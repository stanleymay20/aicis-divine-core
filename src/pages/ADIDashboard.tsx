import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Brain, Shield, AlertTriangle, Target, CheckCircle, XCircle,
  Clock, TrendingUp, TrendingDown, Loader2, Crosshair,
  ArrowLeft, Zap, Globe, BarChart3, Send
} from "lucide-react";

const severityColor = (s: number) =>
  s >= 8 ? "text-destructive" : s >= 5 ? "text-warning" : "text-secondary";

const statusBadge = (status: string) => {
  const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "outline", label: "⏳ Pending Review" },
    reviewed: { variant: "secondary", label: "👁 Reviewed" },
    approved: { variant: "default", label: "✅ Approved" },
    rejected: { variant: "destructive", label: "❌ Rejected" },
    executed: { variant: "default", label: "🚀 Executed" },
  };
  const m = map[status] || map.pending;
  return <Badge variant={m.variant}>{m.label}</Badge>;
};

export default function ADIDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("decisions");
  const [customQuery, setCustomQuery] = useState("");

  // Fetch decisions
  const { data: decisions = [], isLoading: loadingDecisions } = useQuery({
    queryKey: ["adi-decisions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("adi_decisions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Fetch conflict signals
  const { data: conflicts = [], isLoading: loadingConflicts } = useQuery({
    queryKey: ["conflict-signals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("conflict_signals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Fetch scenarios
  const { data: scenarios = [] } = useQuery({
    queryKey: ["adi-scenarios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("adi_scenarios")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Run ADI analysis
  const analyzeM = useMutation({
    mutationFn: async (params: { mode: string; custom_query?: string }) => {
      const { data, error } = await supabase.functions.invoke("adi-analyze", { body: params });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`ADI generated ${data.decisions?.length || 0} decision analyses`);
      queryClient.invalidateQueries({ queryKey: ["adi-decisions"] });
      queryClient.invalidateQueries({ queryKey: ["adi-scenarios"] });
    },
    onError: (e: Error) => toast.error(`ADI error: ${e.message}`),
  });

  // Run conflict scan
  const conflictScanM = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("adi-conflict-scan");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Conflict scan: ${data.signals?.length || 0} hotspots analyzed`);
      queryClient.invalidateQueries({ queryKey: ["conflict-signals"] });
    },
    onError: (e: Error) => toast.error(`Scan error: ${e.message}`),
  });

  // Update decision status
  const updateStatusM = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === 'approved') {
        update.approved_by = user?.id;
        update.approved_at = new Date().toISOString();
      } else if (status === 'reviewed') {
        update.reviewed_by = user?.id;
        update.reviewed_at = new Date().toISOString();
      }
      const { error } = await supabase.from("adi_decisions").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decision status updated");
      queryClient.invalidateQueries({ queryKey: ["adi-decisions"] });
    },
  });

  const pendingCount = decisions.filter((d: any) => d.status === 'pending').length;
  const highRiskConflicts = conflicts.filter((c: any) => c.escalation_probability >= 60).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              <h1 className="text-lg font-bold font-['Orbitron'] tracking-wider">
                ADI <span className="text-primary">Artificial Decision Intelligence</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {pendingCount} Pending
            </Badge>
            {highRiskConflicts > 0 && (
              <Badge variant="destructive" className="font-mono text-xs animate-pulse">
                {highRiskConflicts} High-Risk Conflicts
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Shadow Mode Banner */}
        <div className="rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Shadow Mode — AI-Assisted Analysis Only</p>
            <p>ADI generates structured conflict-risk hypotheses for analyst review. Outputs are AI-synthesized, not measured from validated conflict data pipelines (ACLED, UCDP). All recommendations require human review before action. Do not treat as validated early warning.</p>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card/60 border-border/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Target className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold font-['Orbitron']">{decisions.length}</p>
                <p className="text-xs text-muted-foreground">Decisions</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 border-border/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Crosshair className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold font-['Orbitron']">{conflicts.length}</p>
                <p className="text-xs text-muted-foreground">Conflict Signals</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 border-border/30">
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-secondary" />
              <div>
                <p className="text-2xl font-bold font-['Orbitron']">{scenarios.length}</p>
                <p className="text-xs text-muted-foreground">Scenarios</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/60 border-border/30">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold font-['Orbitron']">{highRiskConflicts}</p>
                <p className="text-xs text-muted-foreground">High-Risk Zones</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Query Bar */}
        <Card className="bg-card/60 border-primary/20">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Ask ADI: 'What should we do about the conflict in Eastern Europe?' or 'Analyze food security risks in Sahel...'"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                className="min-h-[60px] bg-background/50 border-border/40 resize-none"
              />
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (customQuery.trim()) {
                      analyzeM.mutate({ mode: 'manual', custom_query: customQuery });
                      setCustomQuery("");
                    }
                  }}
                  disabled={analyzeM.isPending || !customQuery.trim()}
                >
                  {analyzeM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => analyzeM.mutate({ mode: 'auto' })}
                  disabled={analyzeM.isPending}
                >
                  <Zap className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => conflictScanM.mutate()}
                disabled={conflictScanM.isPending}
              >
                {conflictScanM.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Shield className="h-4 w-4 mr-1" />}
                Run Conflict Scan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-card/60">
            <TabsTrigger value="decisions" className="data-[state=active]:bg-primary/20">
              <Brain className="h-4 w-4 mr-1" /> Decisions
            </TabsTrigger>
            <TabsTrigger value="conflicts" className="data-[state=active]:bg-destructive/20">
              <Crosshair className="h-4 w-4 mr-1" /> Conflict Early Warning
            </TabsTrigger>
            <TabsTrigger value="scenarios" className="data-[state=active]:bg-secondary/20">
              <Globe className="h-4 w-4 mr-1" /> Scenarios
            </TabsTrigger>
          </TabsList>

          {/* Decisions Tab */}
          <TabsContent value="decisions" className="space-y-4">
            {loadingDecisions ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : decisions.length === 0 ? (
              <Card className="bg-card/40 border-border/20">
                <CardContent className="p-8 text-center">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No decisions yet. Run an ADI analysis or ask a question above.</p>
                </CardContent>
              </Card>
            ) : (
              decisions.map((d: any) => (
                <DecisionCard key={d.id} decision={d} onUpdateStatus={updateStatusM.mutate} scenarios={scenarios.filter((s: any) => s.decision_id === d.id)} />
              ))
            )}
          </TabsContent>

          {/* Conflicts Tab */}
          <TabsContent value="conflicts" className="space-y-4">
            {loadingConflicts ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-destructive" /></div>
            ) : conflicts.length === 0 ? (
              <Card className="bg-card/40 border-border/20">
                <CardContent className="p-8 text-center">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No conflict signals yet. Run a conflict scan to analyze global hotspots.</p>
                </CardContent>
              </Card>
            ) : (
              conflicts.map((c: any) => <ConflictCard key={c.id} signal={c} />)
            )}
          </TabsContent>

          {/* Scenarios Tab */}
          <TabsContent value="scenarios" className="space-y-4">
            {scenarios.length === 0 ? (
              <Card className="bg-card/40 border-border/20">
                <CardContent className="p-8 text-center">
                  <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Scenarios are generated automatically when ADI produces decisions.</p>
                </CardContent>
              </Card>
            ) : (
              scenarios.map((s: any) => <ScenarioCard key={s.id} scenario={s} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function DecisionCard({ decision, onUpdateStatus, scenarios }: { decision: any; onUpdateStatus: (p: { id: string; status: string }) => void; scenarios: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const options = Array.isArray(decision.options) ? decision.options : [];

  return (
    <Card className="bg-card/60 border-border/30 hover:border-primary/30 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">{decision.domain}</Badge>
              {statusBadge(decision.status)}
              <span className={`text-sm font-bold ${severityColor(decision.severity_score)}`}>
                Severity: {Number(decision.severity_score).toFixed(1)}
              </span>
            </div>
            <CardTitle className="text-sm font-['Rajdhani'] leading-tight">
              {decision.signal_summary}
            </CardTitle>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>{new Date(decision.created_at).toLocaleDateString()}</p>
            <p>Confidence: {Number(decision.confidence).toFixed(0)}%</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Options */}
        {options.length > 0 && (
          <div className="space-y-2">
            {options.slice(0, expanded ? undefined : 1).map((opt: any, i: number) => (
              <div
                key={i}
                className={`p-3 rounded-lg border ${opt.rank === 1 ? 'border-primary/40 bg-primary/5' : 'border-border/20 bg-background/30'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm flex items-center gap-1">
                    {opt.rank === 1 && <TrendingUp className="h-3 w-3 text-primary" />}
                    #{opt.rank}: {opt.action}
                  </span>
                  <Badge variant={opt.risk_level === 'high' ? 'destructive' : opt.risk_level === 'medium' ? 'secondary' : 'outline'} className="text-xs">
                    {opt.effectiveness_pct}% effective · {opt.risk_level} risk
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
                {expanded && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>⏱ {opt.timeframe?.replace('_', ' ')}</span>
                    <span>📦 {opt.resources_required}</span>
                    {opt.tradeoffs && <span className="col-span-2">⚖️ {opt.tradeoffs}</span>}
                  </div>
                )}
              </div>
            ))}
            {options.length > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-xs">
                {expanded ? 'Show less' : `Show ${options.length - 1} more options`}
              </Button>
            )}
          </div>
        )}

        {/* Scenarios preview */}
        {scenarios.length > 0 && expanded && (
          <div className="border-t border-border/20 pt-2">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Scenario Projections</p>
            <div className="grid grid-cols-3 gap-2">
              {scenarios.map((s: any) => (
                <div key={s.id} className="p-2 rounded bg-background/40 text-xs">
                  <p className="font-medium capitalize">{s.scenario_type.replace('_', ' ')}</p>
                  <p className="text-muted-foreground">
                    30d: {s.projection_30d?.stability_delta > 0 ? '+' : ''}{s.projection_30d?.stability_delta || 0}
                  </p>
                  <p className="text-muted-foreground">
                    90d: {s.projection_90d?.stability_delta > 0 ? '+' : ''}{s.projection_90d?.stability_delta || 0}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reasoning */}
        {expanded && decision.reasoning_md && (
          <div className="border-t border-border/20 pt-2">
            <p className="text-xs font-semibold text-muted-foreground mb-1">ADI Reasoning</p>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{decision.reasoning_md}</p>
          </div>
        )}

        {/* Actions */}
        {decision.status === 'pending' && (
          <div className="flex gap-2 pt-2 border-t border-border/20">
            <Button size="sm" variant="outline" onClick={() => onUpdateStatus({ id: decision.id, status: 'reviewed' })}>
              <Clock className="h-3 w-3 mr-1" /> Mark Reviewed
            </Button>
            <Button size="sm" onClick={() => onUpdateStatus({ id: decision.id, status: 'approved' })}>
              <CheckCircle className="h-3 w-3 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onUpdateStatus({ id: decision.id, status: 'rejected' })}>
              <XCircle className="h-3 w-3 mr-1" /> Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ConflictCard({ signal }: { signal: any }) {
  const prob = Number(signal.escalation_probability);
  const probColor = prob >= 70 ? 'text-destructive' : prob >= 40 ? 'text-warning' : 'text-secondary';
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={`bg-card/60 border-border/30 ${prob >= 70 ? 'border-destructive/30' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={prob >= 70 ? "destructive" : prob >= 40 ? "secondary" : "outline"} className="text-xs">
                {signal.conflict_type || 'Unknown type'}
              </Badge>
              <span className="text-xs text-muted-foreground">{signal.country_iso3}</span>
            </div>
            <CardTitle className="text-sm font-['Rajdhani']">{signal.region}</CardTitle>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold font-['Orbitron'] ${probColor}`}>{prob.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Escalation Risk</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Signal meters */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          {[
            { label: 'Protest', value: signal.protest_momentum },
            { label: 'Conflict', value: signal.conflict_intensity },
            { label: 'Military', value: signal.military_escalation },
            { label: 'Diplomatic', value: signal.diplomatic_tension },
            { label: 'Media', value: signal.media_hostility_index },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="h-16 w-full bg-background/40 rounded relative overflow-hidden">
                <div
                  className={`absolute bottom-0 w-full rounded transition-all ${Number(value) >= 70 ? 'bg-destructive/60' : Number(value) >= 40 ? 'bg-warning/60' : 'bg-secondary/60'}`}
                  style={{ height: `${Math.min(Number(value), 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
              <p className="text-xs font-bold">{Number(value).toFixed(0)}</p>
            </div>
          ))}
        </div>

        {signal.time_to_conflict_days && (
          <p className="text-xs text-destructive font-medium">
            ⚠ Est. time to conflict: {Number(signal.time_to_conflict_days).toFixed(0)} days
          </p>
        )}

        {expanded && (
          <>
            {signal.involved_parties?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-muted-foreground">Involved Parties</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(signal.involved_parties as string[]).map((p, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{p}</Badge>
                  ))}
                </div>
              </div>
            )}
            {signal.assessment_md && (
              <div className="mt-2 border-t border-border/20 pt-2">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{signal.assessment_md}</p>
              </div>
            )}
          </>
        )}

        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="text-xs mt-2">
          {expanded ? 'Collapse' : 'View Details'}
        </Button>
      </CardContent>
    </Card>
  );
}

function ScenarioCard({ scenario }: { scenario: any }) {
  const typeColor = scenario.scenario_type === 'best_case' ? 'text-secondary' : scenario.scenario_type === 'worst_case' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <Card className="bg-card/60 border-border/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-semibold capitalize ${typeColor}`}>
            {scenario.scenario_type === 'best_case' && <TrendingUp className="h-3 w-3 inline mr-1" />}
            {scenario.scenario_type === 'worst_case' && <TrendingDown className="h-3 w-3 inline mr-1" />}
            {scenario.scenario_type.replace('_', ' ')}
          </span>
          <span className="text-xs text-muted-foreground">Confidence: {Number(scenario.confidence).toFixed(0)}%</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">{scenario.scenario_name}</p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded bg-background/40">
            <p className="text-muted-foreground">30 days</p>
            <p className="font-bold">{scenario.projection_30d?.stability_delta > 0 ? '+' : ''}{scenario.projection_30d?.stability_delta || 0}</p>
          </div>
          <div className="p-2 rounded bg-background/40">
            <p className="text-muted-foreground">60 days</p>
            <p className="font-bold">{scenario.projection_60d?.stability_delta > 0 ? '+' : ''}{scenario.projection_60d?.stability_delta || 0}</p>
          </div>
          <div className="p-2 rounded bg-background/40">
            <p className="text-muted-foreground">90 days</p>
            <p className="font-bold">{scenario.projection_90d?.stability_delta > 0 ? '+' : ''}{scenario.projection_90d?.stability_delta || 0}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
