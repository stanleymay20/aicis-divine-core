import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FN = "batch-seed-regions";
const BATCH_SIZE = 5;

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

async function seedOneCountry(supabase: any, iso3: string) {
  const res = { provinces: 0, districts: 0 };

  const cResp = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${iso3}&format=json&limit=1&featuretype=country`,
    { headers: { "User-Agent": "AICIS/2.0" } }
  );
  const cData = await cResp.json().catch(() => []);

  let countryId: string | null = null;
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

  // Provinces (admin_level 4)
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

  // Districts (admin_level 6)
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
    const { data: existing } = await supabase
      .from("admin_regions").select("country_iso3").eq("admin_level", 0);
    const seededSet = new Set((existing || []).map((r: any) => r.country_iso3));
    const unseeded = ALL_COUNTRIES.filter(iso3 => !seededSet.has(iso3));

    if (unseeded.length === 0) {
      // All done — trigger batch inference
      fetch(`${supabaseUrl}/functions/v1/batch-village-inference`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});

      return new Response(JSON.stringify({
        success: true, message: "All 211 countries seeded! Starting inference pipeline.",
        total_seeded: seededSet.size,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Process batch
    const batch = unseeded.slice(0, BATCH_SIZE);
    const batchResults: Record<string, any> = {};

    for (const iso3 of batch) {
      console.log(`[${FN}] Seeding ${iso3} (${seededSet.size + Object.keys(batchResults).length + 1}/${ALL_COUNTRIES.length})`);
      try {
        batchResults[iso3] = await seedOneCountry(supabase, iso3);
      } catch (e) {
        batchResults[iso3] = { error: (e as Error).message };
      }
      // 1.5s delay between countries to respect Nominatim rate limits
      await new Promise(r => setTimeout(r, 1500));
    }

    const progress = seededSet.size + batch.length;
    await supabase.from("automation_logs").insert({
      job_name: FN, status: "success",
      message: `Batch: ${batch.join(",")}. Progress: ${progress}/${ALL_COUNTRIES.length}. ${JSON.stringify(batchResults)}`,
    });

    // Auto-chain
    const remaining = unseeded.length - batch.length;
    if (remaining > 0) {
      fetch(`${supabaseUrl}/functions/v1/batch-seed-regions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      success: true, batch: batchResults,
      progress: `${progress}/${ALL_COUNTRIES.length}`,
      remaining, auto_continuing: remaining > 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(`[${FN}] Error:`, e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
