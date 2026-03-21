import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, GitCompare } from "lucide-react";

export default function BaselineComparison() {
  const { data: eval_ } = useQuery({
    queryKey: ["latest-model-evaluation-extended"],
    queryFn: async () => {
      const { data } = await supabase
        .from("model_evaluations")
        .select("model_version, compared_to_version, proxy_success_rate, real_success_rate, heuristic_success_rate, improvement_over_previous, improvement_over_heuristic, avg_roi, total_net_value, evaluated_at")
        .order("evaluated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 120_000,
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

  const DeltaBadge = ({ value }: { value: number | null }) => {
    if (value == null) return <Badge variant="outline" className="text-[10px]">—</Badge>;
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
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded bg-muted/30">
            <p className="text-[10px] text-muted-foreground">vs Heuristic</p>
            <DeltaBadge value={eval_.improvement_over_heuristic} />
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-[10px] text-muted-foreground">vs Previous Model</p>
            <DeltaBadge value={eval_.improvement_over_previous} />
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-[10px] text-muted-foreground">Proxy Success</p>
            <p className="text-sm font-bold">{eval_.proxy_success_rate != null ? `${(eval_.proxy_success_rate * 100).toFixed(0)}%` : "—"}</p>
          </div>
          <div className="p-2 rounded bg-primary/10">
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
        <p className="text-[10px] text-muted-foreground mt-2">
          {eval_.model_version} · eval {new Date(eval_.evaluated_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}
