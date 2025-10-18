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
    // Log start
    await supabase.from("automation_logs").insert({
      job_name: "cron-daily-learn",
      status: "running",
      message: "Starting daily learning cycle",
    });

    // Invoke the auto-learn-cycle function
    const { data, error } = await supabase.functions.invoke("auto-learn-cycle", {
      body: {}
    });

    if (error) throw error;

    // Log success
    await supabase.from("automation_logs").insert({
      job_name: "cron-daily-learn",
      status: "success",
      message: `Learning cycle complete: ${data?.evaluation?.divisions || 0} impacts, ${data?.learning?.updated || 0} weights`,
    });

    return new Response(
      JSON.stringify({ ok: true, result: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in cron-daily-learn:", e);
    
    await supabase.from("automation_logs").insert({
      job_name: "cron-daily-learn",
      status: "error",
      message: (e as Error).message,
    });

    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
