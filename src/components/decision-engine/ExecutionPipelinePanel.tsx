import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Clock, CheckCircle, XCircle, AlertTriangle, Pause } from "lucide-react";

export default function ExecutionPipelinePanel() {
  const { data } = useQuery({
    queryKey: ["execution-pipeline"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("decision_outcome_log")
        .select("id, signal_title, execution_status, execution_owner, execution_started_at, execution_completed_at, execution_blocker, recommendation_accepted, created_at, action_taken_at")
        .eq("recommendation_accepted", true);

      const all = (rows as any[]) || [];
      const notStarted = all.filter(r => !r.execution_status || r.execution_status === "not_started");
      const inProgress = all.filter(r => r.execution_status === "in_progress");
      const completed = all.filter(r => r.execution_status === "completed");
      const abandoned = all.filter(r => r.execution_status === "abandoned");
      const blocked = all.filter(r => !!r.execution_blocker);

      // Average execution lag (created → started)
      const lags = all
        .filter(r => r.execution_started_at && r.created_at)
        .map(r => (new Date(r.execution_started_at).getTime() - new Date(r.created_at).getTime()) / 3600000);
      const avgLagHours = lags.length > 0
        ? Math.round(lags.reduce((a, b) => a + b, 0) / lags.length)
        : null;

      // Average execution duration (started → completed)
      const durations = all
        .filter(r => r.execution_completed_at && r.execution_started_at)
        .map(r => (new Date(r.execution_completed_at).getTime() - new Date(r.execution_started_at).getTime()) / 3600000);
      const avgDurationHours = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

      return {
        total: all.length,
        notStarted: notStarted.length,
        inProgress: inProgress.length,
        completed: completed.length,
        abandoned: abandoned.length,
        blocked: blocked.length,
        avgLagHours,
        avgDurationHours,
        blockedItems: blocked.slice(0, 3),
      };
    },
    staleTime: 30_000,
  });

  if (!data || data.total === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 text-center">
          <Play className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No accepted decisions to track execution.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5 text-primary" /> Execution Pipeline
          {data.blocked > 0 && <Badge variant="destructive" className="text-[9px] h-4">{data.blocked} blocked</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
          <StatusBox icon={<Pause className="h-3 w-3 text-muted-foreground" />} label="Not Started" value={data.notStarted} warn={data.notStarted > 5} />
          <StatusBox icon={<Clock className="h-3 w-3 text-accent-foreground" />} label="In Progress" value={data.inProgress} />
          <StatusBox icon={<CheckCircle className="h-3 w-3 text-primary" />} label="Completed" value={data.completed} />
          <StatusBox icon={<XCircle className="h-3 w-3 text-destructive" />} label="Abandoned" value={data.abandoned} warn={data.abandoned > 0} />
          <StatusBox icon={<AlertTriangle className="h-3 w-3 text-destructive" />} label="Blocked" value={data.blocked} warn={data.blocked > 0} />
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-bold">{data.avgLagHours != null ? `${data.avgLagHours}h` : "—"}</p>
            <p className="text-[9px] text-muted-foreground">Avg Execution Lag</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-bold">{data.avgDurationHours != null ? `${data.avgDurationHours}h` : "—"}</p>
            <p className="text-[9px] text-muted-foreground">Avg Duration</p>
          </div>
        </div>

        {data.blockedItems.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-destructive mb-1">Blocked Decisions</p>
            {data.blockedItems.map((b: any) => (
              <div key={b.id} className="text-[10px] p-1.5 rounded bg-destructive/5 border border-destructive/20 mb-1">
                <span className="font-medium">{b.signal_title || "Untitled"}</span>
                {b.execution_blocker && <span className="text-muted-foreground ml-1">— {b.execution_blocker}</span>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBox({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: number; warn?: boolean }) {
  return (
    <div className={`p-2 rounded ${warn ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
      <div className="flex justify-center mb-0.5">{icon}</div>
      <p className={`text-sm font-bold ${warn ? "text-destructive" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
