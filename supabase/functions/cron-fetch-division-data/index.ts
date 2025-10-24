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

    console.log("Starting hourly division data fetch...");

    const results: any = {
      successes: [],
      failures: []
    };

    // Invoke all data pull functions
    const pullFunctions = [
      'pull-coingecko',
      'pull-owid-energy',
      'pull-faostat-food',
      'pull-owid-health'
    ];

    for (const funcName of pullFunctions) {
      try {
        const { data, error } = await supabase.functions.invoke(funcName);
        if (error) throw error;
        results.successes.push({ function: funcName, data });
        console.log(`✓ ${funcName} completed successfully`);
      } catch (error) {
        results.failures.push({ 
          function: funcName, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        console.error(`✗ ${funcName} failed:`, error);
      }
    }

    // Update division status for all
    await supabase.functions.invoke('update-division-status');

    // Log cron execution
    await supabase.from('automation_logs').insert({
      job_name: 'cron-fetch-division-data',
      status: results.failures.length === 0 ? 'success' : 'partial',
      message: `Fetched data for ${results.successes.length}/${pullFunctions.length} divisions`
    });

    await supabase.from('system_logs').insert({
      level: results.failures.length > 0 ? 'warning' : 'info',
      category: 'cron',
      message: `Hourly data fetch: ${results.successes.length} successes, ${results.failures.length} failures`,
      metadata: results
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: "Hourly division data fetch completed",
        results
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("cron-fetch-division-data error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
