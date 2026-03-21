import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Brain, RefreshCw, Target, Zap, TrendingUp,
  Activity, BarChart3, Info, ChevronDown, ChevronUp,
  FileText, ClipboardCheck, Shield, ArrowUp, ArrowDown,
  CheckCircle, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import ActionLeaderboard from "./ActionLeaderboard";
import TrustScorePanel from "./TrustScorePanel";
import BaselineComparison from "./BaselineComparison";
import DecisionGovernancePanel from "./DecisionGovernancePanel";
import ReviewControlTower from "./ReviewControlTower";
import OutcomeMaturityPanel from "./OutcomeMaturityPanel";
import ReviewerWorkloadPanel from "./ReviewerWorkloadPanel";
import ModelPromotionLog from "./ModelPromotionLog";
import LearningCycleHealth from "./LearningCycleHealth";
import DecisionKPIPanel from "./DecisionKPIPanel";
import ModelSafetyPanel from "./ModelSafetyPanel";
import ExecutionPipelinePanel from "./ExecutionPipelinePanel";
import ReviewerAccountabilityPanel from "./ReviewerAccountabilityPanel";
import MeasuredEvidenceProgressPanel from "./MeasuredEvidenceProgressPanel";
import SilentFailurePanel from "./SilentFailurePanel";

interface FeatureContribution {
  feature: string;
  normalized: number;
  weight: number;
  contribution: number;
}

interface Recommendation {
  action_type: string;
  label: string;
  success_probability: number;
  impact_estimate: number;
  urgency: string;
  policy: "ACT" | "CONSIDER" | "MONITOR";
  top_drivers: Array<{ feature: string; contribution: number }>;
  domain_override: boolean;
  action_adjusted: boolean;
  guardrail_applied: string | null;
}

interface ModelInferResponse {
  ok: boolean;
  risk_score: number;
  features: Record<string, number>;
  feature_contributions: FeatureContribution[];
  recommendations: Recommendation[];
  explanation: string | null;
  decision_basis: string;
  model_version: string;
  training_mode: string;
  outcome_trained: boolean;
  domain_override_used: boolean;
  action_adjustments_available: number;
  training_samples: number;
  real_samples: number;
  proxy_samples: number;
  inference_hash: string;
  signal_counts: Record<string, number>;
  generated_at: string;
}

const policyConfig = {
  ACT: { color: "bg-destructive text-destructive-foreground", icon: Zap, label: "Act" },
  CONSIDER: { color: "bg-warning text-warning-foreground", icon: TrendingUp, label: "Consider" },
  MONITOR: { color: "bg-muted text-muted-foreground", icon: Target, label: "Monitor" },
};

const urgencyLabels: Record<string, string> = {
  immediate: "Immediate", "24h": "24h", "7d": "7d", "30d": "30d", monitor: "Monitor",
};

const trainingModeLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  real: { label: "Real-Outcome-Trained", variant: "default" },
  hybrid: { label: "Hybrid-Trained", variant: "secondary" },
  proxy: { label: "Proxy-Trained", variant: "outline" },
  heuristic: { label: "Heuristic Weights", variant: "outline" },
};

interface Props {
  domain: string;
}

export default function ModelDrivenView({ domain }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showExplain, setShowExplain] = useState(false);
  const [capturingAction, setCapturingAction] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<ModelInferResponse>({
    queryKey: ["decision-infer", domain],
    queryFn: async () => {
      const body: Record<string, any> = { explain: showExplain };
      if (domain !== "all") body.domain = domain;
      const { data, error } = await supabase.functions.invoke("decision-infer", { body });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Inference failed");
      return data;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: activeModel } = useQuery({
    queryKey: ["active-decision-model"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_models")
        .select("version, training_mode, training_sample_count, proxy_sample_count, real_sample_count, measured_sample_count, last_calibrated_at, avg_impact_score, outcome_maturity_ratio, domain_feature_weights, action_adjustment_weights, promotion_status, rejection_reason")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  const { data: latestEval } = useQuery({
    queryKey: ["latest-model-evaluation"],
    queryFn: async () => {
      const { data } = await supabase
        .from("model_evaluations")
        .select("*")
        .order("evaluated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 120_000,
  });

  const totalSignals = data ? Object.values(data.signal_counts).reduce((a, b) => a + b, 0) : 0;

  const handleCaptureRecommendation = async (rec: Recommendation) => {
    setCapturingAction(rec.action_type);
    try {
      const { data: existing } = await supabase
        .from("decision_outcome_log")
        .select("id")
        .eq("signal_id", `model-${rec.action_type}-${data?.generated_at}`)
        .maybeSingle();

      if (existing) {
        toast.info("This recommendation is already captured");
        setCapturingAction(null);
        return;
      }

      // Look up criticality rules for domain + policy
      const domainKey = domain !== "all" ? domain : "system";
      const { data: critRule } = await supabase
        .from("decision_criticality_rules")
        .select("criticality_tier, requires_dual_approval")
        .eq("domain", domainKey)
        .eq("policy", rec.policy)
        .maybeSingle();

      const criticalityTier = (critRule as any)?.criticality_tier || "standard";
      const requiresDual = (critRule as any)?.requires_dual_approval || false;

      // Auto-set SLA based on policy
      const slaMap: Record<string, number> = { ACT: 24, CONSIDER: 72, MONITOR: 168 };
      const slaHours = slaMap[rec.policy] || 72;
      const reviewDueAt = new Date(Date.now() + slaHours * 3600000).toISOString();

      // Auto-assign reviewer from routing rules
      const { data: routingRule } = await supabase
        .from("reviewer_routing_rules")
        .select("default_reviewer, default_reviewer_role, max_active_assignments")
        .eq("domain", domainKey)
        .eq("criticality_tier", criticalityTier)
        .eq("enabled", true)
        .maybeSingle();

      // Workload balancing: check current load for assigned reviewer
      let assignedReviewer = (routingRule as any)?.default_reviewer || null;
      const assignedReviewerRole = (routingRule as any)?.default_reviewer_role || null;
      const maxAssignments = (routingRule as any)?.max_active_assignments || 10;

      if (assignedReviewer) {
        const { count: currentLoad } = await supabase
          .from("decision_outcome_log")
          .select("id", { count: "exact", head: true })
          .eq("assigned_reviewer", assignedReviewer)
          .or("review_status.is.null,review_status.eq.pending");

        if ((currentLoad ?? 0) >= maxAssignments) {
          // Try fallback: any enabled rule for this domain with lower load
          const { data: fallbacks } = await supabase
            .from("reviewer_routing_rules")
            .select("default_reviewer, default_reviewer_role")
            .eq("domain", domainKey)
            .eq("enabled", true)
            .neq("default_reviewer", assignedReviewer);

          if (fallbacks && fallbacks.length > 0) {
            assignedReviewer = (fallbacks[0] as any).default_reviewer;
          }
          // Otherwise keep original — overloaded is better than unassigned
        }
      }

      const { error } = await supabase.from("decision_outcome_log").insert({
        signal_id: `model-${rec.action_type}-${data?.generated_at}`,
        signal_title: rec.label,
        signal_date: new Date().toISOString().split("T")[0],
        signal_direction: rec.policy === "ACT" ? "down" : "stable",
        signal_confidence: Math.round(rec.success_probability * 100),
        domain: domainKey,
        recommended_action: rec.label,
        hypothetical_decision_value: `Impact: ${rec.impact_estimate}/100, Prob: ${(rec.success_probability * 100).toFixed(0)}%`,
        evidence_type: "hypothetical",
        evidence_source_type: "decision-model",
        evidence_note: `Model: ${data?.model_version} | Mode: ${data?.training_mode} | Hash: ${data?.inference_hash?.slice(0, 16)}`,
        decision_features: data?.features || {},
        action_type: rec.action_type,
        status: "pending",
        recommendation_accepted: true,
        review_status: "pending",
        review_sla_hours: slaHours,
        review_due_at: reviewDueAt,
        criticality_tier: criticalityTier,
        requires_dual_approval: requiresDual,
        recommender_id: `model-${data?.model_version}`,
        assigned_reviewer: assignedReviewer,
        assigned_reviewer_role: assignedReviewerRole,
        execution_status: "not_started",
      });
      if (error) throw error;

      // Log assignment to immutable review history
      if (assignedReviewer) {
        await supabase.from("decision_review_history").insert({
          decision_id: `model-${rec.action_type}-${data?.generated_at}`,
          changed_by: "system",
          changed_role: "auto-router",
          from_status: null,
          to_status: "pending",
          note: `Auto-assigned to ${assignedReviewer} (${assignedReviewerRole}) via routing rules`,
        }).then(() => {}).catch(() => {}); // non-critical

      }

      toast.success(`Captured "${rec.label}" — assigned to ${assignedReviewer || "unassigned"}`);
    } catch (e: any) {
      if (e?.code === "23505") toast.info("Already captured");
      else { toast.error("Failed to capture"); console.error(e); }
    } finally {
      setCapturingAction(null);
    }
  };

  const modeInfo = trainingModeLabels[data?.training_mode || "heuristic"] || trainingModeLabels.heuristic;
  const maturityPct = activeModel?.outcome_maturity_ratio != null ? Math.round(activeModel.outcome_maturity_ratio * 100) : 0;
  const domainWeightsCount = activeModel?.domain_feature_weights ? Object.keys(activeModel.domain_feature_weights as Record<string, unknown>).length : 0;
  const actionAdjCount = activeModel?.action_adjustment_weights ? Object.keys(activeModel.action_adjustment_weights as Record<string, unknown>).length : 0;

  return (
    <div className="space-y-4">
      {/* Model info bar */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded border border-border">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>Model-driven inference</strong> — decisions generated by weighted statistical scoring, not LLM reasoning.
          {data && !data.outcome_trained && " Weights are not yet calibrated from real outcomes."}
          {data?.training_mode === "proxy" && " ⚠ Training uses proxy labels from validated forecasts, not real-world decision outcomes."}
        </span>
      </div>

      {/* Model Calibration + Evaluation Status */}
      {activeModel && (
        <Card className="border-accent/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-accent-foreground" />
                Model Calibration Status
              </span>
              <Badge variant={modeInfo.variant} className="text-xs">{modeInfo.label}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
              <div className="p-1.5 rounded bg-muted/30">
                <p className="text-sm font-bold">{activeModel.training_sample_count || 0}</p>
                <p className="text-[9px] text-muted-foreground">Samples</p>
              </div>
              <div className="p-1.5 rounded bg-muted/30">
                <p className="text-sm font-bold">{activeModel.proxy_sample_count || 0}</p>
                <p className="text-[9px] text-muted-foreground">Proxy</p>
              </div>
              <div className="p-1.5 rounded bg-accent/10">
                <p className="text-sm font-bold">{activeModel.real_sample_count || 0}</p>
                <p className="text-[9px] text-muted-foreground">Real</p>
              </div>
              <div className="p-1.5 rounded bg-primary/10">
                <p className="text-sm font-bold">{activeModel.measured_sample_count || 0}</p>
                <p className="text-[9px] text-muted-foreground">Measured</p>
              </div>
              <div className="p-1.5 rounded bg-muted/30">
                <p className="text-sm font-bold">{maturityPct}%</p>
                <p className="text-[9px] text-muted-foreground">Maturity</p>
              </div>
              <div className="p-1.5 rounded bg-muted/30">
                <p className="text-sm font-bold">{actionAdjCount}</p>
                <p className="text-[9px] text-muted-foreground">Action Adj.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
              <span>v{activeModel.version}</span>
              {activeModel.last_calibrated_at && <span>Cal: {new Date(activeModel.last_calibrated_at).toLocaleDateString()}</span>}
              {domainWeightsCount > 0 && <span>{domainWeightsCount} domain weights</span>}
              {latestEval?.calibration_error != null && <span>ECE: {latestEval.calibration_error.toFixed(3)}</span>}
              {latestEval?.acceptance_rate != null && <span>Accept: {(latestEval.acceptance_rate * 100).toFixed(0)}%</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => { toast.info("Running model inference..."); refetch(); }} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Infer
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowExplain(!showExplain)}>
          <Brain className="h-4 w-4 mr-1" /> {showExplain ? "Hide" : "Show"} LLM Explanation
        </Button>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <Activity className="h-8 w-8 animate-pulse text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Running statistical model inference...</p>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* Risk Score */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Composite Risk Score</span>
                  </div>
                  <div className="text-3xl font-bold text-primary">{data.risk_score.toFixed(1)}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs"><Activity className="h-3 w-3 mr-1" />{data.model_version}</Badge>
                  <Badge variant="outline" className="text-xs">{totalSignals} signals</Badge>
                  {data.domain_override_used && <Badge variant="secondary" className="text-xs">Domain Override</Badge>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Feature Contributions */}
          {data.feature_contributions && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> Top Feature Drivers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {data.feature_contributions.slice(0, 5).map((fc) => (
                    <div key={fc.feature} className="flex items-center gap-2 text-xs">
                      {fc.contribution > 0
                        ? <ArrowUp className="h-3 w-3 text-destructive" />
                        : <ArrowDown className="h-3 w-3 text-primary" />}
                      <span className="text-muted-foreground flex-1 truncate">{fc.feature.replace(/_/g, " ")}</span>
                      <span className="font-mono text-xs font-medium w-14 text-right">
                        {fc.contribution > 0 ? "+" : ""}{fc.contribution.toFixed(3)}
                      </span>
                      <span className="text-muted-foreground w-12 text-right">w:{fc.weight.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* LLM Explanation */}
          {data.explanation && (
            <Card className="border-accent/20 bg-accent/5">
              <CardContent className="py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Brain className="h-3.5 w-3.5 text-accent-foreground" />
                  <span className="text-xs font-semibold text-accent-foreground">LLM Explanation (advisory only)</span>
                </div>
                <p className="text-sm">{data.explanation}</p>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {data.recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center">
                <Target className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Insufficient signals for model-driven recommendations.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {data.recommendations.map((rec) => {
                const policy = policyConfig[rec.policy];
                const PolicyIcon = policy.icon;
                const isExpanded = expanded === rec.action_type;

                return (
                  <Card key={rec.action_type} className="overflow-hidden">
                    <div className="cursor-pointer" onClick={() => setExpanded(isExpanded ? null : rec.action_type)}>
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded ${policy.color}`}>
                            <PolicyIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{rec.label}</span>
                              <Badge variant="outline" className="text-xs">{urgencyLabels[rec.urgency]}</Badge>
                              <Badge className={`text-xs ${policy.color}`}>{policy.label}</Badge>
                              {rec.guardrail_applied && (
                                <Badge variant="outline" className="text-xs border-warning">
                                  <Shield className="h-2.5 w-2.5 mr-0.5" />{rec.guardrail_applied.replace(/_/g, " ")}
                                </Badge>
                              )}
                              {rec.action_adjusted && <Badge variant="outline" className="text-[10px]">Action-adj</Badge>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-bold">{(rec.success_probability * 100).toFixed(0)}%</div>
                            <div className="text-[10px] text-muted-foreground">success prob.</div>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </CardContent>
                    </div>
                    {isExpanded && (
                      <CardContent className="pt-0 pb-3">
                        <Separator className="mb-3" />
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-primary/5 p-2 rounded">
                            <p className="text-xs text-muted-foreground">Impact Estimate</p>
                            <p className="text-sm font-bold">{rec.impact_estimate}/100</p>
                          </div>
                          <div className="bg-muted/30 p-2 rounded">
                            <p className="text-xs text-muted-foreground">Decision Basis</p>
                            <p className="text-sm font-bold">Statistical Model</p>
                          </div>
                        </div>

                        {/* Why this action - top drivers */}
                        {rec.top_drivers && rec.top_drivers.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Top drivers for this action:</p>
                            <div className="flex gap-2 flex-wrap">
                              {rec.top_drivers.map((d) => (
                                <Badge key={d.feature} variant="outline" className="text-[10px]">
                                  {d.contribution > 0 ? <ArrowUp className="h-2.5 w-2.5 mr-0.5 text-destructive" /> : <ArrowDown className="h-2.5 w-2.5 mr-0.5 text-primary" />}
                                  {d.feature.replace(/_/g, " ")}: {d.contribution > 0 ? "+" : ""}{d.contribution.toFixed(3)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Capture workflow */}
                        <Separator className="mb-3" />
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <ClipboardCheck className="h-3 w-3" />
                            Capture to track action → outcome → impact
                          </span>
                          <div className="flex gap-1.5">
                            <Button
                              variant="outline" size="sm"
                              onClick={(e) => { e.stopPropagation(); handleCaptureRecommendation(rec); }}
                              disabled={capturingAction === rec.action_type}
                            >
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              {capturingAction === rec.action_type ? "..." : "Accept & Capture"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

           {/* Operational Safety */}
          <ModelSafetyPanel />
          <SilentFailurePanel />

          {/* Strategic Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TrustScorePanel />
            <BaselineComparison />
          </div>

          {/* Execution & KPIs */}
          <DecisionKPIPanel />
          <ExecutionPipelinePanel />
          <MeasuredEvidenceProgressPanel />
          <ActionLeaderboard />
          <OutcomeMaturityPanel />

          {/* Model History */}
          <ModelPromotionLog />
          <LearningCycleHealth />

          {/* Governance */}
          <ReviewerAccountabilityPanel />
          <ReviewerWorkloadPanel />
          <ReviewControlTower />
          <DecisionGovernancePanel />
        </>
      )}
    </div>
  );
}
