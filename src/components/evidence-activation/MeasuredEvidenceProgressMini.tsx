import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart3 } from "lucide-react";

export default function MeasuredEvidenceProgressMini() {
  const { data } = useQuery({
    queryKey: ["measured-evidence-progress"],
    queryFn: async () => {
      const [outcomeRes, trainingRes] = await Promise.all([
        supabase
          .from("decision_outcome_log")
          .select("evidence_type, outcome_timestamp")
          .not("outcome_success", "is", null),
        supabase
          .from("decision_training_dataset")
          .select("label_source, created_at"),
      ]);

      const outcomes = outcomeRes.data || [];
      const training = trainingRes.data || [];
      const now = Date.now();
      const d7 = 7 * 86400000;

      const measured = outcomes.filter((o) => o.evidence_type === "measured").length;
      const measured7d = outcomes.filter(
        (o) =>
          o.evidence_type === "measured" &&
          o.outcome_timestamp &&
          now - new Date(o.outcome_timestamp).getTime() < d7
      ).length;

      const proxy = training.filter((t) => t.label_source === "proxy").length;
      const real = training.filter((t) => t.label_source === "real").length;
      const measuredTraining = training.filter((t) => t.label_source === "measured").length;

      return { measured, measured7d, proxy, real, measuredTraining };
    },
    refetchInterval: 30000,
  });

  const m = data?.measured ?? 0;
  const thresholds = [
    { label: "First 5", target: 5 },
    { label: "10 target", target: 10 },
    { label: "25 target", target: 25 },
  ];
  const currentThreshold = thresholds.find((t) => m < t.target) || thresholds[2];
  const pct = Math.min(100, Math.round((m / currentThreshold.target) * 100));

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Measured Evidence
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{m}</span>
          <span className="text-xs text-muted-foreground">
            / {currentThreshold.target} ({currentThreshold.label})
          </span>
        </div>
        <Progress value={pct} className="h-2" />

        <div className="text-xs text-muted-foreground">
          Last 7d: <span className="text-foreground font-medium">{data?.measured7d ?? 0}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-muted/50 rounded p-1.5">
            <div className="font-medium">{data?.proxy ?? 0}</div>
            <div className="text-muted-foreground">Proxy</div>
          </div>
          <div className="bg-muted/50 rounded p-1.5">
            <div className="font-medium">{data?.real ?? 0}</div>
            <div className="text-muted-foreground">Real</div>
          </div>
          <div className="bg-muted/50 rounded p-1.5">
            <div className="font-medium">{data?.measuredTraining ?? 0}</div>
            <div className="text-muted-foreground">Measured</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
