import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FN = "batch-seed-regions";

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
    const includeVillages = body.include_villages ?? false;

    // Get already-seeded countries
    const { data: existing } = await supabase
      .from("admin_regions")
      .select("country_iso3")
      .eq("admin_level", 0);

    const seededSet = new Set((existing || []).map((r: any) => r.country_iso3));
    const unseeded = ALL_COUNTRIES.filter(iso3 => !seededSet.has(iso3));

    if (unseeded.length === 0) {
      return new Response(JSON.stringify({
        success: true, message: "All 211 countries seeded!",
        total_seeded: seededSet.size,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Process just 2 countries per invocation to stay within timeout
    const batch = unseeded.slice(0, 2);
    console.log(`[${FN}] Processing: ${batch.join(", ")} (${unseeded.length} remaining)`);

    const results: Record<string, any> = {};

    for (const iso3 of batch) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000);

        const resp = await fetch(`${supabaseUrl}/functions/v1/seed-subnational-regions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ country_iso3: iso3, include_villages: includeVillages }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (resp.ok) {
          results[iso3] = (await resp.json()).results || "ok";
        } else {
          results[iso3] = { error: `HTTP ${resp.status}` };
        }
      } catch (e) {
        results[iso3] = { error: (e as Error).name === "AbortError" ? "timeout" : (e as Error).message };
      }

      // 3s delay between countries
      await new Promise(r => setTimeout(r, 3000));
    }

    const newSeeded = seededSet.size + Object.values(results).filter((r: any) => !r.error).length;
    const remaining = ALL_COUNTRIES.length - newSeeded;

    await supabase.from("automation_logs").insert({
      job_name: FN, status: "success",
      message: `Batch: ${batch.join(",")}. Progress: ${newSeeded}/${ALL_COUNTRIES.length}. Remaining: ${remaining}`,
    });

    // Auto-schedule next batch if remaining
    if (remaining > 0) {
      // Fire-and-forget next batch call
      fetch(`${supabaseUrl}/functions/v1/batch-seed-regions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ include_villages: includeVillages }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({
      success: true,
      batch: batch,
      results,
      progress: `${newSeeded}/${ALL_COUNTRIES.length}`,
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
