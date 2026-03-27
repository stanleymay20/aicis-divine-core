import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function DailyTargetTracker() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["daily-targets"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const todayStart = `${today}T00:00:00Z`;

      const { data: configRows } = await supabase
        .from("daily_target_config" as any)
        .select("*")
        .eq("target_date", today)
        .maybeSingle();

      const config = configRows as any;
      const targets = {
        measured: config?.measured_outcomes_target ?? 2,
        backlog: config?.backlog_closure_target ?? 5,
        postmortem: config?.postmortem_target ?? 1,
        audit: config?.audit_events_target ?? 10,
      };

      const [measuredRes, backlogRes, pmRes, auditRes] = await Promise.all([
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("evidence_type", "measured").gte("outcome_timestamp", todayStart),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("execution_status", "completed").not("outcome_success", "is", null)
          .gte("outcome_timestamp", todayStart),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .not("postmortem_note", "is", null).gte("updated_at", todayStart),
        supabase.from("audit_log").select("id", { count: "exact", head: true })
          .gte("created_at", todayStart),
      ]);

      return {
        targets,
        actuals: {
          measured: measuredRes.count ?? 0,
          backlog: backlogRes.count ?? 0,
          postmortem: pmRes.count ?? 0,
          audit: auditRes.count ?? 0,
        },
      };
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <PanelSkeleton variant="list" rows={4} />;

  const items = data ? [
    { label: "Measured Outcomes", actual: data.actuals.measured, target: data.targets.measured },
    { label: "Backlog Closed", actual: data.actuals.backlog, target: data.targets.backlog },
    { label: "Postmortems", actual: data.actuals.postmortem, target: data.targets.postmortem },
    { label: "Audit Events", actual: data.actuals.audit, target: data.targets.audit },
  ] : [];

  return (
    <ErrorBoundary compact>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Daily Targets
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">Today's closure goals</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item) => {
            const pct = Math.min(100, item.target > 0 ? Math.round((item.actual / item.target) * 100) : 0);
            const met = item.actual >= item.target;
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className={`text-xs font-mono font-semibold ${met ? "text-green-500" : "text-foreground"}`}>
                    {item.actual}/{item.target}
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
              </div>
            );
          })}
          {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No target data</p>}
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}
