import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

export default function MeasuredEvidenceProgressPanel() {
  const { data } = useQuery({
    queryKey: ["measured-evidence-progress"],
    queryFn: async () => {
      // Outcome log evidence funnel
      const { data: outcomes } = await supabase
        .from("decision_outcome_log")
        .select("evidence_type, outcome_success, recommendation_accepted, postmortem_note, roi_estimate");

      const all = (outcomes as any[]) || [];
      const hypothetical = all.filter(r => r.evidence_type === "hypothetical").length;
      const pilot = all.filter(r => r.evidence_type === "pilot").length;
      const real = all.filter(r => r.evidence_type === "real").length;
      const measured = all.filter(r => r.evidence_type === "measured").length;
      const withROI = all.filter(r => r.roi_estimate != null).length;
      const failedAccepted = all.filter(r => r.recommendation_accepted === true && r.outcome_success === false);
      const withPostmortem = failedAccepted.filter(r => !!r.postmortem_note).length;

      // Training data composition
      const { data: training } = await supabase
        .from("decision_training_dataset")
        .select("label_source, overridden_by_real");

      const tAll = (training as any[]) || [];
      const tProxy = tAll.filter(r => r.label_source === "proxy" && !r.overridden_by_real).length;
      const tReal = tAll.filter(r => r.label_source === "real").length;
      const tMeasured = tAll.filter(r => r.label_source === "measured").length;
      const tOverridden = tAll.filter(r => r.overridden_by_real === true).length;

      // Thresholds
      const { data: thresh } = await supabase
        .from("decision_metric_thresholds" as any)
        .select("metric_name, min_measured_samples, enabled")
        .eq("metric_name", "trust_score")
        .maybeSingle();

      const minMeasured = (thresh as any)?.min_measured_samples ?? 10;

      // Silent failures
      const { data: silentFailures } = await supabase
        .from("silent_failure_state" as any)
        .select("id")
        .eq("resolved", false)
        .eq("severity", "high");

      const criticalSilent = (silentFailures as any[])?.length || 0;

      // Readiness
      const isReady = measured >= minMeasured && criticalSilent === 0;
      const isEmerging = measured > 0 || real > 0;
      const readinessLabel = isReady ? "Promotion-ready" : isEmerging ? "Emerging" : "Not ready";
      const readinessVariant: "default" | "secondary" | "destructive" = isReady ? "default" : isEmerging ? "secondary" : "destructive";

      return {
        hypothetical, pilot, real, measured, total: all.length,
        withROI, roiPct: all.length > 0 ? Math.round((withROI / all.length) * 100) : 0,
        postmortemPct: failedAccepted.length > 0 ? Math.round((withPostmortem / failedAccepted.length) * 100) : 100,
        failedAcceptedCount: failedAccepted.length,
        tProxy, tReal, tMeasured, tOverridden, tTotal: tAll.length,
        tRealPct: tAll.length > 0 ? Math.round(((tReal + tMeasured) / tAll.length) * 100) : 0,
        overriddenPct: tAll.filter(r => r.label_source === "proxy").length > 0
          ? Math.round((tOverridden / (tOverridden + tProxy)) * 100) : 0,
        readinessLabel, readinessVariant,
        minMeasured, criticalSilent,
      };
    },
    staleTime: 60_000,
  });

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> Evidence Progression
          <Badge variant={data.readinessVariant} className="text-[9px] h-4 ml-1">{data.readinessLabel}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Evidence funnel */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">Outcome Evidence Funnel</p>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <FunnelBox label="Hypothetical" value={data.hypothetical} total={data.total} />
            <FunnelBox label="Pilot" value={data.pilot} total={data.total} />
            <FunnelBox label="Real" value={data.real} total={data.total} />
            <FunnelBox label="Measured" value={data.measured} total={data.total} highlight={data.measured > 0} />
          </div>
        </div>

        {/* Training data composition */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">Training Data ({data.tTotal} samples)</p>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="p-1.5 rounded bg-muted/30">
              <p className="text-xs font-bold">{data.tProxy}</p>
              <p className="text-[9px] text-muted-foreground">Proxy</p>
            </div>
            <div className="p-1.5 rounded bg-accent/10">
              <p className="text-xs font-bold">{data.tReal}</p>
              <p className="text-[9px] text-muted-foreground">Real</p>
            </div>
            <div className="p-1.5 rounded bg-primary/10">
              <p className="text-xs font-bold">{data.tMeasured}</p>
              <p className="text-[9px] text-muted-foreground">Measured</p>
            </div>
            <div className="p-1.5 rounded bg-muted/30">
              <p className="text-xs font-bold">{data.overriddenPct}%</p>
              <p className="text-[9px] text-muted-foreground">Overridden</p>
            </div>
          </div>
        </div>

        {/* Coverage metrics */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-1.5 rounded bg-muted/30">
            <p className="text-xs font-bold">{data.roiPct}%</p>
            <p className="text-[9px] text-muted-foreground">With ROI</p>
          </div>
          <div className={`p-1.5 rounded ${data.postmortemPct < 80 && data.failedAcceptedCount > 0 ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
            <p className={`text-xs font-bold ${data.postmortemPct < 80 && data.failedAcceptedCount > 0 ? "text-destructive" : ""}`}>{data.postmortemPct}%</p>
            <p className="text-[9px] text-muted-foreground">Postmortem</p>
          </div>
          <div className="p-1.5 rounded bg-muted/30">
            <p className="text-xs font-bold">{data.tRealPct}%</p>
            <p className="text-[9px] text-muted-foreground">Real Training</p>
          </div>
        </div>

        {/* Readiness gate */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground p-2 rounded bg-muted/20">
          {data.readinessLabel === "Promotion-ready" ? (
            <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
          )}
          <span>
            Promotion requires ≥{data.minMeasured} measured samples (have {data.measured}) and 0 critical silent failures (have {data.criticalSilent}).
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function FunnelBox({ label, value, total, highlight }: { label: string; value: number; total: number; highlight?: boolean }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className={`p-1.5 rounded ${highlight ? "bg-primary/10 border border-primary/20" : "bg-muted/30"}`}>
      <p className={`text-xs font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-[8px] text-muted-foreground">{pct}%</p>
    </div>
  );
}
