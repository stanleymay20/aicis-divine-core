import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, FlaskConical, BarChart3, TrendingUp } from "lucide-react";

const OutcomeMaturityPanel = () => {
  const { data } = useQuery({
    queryKey: ["decision-outcome-maturity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("evidence_type");
      const counts = { hypothetical: 0, pilot: 0, measured: 0 };
      (data || []).forEach((r) => {
        const t = r.evidence_type as keyof typeof counts;
        if (t in counts) counts[t]++;
      });
      return counts;
    },
    staleTime: 60_000,
  });

  if (!data) return null;

  const total = data.hypothetical + data.pilot + data.measured;
  const maturityPct = total > 0
    ? Math.round(((data.pilot * 2 + data.measured * 5) / (total * 5)) * 100)
    : 0;

  return (
    <Card className="border-accent/20">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-accent-foreground" />
            Outcome Maturity
          </span>
          <span className="text-xs font-bold text-primary">{maturityPct}%</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-1.5 rounded bg-muted/30">
            <Lightbulb className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
            <p className="text-sm font-bold">{data.hypothetical}</p>
            <p className="text-[9px] text-muted-foreground">Hypothetical</p>
          </div>
          <div className="p-1.5 rounded bg-accent/10">
            <FlaskConical className="h-3 w-3 mx-auto text-accent-foreground mb-0.5" />
            <p className="text-sm font-bold">{data.pilot}</p>
            <p className="text-[9px] text-muted-foreground">Pilot</p>
          </div>
          <div className="p-1.5 rounded bg-primary/10">
            <BarChart3 className="h-3 w-3 mx-auto text-primary mb-0.5" />
            <p className="text-sm font-bold">{data.measured}</p>
            <p className="text-[9px] text-muted-foreground">Measured</p>
          </div>
        </div>
        {total === 0 && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            No outcomes recorded yet. Capture recommendations to begin tracking.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default OutcomeMaturityPanel;
