import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

interface LearningRun {
  id: string;
  action: string;
  result: string | null;
  log_level: string | null;
  created_at: string | null;
}

interface ParsedResult {
  weekly_stats?: { total_outcomes?: number; success_rate?: number | null; avg_roi?: number | null };
  calibration?: string;
  evaluation?: string;
}

export default function LearningCycleHealth() {
  const { data: runs = [] } = useQuery<LearningRun[]>({
    queryKey: ["learning-cycle-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_logs")
        .select("id, action, result, log_level, created_at")
        .eq("action", "weekly_decision_learning")
        .order("created_at", { ascending: false })
        .limit(8);
      return (data as any) || [];
    },
    staleTime: 60_000,
  });

  const successCount = runs.filter(r => r.log_level === "info").length;
  const failCount = runs.filter(r => r.log_level === "error").length;
  const lastSuccess = runs.find(r => r.log_level === "info");
  const lastRun = runs[0];

  const parseResult = (r: LearningRun): ParsedResult | null => {
    try { return JSON.parse(r.result || "{}"); } catch { return null; }
  };

  const daysSinceLastSuccess = lastSuccess?.created_at
    ? Math.round((Date.now() - new Date(lastSuccess.created_at).getTime()) / 86400000)
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
        {/* KPIs */}
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

        {/* Run history */}
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No learning cycles recorded yet. Weekly cron will populate this.
          </p>
        ) : (
          <div className="space-y-1.5">
            {runs.map(r => {
              const parsed = parseResult(r);
              const isError = r.log_level === "error";
              return (
                <div key={r.id} className={`flex items-center gap-2 p-2 rounded text-xs ${isError ? "bg-destructive/5 border border-destructive/20" : "bg-muted/20"}`}>
                  {isError
                    ? <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                    : <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </span>
                      <Badge variant={isError ? "destructive" : "default"} className="text-[9px] h-4">
                        {isError ? "Failed" : "Success"}
                      </Badge>
                    </div>
                    {parsed && !isError && (
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                        {parsed.weekly_stats?.total_outcomes != null && (
                          <span>Outcomes: {parsed.weekly_stats.total_outcomes}</span>
                        )}
                        {parsed.weekly_stats?.success_rate != null && (
                          <span>Success: {parsed.weekly_stats.success_rate}%</span>
                        )}
                        {parsed.calibration && <span>Cal: {parsed.calibration}</span>}
                        {parsed.evaluation && <span>Eval: {parsed.evaluation}</span>}
                      </div>
                    )}
                    {isError && r.result && (
                      <p className="text-[10px] text-destructive mt-0.5 truncate">{r.result}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {runs.length === 0 && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Weekly learning cron has not run yet. Scheduled for Mondays 03:00 UTC.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
