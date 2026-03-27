import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function DailyEvidenceScore() {
  const { data, isLoading } = useQuery({
    queryKey: ["daily-evidence-score"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

      const [measuredToday, measured7d, auditToday, audit7d, postmortemToday] = await Promise.all([
        supabase.from("decision_outcome_log")
          .select("id", { count: "exact", head: true })
          .eq("evidence_type", "measured")
          .gte("outcome_timestamp", todayStart),
        supabase.from("decision_outcome_log")
          .select("id", { count: "exact", head: true })
          .eq("evidence_type", "measured")
          .gte("outcome_timestamp", weekAgo),
        supabase.from("audit_log")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart),
        supabase.from("audit_log")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekAgo),
        supabase.from("decision_outcome_log")
          .select("id", { count: "exact", head: true })
          .not("postmortem_note", "is", null)
          .gte("updated_at", todayStart),
      ]);

      const mT = measuredToday.count ?? 0;
      const m7 = measured7d.count ?? 0;
      const aT = auditToday.count ?? 0;
      const a7 = audit7d.count ?? 0;
      const pT = postmortemToday.count ?? 0;

      const score = Math.min(100, (mT * 20) + (aT * 2) + (pT * 15));
      const weeklyAvg = Math.min(100, Math.round(((m7 / 7) * 20) + ((a7 / 7) * 2)));

      return { 
        todayScore: score, weeklyAvg, 
        measuredToday: mT, measured7d: m7, 
        auditToday: aT, audit7d: a7, postmortemToday: pT,
        trend: score > weeklyAvg ? "up" as const : score < weeklyAvg ? "down" as const : "flat" as const,
      };
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <PanelSkeleton variant="metrics" />;

  const trendIcon = data?.trend === "up" ? <TrendingUp className="h-3.5 w-3.5 text-green-500" /> 
    : data?.trend === "down" ? <TrendingDown className="h-3.5 w-3.5 text-red-500" /> 
    : <Minus className="h-3.5 w-3.5 text-muted-foreground" />;

  return (
    <ErrorBoundary compact>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Evidence Score</CardTitle>
            <div className="flex items-center gap-1.5">
              {trendIcon}
              <span className="text-2xl font-bold font-mono">{data?.todayScore ?? 0}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <ScoreRow label="Measured Today" value={data?.measuredToday ?? 0} />
            <ScoreRow label="Measured (7d)" value={data?.measured7d ?? 0} />
            <ScoreRow label="Audit Events Today" value={data?.auditToday ?? 0} />
            <ScoreRow label="Audit Events (7d)" value={data?.audit7d ?? 0} />
            <ScoreRow label="Postmortems Today" value={data?.postmortemToday ?? 0} />
            <ScoreRow label="Weekly Avg Score" value={data?.weeklyAvg ?? 0} />
          </div>
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-muted/20">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-mono font-semibold">{value}</span>
    </div>
  );
}
