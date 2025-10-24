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

    console.log("Starting 3-hourly division status update...");

    // Invoke update function
    const { data, error } = await supabase.functions.invoke('update-division-status');
    
    if (error) throw error;

    // Log cron execution
    await supabase.from('automation_logs').insert({
      job_name: 'cron-update-division-status',
      status: 'success',
      message: 'Division status updated successfully'
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: "Division status update completed",
        data
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("cron-update-division-status error:", e);
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    await supabase.from('automation_logs').insert({
      job_name: 'cron-update-division-status',
      status: 'failure',
      message: `Error: ${e instanceof Error ? e.message : 'Unknown error'}`
    });

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
