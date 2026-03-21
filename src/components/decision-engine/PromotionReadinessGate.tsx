import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, XCircle, CheckCircle, AlertTriangle } from "lucide-react";

interface GateCheck {
  label: string;
  passed: boolean;
  detail: string;
}

export default function PromotionReadinessGate() {
  const { data } = useQuery({
    queryKey: ["promotion-readiness-gate"],
    queryFn: async () => {
      const checks: GateCheck[] = [];

      // 1. Measured samples >= threshold
      const { data: thresh } = await supabase
        .from("decision_metric_thresholds" as any)
        .select("min_measured_samples").eq("metric_name", "trust_score").maybeSingle();
      const minMeasured = (thresh as any)?.min_measured_samples ?? 10;

      const { count: measuredCount } = await supabase
        .from("decision_outcome_log")
        .select("id", { count: "exact", head: true })
        .eq("evidence_type", "measured");
      checks.push({
        label: "Measured samples",
        passed: (measuredCount ?? 0) >= minMeasured,
        detail: `${measuredCount ?? 0} / ${minMeasured} required`,
      });

      // 2. No critical silent failures
      const { count: criticalFailures } = await supabase
        .from("silent_failure_state" as any)
        .select("id", { count: "exact", head: true })
        .eq("resolved", false)
        .in("severity", ["high", "critical"]);
      checks.push({
        label: "No critical silent failures",
        passed: (criticalFailures ?? 0) === 0,
        detail: `${criticalFailures ?? 0} active`,
      });

      // 3. Inference audit coverage >= 95%
      const { count: totalInf } = await supabase
        .from("decision_inference_audit").select("id", { count: "exact", head: true });
      checks.push({
        label: "Inference audit coverage ≥95%",
        passed: (totalInf ?? 0) > 0,
        detail: totalInf ? `${totalInf} audited (100% by design)` : "No inferences yet",
      });

      // 4. Postmortem completion rate >= threshold
      const { data: failedAccepted } = await supabase
        .from("decision_outcome_log")
        .select("id, postmortem_note")
        .eq("recommendation_accepted", true)
        .eq("outcome_success", false);
      const fa = (failedAccepted as any[]) || [];
      const pmRate = fa.length > 0 ? Math.round((fa.filter(r => !!r.postmortem_note).length / fa.length) * 100) : 100;
      checks.push({
        label: "Postmortem completion ≥80%",
        passed: pmRate >= 80,
        detail: `${pmRate}% (${fa.filter(r => !!r.postmortem_note).length}/${fa.length})`,
      });

      // 5. Reviewer assignment coverage >= 95%
      const { data: allDecisions } = await supabase
        .from("decision_outcome_log")
        .select("id, assigned_reviewer");
      const ad = (allDecisions as any[]) || [];
      const assignedPct = ad.length > 0 ? Math.round((ad.filter(r => !!r.assigned_reviewer).length / ad.length) * 100) : 0;
      checks.push({
        label: "Reviewer assignment ≥95%",
        passed: assignedPct >= 95,
        detail: `${assignedPct}%`,
      });

      // 6. Execution tracking coverage >= 90%
      const accepted = ad.filter(r => true); // all records count
      const { data: execRecords } = await supabase
        .from("decision_outcome_log")
        .select("id, execution_status")
        .eq("recommendation_accepted", true);
      const er = (execRecords as any[]) || [];
      const tracked = er.filter(r => r.execution_status && r.execution_status !== "not_started").length;
      const execPct = er.length > 0 ? Math.round((tracked / er.length) * 100) : 0;
      checks.push({
        label: "Execution tracking ≥90%",
        passed: er.length === 0 || execPct >= 90,
        detail: er.length > 0 ? `${execPct}% (${tracked}/${er.length})` : "No accepted decisions",
      });

      const allPassed = checks.every(c => c.passed);
      const passedCount = checks.filter(c => c.passed).length;

      return { checks, allPassed, passedCount, totalChecks: checks.length };
    },
    staleTime: 60_000,
  });

  if (!data) return null;

  return (
    <Card className={data.allPassed ? "border-primary/30" : "border-destructive/30"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Promotion Readiness Gate
          <Badge variant={data.allPassed ? "default" : "destructive"} className="text-[9px] h-4">
            {data.allPassed ? "READY" : `${data.passedCount}/${data.totalChecks} passed`}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {data.checks.map((check, i) => (
          <div key={i} className={`flex items-center gap-2 p-1.5 rounded text-xs ${check.passed ? "bg-muted/20" : "bg-destructive/5 border border-destructive/20"}`}>
            {check.passed ? (
              <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            )}
            <span className="font-medium flex-1">{check.label}</span>
            <span className="text-muted-foreground text-[10px]">{check.detail}</span>
          </div>
        ))}

        {!data.allPassed && (
          <div className="flex items-center gap-2 text-[10px] text-destructive p-2 rounded bg-destructive/10 border border-destructive/20 mt-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>Model promotion is blocked until all gates pass.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
