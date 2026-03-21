import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain, AlertTriangle, Clock, Target, Shield, RefreshCw, Zap, TrendingUp,
  ChevronDown, ChevronUp, Database, Eye, BookOpen, FileText, Info, Activity
} from "lucide-react";
import { toast } from "sonner";
import OutcomeMaturityPanel from "@/components/decision-engine/OutcomeMaturityPanel";
import ModelDrivenView from "@/components/decision-engine/ModelDrivenView";

interface Recommendation {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  domain: string;
  affected_countries?: string[];
  signal_summary: string;
  ai_reasoning?: string;
  recommended_action: string;
  alternatives?: string[];
  confidence: number;
  urgency: "immediate" | "24h" | "7d" | "30d" | "monitor";
  expected_impact?: string;
  risk_if_ignored?: string;
}

interface DecisionResponse {
  ok: boolean;
  recommendations: Recommendation[];
  global_assessment: string;
  signal_quality: "strong" | "moderate" | "weak" | "insufficient";
  evidence_density: "strong" | "moderate" | "weak" | "insufficient";
  outcome_trained: boolean;
  generated_at: string;
  scope: { country_iso3: string; domain: string };
  signal_counts: { snapshots: number; anomalies: number; alerts: number; crises: number };
}

const priorityConfig = {
  critical: { color: "bg-destructive text-destructive-foreground", icon: AlertTriangle },
  high: { color: "bg-warning text-warning-foreground", icon: Zap },
  medium: { color: "bg-secondary text-secondary-foreground", icon: TrendingUp },
  low: { color: "bg-muted text-muted-foreground", icon: Target },
};

const urgencyLabels: Record<string, string> = {
  immediate: "Act Now",
  "24h": "Within 24h",
  "7d": "This Week",
  "30d": "This Month",
  monitor: "Monitor Only",
};

const densityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  strong: { label: "Strong Evidence", variant: "default" },
  moderate: { label: "Moderate Evidence", variant: "secondary" },
  weak: { label: "Weak Evidence", variant: "outline" },
  insufficient: { label: "Insufficient Evidence", variant: "destructive" },
};

const domains = [
  { value: "all", label: "All Domains" },
  { value: "security", label: "Security" },
  { value: "health", label: "Health" },
  { value: "finance", label: "Finance" },
  { value: "energy", label: "Energy" },
  { value: "food", label: "Food" },
  { value: "governance", label: "Governance" },
];

export default function DecisionEngine() {
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [mode, setMode] = useState<"model" | "llm">("model");
  const [expandedRec, setExpandedRec] = useState<string | null>(null);
  const [capturingId, setCapturingId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<DecisionResponse>({
    queryKey: ["decision-recommend", selectedDomain],
    queryFn: async () => {
      const body: Record<string, string> = {};
      if (selectedDomain !== "all") body.domain = selectedDomain;
      const { data, error } = await supabase.functions.invoke("decision-recommend", { body });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Failed to generate recommendations");
      return data;
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const handleRefresh = () => {
    toast.info("Generating fresh recommendations from live signals...");
    refetch();
  };

  const handleCaptureToLog = async (rec: Recommendation) => {
    setCapturingId(rec.id);
    try {
      // Check for duplicate first
      const { data: existing } = await supabase
        .from("decision_outcome_log")
        .select("id")
        .eq("signal_id", rec.id)
        .eq("evidence_source_type", "decision-engine")
        .maybeSingle();

      if (existing) {
        toast.info(`"${rec.title}" is already captured in the Decision Log`);
        setCapturingId(null);
        return;
      }

      const { error } = await supabase.from("decision_outcome_log").insert({
        signal_id: rec.id,
        signal_title: rec.title,
        signal_date: new Date().toISOString().split("T")[0],
        signal_direction: rec.urgency === "immediate" ? "down" : "stable",
        signal_confidence: rec.confidence,
        domain: rec.domain,
        iso3: rec.affected_countries?.[0] || null,
        recommended_action: rec.recommended_action,
        hypothetical_decision_value: rec.expected_impact || "Pending assessment",
        evidence_type: "hypothetical",
        evidence_source_type: "decision-engine",
        evidence_note: rec.ai_reasoning || rec.signal_summary,
        status: "pending",
      });
      if (error) throw error;
      toast.success(`Captured "${rec.title}" to Decision Outcome Log for tracking`);
    } catch (e: any) {
      if (e?.code === "23505") {
        toast.info(`"${rec.title}" is already captured in the Decision Log`);
      } else {
        toast.error("Failed to capture recommendation to log");
        console.error(e);
      }
    } finally {
      setCapturingId(null);
    }
  };

  const totalSignals = data ? Object.values(data.signal_counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <AICISLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Decision Intelligence Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "model" ? "Statistical model-driven decisions from AICIS signals" : "LLM-assisted advisory from live intelligence signals"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedDomain} onValueChange={setSelectedDomain}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mode === "llm" && (
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Mode Toggle */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as "model" | "llm")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="model" className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Model-Driven
            </TabsTrigger>
            <TabsTrigger value="llm" className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5" /> LLM-Assisted
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Outcome Maturity Panel */}
        <OutcomeMaturityPanel />

        {/* Model-Driven View */}
        {mode === "model" && <ModelDrivenView domain={selectedDomain} />}

        {/* LLM-Assisted View (original) */}
        {mode === "llm" && (
          <>
        {/* Advisory disclaimer */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded border border-border">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Recommendations are AI-synthesized advisory signals based on AICIS evidence, not autonomous decisions.
            Confidence scores are heuristic estimates, not calibrated probabilities.
            {data && !data.outcome_trained && " This engine is not yet outcome-trained — no historical action effectiveness data is incorporated."}
          </span>
        </div>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Brain className="h-10 w-10 animate-pulse text-primary mx-auto mb-3" />
              <p className="text-muted-foreground">Analyzing live signals across all domains...</p>
              <p className="text-xs text-muted-foreground mt-1">This may take 10-15 seconds</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            {/* Global Assessment + Evidence Summary */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Global Assessment</span>
                      <Badge variant={densityConfig[data.evidence_density]?.variant || "outline"} className="text-xs">
                        <Database className="h-3 w-3 mr-1" />
                        {densityConfig[data.evidence_density]?.label}
                      </Badge>
                      {!data.outcome_trained && (
                        <Badge variant="outline" className="text-xs">
                          Not Outcome-Trained
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm">{data.global_assessment}</p>
                  </div>
                </div>
                {/* Signal counts breakdown */}
                <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="font-medium">{totalSignals} total signals:</span>
                  <span>{data.signal_counts.snapshots} snapshots</span>
                  <span>{data.signal_counts.anomalies} anomalies</span>
                  <span>{data.signal_counts.alerts} alerts</span>
                  <span>{data.signal_counts.crises} crises</span>
                </div>
              </CardContent>
            </Card>

            {/* Insufficient evidence state */}
            {data.recommendations.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <Eye className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="font-medium">Monitor Only</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Insufficient evidence to generate actionable recommendations. The system continues monitoring.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            <div className="space-y-3">
              {data.recommendations.map((rec) => {
                const config = priorityConfig[rec.priority];
                const PriorityIcon = config.icon;
                const isExpanded = expandedRec === rec.id;

                return (
                  <Card key={rec.id} className="overflow-hidden">
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedRec(isExpanded ? null : rec.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-3">
                          <div className={`p-1.5 rounded ${config.color}`}>
                            <PriorityIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-base">{rec.title}</CardTitle>
                              <Badge variant="outline" className="text-xs">{rec.domain}</Badge>
                              <Badge variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {urgencyLabels[rec.urgency] || rec.urgency}
                              </Badge>
                            </div>
                            <CardDescription className="mt-1 line-clamp-2">
                              {rec.signal_summary}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Confidence</div>
                              <div className="text-sm font-bold">{rec.confidence}%</div>
                              <div className="text-[10px] text-muted-foreground">heuristic</div>
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                      </CardHeader>
                    </div>

                    {isExpanded && (
                      <CardContent className="pt-0 space-y-4">
                        <Separator />

                        {/* AICIS Evidence vs AI Reasoning */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="bg-primary/5 p-3 rounded border border-primary/10">
                            <h4 className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                              <Database className="h-3 w-3" /> AICIS Evidence
                            </h4>
                            <p className="text-sm">{rec.signal_summary}</p>
                          </div>
                          {rec.ai_reasoning && (
                            <div className="bg-secondary/30 p-3 rounded border border-secondary/20">
                              <h4 className="text-xs font-semibold mb-1 flex items-center gap-1">
                                <Brain className="h-3 w-3" /> AI Reasoning
                              </h4>
                              <p className="text-sm">{rec.ai_reasoning}</p>
                            </div>
                          )}
                        </div>

                        {/* Recommended Action */}
                        <div>
                          <h4 className="text-sm font-semibold text-primary mb-1">Recommended Action</h4>
                          <p className="text-sm bg-primary/5 p-3 rounded border border-primary/10">
                            {rec.recommended_action}
                          </p>
                        </div>

                        {rec.alternatives && rec.alternatives.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold mb-1">Alternatives</h4>
                            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                              {rec.alternatives.map((alt, i) => (
                                <li key={i}>{alt}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {rec.expected_impact && (
                            <div className="bg-accent/30 p-3 rounded">
                              <h4 className="text-xs font-semibold text-accent-foreground mb-1">If Acted Upon</h4>
                              <p className="text-sm">{rec.expected_impact}</p>
                            </div>
                          )}
                          {rec.risk_if_ignored && (
                            <div className="bg-destructive/10 p-3 rounded">
                              <h4 className="text-xs font-semibold text-destructive mb-1">If Ignored</h4>
                              <p className="text-sm">{rec.risk_if_ignored}</p>
                            </div>
                          )}
                        </div>

                        {rec.affected_countries && rec.affected_countries.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-xs text-muted-foreground mr-1">Affected:</span>
                            {rec.affected_countries.map((c) => (
                              <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        )}

                        {/* Capture to Decision Log */}
                        <Separator />
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            Track this recommendation's real-world outcome
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); handleCaptureToLog(rec); }}
                            disabled={capturingId === rec.id}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            {capturingId === rec.id ? "Capturing..." : "Capture to Decision Log"}
                          </Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Footer */}
            <p className="text-xs text-muted-foreground text-center">
              Generated {new Date(data.generated_at).toLocaleString()} · Scope: {data.scope.country_iso3} / {data.scope.domain} · LLM-guided advisory over proprietary AICIS signals · Not outcome-trained
            </p>
          </>
        )}
      </div>
    </AICISLayout>
  );
}
