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
    console.log("Triggering live data seed...");

    await supabase.from("automation_logs").insert({
      job_name: "cron-seed-live-data",
      status: "running",
      message: "Starting live data population cron",
    });

    // Invoke the seed-live-data function
    const { data, error } = await supabase.functions.invoke("seed-live-data");

    if (error) throw error;

    await supabase.from("automation_logs").insert({
      job_name: "cron-seed-live-data",
      status: "success",
      message: `Live data cron completed: ${JSON.stringify(data?.results || {})}`,
    });

    return new Response(
      JSON.stringify({ ok: true, result: data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in cron-seed-live-data:", e);
    
    await supabase.from("automation_logs").insert({
      job_name: "cron-seed-live-data",
      status: "error",
      message: (e as Error).message,
    });

    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
