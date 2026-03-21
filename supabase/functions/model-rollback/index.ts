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

    // 1. Get current active model
    const { data: activeModel } = await supabase
      .from("decision_models")
      .select("version, last_calibrated_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeModel) {
      return new Response(JSON.stringify({ ok: false, error: "No active model to rollback" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Find latest valid prior model (not rejected, not current)
    const { data: priorModel } = await supabase
      .from("decision_models")
      .select("version")
      .neq("version", activeModel.version)
      .neq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!priorModel) {
      return new Response(JSON.stringify({ ok: false, error: "No valid prior model to rollback to" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get evaluation data for audit
    const { data: eval_ } = await supabase
      .from("model_evaluations")
      .select("improvement_over_heuristic, calibration_error, acceptance_rate")
      .eq("model_version", activeModel.version)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Get rollback reason from model or determine
    const { data: modelData } = await supabase
      .from("decision_models")
      .select("rollback_reason")
      .eq("version", activeModel.version)
      .single();

    const reason = modelData?.rollback_reason || "Manual rollback or auto-detected regression";

    // 5. Supersede current active model
    await supabase
      .from("decision_models")
      .update({
        status: "superseded",
        rollback_required: false,
        rolled_back_from_version: priorModel.version,
      })
      .eq("version", activeModel.version);

    // 6. Promote prior model
    await supabase
      .from("decision_models")
      .update({ status: "active", promoted_from_version: activeModel.version })
      .eq("version", priorModel.version);

    // 7. Log rollback immutably
    await supabase.from("model_rollback_history").insert({
      rolled_back_version: activeModel.version,
      rolled_back_to_version: priorModel.version,
      rollback_reason: reason,
      triggered_by: "system",
      improvement_over_heuristic: eval_?.improvement_over_heuristic,
      calibration_error: eval_?.calibration_error,
    });

    // 8. Log to system_logs
    await supabase.from("system_logs").insert({
      action: "model_rollback",
      result: JSON.stringify({
        from: activeModel.version,
        to: priorModel.version,
        reason,
      }),
      log_level: "warn",
      division: "decision-engine",
    });

    return new Response(JSON.stringify({
      ok: true,
      rolled_back_from: activeModel.version,
      rolled_back_to: priorModel.version,
      reason,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Model rollback error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
