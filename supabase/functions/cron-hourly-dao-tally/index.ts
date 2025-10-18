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
      job_name: "cron-hourly-dao-tally",
      status: "running",
      message: "Starting DAO tally job",
    });

    // Get all active proposals where voting has ended
    const { data: proposals, error: fetchError } = await supabase
      .from("dao_proposals")
      .select("*")
      .eq("status", "active")
      .lt("voting_ends", new Date().toISOString());

    if (fetchError) throw fetchError;

    const results = [];
    
    // Tally each proposal
    for (const proposal of proposals || []) {
      try {
        const { data, error } = await supabase.functions.invoke("dao-tally", {
          body: { proposal_id: proposal.id },
        });

        if (error) throw error;
        
        results.push({ proposal_id: proposal.id, success: true, data });
      } catch (e) {
        results.push({ 
          proposal_id: proposal.id, 
          success: false, 
          error: (e as Error).message 
        });
      }
    }

    // Log success
    await supabase.from("automation_logs").insert({
      job_name: "cron-hourly-dao-tally",
      status: "success",
      message: `Tallied ${results.length} proposals: ${JSON.stringify(results)}`,
    });

    return new Response(
      JSON.stringify({ ok: true, tallied: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in cron-hourly-dao-tally:", e);
    
    await supabase.from("automation_logs").insert({
      job_name: "cron-hourly-dao-tally",
      status: "error",
      message: (e as Error).message,
    });

    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
