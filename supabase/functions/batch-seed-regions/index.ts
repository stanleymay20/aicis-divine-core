import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FN = "batch-seed-regions";

// All 211 countries by ISO3
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
    const batchStart = body.batch_start || 0;
    const batchSize = body.batch_size || 10;
    const includeVillages = body.include_villages ?? false;
    const maxVillages = body.max_villages || 200;

    // Get already-seeded countries
    const { data: existing } = await supabase
      .from("admin_regions")
      .select("country_iso3")
      .eq("admin_level", 0);

    const seededSet = new Set((existing || []).map((r: any) => r.country_iso3));

    // Filter to only unseeded countries in this batch
    const batch = ALL_COUNTRIES
      .filter(iso3 => !seededSet.has(iso3))
      .slice(batchStart, batchStart + batchSize);

    if (batch.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: "All countries already seeded or batch empty",
        total_seeded: seededSet.size,
        total_countries: ALL_COUNTRIES.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[${FN}] Processing batch: ${batch.join(", ")} (${batch.length} countries)`);

    const results: Record<string, any> = {};
    let successCount = 0;
    let errorCount = 0;

    for (const iso3 of batch) {
      try {
        // Call seed-subnational-regions directly with a timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 50000); // 50s per country

        const resp = await fetch(`${supabaseUrl}/functions/v1/seed-subnational-regions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            country_iso3: iso3,
            include_villages: includeVillages,
            max_villages: maxVillages,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (resp.ok) {
          const data = await resp.json();
          results[iso3] = data.results || { status: "ok" };
          successCount++;
        } else {
          const errText = await resp.text().catch(() => "unknown");
          results[iso3] = { error: `HTTP ${resp.status}`, detail: errText.slice(0, 200) };
          errorCount++;
        }
      } catch (e) {
        const msg = (e as Error).message || "unknown";
        results[iso3] = { error: msg.includes("abort") ? "timeout" : msg };
        errorCount++;
      }

      // Rate-limit: 2s delay between countries to respect Overpass/Nominatim
      await new Promise(r => setTimeout(r, 2000));
    }

    const totalSeeded = seededSet.size + successCount;

    await supabase.from("automation_logs").insert({
      job_name: FN,
      status: errorCount > 0 ? "partial" : "success",
      message: `Batch complete: ${successCount}/${batch.length} ok, ${errorCount} errors. Total seeded: ${totalSeeded}/${ALL_COUNTRIES.length}`,
    });

    const remaining = ALL_COUNTRIES.length - totalSeeded;

    return new Response(JSON.stringify({
      success: true,
      batch_processed: batch.length,
      success_count: successCount,
      error_count: errorCount,
      total_seeded: totalSeeded,
      total_countries: ALL_COUNTRIES.length,
      remaining,
      next_batch_start: remaining > 0 ? batchStart + batchSize : null,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(`[${FN}] Error:`, e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
