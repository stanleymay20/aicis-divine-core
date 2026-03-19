import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FN = "seed-subnational-regions";

async function insertRegion(supabase: any, data: any): Promise<string | null> {
  // Check if already exists by osm_id
  if (data.osm_id) {
    const { data: existing } = await supabase
      .from("admin_regions")
      .select("id")
      .eq("osm_id", data.osm_id)
      .maybeSingle();
    if (existing) return existing.id;
  }

  const { data: row, error } = await supabase
    .from("admin_regions")
    .insert(data)
    .select("id")
    .single();

  if (error) {
    console.warn(`Insert failed for ${data.name}:`, error.message);
    return null;
  }
  return row?.id || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { country_iso3, include_villages = true, max_villages = 500 } = await req.json();
    if (!country_iso3) {
      return new Response(JSON.stringify({ error: "country_iso3 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const iso3 = country_iso3.toUpperCase();
    console.log(`[${FN}] Seeding regions for ${iso3}`);
    const results = { countries: 0, provinces: 0, districts: 0, villages: 0, errors: [] as string[] };

    // 1. Country from Nominatim
    const countryResp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${iso3}&format=json&limit=1&featuretype=country`,
      { headers: { "User-Agent": "AICIS/2.0" } }
    );
    const countryData = await countryResp.json();
    if (!countryData?.length) throw new Error(`Country ${iso3} not found`);
    const c = countryData[0];

    const countryId = await insertRegion(supabase, {
      name: c.display_name?.split(",")[0] || iso3,
      admin_level: 0,
      country_iso3: iso3,
      lat: parseFloat(c.lat),
      lon: parseFloat(c.lon),
      osm_id: parseInt(c.osm_id) || null,
      source: "nominatim",
    });
    results.countries = 1;

    // 2. Provinces (OSM admin_level 4)
    try {
      const q = `[out:json][timeout:45];area["ISO3166-1:alpha3"="${iso3}"]->.a;rel["admin_level"="4"]["boundary"="administrative"](area.a);out center 300;`;
      const resp = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(q)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const el of (data.elements || [])) {
          const name = el.tags?.name || el.tags?.["name:en"];
          const lat = el.center?.lat; const lon = el.center?.lon;
          if (!name || !lat || !lon) continue;
          const id = await insertRegion(supabase, {
            name, admin_level: 1, parent_id: countryId, country_iso3: iso3,
            iso_code: el.tags?.["ISO3166-2"] || null, osm_id: el.id,
            lat, lon, population_est: parseInt(el.tags?.population) || null, source: "overpass",
          });
          if (id) results.provinces++;
        }
      }
    } catch (e) { results.errors.push(`Provinces: ${(e as Error).message}`); }

    // 3. Districts (OSM admin_level 6)
    try {
      const q = `[out:json][timeout:45];area["ISO3166-1:alpha3"="${iso3}"]->.a;rel["admin_level"="6"]["boundary"="administrative"](area.a);out center 300;`;
      const resp = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(q)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const el of (data.elements || [])) {
          const name = el.tags?.name || el.tags?.["name:en"];
          const lat = el.center?.lat; const lon = el.center?.lon;
          if (!name || !lat || !lon) continue;
          const id = await insertRegion(supabase, {
            name, admin_level: 2, parent_id: countryId, country_iso3: iso3,
            osm_id: el.id, lat, lon,
            population_est: parseInt(el.tags?.population) || null, source: "overpass",
          });
          if (id) results.districts++;
        }
      }
    } catch (e) { results.errors.push(`Districts: ${(e as Error).message}`); }

    // 4. Villages
    if (include_villages) {
      try {
        const q = `[out:json][timeout:60];area["ISO3166-1:alpha3"="${iso3}"]->.a;(node["place"~"village|hamlet|town|isolated_dwelling"](area.a););out ${max_villages};`;
        const resp = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: `data=${encodeURIComponent(q)}`,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        if (resp.ok) {
          const data = await resp.json();
          for (const v of (data.elements || []).slice(0, max_villages)) {
            const name = v.tags?.name || v.tags?.["name:en"] || `Settlement-${v.id}`;
            if (!v.lat || !v.lon) continue;
            const urbanRural = v.tags?.place === "town" ? "urban" : "rural";
            const id = await insertRegion(supabase, {
              name, admin_level: 4, parent_id: countryId, country_iso3: iso3,
              osm_id: v.id, lat: v.lat, lon: v.lon,
              population_est: parseInt(v.tags?.population) || null,
              urban_rural: urbanRural, source: "overpass",
              metadata: { place_type: v.tags?.place },
            });
            if (id) results.villages++;
          }
        }
      } catch (e) { results.errors.push(`Villages: ${(e as Error).message}`); }
    }

    const total = results.countries + results.provinces + results.districts + results.villages;
    await supabase.from("automation_logs").insert({
      job_name: FN, status: "success",
      message: `Seeded ${total} regions for ${iso3}: ${results.provinces}P/${results.districts}D/${results.villages}V`,
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[${FN}] Error:`, e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
