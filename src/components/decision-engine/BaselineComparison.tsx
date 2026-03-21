import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, GitCompare, AlertTriangle, Info } from "lucide-react";

interface Threshold {
  min_samples: number;
  min_measured_samples: number;
  enabled: boolean;
}

export default function BaselineComparison() {
  const { data: eval_ } = useQuery({
    queryKey: ["latest-model-evaluation-extended"],
    queryFn: async () => {
      const { data } = await supabase
        .from("model_evaluations")
        .select("model_version, compared_to_version, proxy_success_rate, real_success_rate, measured_success_rate, heuristic_success_rate, improvement_over_previous, improvement_over_heuristic, avg_roi, total_net_value, sample_count, measured_count, evaluated_at, calibration_error, acceptance_rate")
        .order("evaluated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 120_000,
  });

  const { data: threshold } = useQuery<Threshold | null>({
    queryKey: ["threshold-baseline-comparison"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_metric_thresholds" as any)
        .select("min_samples, min_measured_samples, enabled")
        .eq("metric_name", "baseline_comparison")
        .maybeSingle();
      return data as any;
    },
    staleTime: 300_000,
  });

  if (!eval_) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 text-center">
          <GitCompare className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Run model evaluation to see baseline comparison.</p>
        </CardContent>
      </Card>
    );
  }

  const sampleCount = (eval_ as any).sample_count ?? 0;
  const measuredCount = (eval_ as any).measured_count ?? 0;
  const belowThreshold = threshold?.enabled && (
    sampleCount < (threshold.min_samples ?? 10) ||
    measuredCount < (threshold.min_measured_samples ?? 3)
  );

  const DeltaBadge = ({ value, suppressed }: { value: number | null; suppressed?: boolean }) => {
    if (value == null) return <Badge variant="outline" className="text-[10px]">—</Badge>;
    if (suppressed) {
      return (
        <Badge variant="outline" className="text-[10px]">
          {value > 0 ? "+" : ""}{value.toFixed(1)}% <AlertTriangle className="h-2.5 w-2.5 ml-0.5 text-warning" />
        </Badge>
      );
    }
    const positive = value > 0;
    return (
      <Badge variant={positive ? "default" : "destructive"} className="text-[10px]">
        {positive ? <ArrowUp className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDown className="h-2.5 w-2.5 mr-0.5" />}
        {positive ? "+" : ""}{value.toFixed(1)}%
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <GitCompare className="h-3.5 w-3.5" /> Model vs Baselines
          {belowThreshold && (
            <Badge variant="outline" className="text-[9px] h-4 ml-1">Emerging evidence</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded bg-muted/30">
            <p className="text-[10px] text-muted-foreground">vs Heuristic</p>
            <DeltaBadge value={eval_.improvement_over_heuristic} suppressed={belowThreshold} />
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-[10px] text-muted-foreground">vs Previous Model</p>
            <DeltaBadge value={eval_.improvement_over_previous} suppressed={belowThreshold} />
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-[10px] text-muted-foreground">Proxy Success</p>
            <p className="text-sm font-bold">{eval_.proxy_success_rate != null ? `${(eval_.proxy_success_rate * 100).toFixed(0)}%` : "—"}</p>
          </div>
          <div className={`p-2 rounded ${belowThreshold ? "bg-muted/20 border border-dashed border-border" : "bg-primary/10"}`}>
            <p className="text-[10px] text-muted-foreground">Real Success</p>
            <p className="text-sm font-bold">{eval_.real_success_rate != null ? `${(eval_.real_success_rate * 100).toFixed(0)}%` : "—"}</p>
          </div>
        </div>
        {(eval_.avg_roi != null || eval_.total_net_value != null) && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 rounded bg-accent/10">
              <p className="text-[10px] text-muted-foreground">Avg ROI</p>
              <p className="text-sm font-bold">{eval_.avg_roi?.toFixed(1) ?? "—"}</p>
            </div>
            <div className="p-2 rounded bg-accent/10">
              <p className="text-[10px] text-muted-foreground">Total Net Value</p>
              <p className="text-sm font-bold">{eval_.total_net_value?.toFixed(0) ?? "—"}</p>
            </div>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
          <Info className="h-2.5 w-2.5 shrink-0" />
          {eval_.model_version} · n={sampleCount} · measured={measuredCount} · eval {new Date(eval_.evaluated_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}
