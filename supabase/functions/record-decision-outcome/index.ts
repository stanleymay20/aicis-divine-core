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

    const body = await req.json();
    const {
      decision_id, action_taken, outcome_success, impact_score,
      outcome_description, recommendation_accepted, recommendation_rejected_reason,
      actor_role, cost_of_action: body_cost_of_action,
      outcome_source, execution_note, evidence_note
    } = body;

    if (!decision_id) {
      return new Response(JSON.stringify({ error: "decision_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = { updated_at: now };

    // --- Acceptance tracking ---
    if (recommendation_accepted !== undefined) {
      updatePayload.recommendation_accepted = recommendation_accepted;
      if (!recommendation_accepted && recommendation_rejected_reason) {
        updatePayload.recommendation_rejected_reason = recommendation_rejected_reason;
      }
    }
    if (actor_role) updatePayload.actor_role = actor_role;

    // --- Action tracking ---
    if (action_taken !== undefined) {
      updatePayload.action_taken = action_taken;
      updatePayload.action_taken_at = now;
      updatePayload.action_timestamp = now;
    }
    if (execution_note) updatePayload.execution_note = execution_note;

    // --- Outcome tracking ---
    if (outcome_success !== undefined) {
      updatePayload.outcome_success = outcome_success;
      updatePayload.outcome_timestamp = now;
      if (outcome_source) updatePayload.outcome_source = outcome_source;

      const { data: entry } = await supabase
        .from("decision_outcome_log")
        .select("created_at")
        .eq("id", decision_id)
        .single();
      if (entry?.created_at) {
        updatePayload.time_to_outcome_days = Math.round(
          (Date.now() - new Date(entry.created_at).getTime()) / 86400000
        );
      }
    }

    if (impact_score !== undefined) {
      updatePayload.impact_score = Math.max(0, Math.min(100, impact_score));
    }
    if (outcome_description) updatePayload.measured_outcome = outcome_description;
    if (evidence_note) updatePayload.evidence_note = evidence_note;

    // --- ROI computation ---
    if (impact_score !== undefined) {
      const { data: entry2 } = await supabase
        .from("decision_outcome_log")
        .select("signal_confidence, cost_of_action")
        .eq("id", decision_id)
        .single();
      const conf = (entry2?.signal_confidence || 50) / 100;
      const costVal = body_cost_of_action ?? entry2?.cost_of_action ?? 0;
      const roi = Math.round(impact_score * conf * 10) / 10;
      const net = Math.round((roi - costVal) * 10) / 10;
      updatePayload.roi_estimate = roi;
      updatePayload.net_value = net;
      if (body_cost_of_action !== undefined) updatePayload.cost_of_action = costVal;
    }

    // --- Evidence type promotion ---
    if (outcome_success !== undefined && impact_score !== undefined) {
      updatePayload.evidence_type = "measured";
    } else if (outcome_success !== undefined) {
      updatePayload.evidence_type = "real";
    } else if (action_taken) {
      updatePayload.evidence_type = "pilot";
    }

    const { error: updateError } = await supabase
      .from("decision_outcome_log")
      .update(updatePayload)
      .eq("id", decision_id);

    if (updateError) throw updateError;

    // --- Proxy → Real override pipeline ---
    let proxyOverridden = false;
    if (outcome_success !== undefined) {
      const { data: logEntry } = await supabase
        .from("decision_outcome_log")
        .select("*")
        .eq("id", decision_id)
        .single();

      if (logEntry) {
        // Write real/measured training row
        const labelSource = impact_score !== undefined ? "measured" : "real";
        await supabase.from("decision_training_dataset").insert({
          iso3: logEntry.iso3,
          domain: logEntry.domain,
          features: logEntry.decision_features || {},
          action_type: logEntry.action_type || "unknown",
          outcome_success,
          impact_score: impact_score || null,
          label_source: labelSource,
          source_type: labelSource,
          source_id: decision_id,
          label_confidence: impact_score !== undefined ? 1.0 : 0.9,
        });

        // Override matching proxy rows
        if (logEntry.iso3 && logEntry.domain) {
          const { count } = await supabase
            .from("decision_training_dataset")
            .update({ overridden_by_real: true })
            .eq("iso3", logEntry.iso3)
            .eq("domain", logEntry.domain)
            .eq("label_source", "proxy")
            .eq("overridden_by_real", false)
            .select("*", { count: "exact", head: true });
          proxyOverridden = (count || 0) > 0;
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      evidence_type: updatePayload.evidence_type || "hypothetical",
      proxy_overridden: proxyOverridden,
      message: "Outcome recorded successfully",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Record outcome error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
