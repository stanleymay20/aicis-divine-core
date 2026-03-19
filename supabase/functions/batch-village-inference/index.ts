import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FN = "batch-village-inference";
const REGIONS_PER_BATCH = 10;

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
    // Step 1: Get ALL covered region IDs using a dedicated RPC or paginated distinct query
    const coveredIds = new Set<string>();
    let offset = 0;
    const PAGE = 1000;
    while (true) {
      const { data } = await supabase
        .from("village_indicators")
        .select("region_id")
        .range(offset, offset + PAGE - 1);
      if (!data || data.length === 0) break;
      for (const r of data) coveredIds.add(r.region_id);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    console.log(`[${FN}] ${coveredIds.size} regions already have indicators`);

    // Step 2: Paginate through ALL regions with coords to find uncovered ones
    const uncovered: any[] = [];
    let regOffset = 0;
    const REG_PAGE = 500;
    while (uncovered.length < REGIONS_PER_BATCH * 2) {
      const { data: batch, error } = await supabase
        .from("admin_regions")
        .select("id, name, admin_level, lat, lon, country_iso3, population_est, urban_rural")
        .not("lat", "is", null)
        .not("lon", "is", null)
        .order("id")
        .range(regOffset, regOffset + REG_PAGE - 1);
      
      if (error) throw error;
      if (!batch || batch.length === 0) break;

      for (const r of batch) {
        if (!coveredIds.has(r.id)) uncovered.push(r);
        if (uncovered.length >= REGIONS_PER_BATCH * 2) break;
      }
      
      if (batch.length < REG_PAGE) break;
      regOffset += REG_PAGE;
    }

    // Count total uncovered (estimate)
    const { count: totalRegions } = await supabase
      .from("admin_regions")
      .select("id", { count: "exact", head: true })
      .not("lat", "is", null)
      .not("lon", "is", null);

    const totalUncovered = (totalRegions || 0) - coveredIds.size;

    if (uncovered.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: `All ${coveredIds.size} regions have indicators!`,
        total_covered: coveredIds.size,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const batch = uncovered.slice(0, REGIONS_PER_BATCH);
    const results = { processed: 0, indicators: 0, errors: [] as string[] };

    for (const region of batch) {
      try {
        const indicators = await generateIndicators(region);
        for (const ind of indicators) {
          const { error } = await supabase.from("village_indicators").insert({
            region_id: region.id,
            domain: ind.domain,
            indicator: ind.indicator,
            value: ind.value,
            unit: ind.unit,
            confidence: ind.confidence,
            data_source: "satellite_inference",
            inference_model: ind.model,
            raw: ind.raw || null,
          });
          if (!error) results.indicators++;
        }
        results.processed++;
      } catch (e) {
        results.errors.push(`${region.name}: ${(e as Error).message}`);
      }
      await new Promise(r => setTimeout(r, 600));
    }

    const remaining = totalUncovered - batch.length;

    await supabase.from("automation_logs").insert({
      job_name: FN, status: results.errors.length > 0 ? "partial" : "success",
      message: `${results.processed}/${batch.length} regions, ${results.indicators} ind. Covered: ${coveredIds.size + results.processed}/${totalRegions}. Remaining: ${remaining}`,
    });

    // Auto-chain
    if (remaining > 0) {
      fetch(`${supabaseUrl}/functions/v1/batch-village-inference`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      success: true, results,
      covered: coveredIds.size + results.processed,
      total_regions: totalRegions,
      remaining,
      auto_continuing: remaining > 0,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(`[${FN}] Error:`, e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function generateIndicators(region: any) {
  const { lat, lon, urban_rural, population_est } = region;
  const indicators: any[] = [];

  // 1. NASA POWER satellite data
  const nasaData = await fetchNASAPower(lat, lon);
  if (nasaData) indicators.push(...nasaData);

  // 2. Nightlight proxy
  const nightlight = estimateNightlightFromCoords(lat, lon, urban_rural, population_est);
  indicators.push({
    domain: "economy", indicator: "nightlight_intensity",
    value: nightlight, unit: "nW/cm²/sr", confidence: 0.55, model: "geo_heuristic_v2",
  });

  // 3. Derived health risk from climate
  const temp = nasaData?.find((i: any) => i.indicator === "avg_temperature_c");
  const humidity = nasaData?.find((i: any) => i.indicator === "relative_humidity_pct");
  const precip = nasaData?.find((i: any) => i.indicator === "daily_precipitation_mm");

  if (temp && humidity) {
    const malariaRisk = (temp.value >= 20 && temp.value <= 35 && humidity.value > 60)
      ? Math.min(10, Math.round((humidity.value - 40) / 6))
      : Math.max(1, Math.round((humidity.value - 30) / 10));
    indicators.push({
      domain: "health", indicator: "vector_disease_risk",
      value: malariaRisk, unit: "1-10", confidence: 0.5, model: "climate_health_proxy_v1",
      raw: { factors: ["temperature", "humidity", "latitude"] },
    });

    const heatStress = temp.value > 35 && humidity.value > 60 ? 9
      : temp.value > 30 && humidity.value > 50 ? 7
      : temp.value > 25 ? 4 : 2;
    indicators.push({
      domain: "health", indicator: "heat_stress_index",
      value: heatStress, unit: "1-10", confidence: 0.7, model: "NASA_POWER_derived",
    });
  }

  if (precip) {
    const floodRisk = precip.value > 8 ? 9 : precip.value > 5 ? 7 : precip.value > 3 ? 4 : 2;
    indicators.push({
      domain: "environment", indicator: "flood_risk_index",
      value: floodRisk, unit: "1-10", confidence: 0.5, model: "precip_flood_proxy_v1",
    });
  }

  // 4. Solar potential
  const solar = nasaData?.find((i: any) => i.indicator === "solar_irradiance");
  if (solar) {
    indicators.push({
      domain: "infrastructure", indicator: "solar_energy_potential",
      value: solar.value > 6 ? 9 : solar.value > 4.5 ? 7 : solar.value > 3 ? 5 : 3,
      unit: "1-10", confidence: 0.75, model: "NASA_POWER_derived",
    });
  }

  // 5. Economic development proxy
  const econIndex = Math.min(10, Math.max(1, Math.round(Math.log2(nightlight + 1) * 2)));
  indicators.push({
    domain: "economy", indicator: "development_index_proxy",
    value: econIndex, unit: "1-10", confidence: 0.45, model: "nightlight_econ_v1",
  });

  return indicators;
}

async function fetchNASAPower(lat: number, lon: number) {
  try {
    const today = new Date();
    const endDate = new Date(today.getTime() - 7 * 86400000);
    const startDate = new Date(endDate.getTime() - 30 * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

    const params = "T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN,RH2M,WS2M";
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?start=${fmt(startDate)}&end=${fmt(endDate)}&latitude=${lat}&longitude=${lon}&community=AG&parameters=${params}&format=JSON`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) return null;
    const data = await resp.json();
    const p = data.properties?.parameter || {};

    const avg = (obj: Record<string, number>) => {
      const vals = Object.values(obj).filter(v => v !== -999);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : null;
    };

    const indicators: any[] = [];
    const t2m = avg(p.T2M || {});
    if (t2m !== null) indicators.push({ domain: "environment", indicator: "avg_temperature_c", value: t2m, unit: "°C", confidence: 0.85, model: "NASA_POWER_v2" });
    const precipVal = avg(p.PRECTOTCORR || {});
    if (precipVal !== null) indicators.push({ domain: "environment", indicator: "daily_precipitation_mm", value: precipVal, unit: "mm/day", confidence: 0.8, model: "NASA_POWER_v2" });
    const solarVal = avg(p.ALLSKY_SFC_SW_DWN || {});
    if (solarVal !== null) indicators.push({ domain: "environment", indicator: "solar_irradiance", value: solarVal, unit: "kWh/m²/day", confidence: 0.85, model: "NASA_POWER_v2" });
    const rh = avg(p.RH2M || {});
    if (rh !== null) indicators.push({ domain: "health", indicator: "relative_humidity_pct", value: rh, unit: "%", confidence: 0.8, model: "NASA_POWER_v2" });
    const wind = avg(p.WS2M || {});
    if (wind !== null) indicators.push({ domain: "environment", indicator: "wind_speed_2m", value: wind, unit: "m/s", confidence: 0.8, model: "NASA_POWER_v2" });

    return indicators;
  } catch {
    return null;
  }
}

function estimateNightlightFromCoords(lat: number, lon: number, urbanRural: string | null, pop: number | null): number {
  let base = urbanRural === "urban" ? 35 : urbanRural === "rural" ? 2.5 : 8;
  if (pop && pop > 100000) base *= 1.5;
  else if (pop && pop > 10000) base *= 1.2;
  const variation = Math.abs(Math.cos(lat * Math.PI / 180)) * 3;
  return Math.round((base + variation) * 10) / 10;
}
