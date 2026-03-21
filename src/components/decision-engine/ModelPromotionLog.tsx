import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, CheckCircle, XCircle, Crown, ArrowRight, Info } from "lucide-react";

interface ModelRow {
  version: string;
  created_at: string;
  status: string;
  training_mode: string | null;
  promotion_status: string | null;
  rejection_reason: string | null;
  training_sample_count: number | null;
  proxy_sample_count: number | null;
  real_sample_count: number | null;
  measured_sample_count: number | null;
  last_calibrated_at: string | null;
}

interface EvalRow {
  model_version: string;
  improvement_over_heuristic: number | null;
  improvement_over_previous: number | null;
  calibration_error: number | null;
  proxy_success_rate: number | null;
  real_success_rate: number | null;
  acceptance_rate: number | null;
  evaluated_at: string;
}

const statusIcon = {
  active: <Crown className="h-3 w-3 text-primary" />,
  rejected: <XCircle className="h-3 w-3 text-destructive" />,
  superseded: <ArrowRight className="h-3 w-3 text-muted-foreground" />,
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  rejected: "destructive",
  superseded: "outline",
};

export default function ModelPromotionLog() {
  const { data: models = [] } = useQuery<ModelRow[]>({
    queryKey: ["model-lineage-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_models")
        .select("version, created_at, status, training_mode, promotion_status, rejection_reason, training_sample_count, proxy_sample_count, real_sample_count, measured_sample_count, last_calibrated_at")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data as any) || [];
    },
    staleTime: 60_000,
  });

  const { data: evals = [] } = useQuery<EvalRow[]>({
    queryKey: ["model-evals-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("model_evaluations")
        .select("model_version, improvement_over_heuristic, improvement_over_previous, calibration_error, proxy_success_rate, real_success_rate, acceptance_rate, evaluated_at")
        .order("evaluated_at", { ascending: false })
        .limit(50);
      return (data as any) || [];
    },
    staleTime: 60_000,
  });

  const evalMap = new Map<string, EvalRow>();
  evals.forEach(e => { if (!evalMap.has(e.model_version)) evalMap.set(e.model_version, e); });

  const activeModel = models.find(m => m.status === "active");

  if (models.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 text-center">
          <GitBranch className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No models in registry yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <GitBranch className="h-3.5 w-3.5 text-primary" /> Model Promotion Log
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {activeModel && (
          <div className="flex items-center gap-2 p-2 rounded bg-primary/10 border border-primary/20 mb-3">
            <Crown className="h-4 w-4 text-primary shrink-0" />
            <div className="text-xs">
              <span className="font-medium">Active: </span>
              <span className="font-mono">{activeModel.version}</span>
              <span className="text-muted-foreground ml-2">{activeModel.training_mode || "unknown"}</span>
              <span className="text-muted-foreground ml-2">
                {activeModel.training_sample_count || 0} samples
              </span>
            </div>
          </div>
        )}

        {models.map(m => {
          const ev = evalMap.get(m.version);
          const icon = statusIcon[m.status as keyof typeof statusIcon] || <Info className="h-3 w-3" />;
          const variant = statusVariant[m.status] || "outline";

          return (
            <div key={m.version} className={`border rounded p-2.5 ${m.status === "rejected" ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                {icon}
                <span className="text-xs font-mono font-medium">{m.version}</span>
                <Badge variant={variant} className="text-[9px] h-4">{m.status}</Badge>
                {m.training_mode && (
                  <Badge variant="outline" className="text-[9px] h-4">{m.training_mode}</Badge>
                )}
                {m.promotion_status === "rejected" && (
                  <Badge variant="destructive" className="text-[9px] h-4">
                    <XCircle className="h-2.5 w-2.5 mr-0.5" />Promotion Rejected
                  </Badge>
                )}
                {m.promotion_status === "approved" && (
                  <Badge variant="default" className="text-[9px] h-4">
                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" />Promoted
                  </Badge>
                )}
              </div>

              {m.rejection_reason && (
                <p className="text-[10px] text-destructive mt-1">
                  Rejection: {m.rejection_reason}
                </p>
              )}

              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                <span>Created: {new Date(m.created_at).toLocaleDateString()}</span>
                <span>Samples: {m.training_sample_count || 0}</span>
                <span>Proxy: {m.proxy_sample_count || 0}</span>
                <span>Real: {m.real_sample_count || 0}</span>
                <span>Measured: {m.measured_sample_count || 0}</span>
                {m.last_calibrated_at && <span>Cal: {new Date(m.last_calibrated_at).toLocaleDateString()}</span>}
              </div>

              {ev && (
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                  {ev.improvement_over_heuristic != null && (
                    <span className={ev.improvement_over_heuristic > 0 ? "text-primary font-medium" : "text-destructive font-medium"}>
                      vs Heuristic: {ev.improvement_over_heuristic > 0 ? "+" : ""}{ev.improvement_over_heuristic.toFixed(1)}%
                    </span>
                  )}
                  {ev.calibration_error != null && <span>ECE: {ev.calibration_error.toFixed(3)}</span>}
                  {ev.acceptance_rate != null && <span>Accept: {(ev.acceptance_rate * 100).toFixed(0)}%</span>}
                  <span>Eval: {new Date(ev.evaluated_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
