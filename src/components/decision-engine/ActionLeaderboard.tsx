import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, AlertTriangle, Info } from "lucide-react";

interface ReliabilityRow {
  action_type: string;
  domain: string | null;
  sample_size: number;
  measured_sample_size: number;
  acceptance_count: number;
  success_count: number;
  success_rate_pct: number;
  ci_lower_pct: number;
  ci_upper_pct: number;
  reliability_band: "low" | "emerging" | "moderate" | "strong";
  avg_impact: number | null;
  avg_roi: number | null;
}

interface Threshold {
  min_samples: number;
  min_measured_samples: number;
  min_acceptances: number;
  enabled: boolean;
}

const bandConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  strong: { label: "Strong", variant: "default" },
  moderate: { label: "Moderate", variant: "secondary" },
  emerging: { label: "Emerging", variant: "outline" },
  low: { label: "Low evidence", variant: "destructive" },
};

export default function ActionLeaderboard() {
  const { data: rows } = useQuery<ReliabilityRow[]>({
    queryKey: ["action-reliability-leaderboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("action_reliability_view" as any)
        .select("*")
        .order("success_count", { ascending: false })
        .limit(10);
      return (data as any) || [];
    },
    staleTime: 120_000,
  });

  const { data: threshold } = useQuery<Threshold | null>({
    queryKey: ["threshold-action-effectiveness"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_metric_thresholds" as any)
        .select("min_samples, min_measured_samples, min_acceptances, enabled")
        .eq("metric_name", "action_effectiveness")
        .maybeSingle();
      return data as any;
    },
    staleTime: 300_000,
  });

  if (!rows || rows.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 text-center">
          <Trophy className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No action effectiveness data yet. Capture recommendations to begin tracking.</p>
        </CardContent>
      </Card>
    );
  }

  const meetsThreshold = (r: ReliabilityRow) => {
    if (!threshold?.enabled) return true;
    return (
      r.sample_size >= (threshold?.min_samples ?? 10) &&
      r.measured_sample_size >= (threshold?.min_measured_samples ?? 3) &&
      r.acceptance_count >= (threshold?.min_acceptances ?? 5)
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" /> Action Effectiveness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((r, i) => {
            const met = meetsThreshold(r);
            const band = bandConfig[r.reliability_band] || bandConfig.low;

            return (
              <div key={`${r.action_type}-${r.domain}`} className={`flex items-center gap-2 p-2 rounded ${met ? "bg-muted/30" : "bg-muted/15 border border-dashed border-border"}`}>
                <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium truncate">{r.action_type.replace(/_/g, " ")}</p>
                    {!met && <AlertTriangle className="h-3 w-3 text-warning shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">n={r.sample_size}</span>
                    <span className="text-[10px] text-muted-foreground">measured={r.measured_sample_size}</span>
                    <span className="text-[10px] text-muted-foreground">accepted={r.acceptance_count}</span>
                    <Badge variant={band.variant} className="text-[9px] h-4">{band.label}</Badge>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {r.success_rate_pct != null ? (
                    <div>
                      <span className={`text-sm font-bold ${met && r.success_rate_pct >= 60 ? "text-primary" : "text-muted-foreground"}`}>
                        {r.success_rate_pct}%
                      </span>
                      <p className="text-[9px] text-muted-foreground">
                        CI: {r.ci_lower_pct}–{r.ci_upper_pct}%
                      </p>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">—</Badge>
                  )}
                  {r.avg_impact != null && (
                    <p className="text-[10px] text-muted-foreground">
                      <TrendingUp className="h-2.5 w-2.5 inline mr-0.5" />imp: {r.avg_impact}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {threshold?.enabled && (
          <p className="text-[9px] text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="h-2.5 w-2.5" />
            Min evidence: {threshold.min_samples} samples, {threshold.min_measured_samples} measured, {threshold.min_acceptances} accepted
          </p>
        )}
      </CardContent>
    </Card>
  );
}
