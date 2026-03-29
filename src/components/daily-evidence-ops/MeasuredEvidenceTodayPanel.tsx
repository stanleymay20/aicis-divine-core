import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MeasuredEvidenceTodayPanel() {
  const { data } = useQuery({
    queryKey: ["measured-evidence-today"],
    queryFn: async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

      const [measuredToday, measured7d, totalMeasured, totalAccepted, totalCompleted, trainingToday, proxyOverrides] = await Promise.all([
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("evidence_type", "measured").gte("outcome_timestamp", todayStart),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("evidence_type", "measured").gte("outcome_timestamp", sevenDaysAgo),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("evidence_type", "measured"),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("execution_status", "completed"),
        supabase.from("decision_training_dataset").select("id", { count: "exact", head: true })
          .eq("source_type", "measured").gte("created_at", todayStart),
        supabase.from("decision_training_dataset").select("id", { count: "exact", head: true })
          .eq("overridden_by_real", true),
      ]);

      const acc = totalAccepted.count ?? 0;
      const comp = totalCompleted.count ?? 0;
      const meas = totalMeasured.count ?? 0;

      return {
        measuredToday: measuredToday.count ?? 0,
        measured7d: measured7d.count ?? 0,
        totalMeasured: meas,
        acceptedToMeasured: acc > 0 ? ((meas / acc) * 100).toFixed(1) : "0",
        completedToMeasured: comp > 0 ? ((meas / comp) * 100).toFixed(1) : "0",
        trainingToday: trainingToday.count ?? 0,
        proxyOverrides: proxyOverrides.count ?? 0,
      };
    },
    refetchInterval: 15000,
  });

  const metrics = [
    { label: "Measured Today", value: data?.measuredToday ?? 0 },
    { label: "Measured 7d", value: data?.measured7d ?? 0 },
    { label: "Total Measured", value: data?.totalMeasured ?? 0 },
    { label: "Accepted→Measured", value: `${data?.acceptedToMeasured ?? 0}%` },
    { label: "Completed→Measured", value: `${data?.completedToMeasured ?? 0}%` },
    { label: "Training Rows Today", value: data?.trainingToday ?? 0 },
    { label: "Proxy Overrides", value: data?.proxyOverrides ?? 0 },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Measured Evidence Today</CardTitle>
          <Badge variant="outline" className="text-xs font-mono">{data?.totalMeasured ?? 0} total</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metrics.map(m => (
            <div key={m.label} className="rounded-lg border border-border/30 p-2.5 text-center">
              <p className="text-lg font-mono font-bold text-foreground">{m.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{m.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
