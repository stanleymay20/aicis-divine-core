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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Run health check
    await supabase.functions.invoke("enterprise-health-check");

    // Cleanup old rate limits
    await supabase.rpc("cleanup_rate_limits");

    // Cleanup expired exports
    await supabase.rpc("cleanup_expired_exports");

    // Check for critical security events in last hour
    const { data: criticalEvents } = await supabase
      .from("audit_log")
      .select("*")
      .eq("severity", "critical")
      .gte("created_at", new Date(Date.now() - 3600000).toISOString());

    if (criticalEvents && criticalEvents.length > 0) {
      console.warn(`⚠️ ${criticalEvents.length} critical security events in last hour`);
      // In production: send alert to ops team
    }

    return new Response(
      JSON.stringify({
        ok: true,
        timestamp: new Date().toISOString(),
        critical_events: criticalEvents?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in cron-enterprise-health:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
