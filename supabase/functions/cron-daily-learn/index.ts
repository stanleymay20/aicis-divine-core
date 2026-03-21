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
      job_name: "cron-daily-learn",
      status: "running",
      message: "Starting daily learning cycle + decision calibration",
    });

    // 1. Run auto-learn-cycle
    const { data: learnData, error: learnErr } = await supabase.functions.invoke("auto-learn-cycle", { body: {} });

    // 2. Run decision weight calibration
    const { data: calData, error: calErr } = await supabase.functions.invoke("calibrate-decision-weights", { body: {} });

    const messages: string[] = [];
    if (learnErr) messages.push(`learn-cycle error: ${learnErr.message}`);
    else messages.push(`learn: ${learnData?.evaluation?.divisions || 0} impacts, ${learnData?.learning?.updated || 0} weights`);

    if (calErr) messages.push(`calibration error: ${calErr.message}`);
    else messages.push(`calibration: v${calData?.version || '?'}, ${calData?.samples?.total || 0} samples, mode=${calData?.training_mode || '?'}`);

    await supabase.from("automation_logs").insert({
      job_name: "cron-daily-learn",
      status: learnErr || calErr ? "partial" : "success",
      message: messages.join(" | "),
    });

    return new Response(
      JSON.stringify({ ok: true, learn: learnData, calibration: calData }),
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
