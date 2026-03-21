import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, Crown, RotateCcw, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface RollbackEntry {
  id: string;
  rolled_back_version: string;
  rolled_back_to_version: string;
  rollback_reason: string;
  triggered_by: string | null;
  improvement_over_heuristic: number | null;
  calibration_error: number | null;
  created_at: string;
}

export default function ModelSafetyPanel() {
  const { data: activeModel } = useQuery({
    queryKey: ["model-safety-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_models")
        .select("version, status, training_mode, rollback_required, rollback_reason, last_calibrated_at, promotion_status, rejection_reason")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    staleTime: 30_000,
  });

  const { data: latestEval } = useQuery({
    queryKey: ["model-safety-eval"],
    queryFn: async () => {
      const { data } = await supabase
        .from("model_evaluations")
        .select("model_version, improvement_over_heuristic, calibration_error, acceptance_rate")
        .order("evaluated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    staleTime: 60_000,
  });

  const { data: rollbacks = [] } = useQuery<RollbackEntry[]>({
    queryKey: ["model-rollback-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("model_rollback_history" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      return (data as any) || [];
    },
    staleTime: 60_000,
  });

  const { data: lastValid } = useQuery({
    queryKey: ["model-safety-last-valid"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_models")
        .select("version, training_mode, last_calibrated_at")
        .neq("status", "rejected")
        .neq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    staleTime: 60_000,
  });

  const { data: silentFailures = [] } = useQuery({
    queryKey: ["silent-failures-blocking"],
    queryFn: async () => {
      const { data } = await supabase
        .from("silent_failure_state" as any)
        .select("failure_type, severity")
        .eq("resolved", false);
      return (data as any) || [];
    },
    staleTime: 30_000,
  });

  const criticalFailures = silentFailures.filter((f: any) => f.severity === "critical" || f.severity === "high");
  const promotionBlocked = criticalFailures.length > 0;
  const rollbackRequired = activeModel?.rollback_required === true;

  const heuristicDelta = latestEval?.improvement_over_heuristic;
  const isUnderperforming = heuristicDelta != null && heuristicDelta < 0;

  return (
    <Card className={rollbackRequired ? "border-destructive/50 bg-destructive/5" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-primary" /> Model Safety
          {rollbackRequired && <Badge variant="destructive" className="text-[9px] h-4">Rollback Required</Badge>}
          {promotionBlocked && <Badge variant="outline" className="text-[9px] h-4 border-destructive/50">Promotion Blocked</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Active model health */}
        {activeModel ? (
          <div className="flex items-center gap-2 p-2 rounded bg-muted/30 border border-border">
            <Crown className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-mono font-medium">{activeModel.version}</span>
                <Badge variant="default" className="text-[9px] h-4">Active</Badge>
                {activeModel.training_mode && <Badge variant="outline" className="text-[9px] h-4">{activeModel.training_mode}</Badge>}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                {heuristicDelta != null && (
                  <span className={isUnderperforming ? "text-destructive font-medium" : "text-primary"}>
                    vs Heuristic: {heuristicDelta > 0 ? "+" : ""}{heuristicDelta.toFixed(1)}%
                  </span>
                )}
                {latestEval?.calibration_error != null && <span>ECE: {latestEval.calibration_error.toFixed(3)}</span>}
                {activeModel.last_calibrated_at && <span>Cal: {new Date(activeModel.last_calibrated_at).toLocaleDateString()}</span>}
              </div>
            </div>
            {isUnderperforming ? (
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            ) : (
              <CheckCircle className="h-4 w-4 text-primary shrink-0" />
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">No active model.</p>
        )}

        {/* Rollback reason */}
        {rollbackRequired && activeModel?.rollback_reason && (
          <div className="text-[10px] text-destructive p-2 rounded bg-destructive/10 border border-destructive/20">
            <span className="font-medium">Rollback reason: </span>{activeModel.rollback_reason}
          </div>
        )}

        {/* Last valid fallback */}
        {lastValid && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <RotateCcw className="h-3 w-3 shrink-0" />
            <span>Last valid fallback: <span className="font-mono font-medium">{lastValid.version}</span> ({lastValid.training_mode})</span>
          </div>
        )}

        {/* Promotion blocked by silent failures */}
        {promotionBlocked && (
          <div className="text-[10px] p-2 rounded bg-destructive/5 border border-destructive/20">
            <span className="font-medium text-destructive">Promotion blocked:</span>
            <span className="text-muted-foreground ml-1">
              {criticalFailures.length} unresolved failure(s): {criticalFailures.map((f: any) => f.failure_type).join(", ")}
            </span>
          </div>
        )}

        {/* Rollback history */}
        {rollbacks.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-muted-foreground mb-1">Rollback History</p>
            <div className="space-y-1">
              {rollbacks.map((r: any) => (
                <div key={r.id} className="flex items-center gap-2 text-[10px] p-1.5 rounded bg-muted/20">
                  <XCircle className="h-3 w-3 text-destructive shrink-0" />
                  <span className="font-mono">{r.rolled_back_version}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono">{r.rolled_back_to_version}</span>
                  <span className="text-muted-foreground truncate flex-1">{r.rollback_reason}</span>
                  <span className="text-muted-foreground shrink-0">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
