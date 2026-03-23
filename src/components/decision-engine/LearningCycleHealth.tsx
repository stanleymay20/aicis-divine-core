import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

interface LearningRun {
  id: string;
  run_started_at: string;
  run_finished_at: string | null;
  success: boolean;
  calibration_version: string | null;
  evaluation_result: any;
  governance_alerts_triggered: number | null;
  weekly_stats: any;
  error_message: string | null;
  duration_ms: number | null;
}

export default function LearningCycleHealth() {
  // Try new table first, fall back to system_logs
  const { data: runs = [] } = useQuery<LearningRun[]>({
    queryKey: ["learning-cycle-health"],
    queryFn: async () => {
      // Try weekly_learning_logs first
      const { data: wlLogs, error } = await supabase
        .from("weekly_learning_logs" as any)
        .select("*")
        .order("run_started_at", { ascending: false })
        .limit(8);

      if (!error && wlLogs && wlLogs.length > 0) {
        return wlLogs as any;
      }

      // Fallback to system_logs
      const { data: sysLogs } = await supabase
        .from("system_logs")
        .select("id, action, result, log_level, created_at")
        .eq("action", "weekly_decision_learning")
        .order("created_at", { ascending: false })
        .limit(8);

      return ((sysLogs as any[]) || []).map(r => {
        const parsed = (() => { try { return JSON.parse(r.result || "{}"); } catch { return {}; } })();
        return {
          id: r.id,
          run_started_at: parsed.run_started_at || r.created_at,
          run_finished_at: parsed.run_finished_at || null,
          success: r.log_level !== "error",
          calibration_version: parsed.calibration_version || null,
          evaluation_result: parsed.evaluation_result || null,
          governance_alerts_triggered: parsed.governance_alerts?.alerts_inserted || 0,
          weekly_stats: parsed.weekly_stats || null,
          error_message: parsed.error || null,
          duration_ms: parsed.duration_ms || null,
        };
      });
    },
    staleTime: 60_000,
  });

  const successCount = runs.filter(r => r.success).length;
  const failCount = runs.filter(r => !r.success).length;
  const lastSuccess = runs.find(r => r.success);
  const lastRun = runs[0];

  const daysSinceLastSuccess = lastSuccess?.run_started_at
    ? Math.round((Date.now() - new Date(lastSuccess.run_started_at).getTime()) / 86400000)
    : null;

  const isStale = daysSinceLastSuccess != null && daysSinceLastSuccess > 10;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> Learning Cycle Health
          {isStale && <Badge variant="destructive" className="text-[9px] h-4 ml-1">Stale</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-bold">{runs.length}</p>
            <p className="text-[9px] text-muted-foreground">Runs (last 8)</p>
          </div>
          <div className={`p-2 rounded ${failCount > 0 ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
            <p className={`text-sm font-bold ${failCount > 0 ? "text-destructive" : ""}`}>{successCount}/{runs.length}</p>
            <p className="text-[9px] text-muted-foreground">Success Rate</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-bold">{failCount}</p>
            <p className="text-[9px] text-muted-foreground">Failures</p>
          </div>
          <div className={`p-2 rounded ${isStale ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
            <p className={`text-sm font-bold ${isStale ? "text-destructive" : ""}`}>
              {daysSinceLastSuccess != null ? `${daysSinceLastSuccess}d ago` : "Never"}
            </p>
            <p className="text-[9px] text-muted-foreground">Last Success</p>
          </div>
        </div>

        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No learning cycles recorded yet. Weekly cron runs Mondays 03:00 UTC.
          </p>
        ) : (
          <div className="space-y-1.5">
            {runs.map(r => (
              <div key={r.id} className={`flex items-center gap-2 p-2 rounded text-xs ${!r.success ? "bg-destructive/5 border border-destructive/20" : "bg-muted/20"}`}>
                {!r.success
                  ? <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  : <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground">
                      {new Date(r.run_started_at).toLocaleString()}
                    </span>
                    <Badge variant={!r.success ? "destructive" : "default"} className="text-[9px] h-4">
                      {!r.success ? "Failed" : "Success"}
                    </Badge>
                    {r.duration_ms && (
                      <span className="text-[9px] text-muted-foreground">{(r.duration_ms / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  {r.success && r.weekly_stats && (
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                      {r.weekly_stats.total_outcomes != null && <span>Outcomes: {r.weekly_stats.total_outcomes}</span>}
                      {r.weekly_stats.success_rate != null && <span>Success: {r.weekly_stats.success_rate}%</span>}
                      {r.calibration_version && <span>Cal: {r.calibration_version}</span>}
                    </div>
                  )}
                  {!r.success && r.error_message && (
                    <p className="text-[10px] text-destructive mt-0.5 truncate">{r.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {runs.length === 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Weekly learning cron has not run yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
