import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const domains = ["economy", "health", "security", "energy", "food", "governance", "education"];
    const results: Array<{ domain: string; ok: boolean; recommendations?: number; error?: string }> = [];

    for (const domain of domains) {
      try {
        const { data, error } = await supabase.functions.invoke("decision-infer", {
          body: { domain, auto_capture: true },
        });

        if (error) {
          results.push({ domain, ok: false, error: error.message });
        } else {
          results.push({ domain, ok: true, recommendations: data?.recommendations?.length || 0 });
        }
      } catch (e) {
        results.push({ domain, ok: false, error: (e as Error).message });
      }
    }

    const totalRecs = results.filter(r => r.ok).reduce((sum, r) => sum + (r.recommendations || 0), 0);
    const failedDomains = results.filter(r => !r.ok).length;

    await supabase.from("system_logs").insert({
      action: "daily_inference_trigger",
      result: JSON.stringify({ total_recommendations: totalRecs, failed_domains: failedDomains, results }),
      log_level: failedDomains > 0 ? "warning" : "info",
      division: "decision-engine",
    });

    return new Response(JSON.stringify({
      ok: true,
      total_recommendations: totalRecs,
      failed_domains: failedDomains,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Daily inference error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
