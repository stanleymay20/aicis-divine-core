import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Bootstrap training data from forecast_validation_results.
 * Uses proxy labeling: if AICIS correctly predicted a direction change,
 * an action aligned with that signal would likely have succeeded.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check existing training data count
    const { count: existingCount } = await supabase
      .from("decision_training_dataset")
      .select("*", { count: "exact", head: true });

    if ((existingCount || 0) > 500) {
      return new Response(JSON.stringify({
        ok: true,
        message: "Training dataset already has sufficient samples",
        count: existingCount,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pull validated forecasts with direction changes (non-stable)
    const { data: validations, error: vErr } = await supabase
      .from("forecast_validation_results")
      .select("iso3, domain, actual_direction, predicted_direction, direction_hit, absolute_error, predicted_value, actual_value, realized_date")
      .neq("actual_direction", "stable")
      .order("realized_date", { ascending: false })
      .limit(1000);

    if (vErr) throw vErr;
    if (!validations || validations.length === 0) {
      return new Response(JSON.stringify({
        ok: true, message: "No validation data to bootstrap from", count: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pull corresponding snapshots for feature context
    const uniqueIso3s = [...new Set(validations.map(v => v.iso3))];
    const { data: snapshots } = await supabase
      .from("country_performance_snapshots")
      .select("iso3, domain, performance_index, momentum_score, risk_pressure_score, systemic_fragility_score, confidence_score, structural_break_count, forecast_stability_score")
      .in("iso3", uniqueIso3s)
      .limit(500);

    const snapshotMap = new Map<string, any>();
    (snapshots || []).forEach(s => {
      snapshotMap.set(`${s.iso3}-${s.domain}`, s);
    });

    // Generate proxy training samples
    const actionMap: Record<string, string> = {
      security: "deploy_resources",
      health: "public_health_response",
      finance: "financial_stabilization",
      energy: "infrastructure_hardening",
      food: "supply_chain_intervention",
      governance: "governance_reform",
    };

    const trainingRows = validations.map(v => {
      const snap = snapshotMap.get(`${v.iso3}-${v.domain}`);
      const features = snap ? {
        performance_index: snap.performance_index || 50,
        momentum_score: snap.momentum_score || 0,
        risk_pressure_score: snap.risk_pressure_score || 0,
        systemic_fragility_score: snap.systemic_fragility_score || 0,
        confidence_score: snap.confidence_score || 50,
        structural_break_count: snap.structural_break_count || 0,
        forecast_stability_score: snap.forecast_stability_score || 50,
        anomaly_count: 0, // not available from snapshot
        alert_count: 0,
        crisis_severity_avg: 0,
      } : {
        performance_index: 50, momentum_score: 0, risk_pressure_score: 30,
        systemic_fragility_score: 30, confidence_score: 50,
        structural_break_count: 0, forecast_stability_score: 50,
        anomaly_count: 0, alert_count: 0, crisis_severity_avg: 0,
      };

      // Proxy label: if AICIS predicted direction correctly AND error is small → action would succeed
      const outcomeSuccess = v.direction_hit && (v.absolute_error || 999) < 5;

      // Impact estimate from how significant the actual change was
      const changeMagnitude = Math.abs((v.actual_value || 0) - (v.predicted_value || 0));
      const impactScore = Math.min(100, changeMagnitude * 10);

      return {
        iso3: v.iso3,
        domain: v.domain,
        features,
        action_type: actionMap[v.domain] || "escalate_monitoring",
        outcome_success: outcomeSuccess,
        impact_score: impactScore,
        source_type: "proxy",
      };
    });

    // Batch insert
    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < trainingRows.length; i += batchSize) {
      const batch = trainingRows.slice(i, i + batchSize);
      const { error: insertErr } = await supabase
        .from("decision_training_dataset")
        .insert(batch);
      if (!insertErr) inserted += batch.length;
    }

    // Seed initial model weights if no active model exists
    const { data: existingModel } = await supabase
      .from("decision_models")
      .select("id")
      .eq("status", "active")
      .maybeSingle();

    if (!existingModel) {
      await supabase.from("decision_models").insert({
        version: "DL-heuristic-0.1",
        model_type: "weighted_scoring",
        feature_schema: { features: Object.keys(trainingRows[0]?.features || {}) },
        feature_weights: {
          performance_index: -0.15,
          momentum_score: -0.10,
          risk_pressure_score: 0.25,
          systemic_fragility_score: 0.20,
          confidence_score: 0.05,
          structural_break_count: 0.10,
          anomaly_count: 0.10,
          alert_count: 0.10,
          crisis_severity_avg: 0.10,
          forecast_stability_score: -0.05,
        },
        action_policies: {
          act_threshold: 0.75,
          consider_threshold: 0.50,
          min_impact: 40,
        },
        performance_metrics: null,
        training_sample_count: inserted,
        status: "active",
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      message: `Bootstrapped ${inserted} proxy training samples from ${validations.length} validated forecasts`,
      inserted,
      total_validations: validations.length,
      proxy_success_rate: Math.round(trainingRows.filter(r => r.outcome_success).length / trainingRows.length * 100),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Bootstrap training error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
