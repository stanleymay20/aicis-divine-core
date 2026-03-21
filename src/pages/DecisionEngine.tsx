import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Brain, AlertTriangle, Clock, Target, Shield, RefreshCw, Zap, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  domain: string;
  affected_countries?: string[];
  signal_summary: string;
  recommended_action: string;
  alternatives?: string[];
  confidence: number;
  urgency: "immediate" | "24h" | "7d" | "30d";
  expected_impact?: string;
  risk_if_ignored?: string;
}

interface DecisionResponse {
  ok: boolean;
  recommendations: Recommendation[];
  global_assessment: string;
  signal_quality: "strong" | "moderate" | "weak" | "insufficient";
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

const urgencyLabels = {
  immediate: "Act Now",
  "24h": "Within 24h",
  "7d": "This Week",
  "30d": "This Month",
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
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

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

  return (
    <AICISLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              Decision Engine
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered recommendations from live intelligence signals
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
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
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

        {/* Global Assessment */}
        {data && (
          <>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">Global Assessment</span>
                      <Badge variant="outline" className="text-xs">
                        Signal Quality: {data.signal_quality}
                      </Badge>
                    </div>
                    <p className="text-sm">{data.global_assessment}</p>
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{data.signal_counts.snapshots} snapshots</span>
                    <span>{data.signal_counts.anomalies} anomalies</span>
                    <span>{data.signal_counts.alerts} alerts</span>
                    <span>{data.signal_counts.crises} crises</span>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                                {urgencyLabels[rec.urgency]}
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
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>
                      </CardHeader>
                    </div>

                    {isExpanded && (
                      <CardContent className="pt-0 space-y-4">
                        <Separator />

                        {/* Recommended Action */}
                        <div>
                          <h4 className="text-sm font-semibold text-primary mb-1">Recommended Action</h4>
                          <p className="text-sm bg-primary/5 p-3 rounded border border-primary/10">
                            {rec.recommended_action}
                          </p>
                        </div>

                        {/* Alternatives */}
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
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Footer */}
            <p className="text-xs text-muted-foreground text-center">
              Generated {new Date(data.generated_at).toLocaleString()} · Scope: {data.scope.country_iso3} / {data.scope.domain} · Recommendations are AI-generated advisory signals, not directives
            </p>
          </>
        )}
      </div>
    </AICISLayout>
  );
}
