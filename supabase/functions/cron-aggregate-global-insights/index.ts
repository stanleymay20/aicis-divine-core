import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    console.log("Starting daily global insights aggregation...");

    // Invoke aggregation and anomaly detection
    const { data: insightsData } = await supabase.functions.invoke('aggregate-global-insights');
    const { data: anomaliesData } = await supabase.functions.invoke('detect-global-anomalies');

    // Log cron execution
    await supabase.from('automation_logs').insert({
      job_name: 'cron-aggregate-global-insights',
      status: 'success',
      message: 'Global insights aggregated and anomalies detected'
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: "Daily global insights aggregation completed",
        insights: insightsData,
        anomalies: anomaliesData
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("cron-aggregate-global-insights error:", e);
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    await supabase.from('automation_logs').insert({
      job_name: 'cron-aggregate-global-insights',
      status: 'failure',
      message: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
    });

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
