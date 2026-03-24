import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle } from "lucide-react";

export default function AuditActivityPanel() {
  const { data } = useQuery({
    queryKey: ["audit-activity"],
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

      const [todayRes, weekRes, recentRes] = await Promise.all([
        supabase.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("audit_log").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("audit_log").select("action, created_at, severity").order("created_at", { ascending: false }).limit(10),
      ]);

      // Action distribution
      const actions = (recentRes.data as any[]) || [];
      const actionCounts = new Map<string, number>();
      for (const a of actions) {
        actionCounts.set(a.action, (actionCounts.get(a.action) || 0) + 1);
      }

      return {
        today: todayRes.count ?? 0,
        week: weekRes.count ?? 0,
        recent: actions,
        actionDistribution: Array.from(actionCounts.entries()).map(([action, count]) => ({ action, count })),
      };
    },
    staleTime: 30_000,
  });

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> Audit Activity
          {data.today === 0 && (
            <Badge variant="outline" className="text-[9px] h-4 ml-1 border-destructive/50 text-destructive">
              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />No audit events today
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className={`p-2 rounded ${data.today === 0 ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
            <p className={`text-sm font-bold ${data.today === 0 ? "text-destructive" : ""}`}>{data.today}</p>
            <p className="text-[9px] text-muted-foreground">Today</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-bold">{data.week}</p>
            <p className="text-[9px] text-muted-foreground">Last 7 Days</p>
          </div>
        </div>

        {data.actionDistribution.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-medium">Recent Events</p>
            {data.actionDistribution.map(d => (
              <div key={d.action} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/20">
                <span className="text-muted-foreground truncate">{d.action}</span>
                <Badge variant="outline" className="text-[9px] h-4">{d.count}</Badge>
              </div>
            ))}
          </div>
        )}

        {data.recent.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground font-medium">Latest</p>
            {data.recent.slice(0, 5).map((r: any, i: number) => (
              <div key={i} className="text-[10px] text-muted-foreground flex justify-between">
                <span className="truncate">{r.action}</span>
                <span>{new Date(r.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
