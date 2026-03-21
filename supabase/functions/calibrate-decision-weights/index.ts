import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FEATURE_KEYS = [
  "performance_index", "momentum_score", "risk_pressure_score",
  "systemic_fragility_score", "confidence_score", "structural_break_count",
  "anomaly_count", "alert_count", "crisis_severity_avg", "forecast_stability_score",
];

const DOMAINS = ["security", "health", "finance", "energy", "food", "governance"];

// Label source weights for calibration
const LABEL_WEIGHTS: Record<string, number> = {
  real: 1.0,
  measured: 1.2,
  proxy: 0.35,
};

// Domain-specific action policy defaults
const DOMAIN_ACTION_POLICIES: Record<string, { act: number; consider: number; min_impact: number }> = {
  security: { act: 0.65, consider: 0.40, min_impact: 35 },
  health: { act: 0.70, consider: 0.45, min_impact: 40 },
  finance: { act: 0.75, consider: 0.50, min_impact: 45 },
  energy: { act: 0.70, consider: 0.45, min_impact: 40 },
  food: { act: 0.65, consider: 0.40, min_impact: 35 },
  governance: { act: 0.80, consider: 0.55, min_impact: 50 },
};

/**
 * Calibrate feature weights from training data using weighted correlation.
 * For each feature, compute how well it correlates with outcome_success,
 * weighted by label source credibility.
 */
function calibrateWeights(
  rows: any[],
  existingWeights: Record<string, number>
): Record<string, number> {
  if (rows.length < 10) return existingWeights;

  const newWeights: Record<string, number> = {};

  for (const key of FEATURE_KEYS) {
    // Compute weighted correlation between feature and outcome
    let sumWXY = 0, sumWX = 0, sumWY = 0, sumWX2 = 0, sumWY2 = 0, sumW = 0;

    for (const row of rows) {
      const features = row.features || {};
      const x = features[key] ?? 0;
      const y = row.outcome_success ? 1 : 0;
      const w = LABEL_WEIGHTS[row.label_source] || 0.35;
      // If overridden by real data, skip proxy
      if (row.overridden_by_real) continue;

      sumW += w;
      sumWX += w * x;
      sumWY += w * y;
      sumWXY += w * x * y;
      sumWX2 += w * x * x;
      sumWY2 += w * y * y;
    }

    if (sumW === 0) {
      newWeights[key] = existingWeights[key] || 0;
      continue;
    }

    const meanX = sumWX / sumW;
    const meanY = sumWY / sumW;
    const covXY = sumWXY / sumW - meanX * meanY;
    const varX = sumWX2 / sumW - meanX * meanX;
    const varY = sumWY2 / sumW - meanY * meanY;

    if (varX < 1e-10 || varY < 1e-10) {
      newWeights[key] = existingWeights[key] || 0;
      continue;
    }

    const correlation = covXY / Math.sqrt(varX * varY);

    // Blend: 70% data-driven correlation, 30% prior weights
    const prior = existingWeights[key] || 0;
    newWeights[key] = Math.round((correlation * 0.7 + prior * 0.3) * 1000) / 1000;
  }

  // Normalize so absolute weights sum to ~1
  const absSum = Object.values(newWeights).reduce((s, v) => s + Math.abs(v), 0);
  if (absSum > 0) {
    for (const key of FEATURE_KEYS) {
      newWeights[key] = Math.round((newWeights[key] / absSum) * 1000) / 1000;
    }
  }

  return newWeights;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Load all training data (excluding overridden proxy rows)
    const { data: allRows, error: fetchErr } = await supabase
      .from("decision_training_dataset")
      .select("iso3, domain, features, action_type, outcome_success, impact_score, label_source, label_confidence, overridden_by_real")
      .eq("overridden_by_real", false)
      .limit(5000);

    if (fetchErr) throw fetchErr;
    if (!allRows || allRows.length < 10) {
      return new Response(JSON.stringify({
        ok: true, message: "Insufficient training data for calibration", count: allRows?.length || 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Load current active model
    const { data: activeModel } = await supabase
      .from("decision_models")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentWeights = activeModel?.feature_weights || {};

    // 3. Calibrate global weights
    const globalWeights = calibrateWeights(allRows, currentWeights);

    // 4. Calibrate per-domain weights
    const domainWeights: Record<string, Record<string, number>> = {};
    for (const domain of DOMAINS) {
      const domainRows = allRows.filter(r => r.domain === domain);
      if (domainRows.length >= 5) {
        domainWeights[domain] = calibrateWeights(domainRows, globalWeights);
      }
    }

    // 5. Compute performance metrics
    const realRows = allRows.filter(r => r.label_source === "real" || r.label_source === "measured");
    const proxyRows = allRows.filter(r => r.label_source === "proxy");
    const proxyAccuracy = proxyRows.length > 0
      ? proxyRows.filter(r => r.outcome_success).length / proxyRows.length
      : null;
    const realAccuracy = realRows.length > 0
      ? realRows.filter(r => r.outcome_success).length / realRows.length
      : null;
    const avgImpact = allRows.filter(r => r.impact_score != null).length > 0
      ? allRows.filter(r => r.impact_score != null).reduce((s, r) => s + (r.impact_score || 0), 0) / allRows.filter(r => r.impact_score != null).length
      : null;

    // Determine training mode
    const measuredCount = allRows.filter(r => r.label_source === "measured").length;
    const realCount = realRows.length;
    const proxyCount = proxyRows.length;
    let trainingMode = "heuristic";
    if (measuredCount > 0 && proxyCount > 0) trainingMode = "hybrid";
    else if (realCount > 0) trainingMode = "real";
    else if (proxyCount > 0) trainingMode = "proxy";

    const maturityRatio = allRows.length > 0
      ? (realCount * 1.0 + measuredCount * 1.5) / (allRows.length * 1.5)
      : 0;

    // 6. Create new model version (don't overwrite)
    const versionNum = activeModel ? parseInt(activeModel.version?.split("-").pop() || "0") + 1 : 1;
    const newVersion = `DL-cal-${versionNum}`;

    // Deactivate old model
    if (activeModel) {
      await supabase
        .from("decision_models")
        .update({ status: "superseded" })
        .eq("id", activeModel.id);
    }

    // Insert new calibrated model
    const { error: insertErr } = await supabase.from("decision_models").insert({
      version: newVersion,
      model_type: "weighted_scoring",
      feature_schema: { features: FEATURE_KEYS },
      feature_weights: globalWeights,
      domain_feature_weights: domainWeights,
      action_policies: {
        global: { act_threshold: 0.75, consider_threshold: 0.50, min_impact: 40 },
      },
      domain_action_policies: DOMAIN_ACTION_POLICIES,
      performance_metrics: {
        proxy_accuracy: proxyAccuracy,
        real_accuracy: realAccuracy,
        global_weight_count: FEATURE_KEYS.length,
        domain_weights_count: Object.keys(domainWeights).length,
      },
      training_sample_count: allRows.length,
      training_mode: trainingMode,
      proxy_sample_count: proxyCount,
      real_sample_count: realCount,
      measured_sample_count: measuredCount,
      avg_impact_score: avgImpact,
      outcome_maturity_ratio: Math.round(maturityRatio * 100) / 100,
      last_calibrated_at: new Date().toISOString(),
      status: "active",
    });

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({
      ok: true,
      version: newVersion,
      training_mode: trainingMode,
      global_weights: globalWeights,
      domain_weights_count: Object.keys(domainWeights).length,
      samples: { total: allRows.length, proxy: proxyCount, real: realCount, measured: measuredCount },
      metrics: { proxy_accuracy: proxyAccuracy, real_accuracy: realAccuracy, avg_impact: avgImpact },
      maturity_ratio: Math.round(maturityRatio * 100) / 100,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Calibration error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
