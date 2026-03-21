import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Shield, Activity, Database, Brain, CheckCircle, AlertTriangle, Target, TrendingUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReadinessScore {
  category: string;
  score: number;
  maxScore: number;
  items: { label: string; met: boolean; detail: string }[];
}

const EnterpriseReadiness = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["enterprise-readiness"],
    queryFn: async () => {
      const [
        { count: validations },
        { data: logs },
        { data: snapshots },
        { data: intelScore },
        { data: divisions },
        { count: auditEntries },
        { count: scenarios },
        { count: calibrations },
      ] = await Promise.all([
        supabase.from("forecast_validation_results").select("*", { count: "exact", head: true }),
        supabase.from("automation_logs").select("job_name, status, executed_at").order("executed_at", { ascending: false }).limit(1000),
        supabase.from("country_performance_snapshots").select("snapshot_date").order("snapshot_date", { ascending: false }).limit(31),
        supabase.from("intelligence_score_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(1),
        supabase.from("ai_divisions").select("status"),
        supabase.from("automation_logs").select("*", { count: "exact", head: true }),
        supabase.from("adi_scenarios").select("*", { count: "exact", head: true }),
        supabase.from("calibration_metrics").select("*", { count: "exact", head: true }),
      ]);

      // Compute pipeline success rate (exclude "running")
      const completedLogs = (logs || []).filter((l: any) => l.status !== "running");
      const successLogs = completedLogs.filter((l: any) => l.status === "success");
      const pipelineRate = completedLogs.length > 0 ? Math.round((successLogs.length / completedLogs.length) * 100) : 0;

      // Compute streak
      const dates = new Set((snapshots || []).map((s: any) => s.snapshot_date));
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 31; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split("T")[0];
        if (dates.has(ds)) streak++;
        else break;
      }

      const grade = intelScore?.[0]?.intelligence_grade || "SENSING";
      const tpAccuracy = intelScore?.[0]?.turning_point_accuracy || 0;
      const operationalDivisions = (divisions || []).filter((d: any) => d.status === "operational").length;

      return {
        validations: validations || 0,
        pipelineRate,
        streak,
        grade,
        tpAccuracy,
        operationalDivisions,
        totalDivisions: (divisions || []).length,
        auditEntries: auditEntries || 0,
        scenarios: scenarios || 0,
        calibrations: calibrations || 0,
      };
    },
    enabled: !!user,
  });

  if (authLoading || !user) return null;

  // Compute readiness scores
  const scores: ReadinessScore[] = data ? [
    {
      category: "Reliability",
      score: [
        data.pipelineRate >= 95,
        data.streak >= 14,
        data.operationalDivisions >= 7,
        data.pipelineRate >= 80,
      ].filter(Boolean).length,
      maxScore: 4,
      items: [
        { label: "Pipeline success rate ≥ 95%", met: data.pipelineRate >= 95, detail: `Current: ${data.pipelineRate}%` },
        { label: "Snapshot streak ≥ 14 days", met: data.streak >= 14, detail: `Current: ${data.streak} days` },
        { label: "7+ divisions operational", met: data.operationalDivisions >= 7, detail: `${data.operationalDivisions}/${data.totalDivisions}` },
        { label: "Pipeline rate ≥ 80% (minimum)", met: data.pipelineRate >= 80, detail: `Current: ${data.pipelineRate}%` },
      ],
    },
    {
      category: "Evidence",
      score: [
        data.validations >= 10000,
        data.validations >= 30000,
        data.calibrations >= 1000,
        data.scenarios >= 20,
      ].filter(Boolean).length,
      maxScore: 4,
      items: [
        { label: "10,000+ forecast validations", met: data.validations >= 10000, detail: `Current: ${data.validations.toLocaleString()}` },
        { label: "30,000+ forecast validations", met: data.validations >= 30000, detail: `Target: 30,000` },
        { label: "1,000+ calibration metrics", met: data.calibrations >= 1000, detail: `Current: ${data.calibrations.toLocaleString()}` },
        { label: "20+ AI-generated scenarios", met: data.scenarios >= 20, detail: `Current: ${data.scenarios}` },
      ],
    },
    {
      category: "Intelligence Maturity",
      score: [
        data.tpAccuracy >= 20,
        data.tpAccuracy >= 40,
        data.grade !== "SENSING",
        data.streak >= 30,
      ].filter(Boolean).length,
      maxScore: 4,
      items: [
        { label: "Turning-point accuracy ≥ 20%", met: data.tpAccuracy >= 20, detail: `Current: ${data.tpAccuracy}%` },
        { label: "Turning-point accuracy ≥ 40% (PREDICTING)", met: data.tpAccuracy >= 40, detail: `Target grade: PREDICTING` },
        { label: "Intelligence grade above SENSING", met: data.grade !== "SENSING", detail: `Current: ${data.grade}` },
        { label: "30-day continuous data streak", met: data.streak >= 30, detail: `Current: ${data.streak} days` },
      ],
    },
    {
      category: "Trust & Governance",
      score: [
        true, // Privacy policy exists
        true, // Terms exist
        true, // Advisory mode
        data.auditEntries >= 100,
      ].filter(Boolean).length,
      maxScore: 4,
      items: [
        { label: "Privacy policy published", met: true, detail: "Active at /privacy" },
        { label: "Terms of use published", met: true, detail: "Active at /terms" },
        { label: "System in advisory mode", met: true, detail: "Shadow Mode enforced" },
        { label: "100+ audit log entries", met: data.auditEntries >= 100, detail: `Current: ${data.auditEntries.toLocaleString()}` },
      ],
    },
  ] : [];

  const totalScore = scores.reduce((s, c) => s + c.score, 0);
  const totalMax = scores.reduce((s, c) => s + c.maxScore, 0);
  const overallPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  const readinessLevel = overallPct >= 90 ? "Enterprise-Ready" : overallPct >= 75 ? "Reviewer-Ready" : overallPct >= 50 ? "Validation Phase" : "Early Stage";

  return (
    <AICISLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-orbitron font-bold text-foreground flex items-center gap-3">
            <Target className="h-7 w-7 text-primary" />
            Enterprise Readiness
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live assessment of AICIS readiness for institutional deployment
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Overall Score */}
            <Card className="border-primary/30">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-3xl font-orbitron font-bold text-primary">{overallPct}%</p>
                    <p className="text-sm text-muted-foreground">Overall Enterprise Readiness</p>
                  </div>
                  <Badge variant={overallPct >= 75 ? "default" : "secondary"} className="text-sm px-3 py-1">
                    {readinessLevel}
                  </Badge>
                </div>
                <Progress value={overallPct} className="h-3" />
                <p className="text-xs text-muted-foreground mt-2">
                  {totalScore} of {totalMax} criteria met · Last updated: live
                </p>
              </CardContent>
            </Card>

            {/* Category Scores */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scores.map((cat) => {
                const pct = Math.round((cat.score / cat.maxScore) * 100);
                const CategoryIcon = cat.category === "Reliability" ? Activity :
                  cat.category === "Evidence" ? Database :
                  cat.category === "Intelligence Maturity" ? Brain : Shield;

                return (
                  <Card key={cat.category}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <CategoryIcon className="h-4 w-4 text-primary" />
                          {cat.category}
                        </CardTitle>
                        <span className="text-sm font-orbitron font-bold">{cat.score}/{cat.maxScore}</span>
                      </div>
                      <Progress value={pct} className="h-1.5 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {cat.items.map((item) => (
                        <div key={item.label} className="flex items-start gap-2">
                          {item.met ? (
                            <CheckCircle className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                          ) : (
                            <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className={`text-xs ${item.met ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</p>
                            <p className="text-[10px] text-muted-foreground">{item.detail}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Link to="/system-health"><Button variant="outline" size="sm" className="w-full text-xs gap-1"><Activity className="h-3 w-3" />System Status<ExternalLink className="h-2.5 w-2.5" /></Button></Link>
              <Link to="/prediction-accuracy"><Button variant="outline" size="sm" className="w-full text-xs gap-1"><TrendingUp className="h-3 w-3" />Accuracy<ExternalLink className="h-2.5 w-2.5" /></Button></Link>
              <Link to="/trust"><Button variant="outline" size="sm" className="w-full text-xs gap-1"><Shield className="h-3 w-3" />Trust Layer<ExternalLink className="h-2.5 w-2.5" /></Button></Link>
              <Link to="/competitive-landscape"><Button variant="outline" size="sm" className="w-full text-xs gap-1"><Target className="h-3 w-3" />Positioning<ExternalLink className="h-2.5 w-2.5" /></Button></Link>
            </div>

            {/* Disclaimer */}
            <Card className="border-warning/20 bg-warning/5">
              <CardContent className="p-4 text-xs text-muted-foreground">
                <strong className="text-foreground">Note:</strong> Enterprise readiness is assessed against internal criteria based on
                reliability, evidence depth, intelligence maturity, and governance posture. These metrics are self-reported from live system data
                and should be independently verified during formal due diligence.
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AICISLayout>
  );
};

export default EnterpriseReadiness;
