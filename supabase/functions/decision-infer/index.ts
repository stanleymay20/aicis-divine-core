import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Feature Schema ───
const FEATURE_KEYS = [
  "performance_index", "momentum_score", "risk_pressure_score",
  "systemic_fragility_score", "confidence_score", "structural_break_count",
  "anomaly_count", "alert_count", "crisis_severity_avg", "forecast_stability_score",
] as const;

// ─── Default weights (updated by training) ───
const DEFAULT_WEIGHTS: Record<string, number> = {
  performance_index: -0.15,      // higher perf → lower risk → less urgent
  momentum_score: -0.10,         // positive momentum → less concern
  risk_pressure_score: 0.25,     // high risk → high urgency
  systemic_fragility_score: 0.20,// high fragility → high urgency
  confidence_score: 0.05,        // higher confidence → slightly more actionable
  structural_break_count: 0.10,  // more breaks → more concern
  anomaly_count: 0.10,           // more anomalies → more concern
  alert_count: 0.10,             // more alerts → more concern
  crisis_severity_avg: 0.10,     // higher severity → more concern
  forecast_stability_score: -0.05,// stable forecast → less concern
};

// ─── Action Types ───
const ACTION_TYPES = [
  { type: "deploy_resources", label: "Deploy Additional Resources", domains: ["security", "health", "food"] },
  { type: "escalate_monitoring", label: "Escalate Monitoring", domains: ["all"] },
  { type: "diplomatic_engagement", label: "Initiate Diplomatic Engagement", domains: ["security", "governance"] },
  { type: "supply_chain_intervention", label: "Supply Chain Intervention", domains: ["food", "energy"] },
  { type: "financial_stabilization", label: "Financial Stabilization Measures", domains: ["finance"] },
  { type: "public_health_response", label: "Public Health Response", domains: ["health"] },
  { type: "infrastructure_hardening", label: "Infrastructure Hardening", domains: ["energy", "security"] },
  { type: "governance_reform", label: "Governance Reform Advisory", domains: ["governance"] },
  { type: "early_warning_broadcast", label: "Early Warning Broadcast", domains: ["all"] },
  { type: "resource_reallocation", label: "Resource Reallocation", domains: ["all"] },
];

// ─── Feature Engineering ───
interface SignalData {
  snapshots: any[];
  anomalies: any[];
  alerts: any[];
  crises: any[];
}

function buildFeatures(signals: SignalData): Record<string, number> {
  const s = signals.snapshots;
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  return {
    performance_index: avg(s.map((x: any) => x.performance_index || 50)),
    momentum_score: avg(s.map((x: any) => x.momentum_score || 0)),
    risk_pressure_score: avg(s.map((x: any) => x.risk_pressure_score || 0)),
    systemic_fragility_score: avg(s.map((x: any) => x.systemic_fragility_score || 0)),
    confidence_score: avg(s.map((x: any) => x.confidence_score || 50)),
    structural_break_count: s.reduce((sum: number, x: any) => sum + (x.structural_break_count || 0), 0),
    anomaly_count: signals.anomalies.length,
    alert_count: signals.alerts.length,
    crisis_severity_avg: avg(signals.crises.map((x: any) => x.severity || 0)),
    forecast_stability_score: avg(s.map((x: any) => x.forecast_stability_score || 50)),
  };
}

// ─── Scoring Engine ───
function computeRiskScore(features: Record<string, number>, weights: Record<string, number>): number {
  // Normalize features to 0-1 range using known bounds
  const bounds: Record<string, [number, number]> = {
    performance_index: [0, 100],
    momentum_score: [-50, 50],
    risk_pressure_score: [0, 100],
    systemic_fragility_score: [0, 100],
    confidence_score: [0, 100],
    structural_break_count: [0, 20],
    anomaly_count: [0, 20],
    alert_count: [0, 15],
    crisis_severity_avg: [0, 10],
    forecast_stability_score: [0, 100],
  };

  let score = 0;
  for (const key of FEATURE_KEYS) {
    const [min, max] = bounds[key] || [0, 100];
    const normalized = Math.max(0, Math.min(1, (features[key] - min) / (max - min)));
    score += normalized * (weights[key] || 0);
  }

  // Convert to 0-100 probability-like scale
  // Sigmoid-ish transformation: map [-1,1] → [0,100]
  return Math.max(0, Math.min(100, (score + 0.5) * 100));
}

function selectActions(
  domain: string,
  riskScore: number,
  features: Record<string, number>,
): Array<{ action_type: string; label: string; success_probability: number; impact_estimate: number; urgency: string }> {
  const relevant = ACTION_TYPES.filter(a => a.domains.includes("all") || a.domains.includes(domain));

  return relevant.map(action => {
    // Each action has slightly different scoring based on feature relevance
    let actionScore = riskScore;

    // Action-specific modifiers
    if (action.type === "deploy_resources" && features.crisis_severity_avg > 5) actionScore += 8;
    if (action.type === "escalate_monitoring" && features.anomaly_count > 5) actionScore += 10;
    if (action.type === "early_warning_broadcast" && features.structural_break_count > 3) actionScore += 12;
    if (action.type === "diplomatic_engagement" && features.risk_pressure_score > 60) actionScore += 7;
    if (action.type === "supply_chain_intervention" && features.systemic_fragility_score > 50) actionScore += 9;

    // Clamp
    actionScore = Math.max(5, Math.min(95, actionScore));

    // Deterministic impact estimate: weighted combination of action score and feature relevance
    const featureRelevance = (features.risk_pressure_score + features.systemic_fragility_score) / 200;
    const impactEstimate = Math.round(Math.min(95, actionScore * 0.75 + featureRelevance * 20));

    // Urgency from score
    let urgency: string;
    if (actionScore > 75) urgency = "immediate";
    else if (actionScore > 60) urgency = "24h";
    else if (actionScore > 40) urgency = "7d";
    else if (actionScore > 25) urgency = "30d";
    else urgency = "monitor";

    return {
      action_type: action.type,
      label: action.label,
      success_probability: Math.round(actionScore) / 100,
      impact_estimate: impactEstimate,
      urgency,
    };
  })
  .sort((a, b) => b.success_probability - a.success_probability)
  .slice(0, 5); // Top 5
}

// ─── Policy Layer ───
function classifyAction(
  successProb: number, 
  impact: number, 
  domainPolicies?: Record<string, { act: number; consider: number; min_impact: number }>,
  domain?: string
): "ACT" | "CONSIDER" | "MONITOR" {
  const policy = (domain && domainPolicies?.[domain]) || { act: 0.75, consider: 0.50, min_impact: 40 };
  if (successProb >= policy.act && impact >= policy.min_impact) return "ACT";
  if (successProb >= policy.consider || impact >= (policy.min_impact * 0.8)) return "CONSIDER";
  return "MONITOR";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { iso3, domain, explain } = await req.json().catch(() => ({}));

    // 1. Load active model weights (or use defaults)
    const { data: activeModel } = await supabase
      .from("decision_models")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Use domain-specific weights if available, else global
    const domainWeightsMap = activeModel?.domain_feature_weights || {};
    const globalWeights = activeModel?.feature_weights || DEFAULT_WEIGHTS;
    const { domain: reqDomain } = { domain: undefined, ...await req.clone().json().catch(() => ({})) };
    const weights = (reqDomain && domainWeightsMap[reqDomain]) || globalWeights;
    const domainActionPolicies = activeModel?.domain_action_policies || {};
    const modelVersion = activeModel?.version || "DL-heuristic-0.1";
    const trainingMode = activeModel?.training_mode || "heuristic";

    // 2. Pull signals
    let snapshotQuery = supabase
      .from("country_performance_snapshots")
      .select("iso3, domain, performance_index, momentum_score, risk_pressure_score, systemic_fragility_score, confidence_score, structural_break_count, forecast_stability_score")
      .order("risk_pressure_score", { ascending: false })
      .limit(50);
    if (iso3) snapshotQuery = snapshotQuery.eq("iso3", iso3);
    if (domain) snapshotQuery = snapshotQuery.eq("domain", domain);

    const [snapshots, anomalies, alerts, crises] = await Promise.all([
      snapshotQuery,
      supabase.from("anomaly_detections").select("*").eq("status", "active").limit(20),
      supabase.from("critical_alerts").select("*").eq("acknowledged", false).limit(15),
      supabase.from("crisis_events").select("*").neq("status", "resolved").limit(10),
    ]);

    const signalData: SignalData = {
      snapshots: snapshots.data || [],
      anomalies: anomalies.data || [],
      alerts: alerts.data || [],
      crises: crises.data || [],
    };

    const totalSignals = signalData.snapshots.length + signalData.anomalies.length + signalData.alerts.length + signalData.crises.length;

    if (totalSignals < 3) {
      return new Response(JSON.stringify({
        ok: true,
        recommendations: [],
        risk_score: 0,
        decision_basis: "statistical_model",
        model_version: modelVersion,
        training_mode: trainingMode,
        outcome_trained: trainingMode === "real" || trainingMode === "hybrid",
        message: "Insufficient signal data for model-driven inference",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Feature engineering
    const features = buildFeatures(signalData);

    // 4. Scoring
    const riskScore = computeRiskScore(features, weights as Record<string, number>);

    // 5. Action selection
    const targetDomain = domain || "all";
    const actions = selectActions(targetDomain, riskScore, features);

    // 6. Apply policy layer
    const recommendations = actions.map(a => ({
      ...a,
      policy: classifyAction(a.success_probability, a.impact_estimate),
    }));

    // 7. Optional LLM explanation
    let explanation: string | null = null;
    if (explain) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        try {
          const topRec = recommendations[0];
          const explainPrompt = `You are explaining a statistical decision model's output. Be concise (2-3 sentences).

The model analyzed ${totalSignals} signals for ${iso3 || 'global'} / ${targetDomain}.
Risk score: ${riskScore.toFixed(1)}/100
Top recommendation: "${topRec.label}" with ${(topRec.success_probability * 100).toFixed(0)}% success probability.

Key features driving this:
- Risk pressure: ${features.risk_pressure_score.toFixed(1)}
- Fragility: ${features.systemic_fragility_score.toFixed(1)}
- Momentum: ${features.momentum_score.toFixed(1)}
- Active anomalies: ${features.anomaly_count}
- Active crises: ${features.crisis_severity_avg.toFixed(1)} avg severity

Explain WHY this action has this success probability based on these features. Do NOT decide — only explain.`;

          const llmResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [{ role: "user", content: explainPrompt }],
            }),
          });

          if (llmResp.ok) {
            const llmData = await llmResp.json();
            explanation = llmData.choices?.[0]?.message?.content || null;
          } else {
            await llmResp.text(); // consume body
          }
        } catch (e) {
          console.error("LLM explain error (non-fatal):", e);
        }
      }
    }

    // 8. Compute deterministic inference hash for auditability
    const canonicalInput = JSON.stringify(
      { features, weights, modelVersion, trainingMode },
      Object.keys({ features, weights, modelVersion, trainingMode }).sort()
    );
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalInput));
    const inferenceHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    const signalCounts = {
      snapshots: signalData.snapshots.length,
      anomalies: signalData.anomalies.length,
      alerts: signalData.alerts.length,
      crises: signalData.crises.length,
    };

    // 9. Log inference audit + decision log
    await Promise.all([
      supabase.from("decision_inference_audit").insert({
        model_version: modelVersion,
        training_mode: trainingMode,
        scope_iso3: iso3 || null,
        scope_domain: domain || "all",
        feature_vector: features,
        weights_used: weights,
        risk_score: riskScore,
        chosen_actions: recommendations.map(r => ({ action_type: r.action_type, success_probability: r.success_probability })),
        policy_classifications: recommendations.map(r => ({ action_type: r.action_type, policy: r.policy })),
        signal_counts: signalCounts,
        inference_hash: inferenceHash,
      }),
      supabase.from("ai_decision_logs").insert({
        division_key: domain || "system",
        model_name: modelVersion,
        input_summary: `Model inference for ${iso3 || 'global'} / ${targetDomain} | ${totalSignals} signals`,
        output_summary: `Risk: ${riskScore.toFixed(1)} | Top: ${recommendations[0]?.label} (${(recommendations[0]?.success_probability * 100).toFixed(0)}%)`,
        confidence: recommendations[0]?.success_probability * 100 || 0,
        explanation: { features, risk_score: riskScore, model_version: modelVersion, training_mode: trainingMode, inference_hash: inferenceHash },
      }),
    ]);

    return new Response(JSON.stringify({
      ok: true,
      risk_score: Math.round(riskScore * 10) / 10,
      features,
      recommendations,
      explanation,
      decision_basis: "statistical_model",
      model_version: modelVersion,
      training_mode: trainingMode,
      outcome_trained: trainingMode === "real" || trainingMode === "hybrid",
      training_samples: activeModel?.training_sample_count || 0,
      real_samples: activeModel?.real_sample_count || 0,
      proxy_samples: activeModel?.proxy_sample_count || 0,
      inference_hash: inferenceHash,
      signal_counts: signalCounts,
      generated_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("Decision infer error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
