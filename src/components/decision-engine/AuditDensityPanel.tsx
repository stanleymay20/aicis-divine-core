import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle } from "lucide-react";

export default function AuditDensityPanel() {
  const { data } = useQuery({
    queryKey: ["audit-density"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const [totalRes, todayRes, weekRes, byActionRes] = await Promise.all([
        supabase.from("audit_log").select("id", { count: "exact", head: true }),
        supabase.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("audit_log").select("action").limit(500),
      ]);

      const actions = (byActionRes.data as any[]) || [];
      const actionCounts: Record<string, number> = {};
      actions.forEach(a => {
        actionCounts[a.action] = (actionCounts[a.action] || 0) + 1;
      });

      const sortedActions = Object.entries(actionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8);

      // Check for expected audit events
      const expectedEvents = [
        "engine.daily_inference",
        "governance.alerts_scan",
        "engine.weekly_learning",
        "decision.accepted",
        "decision.rejected",
        "outcome_recorded",
        "execution_started",
      ];
      const missingEvents = expectedEvents.filter(e => !actionCounts[e]);

      return {
        total: totalRes.count ?? 0,
        today: todayRes.count ?? 0,
        week: weekRes.count ?? 0,
        topActions: sortedActions,
        missingEvents,
        dailyAvg: (weekRes.count ?? 0) > 0 ? Math.round((weekRes.count ?? 0) / 7) : 0,
      };
    },
    staleTime: 30_000,
  });

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" /> Audit Density
          </CardTitle>
          <Badge variant={data.total > 20 ? "default" : data.total > 5 ? "secondary" : "destructive"} className="text-[9px]">
            {data.total} total events
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-2.5 rounded border border-border bg-muted/20 text-center">
            <p className="text-lg font-bold">{data.today}</p>
            <p className="text-[9px] text-muted-foreground">Today</p>
          </div>
          <div className="p-2.5 rounded border border-border bg-muted/20 text-center">
            <p className="text-lg font-bold">{data.week}</p>
            <p className="text-[9px] text-muted-foreground">Last 7 Days</p>
          </div>
          <div className="p-2.5 rounded border border-border bg-muted/20 text-center">
            <p className="text-lg font-bold">{data.dailyAvg}</p>
            <p className="text-[9px] text-muted-foreground">Daily Avg</p>
          </div>
        </div>

        {/* Action breakdown */}
        <div>
          <p className="text-[10px] font-medium text-muted-foreground mb-2">Event Distribution</p>
          <div className="space-y-1">
            {data.topActions.map(([action, count]) => (
              <div key={action} className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-muted/20">
                <span className="font-mono text-muted-foreground">{action}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Missing events warning */}
        {data.missingEvents.length > 0 && (
          <div className="p-2 rounded border border-warning/30 bg-warning/5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              <span className="text-[10px] font-medium">Missing Audit Events</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {data.missingEvents.map(e => (
                <Badge key={e} variant="outline" className="text-[8px] h-4 font-mono">{e}</Badge>
              ))}
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">These events should appear as the system processes decisions.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
