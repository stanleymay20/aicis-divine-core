import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Shield, Activity, Eye, BarChart3, Target, CheckCircle2, AlertTriangle, Clock, Siren } from "lucide-react";

interface DimensionData {
  label: string;
  score: number;
  target: number;
  icon: React.ElementType;
  items: { name: string; status: "done" | "partial" | "missing"; detail: string }[];
}

const GovReadiness = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Live data queries for scoring
  const { data: pipelineHealth } = useQuery({
    queryKey: ["gov-pipeline-health"],
    queryFn: async () => {
      const { data } = await supabase.from("pipeline_health").select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: validations } = useQuery({
    queryKey: ["gov-validations-count"],
    queryFn: async () => {
      const { count } = await supabase.from("forecast_validation_results" as any).select("*", { count: "exact", head: true });
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: decisionEntries } = useQuery({
    queryKey: ["gov-decision-entries"],
    queryFn: async () => {
      const { data } = await supabase.from("decision_outcome_log").select("evidence_type");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: slaDefinitions } = useQuery({
    queryKey: ["gov-sla-defs"],
    queryFn: async () => {
      const { data } = await supabase.from("sla_definitions" as any).select("*");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: auditChainCount } = useQuery({
    queryKey: ["gov-audit-chain-count"],
    queryFn: async () => {
      const { count } = await supabase.from("signal_audit_chain" as any).select("*", { count: "exact", head: true });
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: slaBreaches } = useQuery({
    queryKey: ["gov-sla-breaches"],
    queryFn: async () => {
      // Check breaches client-side from pipeline_health + sla_definitions
      if (!pipelineHealth || !slaDefinitions) return [];
      const now = Date.now();
      const breaches: { pipeline: string; type: string; detail: string; severity: string }[] = [];
      for (const sla of slaDefinitions as any[]) {
        const p = (pipelineHealth as any[]).find((ph: any) => ph.pipeline_name === sla.pipeline_name);
        if (p?.last_success_at) {
          const staleH = (now - new Date(p.last_success_at).getTime()) / 3600000;
          if (staleH > sla.max_stale_hours) {
            breaches.push({ pipeline: sla.pipeline_name, type: "Stale", detail: `${Math.round(staleH)}h > ${sla.max_stale_hours}h`, severity: staleH > sla.max_stale_hours * 2 ? "critical" : "warning" });
          }
        }
        if (p?.consecutive_failures >= sla.max_consecutive_failures) {
          breaches.push({ pipeline: sla.pipeline_name, type: "Failures", detail: `${p.consecutive_failures} consecutive`, severity: "critical" });
        }
      }
      return breaches;
    },
    enabled: !!user && !!pipelineHealth && !!slaDefinitions,
  });

  if (authLoading || !user) return null;

  // Compute live scores
  const totalPipelines = pipelineHealth?.length || 0;
  const healthyPipelines = pipelineHealth?.filter((p: any) => p.status === "healthy").length || 0;
  const pipelineUptime = totalPipelines > 0 ? Math.round((healthyPipelines / totalPipelines) * 100) : 0;
  const hasSLAs = (slaDefinitions?.length || 0) > 0;

  const pilotEntries = decisionEntries?.filter((e: any) => e.evidence_type === "pilot").length || 0;
  const measuredEntries = decisionEntries?.filter((e: any) => e.evidence_type === "measured").length || 0;
  const totalDecisions = decisionEntries?.length || 0;

  const reliabilityScore = Math.min(100, Math.round(
    (pipelineUptime * 0.4) + (hasSLAs ? 20 : 0) + (totalPipelines > 10 ? 20 : totalPipelines * 2) + 20
  ));

  const securityScore = Math.min(100, Math.round(
    25 + // RLS exists
    15 + // RBAC exists
    10 + // GDPR page exists
    10 + // advisory mode
    (hasSLAs ? 10 : 0) +
    10 // encryption at rest (Supabase default)
  ));

  const evidenceScore = Math.min(100, Math.round(
    Math.min(30, ((validations as number) / 1000) * 30) +
    Math.min(25, pilotEntries * 5) +
    Math.min(25, measuredEntries * 10) +
    (totalDecisions > 0 ? 20 : 0)
  ));

  const opsScore = Math.min(100, Math.round(
    (totalPipelines > 0 ? 25 : 0) +
    (hasSLAs ? 25 : 0) +
    25 + // lifecycle registry exists
    15 // infra-ops page exists
  ));

  const overallScore = Math.round((reliabilityScore + securityScore + evidenceScore + opsScore) / 4);

  const grade = overallScore >= 90 ? "Government-Grade" :
    overallScore >= 75 ? "Enterprise-Ready" :
    overallScore >= 60 ? "Pilot-Ready" :
    overallScore >= 40 ? "Reviewer-Ready" : "Pre-Pilot";

  const gradeColor = overallScore >= 90 ? "text-success" :
    overallScore >= 75 ? "text-primary" :
    overallScore >= 60 ? "text-accent-foreground" :
    "text-warning";

  const dimensions: DimensionData[] = [
    {
      label: "Reliability",
      score: reliabilityScore,
      target: 95,
      icon: Activity,
      items: [
        { name: "Pipeline uptime tracking", status: totalPipelines > 0 ? "done" : "missing", detail: `${pipelineUptime}% healthy` },
        { name: "SLA/SLO definitions", status: hasSLAs ? "done" : "missing", detail: `${slaDefinitions?.length || 0} defined` },
        { name: "Failure alerting", status: "partial", detail: "Internal alerts active" },
        { name: "Automatic retry/backoff", status: "done", detail: "Circuit breaker pattern" },
        { name: "Disaster recovery", status: "missing", detail: "Not yet multi-region" },
      ],
    },
    {
      label: "Security & Compliance",
      score: securityScore,
      target: 95,
      icon: Shield,
      items: [
        { name: "Row-Level Security", status: "done", detail: "All tables protected" },
        { name: "Role-based access (RBAC)", status: "done", detail: "Admin/observer/analyst" },
        { name: "GDPR data rights", status: "done", detail: "/compliance portal" },
        { name: "Audit trail", status: "partial", detail: "audit_log table active" },
        { name: "SOC2 / ISO 27001", status: "missing", detail: "Not yet certified" },
      ],
    },
    {
      label: "Evidence & Decision Impact",
      score: evidenceScore,
      target: 80,
      icon: BarChart3,
      items: [
        { name: "Forecast validations", status: (validations as number) > 1000 ? "done" : "partial", detail: `${(validations as number)?.toLocaleString()} validations` },
        { name: "Decision outcome log", status: totalDecisions > 0 ? "done" : "missing", detail: `${totalDecisions} entries` },
        { name: "Pilot actions recorded", status: pilotEntries > 0 ? "partial" : "missing", detail: `${pilotEntries} pilot records` },
        { name: "Measured outcomes", status: measuredEntries > 0 ? "done" : "missing", detail: `${measuredEntries} measured` },
        { name: "Impact scoring doctrine", status: "done", detail: "5-band standard defined" },
      ],
    },
    {
      label: "Operational Maturity",
      score: opsScore,
      target: 90,
      icon: Eye,
      items: [
        { name: "Data lifecycle registry", status: "done", detail: "33 tables classified" },
        { name: "Pipeline health monitoring", status: totalPipelines > 0 ? "done" : "missing", detail: `${totalPipelines} pipelines tracked` },
        { name: "Infra ops console", status: "done", detail: "/infra-ops active" },
        { name: "SLA definitions", status: hasSLAs ? "done" : "missing", detail: "Target uptime + staleness" },
        { name: "Incident response system", status: "missing", detail: "Not yet formalized" },
      ],
    },
  ];

  const statusIcon = (s: string) => {
    if (s === "done") return <CheckCircle2 className="h-3 w-3 text-success" />;
    if (s === "partial") return <Clock className="h-3 w-3 text-warning" />;
    return <AlertTriangle className="h-3 w-3 text-destructive" />;
  };

  return (
    <AICISLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-orbitron font-bold flex items-center gap-3">
            <Target className="h-7 w-7 text-primary" />
            Government-Grade Readiness
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            90-day roadmap to institutional deployment readiness
          </p>
        </div>

        {/* Overall score */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Overall Readiness</p>
                <p className={`text-4xl font-orbitron font-bold ${gradeColor}`}>{overallScore}%</p>
              </div>
              <Badge className="text-sm px-3 py-1">{grade}</Badge>
            </div>
            <Progress value={overallScore} className="h-3" />
            <div className="grid grid-cols-4 gap-4 mt-4">
              {dimensions.map((d) => (
                <div key={d.label} className="text-center">
                  <p className="text-lg font-bold">{d.score}%</p>
                  <p className="text-[10px] text-muted-foreground">{d.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dimension cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dimensions.map((dim) => {
            const Icon = dim.icon;
            const done = dim.items.filter((i) => i.status === "done").length;
            const total = dim.items.length;

            return (
              <Card key={dim.label}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      {dim.label}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{done}/{total}</span>
                      <Badge variant={dim.score >= dim.target ? "default" : "outline"} className="text-[10px]">
                        {dim.score}% / {dim.target}%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {dim.items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {statusIcon(item.status)}
                        <span>{item.name}</span>
                      </div>
                      <span className="text-muted-foreground text-[10px]">{item.detail}</span>
                    </div>
                  ))}
                  <Progress value={dim.score} className="h-1.5 mt-2" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* SLA Breaches + Audit Chain Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className={slaBreaches && slaBreaches.length > 0 ? "border-destructive/30" : "border-success/30"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Siren className="h-4 w-4" />
                SLA Breaches
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!slaBreaches || slaBreaches.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  No active SLA breaches
                </div>
              ) : (
                <div className="space-y-2">
                  {slaBreaches.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`h-3 w-3 ${b.severity === "critical" ? "text-destructive" : "text-warning"}`} />
                        <span className="font-mono">{b.pipeline}</span>
                      </div>
                      <span className="text-muted-foreground">{b.type}: {b.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Signal Audit Chain
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-2xl font-bold">{(auditChainCount as number)?.toLocaleString() || 0}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Auditable signal entries</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="text-center bg-muted/20 rounded-lg p-2">
                  <p className="text-xs font-bold">Full</p>
                  <p className="text-[9px] text-muted-foreground">Coverage scope</p>
                </div>
                <div className="text-center bg-muted/20 rounded-lg p-2">
                  <p className="text-xs font-bold">SHA-256</p>
                  <p className="text-[9px] text-muted-foreground">Hash algorithm</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Recursive canonical JSON + SHA-256. Every snapshot is audited with input/output hashes.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Roadmap timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">90-Day Roadmap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { phase: "Week 1–2", label: "Reliability Foundation", items: ["Define SLAs for all critical pipelines", "Add failure alerting", "Uptime tracking dashboard"], status: hasSLAs ? "done" : "partial" },
              { phase: "Week 3–4", label: "Security Hardening", items: ["Complete audit trail coverage", "Document encryption standards", "Environment separation"], status: "partial" },
              { phase: "Month 2", label: "Evidence Density", items: ["5+ pilot partner records", "First measured outcomes", "Cross-domain validated wins"], status: pilotEntries >= 5 ? "done" : "missing" },
              { phase: "Month 3", label: "Operational Maturity", items: ["Incident response formalized", "Weekly ops review process", "Reproducibility verification"], status: "missing" },
            ].map((phase) => (
              <div key={phase.phase} className="flex gap-4">
                <div className="w-20 shrink-0">
                  <Badge variant="outline" className="text-[10px] w-full justify-center">{phase.phase}</Badge>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {statusIcon(phase.status)}
                    <span className="text-xs font-medium">{phase.label}</span>
                  </div>
                  <ul className="text-[10px] text-muted-foreground space-y-0.5 ml-5">
                    {phase.items.map((i) => (
                      <li key={i}>• {i}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Transparency */}
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-4 text-xs text-muted-foreground">
            <strong className="text-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Honest Assessment
            </strong>
            <p className="mt-1">
              AICIS is currently <strong>Pilot-Ready</strong>, not Government-Grade. 
              Government systems require 99.9%+ uptime, SOC2/ISO certification, proven decision impact, 
              and formalized incident response. This page tracks live progress toward those standards.
            </p>
          </CardContent>
        </Card>
      </div>
    </AICISLayout>
  );
};

export default GovReadiness;
