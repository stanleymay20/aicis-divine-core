import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, AlertTriangle } from "lucide-react";

export default function DecisionKPIPanel() {
  const { data } = useQuery({
    queryKey: ["decision-kpi-panel"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("decision_outcome_log")
        .select("recommendation_accepted, action_taken, action_taken_at, outcome_success, evidence_type, postmortem_note, created_at, outcome_timestamp");

      const all = (rows as any[]) || [];
      const total = all.length;
      const accepted = all.filter(r => r.recommendation_accepted === true).length;
      const acted = all.filter(r => r.action_taken === true).length;
      const measured = all.filter(r => r.evidence_type === "measured").length;
      const failed = all.filter(r => r.outcome_success === false).length;
      const failedAccepted = all.filter(r => r.recommendation_accepted === true && r.outcome_success === false);
      const withPostmortem = failedAccepted.filter(r => !!r.postmortem_note).length;
      const postmortemPct = failedAccepted.length > 0 ? Math.round((withPostmortem / failedAccepted.length) * 100) : 100;

      // Avg time to action (accepted → action_taken_at)
      const actionTimes = all
        .filter(r => r.action_taken_at && r.created_at)
        .map(r => (new Date(r.action_taken_at).getTime() - new Date(r.created_at).getTime()) / 3600000);
      const avgTimeToAction = actionTimes.length > 0
        ? Math.round(actionTimes.reduce((a, b) => a + b, 0) / actionTimes.length)
        : null;

      // Avg time to outcome
      const outcomeTimes = all
        .filter(r => r.outcome_timestamp && r.created_at)
        .map(r => (new Date(r.outcome_timestamp).getTime() - new Date(r.created_at).getTime()) / 86400000);
      const avgTimeToOutcome = outcomeTimes.length > 0
        ? Math.round(outcomeTimes.reduce((a, b) => a + b, 0) / outcomeTimes.length * 10) / 10
        : null;

      return { total, accepted, acted, measured, failed, postmortemPct, avgTimeToAction, avgTimeToOutcome, failedAcceptedCount: failedAccepted.length };
    },
    staleTime: 60_000,
  });

  if (!data || data.total === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 text-center">
          <BarChart3 className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No decision data yet.</p>
        </CardContent>
      </Card>
    );
  }

  const lowMeasured = data.measured < 5;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-primary" /> Decision Outcome KPIs
          {lowMeasured && <Badge variant="outline" className="text-[9px] h-4 ml-1">Emerging Evidence</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
          <KpiBox label="Total" value={data.total} />
          <KpiBox label="Accepted" value={data.accepted} />
          <KpiBox label="Acted" value={data.acted} />
          <KpiBox label="Measured" value={data.measured} warn={lowMeasured} />
          <KpiBox label="Failed" value={data.failed} warn={data.failed > 0} />
          <KpiBox label="Postmortem %" value={`${data.postmortemPct}%`} warn={data.postmortemPct < 80 && data.failedAcceptedCount > 0} />
          <KpiBox label="Avg → Action" value={data.avgTimeToAction != null ? `${data.avgTimeToAction}h` : "—"} />
          <KpiBox label="Avg → Outcome" value={data.avgTimeToOutcome != null ? `${data.avgTimeToOutcome}d` : "—"} />
        </div>
      </CardContent>
    </Card>
  );
}

function KpiBox({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={`p-2 rounded ${warn ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
      {warn && <AlertTriangle className="h-2.5 w-2.5 text-destructive mx-auto mb-0.5" />}
      <p className={`text-sm font-bold ${warn ? "text-destructive" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
