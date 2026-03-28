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
      job_name: "cron-hourly-crisis-scan",
      status: "running",
      message: "Starting crisis detection scan",
    });

    const { data, error } = await supabase.functions.invoke("crisis-scan");

    if (error) {
      // Extract the real error message from the response
      const errorMsg = typeof error === 'object' && error.message 
        ? error.message 
        : String(error);
      
      await supabase.from("automation_logs").insert({
        job_name: "cron-hourly-crisis-scan",
        status: "error",
        message: errorMsg.slice(0, 500),
      });

      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiSkipped = data?.ai_skipped ? " (AI credits exhausted)" : "";

    await supabase.from("automation_logs").insert({
      job_name: "cron-hourly-crisis-scan",
      status: "success",
      message: `Crisis scan completed: ${data?.events?.length || 0} events${aiSkipped}`,
    });

    return new Response(
      JSON.stringify({ ok: true, result: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in cron-hourly-crisis-scan:", e);
    
    await supabase.from("automation_logs").insert({
      job_name: "cron-hourly-crisis-scan",
      status: "error",
      message: ((e as Error).message || "Unknown error").slice(0, 500),
    });

    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
