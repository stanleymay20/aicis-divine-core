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

    // 1. Get active + previous models
    const { data: models } = await supabase
      .from("decision_models")
      .select("id, version, status, training_mode, training_sample_count, proxy_sample_count, real_sample_count, measured_sample_count")
      .in("status", ["active", "superseded"])
      .order("created_at", { ascending: false })
      .limit(2);

    const activeModel = models?.find(m => m.status === "active");
    const previousModel = models?.find(m => m.status === "superseded");

    if (!activeModel) {
      return new Response(JSON.stringify({ ok: true, message: "No active model to evaluate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load training dataset
    const { data: trainingData } = await supabase
      .from("decision_training_dataset")
      .select("label_source, outcome_success, impact_score")
      .eq("overridden_by_real", false)
      .limit(5000);

    const rows = trainingData || [];
    const proxyRows = rows.filter(r => r.label_source === "proxy");
    const realRows = rows.filter(r => r.label_source === "real" || r.label_source === "measured");
    const measuredRows = rows.filter(r => r.label_source === "measured");

    const successRate = (arr: typeof rows) => {
      const withOutcome = arr.filter(r => r.outcome_success !== null);
      return withOutcome.length > 0 ? withOutcome.filter(r => r.outcome_success).length / withOutcome.length : null;
    };

    // 3. Load outcome log for acceptance tracking
    const { data: outcomes } = await supabase
      .from("decision_outcome_log")
      .select("recommendation_accepted, outcome_success, impact_score, evidence_type, signal_confidence")
      .not("action_type", "is", null)
      .limit(2000);

    const outcomeRows = outcomes || [];
    const withAcceptance = outcomeRows.filter(r => r.recommendation_accepted !== null);
    const acceptanceRate = withAcceptance.length > 0
      ? withAcceptance.filter(r => r.recommendation_accepted).length / withAcceptance.length
      : null;

    // 4. Confidence calibration: bucket predicted confidence vs actual outcomes
    const buckets: Record<string, { predicted: number; actual: number; count: number }> = {};
    for (const row of outcomeRows) {
      if (row.signal_confidence == null || row.outcome_success == null) continue;
      const bucket = `${Math.floor(row.signal_confidence / 10) * 10}-${Math.floor(row.signal_confidence / 10) * 10 + 10}`;
      if (!buckets[bucket]) buckets[bucket] = { predicted: 0, actual: 0, count: 0 };
      buckets[bucket].count++;
      buckets[bucket].predicted += row.signal_confidence / 100;
      buckets[bucket].actual += row.outcome_success ? 1 : 0;
    }

    // Compute calibration error (ECE - Expected Calibration Error)
    let calibrationError: number | null = null;
    const bucketEntries = Object.values(buckets);
    if (bucketEntries.length > 0) {
      const totalSamples = bucketEntries.reduce((s, b) => s + b.count, 0);
      calibrationError = bucketEntries.reduce((ece, b) => {
        const avgPred = b.predicted / b.count;
        const avgActual = b.actual / b.count;
        return ece + (b.count / totalSamples) * Math.abs(avgPred - avgActual);
      }, 0);
      calibrationError = Math.round(calibrationError * 1000) / 1000;
    }

    // 5. ACT/CONSIDER precision from inference audit
    const { data: recentInferences } = await supabase
      .from("decision_inference_audit")
      .select("policy_classifications, model_version")
      .eq("model_version", activeModel.version)
      .limit(200);

    let actCount = 0, considerCount = 0;
    for (const inf of recentInferences || []) {
      const policies = inf.policy_classifications as Array<{ policy: string }> || [];
      for (const p of policies) {
        if (p.policy === "ACT") actCount++;
        if (p.policy === "CONSIDER") considerCount++;
      }
    }

    // 6. Store evaluation
    const evaluation = {
      model_version: activeModel.version,
      compared_to_version: previousModel?.version || null,
      evaluation_type: "periodic",
      proxy_success_rate: successRate(proxyRows),
      real_success_rate: successRate(realRows),
      measured_success_rate: successRate(measuredRows),
      avg_impact_score: rows.filter(r => r.impact_score != null).length > 0
        ? Math.round(rows.filter(r => r.impact_score != null).reduce((s, r) => s + (r.impact_score || 0), 0) / rows.filter(r => r.impact_score != null).length * 10) / 10
        : null,
      acceptance_rate: acceptanceRate,
      act_precision: actCount,
      consider_precision: considerCount,
      calibration_error: calibrationError,
      confidence_buckets: buckets,
      sample_count: rows.length,
      metadata: {
        active_model: activeModel.version,
        previous_model: previousModel?.version,
        outcome_log_count: outcomeRows.length,
        inference_count: recentInferences?.length || 0,
      },
    };

    const { error: insertErr } = await supabase.from("model_evaluations").insert(evaluation);
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ ok: true, evaluation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Model evaluation error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
