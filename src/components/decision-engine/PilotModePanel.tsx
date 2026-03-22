import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Beaker, TrendingUp, CheckCircle, AlertTriangle, Target, BarChart3 } from "lucide-react";

export default function PilotModePanel() {
  const { data: stats } = useQuery({
    queryKey: ["pilot-report-stats"],
    queryFn: async () => {
      const [totalRes, acceptedRes, actedRes, measuredRes, failedRes, pmRes] = await Promise.all([
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("recommendation_accepted", true),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("action_taken", true),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("evidence_type", "measured"),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("outcome_success", false).eq("recommendation_accepted", true),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("outcome_success", false).eq("recommendation_accepted", true).not("postmortem_note", "is", null),
      ]);

      const { data: roiData } = await supabase
        .from("decision_outcome_log")
        .select("roi_estimate, net_value, outcome_success")
        .not("roi_estimate", "is", null);

      const total = totalRes.count ?? 0;
      const accepted = acceptedRes.count ?? 0;
      const acted = actedRes.count ?? 0;
      const measured = measuredRes.count ?? 0;
      const failed = failedRes.count ?? 0;
      const withPm = pmRes.count ?? 0;

      const successCount = (roiData || []).filter(r => r.outcome_success === true).length;
      const totalOutcomes = (roiData || []).filter(r => r.outcome_success !== null).length;
      const avgRoi = (roiData || []).length > 0
        ? (roiData || []).reduce((s, r) => s + (r.roi_estimate || 0), 0) / (roiData || []).length
        : 0;
      const totalNet = (roiData || []).reduce((s, r) => s + (r.net_value || 0), 0);

      return {
        total, accepted, acted, measured, failed,
        pmCompletion: failed > 0 ? Math.round((withPm / failed) * 100) : 100,
        acceptanceRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
        executionRate: accepted > 0 ? Math.round((acted / accepted) * 100) : 0,
        successRate: totalOutcomes > 0 ? Math.round((successCount / totalOutcomes) * 100) : 0,
        avgRoi: Math.round(avgRoi * 10) / 10,
        totalNet: Math.round(totalNet * 10) / 10,
        totalOutcomes,
      };
    },
    staleTime: 60_000,
  });

  if (!stats) return null;

  const pilotComplete = stats.total >= 20 && stats.measured >= 5 && stats.totalOutcomes >= 10;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Beaker className="h-3.5 w-3.5 text-primary" /> Pilot Report
          </CardTitle>
          <Badge variant={pilotComplete ? "default" : "outline"} className="text-[9px]">
            {pilotComplete ? "Pilot Complete" : "Pilot Data — Emerging Evidence"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Funnel */}
        <div className="space-y-2">
          <FunnelRow label="Decisions Generated" value={stats.total} max={50} target={50} />
          <FunnelRow label="Accepted" value={stats.accepted} max={stats.total || 1} pct={stats.acceptanceRate} />
          <FunnelRow label="Executed" value={stats.acted} max={stats.accepted || 1} pct={stats.executionRate} />
          <FunnelRow label="Measured Outcomes" value={stats.measured} max={stats.acted || 1} />
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ResultBox icon={<Target className="h-3.5 w-3.5" />} label="Success Rate" value={`${stats.successRate}%`} sub={`${stats.totalOutcomes} outcomes`} />
          <ResultBox icon={<TrendingUp className="h-3.5 w-3.5" />} label="Avg ROI" value={`${stats.avgRoi}`} />
          <ResultBox icon={<BarChart3 className="h-3.5 w-3.5" />} label="Total Net Value" value={`${stats.totalNet}`} />
          <ResultBox icon={<CheckCircle className="h-3.5 w-3.5" />} label="PM Completion" value={`${stats.pmCompletion}%`} warn={stats.pmCompletion < 80} />
        </div>

        {!pilotComplete && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded border">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
            <span>
              Pilot incomplete. Need: ≥50 decisions, ≥5 measured outcomes, ≥10 total outcomes.
              Current: {stats.total} decisions, {stats.measured} measured, {stats.totalOutcomes} outcomes.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelRow({ label, value, max, pct, target }: { label: string; value: number; max: number; pct?: number; target?: number }) {
  const progress = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}{target ? `/${target}` : ""} {pct !== undefined ? `(${pct}%)` : ""}</span>
      </div>
      <Progress value={Math.min(progress, 100)} className="h-1.5" />
    </div>
  );
}

function ResultBox({ icon, label, value, sub, warn }: { icon: React.ReactNode; label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`p-2.5 rounded border ${warn ? "border-destructive/20 bg-destructive/5" : "border-border bg-muted/20"}`}>
      <div className="flex items-center gap-1 text-muted-foreground mb-1">{icon}<span className="text-[9px]">{label}</span></div>
      <p className={`text-sm font-bold ${warn ? "text-destructive" : ""}`}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
