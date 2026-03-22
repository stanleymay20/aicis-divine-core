import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Shield,
  TrendingUp,
  XCircle,
  Cpu,
  Clock,
} from "lucide-react";

interface KPIData {
  activeRecommendations: number;
  pendingReviews: number;
  criticalAlerts: number;
  modelSafety: string;
  trustScore: number;
  evidenceMaturity: string;
  executionRate: number;
  measuredOutcomes: number;
}

export const AICISMainView = () => {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIData>({
    activeRecommendations: 0,
    pendingReviews: 0,
    criticalAlerts: 0,
    modelSafety: "Loading",
    trustScore: 0,
    evidenceMaturity: "—",
    executionRate: 0,
    measuredOutcomes: 0,
  });
  const [recentDecisions, setRecentDecisions] = useState<any[]>([]);
  const [silentFailures, setSilentFailures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Parallel fetch all KPI sources
        const [
          { count: recCount },
          { count: alertCount },
          { data: outcomes },
          { data: models },
          { data: silentData },
          { data: recent },
        ] = await Promise.all([
          supabase.from("decision_outcome_log").select("*", { count: "exact", head: true }).eq("review_status", "pending"),
          supabase.from("critical_alerts").select("*", { count: "exact", head: true }).eq("acknowledged", false),
          supabase.from("decision_outcome_log").select("execution_status, outcome_success, evidence_type, recommendation_accepted").limit(500),
          supabase.from("decision_models").select("status, metadata").order("created_at", { ascending: false }).limit(3),
          supabase.from("silent_failure_state").select("*").in("severity", ["critical", "high"]).eq("resolved", false).limit(10),
          supabase.from("decision_outcome_log").select("id, action_type, domain, recommendation_accepted, outcome_success, review_status, evidence_type, created_at").order("created_at", { ascending: false }).limit(8),
        ]);

        const total = outcomes?.length || 0;
        const accepted = outcomes?.filter(o => o.recommendation_accepted)?.length || 0;
        const executed = outcomes?.filter(o => o.execution_status === "completed")?.length || 0;
        const measured = outcomes?.filter(o => o.evidence_type === "measured")?.length || 0;

        const activeModel = models?.find(m => m.status === "active");
        const modelSafe = activeModel ? (activeModel.calibration_error < 0.15 ? "Secure" : "Degraded") : "No Model";

        // Evidence maturity
        let maturity = "None";
        if (measured > 20) maturity = "High";
        else if (measured > 5) maturity = "Medium";
        else if (total > 0) maturity = "Low";

        setKpis({
          activeRecommendations: total,
          pendingReviews: recCount || 0,
          criticalAlerts: alertCount || 0,
          modelSafety: modelSafe,
          trustScore: Math.min(100, Math.round((measured / Math.max(total, 1)) * 100 * 0.4 + (executed / Math.max(accepted, 1)) * 100 * 0.6)),
          evidenceMaturity: maturity,
          executionRate: accepted > 0 ? Math.round((executed / accepted) * 100) : 0,
          measuredOutcomes: measured,
        });

        setSilentFailures(silentData || []);
        setRecentDecisions(recent || []);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const KPICard = ({ label, value, icon: Icon, trend, color }: { label: string; value: string | number; icon: any; trend?: string; color?: string }) => (
    <Card className="card-hover">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <Icon className={cn("h-4 w-4", color || "text-muted-foreground")} />
        </div>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {trend && <span className="text-[11px] text-muted-foreground mt-1">{trend}</span>}
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold">Executive Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Decision intelligence overview</p>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard label="Active Recommendations" value={kpis.activeRecommendations} icon={Brain} color="text-primary" />
        <KPICard label="Pending Reviews" value={kpis.pendingReviews} icon={Clock} color="text-warning" />
        <KPICard label="Evidence Maturity" value={kpis.evidenceMaturity} icon={TrendingUp} color="text-secondary" />
        <KPICard label="Model Safety" value={kpis.modelSafety} icon={Shield} color={kpis.modelSafety === "Secure" ? "text-success" : "text-destructive"} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Trust + Actions */}
        <div className="lg:col-span-2 space-y-4">
          {/* Trust Score + Execution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card className="card-hover">
              <CardContent className="p-5">
                <div className="text-xs text-muted-foreground font-medium mb-1">Trust Score</div>
                <div className="flex items-end gap-3">
                  <span className={cn(
                    "text-4xl font-bold tabular-nums",
                    kpis.trustScore >= 70 ? "text-success" : kpis.trustScore >= 40 ? "text-warning" : "text-destructive"
                  )}>
                    {kpis.trustScore}
                  </span>
                  <span className="text-sm text-muted-foreground mb-1">/ 100</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full mt-3">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      kpis.trustScore >= 70 ? "bg-success" : kpis.trustScore >= 40 ? "bg-warning" : "bg-destructive"
                    )}
                    style={{ width: `${kpis.trustScore}%` }}
                  />
                </div>
                {kpis.measuredOutcomes < 20 && (
                  <Badge variant="outline" className="mt-2 text-[10px] text-warning border-warning/30">
                    Low measured evidence
                  </Badge>
                )}
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardContent className="p-5">
                <div className="text-xs text-muted-foreground font-medium mb-1">Execution Rate</div>
                <div className="flex items-end gap-3">
                  <span className="text-4xl font-bold tabular-nums">{kpis.executionRate}%</span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full mt-3">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${kpis.executionRate}%` }} />
                </div>
                <div className="text-[11px] text-muted-foreground mt-2">{kpis.measuredOutcomes} measured outcomes</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Decisions */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Recent Decisions</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs text-primary h-7" onClick={() => navigate("/decision-ops")}>
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentDecisions.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No decisions yet</div>
              ) : (
                <div className="divide-y divide-border">
                  {recentDecisions.slice(0, 5).map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          d.outcome_success === true && "bg-success",
                          d.outcome_success === false && "bg-destructive",
                          d.outcome_success === null && "bg-muted-foreground"
                        )} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{d.action_type || "—"}</div>
                          <div className="text-[11px] text-muted-foreground">{d.domain}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          d.evidence_type === "measured" && "border-success/30 text-success",
                          d.evidence_type === "pilot" && "border-primary/30 text-primary",
                        )}>
                          {d.evidence_type || "pilot"}
                        </Badge>
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          d.review_status === "approved" && "border-success/30 text-success",
                          d.review_status === "pending" && "border-warning/30 text-warning",
                          d.review_status === "rejected" && "border-destructive/30 text-destructive",
                        )}>
                          {d.review_status || "pending"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Alerts + Silent Failures */}
        <div className="space-y-4">
          {/* Critical Alerts */}
          <Card className={cn(kpis.criticalAlerts > 0 && "border-destructive/30")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className={cn("h-4 w-4", kpis.criticalAlerts > 0 ? "text-destructive" : "text-muted-foreground")} />
                Critical Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kpis.criticalAlerts > 0 ? (
                <div className="text-3xl font-bold text-destructive">{kpis.criticalAlerts}</div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  All clear
                </div>
              )}
            </CardContent>
          </Card>

          {/* Silent Failures */}
          <Card className={cn(silentFailures.length > 0 && "border-warning/30")}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Silent Failures
              </CardTitle>
            </CardHeader>
            <CardContent>
              {silentFailures.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  No active failures
                </div>
              ) : (
                <div className="space-y-2">
                  {silentFailures.slice(0, 4).map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <XCircle className="h-3 w-3 text-warning shrink-0" />
                      <span className="text-muted-foreground truncate">{f.failure_type || "Unknown"}</span>
                      <Badge variant="outline" className="text-[9px] ml-auto shrink-0">{f.severity}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick nav */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Quick Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { label: "Decision Operations", path: "/decision-ops", icon: Activity },
                { label: "Operational Truth", path: "/operational-truth", icon: Cpu },
                { label: "Governance", path: "/governance", icon: Shield },
                { label: "Models", path: "/decision-engine", icon: Brain },
              ].map(({ label, path, icon: Icon }) => (
                <Button
                  key={path}
                  variant="ghost"
                  className="w-full justify-start gap-2 h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate(path)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  <ArrowRight className="h-3 w-3 ml-auto" />
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
