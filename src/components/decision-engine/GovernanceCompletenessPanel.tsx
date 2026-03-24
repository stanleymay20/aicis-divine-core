import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, CheckCircle, AlertTriangle } from "lucide-react";

export default function GovernanceCompletenessPanel() {
  const { data } = useQuery({
    queryKey: ["governance-completeness"],
    queryFn: async () => {
      const { data: records } = await supabase
        .from("decision_outcome_log")
        .select("id, assigned_reviewer, assigned_reviewer_role, review_status, recommendation_accepted, outcome_success, postmortem_note, override_reason, review_overdue, execution_owner")
        .eq("recommendation_accepted", true);

      const all = (records as any[]) || [];
      const total = all.length;
      if (total === 0) return null;

      const withReviewer = all.filter(r => r.assigned_reviewer).length;
      const reviewed = all.filter(r => r.review_status && r.review_status !== "pending").length;
      const failedAccepted = all.filter(r => r.outcome_success === false);
      const withPostmortem = failedAccepted.filter(r => r.postmortem_note).length;
      const overrides = all.filter(r => r.review_status === "overridden");
      const withOverrideReason = overrides.filter(r => r.override_reason).length;
      const withOwner = all.filter(r => r.execution_owner).length;

      // Audit trail check
      const { count: auditCount } = await supabase
        .from("audit_log")
        .select("id", { count: "exact", head: true })
        .eq("resource_type", "decision_outcome_log");

      const metrics = {
        reviewerAssigned: total > 0 ? Math.round((withReviewer / total) * 100) : 0,
        reviewCompleted: total > 0 ? Math.round((reviewed / total) * 100) : 0,
        postmortemDone: failedAccepted.length > 0 ? Math.round((withPostmortem / failedAccepted.length) * 100) : 100,
        overrideReason: overrides.length > 0 ? Math.round((withOverrideReason / overrides.length) * 100) : 100,
        ownerAssigned: total > 0 ? Math.round((withOwner / total) * 100) : 0,
        auditPresent: (auditCount ?? 0) > 0,
      };

      const score = Math.round(
        (metrics.reviewerAssigned * 0.25 +
        metrics.reviewCompleted * 0.25 +
        metrics.postmortemDone * 0.2 +
        metrics.overrideReason * 0.1 +
        metrics.ownerAssigned * 0.15 +
        (metrics.auditPresent ? 100 : 0) * 0.05)
      );

      return {
        ...metrics,
        score,
        total,
        failedCount: failedAccepted.length,
        overrideCount: overrides.length,
        withReviewer,
        reviewed,
        withPostmortem,
        withOwner,
      };
    },
    staleTime: 60_000,
  });

  if (!data) return (
    <Card>
      <CardContent className="py-6 text-center">
        <p className="text-xs text-muted-foreground">No accepted decisions yet. Governance score requires data.</p>
      </CardContent>
    </Card>
  );

  const scoreColor = data.score >= 80 ? "text-primary" : data.score >= 50 ? "text-foreground" : "text-destructive";

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-primary" /> Governance Completeness
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${scoreColor}`}>{data.score}</span>
            <span className="text-[10px] text-muted-foreground">/100</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={data.score} className="h-2" />

        <div className="space-y-2">
          <ScoreRow label="Reviewer Assigned" value={data.reviewerAssigned} detail={`${data.withReviewer}/${data.total}`} />
          <ScoreRow label="Review Completed" value={data.reviewCompleted} detail={`${data.reviewed}/${data.total}`} />
          <ScoreRow label="Execution Owner" value={data.ownerAssigned} detail={`${data.withOwner}/${data.total}`} />
          <ScoreRow label="Postmortem Done" value={data.postmortemDone} detail={`${data.withPostmortem}/${data.failedCount} failed`} />
          <ScoreRow label="Override Reason" value={data.overrideReason} detail={`${data.overrideCount} overrides`} />
          <div className="flex items-center justify-between text-[10px] px-2 py-1.5 rounded bg-muted/20">
            <span className="text-muted-foreground">Audit Trail</span>
            {data.auditPresent ? (
              <Badge variant="default" className="text-[8px] h-4"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Present</Badge>
            ) : (
              <Badge variant="destructive" className="text-[8px] h-4"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Missing</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}% <span className="text-muted-foreground font-normal">({detail})</span></span>
      </div>
      <Progress value={value} className="h-1" />
    </div>
  );
}
