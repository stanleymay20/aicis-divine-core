import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    await supabase.from("automation_logs").insert({
      job_name: "cron-global-intelligence",
      status: "running",
      message: "Starting global data collection cycle",
    });

    const results = {
      finance: null,
      security: null,
      health: null,
      food: null,
      governance: null,
      errors: []
    };

    // Invoke all data collection functions in parallel
    const [financeRes, securityRes, healthRes, foodRes, governanceRes] = await Promise.allSettled([
      supabase.functions.invoke("fetch-finance-global"),
      supabase.functions.invoke("fetch-security-global"),
      supabase.functions.invoke("fetch-health-global"),
      supabase.functions.invoke("fetch-food-global"),
      supabase.functions.invoke("fetch-governance-global")
    ]);

    // Process results
    if (financeRes.status === 'fulfilled') results.finance = financeRes.value.data;
    else results.errors.push(`Finance: ${financeRes.reason}`);

    if (securityRes.status === 'fulfilled') results.security = securityRes.value.data;
    else results.errors.push(`Security: ${securityRes.reason}`);

    if (healthRes.status === 'fulfilled') results.health = healthRes.value.data;
    else results.errors.push(`Health: ${healthRes.reason}`);

    if (foodRes.status === 'fulfilled') results.food = foodRes.value.data;
    else results.errors.push(`Food: ${foodRes.reason}`);

    if (governanceRes.status === 'fulfilled') results.governance = governanceRes.value.data;
    else results.errors.push(`Governance: ${governanceRes.reason}`);

    // Trigger vulnerability calculation
    await supabase.functions.invoke("calculate-vulnerability");

    // Log success
    await supabase.from("automation_logs").insert({
      job_name: "cron-global-intelligence",
      status: results.errors.length === 0 ? "success" : "partial",
      message: `Global data collection complete. Errors: ${results.errors.length}`,
    });

    return new Response(
      JSON.stringify({ ok: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in cron-global-intelligence:", e);
    
    await supabase.from("automation_logs").insert({
      job_name: "cron-global-intelligence",
      status: "error",
      message: (e as Error).message,
    });

    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
