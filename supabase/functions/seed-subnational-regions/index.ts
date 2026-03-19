import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FN = "seed-subnational-regions";

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
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${FN}] Seeding regions for ${country_iso3}`);
    const results = { countries: 0, provinces: 0, districts: 0, villages: 0, errors: [] as string[] };

    // 1. Get country info from Nominatim (search by ISO code)
    const countryResp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${country_iso3}&format=json&limit=1&featuretype=country`,
      { headers: { "User-Agent": "AICIS/2.0" } }
    );
    const countryData = await countryResp.json();
    if (!countryData?.length) throw new Error(`Country ${country_iso3} not found`);

    const country = countryData[0];

    // Insert country (admin level 0)
    const { data: countryRow } = await supabase.from("admin_regions").upsert({
      name: country.display_name?.split(",")[0] || country_iso3,
      admin_level: 0,
      country_iso3: country_iso3.toUpperCase(),
      lat: parseFloat(country.lat),
      lon: parseFloat(country.lon),
      osm_id: parseInt(country.osm_id) || null,
      source: "nominatim",
    }, { onConflict: "osm_id" }).select("id").single();

    results.countries = 1;
    const countryId = countryRow?.id;

    // 2. Get provinces/states (admin_level 4 in OSM)
    const provinceQuery = `[out:json][timeout:45];
area["ISO3166-1:alpha3"="${country_iso3.toUpperCase()}"]->.a;
rel["admin_level"="4"]["boundary"="administrative"](area.a);
out center 300;`;

    const provResp = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(provinceQuery)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const provinceMap = new Map<number, string>(); // osm_id → db_id

    if (provResp.ok) {
      const provData = await provResp.json();
      for (const el of (provData.elements || [])) {
        const name = el.tags?.name || el.tags?.["name:en"];
        const lat = el.center?.lat;
        const lon = el.center?.lon;
        if (!name || !lat || !lon) continue;

        const { data: row } = await supabase.from("admin_regions").upsert({
          name,
          admin_level: 1,
          parent_id: countryId,
          country_iso3: country_iso3.toUpperCase(),
          iso_code: el.tags?.["ISO3166-2"] || null,
          osm_id: el.id,
          lat, lon,
          population_est: parseInt(el.tags?.population) || null,
          source: "overpass",
        }, { onConflict: "osm_id" }).select("id").single();

        if (row) provinceMap.set(el.id, row.id);
        results.provinces++;
      }
    }

    // 3. Get districts (admin_level 6 in OSM)
    const districtQuery = `[out:json][timeout:45];
area["ISO3166-1:alpha3"="${country_iso3.toUpperCase()}"]->.a;
rel["admin_level"="6"]["boundary"="administrative"](area.a);
out center 300;`;

    const distResp = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(districtQuery)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (distResp.ok) {
      const distData = await distResp.json();
      for (const el of (distData.elements || [])) {
        const name = el.tags?.name || el.tags?.["name:en"];
        const lat = el.center?.lat;
        const lon = el.center?.lon;
        if (!name || !lat || !lon) continue;

        // Find nearest province as parent (simplified)
        const { error } = await supabase.from("admin_regions").upsert({
          name,
          admin_level: 2,
          parent_id: countryId, // simplified parent assignment
          country_iso3: country_iso3.toUpperCase(),
          osm_id: el.id,
          lat, lon,
          population_est: parseInt(el.tags?.population) || null,
          source: "overpass",
        }, { onConflict: "osm_id" });

        if (!error) results.districts++;
      }
    }

    // 4. Get villages/settlements
    if (include_villages) {
      const villageQuery = `[out:json][timeout:60];
area["ISO3166-1:alpha3"="${country_iso3.toUpperCase()}"]->.a;
(
  node["place"~"village|hamlet|isolated_dwelling"](area.a);
);
out ${max_villages};`;

      const vilResp = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(villageQuery)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (vilResp.ok) {
        const vilData = await vilResp.json();
        for (const v of (vilData.elements || []).slice(0, max_villages)) {
          const name = v.tags?.name || v.tags?.["name:en"] || `Settlement-${v.id}`;
          if (!v.lat || !v.lon) continue;

          const urbanRural = v.tags?.place === "village" ? "rural" : "rural";

          const { error } = await supabase.from("admin_regions").upsert({
            name,
            admin_level: 4,
            parent_id: countryId,
            country_iso3: country_iso3.toUpperCase(),
            osm_id: v.id,
            lat: v.lat,
            lon: v.lon,
            population_est: parseInt(v.tags?.population) || null,
            urban_rural: urbanRural,
            source: "overpass",
            metadata: { place_type: v.tags?.place },
          }, { onConflict: "osm_id" });

          if (!error) results.villages++;
        }
      }
    }

    const total = results.countries + results.provinces + results.districts + results.villages;
    await supabase.from("automation_logs").insert({
      job_name: FN,
      status: "success",
      message: `Seeded ${total} regions for ${country_iso3}: ${results.provinces} provinces, ${results.districts} districts, ${results.villages} villages`,
    });

    console.log(`[${FN}] Done: ${total} regions for ${country_iso3}`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(`[${FN}] Error:`, e);
    await supabase.from("automation_logs").insert({
      job_name: FN, status: "error", message: (e as Error).message,
    });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
