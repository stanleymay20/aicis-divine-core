import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gauge } from "lucide-react";

export default function CompletionVelocityPanel() {
  const { data } = useQuery({
    queryKey: ["completion-velocity"],
    queryFn: async () => {
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

      const [notStarted, inProgress, completedToday, completedNoOutcome, totalAccepted, totalCompleted, notStartedRows, inProgressRows] = await Promise.all([
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true).or("execution_status.is.null,execution_status.eq.not_started"),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("execution_status", "in_progress"),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .gte("execution_completed_at", todayStart),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("execution_status", "completed").is("outcome_success", null),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("execution_status", "completed"),
        supabase.from("decision_outcome_log").select("created_at")
          .eq("recommendation_accepted", true).or("execution_status.is.null,execution_status.eq.not_started")
          .order("created_at", { ascending: true }).limit(200),
        supabase.from("decision_outcome_log").select("execution_started_at")
          .eq("execution_status", "in_progress")
          .order("execution_started_at", { ascending: true }).limit(200),
      ]);

      const medianAge = (rows: any[], field: string) => {
        const ages = (rows || []).filter((r: any) => r[field]).map((r: any) => (Date.now() - new Date(r[field]).getTime()) / 3600000);
        if (ages.length === 0) return 0;
        ages.sort((a, b) => a - b);
        return Math.round(ages[Math.floor(ages.length / 2)]);
      };

      const acc = totalAccepted.count ?? 0;
      const comp = totalCompleted.count ?? 0;

      return {
        notStarted: notStarted.count ?? 0,
        inProgress: inProgress.count ?? 0,
        completedToday: completedToday.count ?? 0,
        completedNoOutcome: completedNoOutcome.count ?? 0,
        completionRate: acc > 0 ? `${((comp / acc) * 100).toFixed(0)}%` : "0%",
        medianNotStartedH: medianAge(notStartedRows.data ?? [], "created_at"),
        medianInProgressH: medianAge(inProgressRows.data ?? [], "execution_started_at"),
      };
    },
    refetchInterval: 10000,
  });

  const metrics = [
    { label: "Not Started", value: data?.notStarted ?? 0, warn: (data?.notStarted ?? 0) > 0 },
    { label: "In Progress", value: data?.inProgress ?? 0 },
    { label: "Completed Today", value: data?.completedToday ?? 0, highlight: true },
    { label: "Awaiting Outcome", value: data?.completedNoOutcome ?? 0, warn: (data?.completedNoOutcome ?? 0) > 0 },
    { label: "Completion Rate", value: data?.completionRate ?? "0%" },
    { label: "Median Wait (h)", value: `${data?.medianNotStartedH ?? 0}h`, warn: (data?.medianNotStartedH ?? 0) > 24 },
    { label: "Median WIP (h)", value: `${data?.medianInProgressH ?? 0}h`, warn: (data?.medianInProgressH ?? 0) > 48 },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-primary" /> Completion Velocity
          </CardTitle>
          <Badge variant={data?.completedToday ? "default" : "secondary"} className="text-xs font-mono">
            {data?.completedToday ?? 0} completed today
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {metrics.map(m => (
            <div key={m.label} className={`rounded-lg border p-2 text-center ${
              m.highlight ? "border-primary/30 bg-primary/5" : m.warn ? "border-destructive/30 bg-destructive/5" : "border-border/30"
            }`}>
              <p className={`text-lg font-mono font-bold ${m.highlight ? "text-primary" : m.warn ? "text-destructive" : "text-foreground"}`}>{m.value}</p>
              <p className="text-[9px] text-muted-foreground leading-tight">{m.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
