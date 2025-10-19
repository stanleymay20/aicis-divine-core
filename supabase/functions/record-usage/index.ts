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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { org_id, metric_key, quantity = 1 } = await req.json();
    if (!org_id || !metric_key) {
      throw new Error("Organization ID and metric key are required");
    }

    // Validate metric_key
    const validMetrics = ["api_calls", "scrollcoin_tx"];
    if (!validMetrics.includes(metric_key)) {
      throw new Error(`Invalid metric key. Must be one of: ${validMetrics.join(", ")}`);
    }

    // Record usage in queue
    const { error: queueError } = await supabase
      .from("billing_usage_queue")
      .insert({
        org_id,
        metric_key,
        quantity: Number(quantity),
        processed: false,
      });

    if (queueError) throw queueError;

    // Also update usage_metrics for real-time tracking
    const { error: metricsError } = await supabase
      .from("usage_metrics")
      .insert({
        org_id,
        metric_key,
        metric_value: Number(quantity),
        period_start: new Date().toISOString(),
      });

    if (metricsError) console.error("Error updating usage_metrics:", metricsError);

    return new Response(
      JSON.stringify({ ok: true, recorded: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in record-usage:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
