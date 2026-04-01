import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

export default function DailyThroughputPanel() {
  const { data } = useQuery({
    queryKey: ["daily-throughput"],
    queryFn: async () => {
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [newToday, acceptedToday, startedToday, completedToday, measuredToday, measuredWeek, totalAccepted, totalMeasured] = await Promise.all([
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("recommendation_accepted", true).gte("action_taken_at", todayStart),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).gte("execution_started_at", todayStart),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).gte("execution_completed_at", todayStart),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("evidence_type", "measured").gte("outcome_timestamp", todayStart),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("evidence_type", "measured").gte("outcome_timestamp", weekAgo),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("recommendation_accepted", true),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("evidence_type", "measured"),
      ]);

      const acc = totalAccepted.count ?? 0;
      const meas = totalMeasured.count ?? 0;
      const conversion = acc > 0 ? ((meas / acc) * 100).toFixed(1) : "0";

      return {
        newToday: newToday.count ?? 0,
        acceptedToday: acceptedToday.count ?? 0,
        startedToday: startedToday.count ?? 0,
        completedToday: completedToday.count ?? 0,
        measuredToday: measuredToday.count ?? 0,
        measuredWeek: measuredWeek.count ?? 0,
        conversion: `${conversion}%`,
      };
    },
    refetchInterval: 10000,
  });

  const metrics = [
    { label: "New Today", value: data?.newToday ?? 0 },
    { label: "Accepted", value: data?.acceptedToday ?? 0 },
    { label: "Started", value: data?.startedToday ?? 0 },
    { label: "Completed", value: data?.completedToday ?? 0 },
    { label: "Measured", value: data?.measuredToday ?? 0, highlight: true },
    { label: "Measured 7d", value: data?.measuredWeek ?? 0, highlight: true },
    { label: "Conversion", value: data?.conversion ?? "0%" },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-primary" /> Daily Throughput
          </CardTitle>
          <Badge variant={data?.measuredToday ? "default" : "secondary"} className="text-xs font-mono">
            {data?.measuredToday ?? 0} measured
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 sm:gap-2">
          {metrics.map(m => (
            <div key={m.label} className={`rounded-lg border p-2 text-center ${m.highlight ? "border-primary/30 bg-primary/5" : "border-border/30"}`}>
              <p className={`text-base sm:text-lg font-mono font-bold ${m.highlight ? "text-primary" : "text-foreground"}`}>{m.value}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{m.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
