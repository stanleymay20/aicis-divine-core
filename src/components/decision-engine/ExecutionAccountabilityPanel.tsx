import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserCheck, AlertTriangle } from "lucide-react";

interface OwnerStats {
  owner: string;
  assigned: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
  noOutcome: number;
}

export default function ExecutionAccountabilityPanel() {
  const { data: owners = [] } = useQuery({
    queryKey: ["execution-accountability"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("execution_owner, execution_status, outcome_success, recommendation_accepted, created_at, execution_completed_at")
        .eq("recommendation_accepted", true)
        .not("execution_owner", "is", null);

      if (!data?.length) return [];

      const map = new Map<string, OwnerStats>();
      const now = Date.now();
      const SLA_MS = 24 * 3600000;

      data.forEach((d: any) => {
        const owner = d.execution_owner || "Unassigned";
        if (!map.has(owner)) map.set(owner, { owner, assigned: 0, notStarted: 0, inProgress: 0, completed: 0, overdue: 0, noOutcome: 0 });
        const s = map.get(owner)!;
        s.assigned++;
        const status = d.execution_status || "not_started";
        if (status === "not_started") {
          s.notStarted++;
          if (now - new Date(d.created_at).getTime() > SLA_MS) s.overdue++;
        }
        if (status === "in_progress") s.inProgress++;
        if (status === "completed") {
          s.completed++;
          if (d.outcome_success === null) s.noOutcome++;
        }
      });

      return Array.from(map.values()).sort((a, b) => b.overdue - a.overdue || b.assigned - a.assigned);
    },
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" /> Execution Accountability
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px]">
          <div className="space-y-1.5">
            <div className="grid grid-cols-7 text-[10px] text-muted-foreground font-medium px-2 pb-1 border-b border-border/30">
              <span className="col-span-2">Owner</span>
              <span className="text-center">Assigned</span>
              <span className="text-center">Pending</span>
              <span className="text-center">Done</span>
              <span className="text-center">Overdue</span>
              <span className="text-center">No Out.</span>
            </div>
            {owners.map((o) => (
              <div key={o.owner} className={`grid grid-cols-7 items-center px-2 py-1.5 rounded text-xs ${o.overdue > 2 ? "bg-destructive/5 border border-destructive/20" : "border border-transparent"}`}>
                <span className="col-span-2 font-medium truncate">{o.owner}</span>
                <span className="text-center font-mono">{o.assigned}</span>
                <span className="text-center font-mono">{o.notStarted + o.inProgress}</span>
                <span className="text-center font-mono text-green-500">{o.completed}</span>
                <span className="text-center font-mono">
                  {o.overdue > 0 ? <Badge variant="destructive" className="text-[9px] h-4">{o.overdue}</Badge> : "0"}
                </span>
                <span className="text-center font-mono">
                  {o.noOutcome > 0 ? <Badge variant="outline" className="text-[9px] h-4 text-yellow-500 border-yellow-500/30">{o.noOutcome}</Badge> : "0"}
                </span>
              </div>
            ))}
            {owners.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No execution data</p>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
