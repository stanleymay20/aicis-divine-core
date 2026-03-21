import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { decision_id, action_taken, outcome_success, impact_score, outcome_description } = await req.json();

    if (!decision_id) {
      return new Response(JSON.stringify({ error: "decision_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Update decision_outcome_log
    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = { updated_at: now };

    if (action_taken !== undefined) {
      updatePayload.action_taken = action_taken;
      updatePayload.action_timestamp = now;
    }
    if (outcome_success !== undefined) {
      updatePayload.outcome_success = outcome_success;
      updatePayload.outcome_timestamp = now;
      // Calculate time to outcome
      const { data: entry } = await supabase
        .from("decision_outcome_log")
        .select("created_at")
        .eq("id", decision_id)
        .single();
      if (entry?.created_at) {
        const days = Math.round((Date.now() - new Date(entry.created_at).getTime()) / 86400000);
        updatePayload.time_to_outcome_days = days;
      }
    }
    if (impact_score !== undefined) {
      updatePayload.impact_score = Math.max(0, Math.min(100, impact_score));
    }
    if (outcome_description) {
      updatePayload.measured_outcome = outcome_description;
    }

    // Promote evidence type based on what's recorded
    if (outcome_success !== undefined && impact_score !== undefined) {
      updatePayload.evidence_type = "measured";
    } else if (action_taken) {
      updatePayload.evidence_type = "pilot";
    }

    const { error: updateError } = await supabase
      .from("decision_outcome_log")
      .update(updatePayload)
      .eq("id", decision_id);

    if (updateError) throw updateError;

    // 2. If outcome recorded, write to training dataset
    if (outcome_success !== undefined) {
      const { data: logEntry } = await supabase
        .from("decision_outcome_log")
        .select("*")
        .eq("id", decision_id)
        .single();

      if (logEntry) {
        await supabase.from("decision_training_dataset").insert({
          iso3: logEntry.iso3,
          domain: logEntry.domain,
          features: logEntry.decision_features || {},
          action_type: logEntry.action_type || "unknown",
          outcome_success,
          impact_score: impact_score || null,
          source_type: impact_score !== undefined ? "measured" : "pilot",
          source_id: decision_id,
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      evidence_type: updatePayload.evidence_type || "hypothetical",
      message: "Outcome recorded successfully",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Record outcome error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
