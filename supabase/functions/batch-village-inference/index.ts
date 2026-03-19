import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FN = "batch-village-inference";
const REGIONS_PER_BATCH = 8;

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
    // Find regions that have coordinates but NO indicators yet
    // Use a left join approach: get regions not in village_indicators
    const { data: coveredData } = await supabase
      .from("village_indicators")
      .select("region_id")
      .limit(1000);
    
    const coveredIds = new Set((coveredData || []).map((r: any) => r.region_id));

    const { data: allRegions, error: regErr } = await supabase
      .from("admin_regions")
      .select("id, name, admin_level, lat, lon, country_iso3, population_est, urban_rural")
      .not("lat", "is", null)
      .not("lon", "is", null)
      .limit(200);

    if (regErr) throw regErr;

    const uncovered = (allRegions || []).filter((r: any) => !coveredIds.has(r.id));

    if (uncovered.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "All regions have indicators!",
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
      // Small delay to avoid NASA rate limits
      await new Promise(r => setTimeout(r, 500));
    }

    await supabase.from("automation_logs").insert({
      job_name: FN, status: results.errors.length > 0 ? "partial" : "success",
      message: `${results.processed}/${batch.length} regions, ${results.indicators} indicators. Remaining: ${uncovered.length - batch.length}. Errors: ${results.errors.length}`,
    });

    // Auto-chain if more regions remain
    const remaining = uncovered.length - batch.length;
    if (remaining > 0) {
      fetch(`${supabaseUrl}/functions/v1/batch-village-inference`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      success: true, results,
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
  const { lat, lon, name, country_iso3, admin_level, population_est, urban_rural } = region;
  const indicators: any[] = [];

  // 1. NASA POWER satellite data
  const nasaData = await fetchNASAPower(lat, lon);
  if (nasaData) indicators.push(...nasaData);

  // 2. Nightlight proxy
  const nightlight = estimateNightlightFromCoords(lat, lon, urban_rural, population_est);
  indicators.push({
    domain: "economy",
    indicator: "nightlight_intensity",
    value: nightlight,
    unit: "nW/cm²/sr",
    confidence: 0.55,
    model: "geo_heuristic_v2",
  });

  // 3. Derived health risk from climate
  const temp = nasaData?.find((i: any) => i.indicator === "avg_temperature_c");
  const humidity = nasaData?.find((i: any) => i.indicator === "relative_humidity_pct");
  const precip = nasaData?.find((i: any) => i.indicator === "daily_precipitation_mm");

  if (temp && humidity) {
    // Malaria risk proxy (tropical, high humidity, moderate temp)
    const malariaRisk = (temp.value >= 20 && temp.value <= 35 && humidity.value > 60)
      ? Math.min(10, Math.round((humidity.value - 40) / 6))
      : Math.max(1, Math.round((humidity.value - 30) / 10));
    indicators.push({
      domain: "health",
      indicator: "vector_disease_risk",
      value: malariaRisk,
      unit: "1-10",
      confidence: 0.5,
      model: "climate_health_proxy_v1",
      raw: { factors: ["temperature", "humidity", "latitude"] },
    });

    // Heat stress
    const heatStress = temp.value > 35 && humidity.value > 60 ? 9
      : temp.value > 30 && humidity.value > 50 ? 7
      : temp.value > 25 ? 4 : 2;
    indicators.push({
      domain: "health",
      indicator: "heat_stress_index",
      value: heatStress,
      unit: "1-10",
      confidence: 0.7,
      model: "NASA_POWER_derived",
    });
  }

  if (precip) {
    // Flood risk proxy
    const floodRisk = precip.value > 8 ? 9 : precip.value > 5 ? 7 : precip.value > 3 ? 4 : 2;
    indicators.push({
      domain: "environment",
      indicator: "flood_risk_index",
      value: floodRisk,
      unit: "1-10",
      confidence: 0.5,
      model: "precip_flood_proxy_v1",
    });
  }

  // 4. Solar potential
  const solar = nasaData?.find((i: any) => i.indicator === "solar_irradiance");
  if (solar) {
    indicators.push({
      domain: "infrastructure",
      indicator: "solar_energy_potential",
      value: solar.value > 6 ? 9 : solar.value > 4.5 ? 7 : solar.value > 3 ? 5 : 3,
      unit: "1-10",
      confidence: 0.75,
      model: "NASA_POWER_derived",
    });
  }

  // 5. Economic development proxy from nightlight
  const econIndex = Math.min(10, Math.max(1, Math.round(Math.log2(nightlight + 1) * 2)));
  indicators.push({
    domain: "economy",
    indicator: "development_index_proxy",
    value: econIndex,
    unit: "1-10",
    confidence: 0.45,
    model: "nightlight_econ_v1",
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

    const precip = avg(p.PRECTOTCORR || {});
    if (precip !== null) indicators.push({ domain: "environment", indicator: "daily_precipitation_mm", value: precip, unit: "mm/day", confidence: 0.8, model: "NASA_POWER_v2" });

    const solar = avg(p.ALLSKY_SFC_SW_DWN || {});
    if (solar !== null) indicators.push({ domain: "environment", indicator: "solar_irradiance", value: solar, unit: "kWh/m²/day", confidence: 0.85, model: "NASA_POWER_v2" });

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
  // Latitude variation
  const variation = Math.abs(Math.cos(lat * Math.PI / 180)) * 3;
  return Math.round((base + variation) * 10) / 10;
}
