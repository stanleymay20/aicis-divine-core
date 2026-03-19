import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FN = "batch-seed-regions";
const BATCH_SIZE = 3; // fewer per batch since we now also seed villages

const ALL_COUNTRIES = [
  "AFG","ALB","DZA","AND","AGO","ATG","ARG","ARM","AUS","AUT","AZE","BHS","BHR","BGD","BRB",
  "BLR","BEL","BLZ","BEN","BTN","BOL","BIH","BWA","BRA","BRN","BGR","BFA","BDI","CPV","KHM",
  "CMR","CAN","CAF","TCD","CHL","CHN","COL","COM","COG","COD","CRI","CIV","HRV","CUB","CYP",
  "CZE","DNK","DJI","DMA","DOM","ECU","EGY","SLV","GNQ","ERI","EST","SWZ","ETH","FJI","FIN",
  "FRA","GAB","GMB","GEO","DEU","GHA","GRC","GRD","GTM","GIN","GNB","GUY","HTI","HND","HUN",
  "ISL","IND","IDN","IRN","IRQ","IRL","ISR","ITA","JAM","JPN","JOR","KAZ","KEN","KIR","PRK",
  "KOR","KWT","KGZ","LAO","LVA","LBN","LSO","LBR","LBY","LIE","LTU","LUX","MDG","MWI","MYS",
  "MDV","MLI","MLT","MHL","MRT","MUS","MEX","FSM","MDA","MCO","MNG","MNE","MAR","MOZ","MMR",
  "NAM","NRU","NPL","NLD","NZL","NIC","NER","NGA","MKD","NOR","OMN","PAK","PLW","PAN","PNG",
  "PRY","PER","PHL","POL","PRT","QAT","ROU","RUS","RWA","KNA","LCA","VCT","WSM","SMR","STP",
  "SAU","SEN","SRB","SYC","SLE","SGP","SVK","SVN","SLB","SOM","ZAF","SSD","ESP","LKA","SDN",
  "SUR","SWE","CHE","SYR","TWN","TJK","TZA","THA","TLS","TGO","TON","TTO","TUN","TUR","TKM",
  "TUV","UGA","UKR","ARE","GBR","USA","URY","UZB","VUT","VEN","VNM","YEM","ZMB","ZWE"
];

async function insertRegion(supabase: any, data: any): Promise<string | null> {
  if (data.osm_id) {
    const { data: existing } = await supabase
      .from("admin_regions").select("id").eq("osm_id", data.osm_id).maybeSingle();
    if (existing) return existing.id;
  }
  const { data: row, error } = await supabase
    .from("admin_regions").insert(data).select("id").single();
  if (error) return null;
  return row?.id || null;
}

async function overpass(query: string): Promise<any[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return [];
    return (await resp.json()).elements || [];
  } catch { clearTimeout(timer); return []; }
}

async function seedOneCountry(supabase: any, iso3: string, seedVillages: boolean) {
  const res = { provinces: 0, districts: 0, villages: 0 };

  // Check if country already exists
  const { data: existCheck } = await supabase
    .from("admin_regions").select("id").eq("country_iso3", iso3).eq("admin_level", 0).maybeSingle();

  let countryId: string | null = existCheck?.id || null;

  if (!countryId) {
    const cResp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${iso3}&format=json&limit=1&featuretype=country`,
      { headers: { "User-Agent": "AICIS/2.0" } }
    );
    const cData = await cResp.json().catch(() => []);

    if (cData?.length) {
      const c = cData[0];
      countryId = await insertRegion(supabase, {
        name: c.display_name?.split(",")[0] || iso3,
        admin_level: 0, country_iso3: iso3,
        lat: parseFloat(c.lat), lon: parseFloat(c.lon),
        osm_id: parseInt(c.osm_id) || null, source: "nominatim",
      });
    } else {
      const { data: row } = await supabase.from("admin_regions")
        .insert({ name: iso3, admin_level: 0, country_iso3: iso3, source: "fallback" })
        .select("id").single();
      countryId = row?.id || null;
    }
  }

  // Check if provinces already seeded
  const { count: provCount } = await supabase
    .from("admin_regions").select("id", { count: "exact", head: true })
    .eq("country_iso3", iso3).eq("admin_level", 1);

  if (!provCount || provCount === 0) {
    const provs = await overpass(
      `[out:json][timeout:12];area["ISO3166-1:alpha3"="${iso3}"]->.a;rel["admin_level"="4"]["boundary"="administrative"](area.a);out center 150;`
    );
    for (const el of provs) {
      const name = el.tags?.name || el.tags?.["name:en"];
      if (!name || !el.center?.lat) continue;
      const id = await insertRegion(supabase, {
        name, admin_level: 1, parent_id: countryId, country_iso3: iso3,
        osm_id: el.id, lat: el.center.lat, lon: el.center.lon,
        iso_code: el.tags?.["ISO3166-2"] || null, source: "overpass",
      });
      if (id) res.provinces++;
    }
  }

  // Check if districts already seeded
  const { count: distCount } = await supabase
    .from("admin_regions").select("id", { count: "exact", head: true })
    .eq("country_iso3", iso3).eq("admin_level", 2);

  if (!distCount || distCount === 0) {
    const dists = await overpass(
      `[out:json][timeout:12];area["ISO3166-1:alpha3"="${iso3}"]->.a;rel["admin_level"="6"]["boundary"="administrative"](area.a);out center 200;`
    );
    for (const el of dists) {
      const name = el.tags?.name || el.tags?.["name:en"];
      if (!name || !el.center?.lat) continue;
      await insertRegion(supabase, {
        name, admin_level: 2, parent_id: countryId, country_iso3: iso3,
        osm_id: el.id, lat: el.center.lat, lon: el.center.lon, source: "overpass",
      });
      res.districts++;
    }
  }

  // Seed villages (admin_level 3 = towns, admin_level 4 = villages/hamlets)
  if (seedVillages) {
    const { count: vilCount } = await supabase
      .from("admin_regions").select("id", { count: "exact", head: true })
      .eq("country_iso3", iso3).gte("admin_level", 3);

    if (!vilCount || vilCount === 0) {
      const MAX_VILLAGES = 150;
      const vilElements = await overpass(
        `[out:json][timeout:15];area["ISO3166-1:alpha3"="${iso3}"]->.a;(node["place"~"village|hamlet|town|city"](area.a););out ${MAX_VILLAGES};`
      );
      for (const v of vilElements.slice(0, MAX_VILLAGES)) {
        const name = v.tags?.name || v.tags?.["name:en"] || `Settlement-${v.id}`;
        if (!v.lat || !v.lon) continue;
        const placeType = v.tags?.place || "village";
        const adminLvl = (placeType === "city" || placeType === "town") ? 3 : 4;
        await insertRegion(supabase, {
          name, admin_level: adminLvl, parent_id: countryId, country_iso3: iso3,
          osm_id: v.id, lat: v.lat, lon: v.lon,
          population_est: parseInt(v.tags?.population) || null,
          urban_rural: (placeType === "city" || placeType === "town") ? "urban" : "rural",
          source: "overpass",
          metadata: { place_type: placeType },
        });
        res.villages++;
      }
    }
  }

  return res;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "full"; // "full" = provinces + districts + villages

    // Step 1: Get countries with level-0 entries (already seeded)
    const seededCountries = new Set<string>();
    let offset = 0;
    while (true) {
      const { data } = await supabase
        .from("admin_regions").select("country_iso3")
        .eq("admin_level", 0)
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) seededCountries.add(r.country_iso3);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // Step 2: Get countries that have villages (level 3 or 4)
    const villageCountries = new Set<string>();
    offset = 0;
    while (true) {
      const { data } = await supabase
        .from("admin_regions").select("country_iso3")
        .gte("admin_level", 3)
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) villageCountries.add(r.country_iso3);
      if (data.length < 1000) break;
      offset += 1000;
    }

    const unseeded = ALL_COUNTRIES.filter(iso3 => !seededCountries.has(iso3));
    const needsVillages = ALL_COUNTRIES.filter(iso3 => seededCountries.has(iso3) && !villageCountries.has(iso3));

    let batch: string[];
    let phase: string;

    console.log(`[${FN}] Unseeded: ${unseeded.length}, Needs villages: ${needsVillages.length}`);

    if (unseeded.length > 0) {
      batch = unseeded.slice(0, BATCH_SIZE);
      phase = "seeding";
    } else if (needsVillages.length > 0) {
      batch = needsVillages.slice(0, BATCH_SIZE);
      phase = "villages";
    } else {
      // All done — trigger inference
      fetch(`${supabaseUrl}/functions/v1/batch-village-inference`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});

      return new Response(JSON.stringify({
        success: true,
        message: "All 211 countries fully seeded with villages! Starting inference.",
        total_countries: seededSet.size,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const batchResults: Record<string, any> = {};

    for (const iso3 of batch) {
      console.log(`[${FN}] [${phase}] ${iso3}`);
      try {
        batchResults[iso3] = await seedOneCountry(supabase, iso3, true);
      } catch (e) {
        batchResults[iso3] = { error: (e as Error).message };
      }
      await new Promise(r => setTimeout(r, 1500));
    }

    const totalRemaining = (phase === "seeding")
      ? (unseeded.length - batch.length) + needsVillages.length
      : needsVillages.length - batch.length;

    await supabase.from("automation_logs").insert({
      job_name: FN, status: "success",
      message: `[${phase}] ${batch.join(",")}. Remaining: ${totalRemaining}. ${JSON.stringify(batchResults)}`,
    });

    // Auto-chain
    if (totalRemaining > 0) {
      fetch(`${supabaseUrl}/functions/v1/batch-seed-regions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      success: true, phase, batch: batchResults,
      remaining: totalRemaining,
      auto_continuing: totalRemaining > 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(`[${FN}] Error:`, e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
