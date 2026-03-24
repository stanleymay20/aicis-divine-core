import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

export default function MeasuredOutcomeKPI() {
  const { data } = useQuery({
    queryKey: ["measured-outcome-kpi"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("decision_outcome_log")
        .select("recommendation_accepted, outcome_success, evidence_type, created_at")
        .limit(500);

      const all = (rows as any[]) || [];
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 86400000;

      const total = all.length;
      const accepted = all.filter(r => r.recommendation_accepted).length;
      const withOutcome = all.filter(r => r.outcome_success !== null).length;
      const measured = all.filter(r => r.evidence_type === "measured").length;
      const measured7d = all.filter(r => r.evidence_type === "measured" && r.created_at && new Date(r.created_at).getTime() > sevenDaysAgo).length;
      const measuredRate = total > 0 ? Math.round((measured / total) * 100) : 0;
      const acceptedToMeasured = accepted > 0 ? Math.round((measured / accepted) * 100) : 0;

      return { total, accepted, withOutcome, measured, measured7d, measuredRate, acceptedToMeasured };
    },
    staleTime: 30_000,
  });

  if (!data) return null;

  const thresholds = [
    { min: 10, label: "Promotion Ready", met: data.measured >= 10 },
    { min: 25, label: "Credible Pilot", met: data.measured >= 25 },
    { min: 50, label: "Enterprise Strength", met: data.measured >= 50 },
  ];

  const currentTier = data.measured >= 50 ? "Enterprise" : data.measured >= 25 ? "Credible" : data.measured >= 10 ? "Promotion Ready" : "Emerging";

  return (
    <Card className={data.measured < 10 ? "border-destructive/30" : "border-primary/30"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> Measured Outcome KPIs
          <Badge variant={data.measured >= 10 ? "default" : "destructive"} className="text-[9px] h-4 ml-1">
            {currentTier}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <MetricBox label="Total Measured" value={data.measured} warn={data.measured < 10} />
          <MetricBox label="7-Day Measured" value={data.measured7d} />
          <MetricBox label="Measured Rate" value={`${data.measuredRate}%`} warn={data.measuredRate < 20} />
          <MetricBox label="Accept→Measured" value={`${data.acceptedToMeasured}%`} />
        </div>

        <div className="space-y-1.5">
          {thresholds.map(t => (
            <div key={t.min} className="flex items-center gap-2 text-xs">
              {t.met ? (
                <CheckCircle className="h-3 w-3 text-primary shrink-0" />
              ) : (
                <AlertTriangle className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className={t.met ? "font-medium" : "text-muted-foreground"}>{t.label}</span>
              <Progress value={Math.min(100, (data.measured / t.min) * 100)} className="flex-1 h-1.5" />
              <span className="text-[10px] text-muted-foreground w-12 text-right">{data.measured}/{t.min}</span>
            </div>
          ))}
        </div>

        {data.measured < 10 && (
          <div className="flex items-center gap-2 text-[10px] p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>Model promotion blocked — need {10 - data.measured} more measured outcomes.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricBox({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={`p-2 rounded ${warn ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
      <p className={`text-sm font-bold ${warn ? "text-destructive" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
