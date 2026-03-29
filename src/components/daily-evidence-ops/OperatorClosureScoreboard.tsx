import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface OperatorRow {
  name: string;
  assigned: number;
  started: number;
  completed: number;
  outcomes: number;
  overdue: number;
  measured: number;
}

export default function OperatorClosureScoreboard() {
  const { data: operators = [] } = useQuery({
    queryKey: ["operator-closure-scoreboard"],
    queryFn: async () => {
      const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
      const { data: rows } = await supabase.from("decision_outcome_log")
        .select("execution_owner, execution_status, outcome_success, evidence_type, execution_started_at, execution_completed_at, outcome_timestamp, review_due_at")
        .eq("recommendation_accepted", true)
        .not("execution_owner", "is", null);

      if (!rows) return [];

      const map = new Map<string, OperatorRow>();
      const now = new Date();

      for (const r of rows) {
        const name = r.execution_owner as string;
        if (!map.has(name)) map.set(name, { name, assigned: 0, started: 0, completed: 0, outcomes: 0, overdue: 0, measured: 0 });
        const op = map.get(name)!;
        op.assigned++;

        if (r.execution_started_at && r.execution_started_at >= todayStart) op.started++;
        if (r.execution_status === "completed") op.completed++;
        if (r.execution_completed_at && r.execution_completed_at >= todayStart) op.completed++;
        if (r.outcome_success !== null) op.outcomes++;
        if (r.outcome_timestamp && r.outcome_timestamp >= todayStart) op.outcomes++;
        if (r.evidence_type === "measured") op.measured++;
        if (r.review_due_at && new Date(r.review_due_at) < now && r.execution_status !== "completed") op.overdue++;
      }

      return Array.from(map.values()).sort((a, b) => b.measured - a.measured);
    },
    refetchInterval: 30000,
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Operator Closure</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Owner</TableHead>
              <TableHead className="text-xs text-center">Assigned</TableHead>
              <TableHead className="text-xs text-center">Completed</TableHead>
              <TableHead className="text-xs text-center">Outcomes</TableHead>
              <TableHead className="text-xs text-center">Measured</TableHead>
              <TableHead className="text-xs text-center">Overdue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {operators.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">No operators with assignments</TableCell></TableRow>
            )}
            {operators.map(op => (
              <TableRow key={op.name}>
                <TableCell className="text-xs font-medium truncate max-w-[120px]">{op.name}</TableCell>
                <TableCell className="text-xs text-center font-mono">{op.assigned}</TableCell>
                <TableCell className="text-xs text-center font-mono">{op.completed}</TableCell>
                <TableCell className="text-xs text-center font-mono">{op.outcomes}</TableCell>
                <TableCell className="text-xs text-center"><Badge variant={op.measured > 0 ? "default" : "secondary"} className="text-xs">{op.measured}</Badge></TableCell>
                <TableCell className="text-xs text-center">{op.overdue > 0 ? <Badge variant="destructive" className="text-xs">{op.overdue}</Badge> : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
