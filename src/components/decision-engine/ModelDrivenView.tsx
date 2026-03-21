import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Brain, RefreshCw, Target, Zap, TrendingUp,
  Activity, BarChart3, Info, ChevronDown, ChevronUp,
  FileText, CheckCircle, ClipboardCheck
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface ModelInferResponse {
  ok: boolean;
  risk_score: number;
  features: Record<string, number>;
  recommendations: Array<{
    action_type: string;
    label: string;
    success_probability: number;
    impact_estimate: number;
    urgency: string;
    policy: "ACT" | "CONSIDER" | "MONITOR";
  }>;
  explanation: string | null;
  decision_basis: string;
  model_version: string;
  training_mode: string;
  outcome_trained: boolean;
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

  // Active model metadata
  const { data: activeModel } = useQuery({
    queryKey: ["active-decision-model"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_models")
        .select("version, training_mode, training_sample_count, proxy_sample_count, real_sample_count, measured_sample_count, last_calibrated_at, avg_impact_score, outcome_maturity_ratio, performance_metrics, domain_feature_weights")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 60_000,
  });

  const totalSignals = data ? Object.values(data.signal_counts).reduce((a, b) => a + b, 0) : 0;

  const handleCaptureRecommendation = async (rec: ModelInferResponse["recommendations"][0]) => {
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

      const { error } = await supabase.from("decision_outcome_log").insert({
        signal_id: `model-${rec.action_type}-${data?.generated_at}`,
        signal_title: rec.label,
        signal_date: new Date().toISOString().split("T")[0],
        signal_direction: rec.policy === "ACT" ? "down" : "stable",
        signal_confidence: Math.round(rec.success_probability * 100),
        domain: domain !== "all" ? domain : "system",
        recommended_action: rec.label,
        hypothetical_decision_value: `Impact: ${rec.impact_estimate}/100, Prob: ${(rec.success_probability * 100).toFixed(0)}%`,
        evidence_type: "hypothetical",
        evidence_source_type: "decision-model",
        evidence_note: `Model: ${data?.model_version} | Mode: ${data?.training_mode} | Hash: ${data?.inference_hash?.slice(0, 16)}`,
        decision_features: data?.features || {},
        action_type: rec.action_type,
        status: "pending",
      });
      if (error) throw error;
      toast.success(`Captured "${rec.label}" — track action & outcome in Decision Log`);
    } catch (e: any) {
      if (e?.code === "23505") {
        toast.info("Already captured");
      } else {
        toast.error("Failed to capture");
        console.error(e);
      }
    } finally {
      setCapturingAction(null);
    }
  };

  const modeInfo = trainingModeLabels[data?.training_mode || "heuristic"] || trainingModeLabels.heuristic;
  const maturityPct = activeModel?.outcome_maturity_ratio != null
    ? Math.round(activeModel.outcome_maturity_ratio * 100)
    : 0;
  const domainWeightsCount = activeModel?.domain_feature_weights
    ? Object.keys(activeModel.domain_feature_weights).length
    : 0;

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

      {/* Outcome Maturity Summary */}
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="p-1.5 rounded bg-muted/30">
                <p className="text-sm font-bold">{activeModel.training_sample_count || 0}</p>
                <p className="text-[9px] text-muted-foreground">Total Samples</p>
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
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground flex-wrap">
              <span>v{activeModel.version}</span>
              {activeModel.last_calibrated_at && (
                <span>Calibrated: {new Date(activeModel.last_calibrated_at).toLocaleDateString()}</span>
              )}
              {domainWeightsCount > 0 && (
                <span>{domainWeightsCount} domain-specific weight sets</span>
              )}
              {activeModel.avg_impact_score != null && (
                <span>Avg impact: {activeModel.avg_impact_score.toFixed(1)}</span>
              )}
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
          {/* Risk Score + Model Meta */}
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
                  <Badge variant="outline" className="text-xs">
                    <Activity className="h-3 w-3 mr-1" />
                    {data.model_version}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {totalSignals} signals
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Vector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Feature Vector</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {Object.entries(data.features).map(([key, val]) => (
                  <div key={key} className="text-center p-2 rounded bg-muted/30">
                    <p className="text-xs text-muted-foreground truncate">{key.replace(/_/g, " ")}</p>
                    <p className="text-sm font-bold">{typeof val === "number" ? val.toFixed(1) : val}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* LLM Explanation (optional) */}
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
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : rec.action_type)}
                    >
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
                        {/* Operator capture workflow */}
                        <Separator className="mb-3" />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <ClipboardCheck className="h-3 w-3" />
                            Capture to track action → outcome → impact
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleCaptureRecommendation(rec); }}
                            disabled={capturingAction === rec.action_type}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            {capturingAction === rec.action_type ? "Capturing..." : "Capture to Log"}
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Generated {new Date(data.generated_at).toLocaleString()} · Model: {data.model_version} · Mode: {data.training_mode} · Hash: {data.inference_hash?.slice(0, 12)}…
          </p>
        </>
      )}
    </div>
  );
}
