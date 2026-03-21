import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, FlaskConical, BarChart3, TrendingUp, Database } from "lucide-react";

const OutcomeMaturityPanel = () => {
  const { data } = useQuery({
    queryKey: ["decision-outcome-maturity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("evidence_type, outcome_success, impact_score, roi_estimate");
      const counts = { hypothetical: 0, pilot: 0, measured: 0, real: 0 };
      let withOutcome = 0;
      let withImpact = 0;
      let withROI = 0;
      (data || []).forEach((r: any) => {
        const t = r.evidence_type as string;
        if (t in counts) counts[t as keyof typeof counts]++;
        if (r.outcome_success !== null) withOutcome++;
        if (r.impact_score !== null) withImpact++;
        if (r.roi_estimate !== null) withROI++;
      });
      const total = (data || []).length;
      return { counts, total, withOutcome, withImpact, withROI };
    },
    staleTime: 60_000,
  });

  // Training dataset composition
  const { data: trainingStats } = useQuery({
    queryKey: ["training-dataset-composition"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_training_dataset")
        .select("label_source, overridden_by_real")
        .eq("overridden_by_real", false);
      const sources = { proxy: 0, real: 0, measured: 0 };
      (data || []).forEach((r: any) => {
        if (r.label_source in sources) sources[r.label_source as keyof typeof sources]++;
      });
      return { ...sources, total: (data || []).length };
    },
    staleTime: 120_000,
  });

  if (!data) return null;

  const { counts, total, withOutcome, withImpact, withROI } = data;
  const realEvidence = counts.real + counts.measured;
  const maturityPct = total > 0
    ? Math.round(((counts.pilot * 2 + counts.measured * 5 + counts.real * 3) / (total * 5)) * 100)
    : 0;
  const realPct = total > 0 ? Math.round((realEvidence / total) * 100) : 0;

  const maturityLabel = maturityPct >= 60 ? "Operational" : maturityPct >= 30 ? "Emerging" : "Experimental";
  const maturityVariant = maturityPct >= 60 ? "default" as const : maturityPct >= 30 ? "secondary" as const : "outline" as const;

  return (
    <Card className="border-accent/20">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-accent-foreground" />
            Outcome Maturity
          </span>
          <div className="flex items-center gap-1.5">
            <Badge variant={maturityVariant} className="text-[9px] h-4">{maturityLabel}</Badge>
            <span className="text-xs font-bold text-primary">{maturityPct}%</span>
          </div>
        </div>

        {/* Evidence breakdown */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          <div className="p-1.5 rounded bg-muted/30">
            <Lightbulb className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
            <p className="text-sm font-bold">{counts.hypothetical}</p>
            <p className="text-[9px] text-muted-foreground">Hypothetical</p>
          </div>
          <div className="p-1.5 rounded bg-accent/10">
            <FlaskConical className="h-3 w-3 mx-auto text-accent-foreground mb-0.5" />
            <p className="text-sm font-bold">{counts.pilot}</p>
            <p className="text-[9px] text-muted-foreground">Pilot</p>
          </div>
          <div className="p-1.5 rounded bg-primary/10">
            <BarChart3 className="h-3 w-3 mx-auto text-primary mb-0.5" />
            <p className="text-sm font-bold">{counts.measured}</p>
            <p className="text-[9px] text-muted-foreground">Measured</p>
          </div>
          <div className="p-1.5 rounded bg-primary/5">
            <Database className="h-3 w-3 mx-auto text-primary mb-0.5" />
            <p className="text-sm font-bold">{counts.real}</p>
            <p className="text-[9px] text-muted-foreground">Real</p>
          </div>
        </div>

        {/* Coverage metrics */}
        <div className="grid grid-cols-3 gap-2 mt-2 text-center text-[10px]">
          <div>
            <p className="text-muted-foreground">With Outcome</p>
            <p className="font-bold">{withOutcome}/{total}</p>
          </div>
          <div>
            <p className="text-muted-foreground">With Impact</p>
            <p className="font-bold">{withImpact}/{total}</p>
          </div>
          <div>
            <p className="text-muted-foreground">With ROI</p>
            <p className="font-bold">{withROI}/{total}</p>
          </div>
        </div>

        {/* Training data composition */}
        {trainingStats && trainingStats.total > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground mb-1">Training Data: {trainingStats.total} samples</p>
            <div className="flex gap-2 text-[9px]">
              <span>Proxy: {trainingStats.proxy}</span>
              <span>Real: {trainingStats.real}</span>
              <span>Measured: {trainingStats.measured}</span>
              <span className="font-medium">
                ({Math.round(((trainingStats.real + trainingStats.measured) / trainingStats.total) * 100)}% real)
              </span>
            </div>
          </div>
        )}

        {/* Honest label */}
        {realPct < 10 && total > 0 && (
          <Badge variant="outline" className="text-[9px] mt-2">
            ⚠ Pilot Data — {realPct}% real evidence
          </Badge>
        )}

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
