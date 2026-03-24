import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp } from "lucide-react";

const thresholds = [
  { min: 5, label: "Evidence Emerging", tier: 1 },
  { min: 10, label: "Promotion Gate Eligible", tier: 2 },
  { min: 25, label: "Credible Pilot Evidence", tier: 3 },
  { min: 50, label: "Enterprise Pilot Strength", tier: 4 },
];

export default function MeasuredThresholdPanel() {
  const { data } = useQuery({
    queryKey: ["measured-threshold-stats"],
    queryFn: async () => {
      const [measuredRes, totalRes, last7Res, trainingRes] = await Promise.all([
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }).eq("evidence_type", "measured"),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true }),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("evidence_type", "measured")
          .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from("decision_training_dataset").select("label_source, overridden_by_real"),
      ]);

      const measured = measuredRes.count ?? 0;
      const total = totalRes.count ?? 0;
      const last7 = last7Res.count ?? 0;
      const training = (trainingRes.data as any[]) || [];
      const proxy = training.filter(r => r.label_source === "proxy" && !r.overridden_by_real).length;
      const real = training.filter(r => r.label_source === "real").length;
      const tMeasured = training.filter(r => r.label_source === "measured").length;
      const overridden = training.filter(r => r.overridden_by_real === true).length;

      const currentTier = thresholds.filter(t => measured >= t.min).length;
      const nextThreshold = thresholds[currentTier] || thresholds[thresholds.length - 1];

      return {
        measured, total, last7, proxy, real, tMeasured, overridden,
        trainingTotal: training.length,
        ratio: total > 0 ? Math.round((measured / total) * 100) : 0,
        currentTier,
        nextThreshold,
        tierLabel: currentTier > 0 ? thresholds[currentTier - 1].label : "Not Yet Emerging",
      };
    },
    staleTime: 30_000,
  });

  if (!data) return null;

  const progressToNext = data.nextThreshold
    ? Math.min(100, Math.round((data.measured / data.nextThreshold.min) * 100))
    : 100;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" /> Measured Evidence Readiness
          </CardTitle>
          <Badge variant={data.currentTier >= 3 ? "default" : data.currentTier >= 1 ? "secondary" : "destructive"} className="text-[9px]">
            {data.tierLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main counter */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricBox label="Measured Outcomes" value={data.measured} highlight />
          <MetricBox label="Last 7 Days" value={data.last7} />
          <MetricBox label="Measured Ratio" value={`${data.ratio}%`} />
          <MetricBox label="Total Decisions" value={data.total} />
        </div>

        {/* Progress to next tier */}
        <div>
          <div className="flex justify-between text-[10px] mb-1">
            <span className="text-muted-foreground">Next: {data.nextThreshold.label}</span>
            <span className="font-medium">{data.measured}/{data.nextThreshold.min}</span>
          </div>
          <Progress value={progressToNext} className="h-2" />
        </div>

        {/* Tier ladder */}
        <div className="grid grid-cols-4 gap-1.5">
          {thresholds.map((t, i) => (
            <div key={t.min} className={`p-1.5 rounded text-center border ${data.currentTier > i ? "bg-primary/10 border-primary/30" : "bg-muted/20 border-border"}`}>
              <p className={`text-[10px] font-bold ${data.currentTier > i ? "text-primary" : "text-muted-foreground"}`}>≥{t.min}</p>
              <p className="text-[8px] text-muted-foreground leading-tight">{t.label}</p>
            </div>
          ))}
        </div>

        {/* Training data composition */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Training Data ({data.trainingTotal} samples)
          </p>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="p-1.5 rounded bg-muted/30">
              <p className="text-xs font-bold">{data.proxy}</p>
              <p className="text-[9px] text-muted-foreground">Proxy</p>
            </div>
            <div className="p-1.5 rounded bg-accent/10">
              <p className="text-xs font-bold">{data.real}</p>
              <p className="text-[9px] text-muted-foreground">Real</p>
            </div>
            <div className="p-1.5 rounded bg-primary/10">
              <p className="text-xs font-bold">{data.tMeasured}</p>
              <p className="text-[9px] text-muted-foreground">Measured</p>
            </div>
            <div className="p-1.5 rounded bg-muted/30">
              <p className="text-xs font-bold">{data.overridden}</p>
              <p className="text-[9px] text-muted-foreground">Overridden</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBox({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className={`p-2.5 rounded border ${highlight ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"}`}>
      <p className={`text-lg font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
