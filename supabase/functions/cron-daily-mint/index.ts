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
      job_name: "cron-daily-mint",
      status: "running",
      message: "Starting daily mint job",
    });

    // Invoke sc-mint-epoch
    const { data, error } = await supabase.functions.invoke("sc-mint-epoch", {
      body: {},
    });

    if (error) throw error;

    // Log success
    await supabase.from("automation_logs").insert({
      job_name: "cron-daily-mint",
      status: "success",
      message: `SC minted: ${JSON.stringify(data)}`,
    });

    return new Response(
      JSON.stringify({ ok: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in cron-daily-mint:", e);
    
    await supabase.from("automation_logs").insert({
      job_name: "cron-daily-mint",
      status: "error",
      message: (e as Error).message,
    });

    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
