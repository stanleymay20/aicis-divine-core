import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReviewerRow {
  name: string;
  assigned: number;
  reviewed: number;
  pending: number;
  overdue: number;
  failedNoPostmortem: number;
  completionRate: string;
}

export default function ReviewerClosureScoreboard() {
  const { data: reviewers = [] } = useQuery({
    queryKey: ["reviewer-closure-scoreboard"],
    queryFn: async () => {
      const { data: rows } = await supabase.from("decision_outcome_log")
        .select("assigned_reviewer, execution_status, outcome_success, postmortem_note, review_due_at")
        .eq("recommendation_accepted", true)
        .not("assigned_reviewer", "is", null);

      if (!rows) return [];

      const map = new Map<string, ReviewerRow>();
      const now = new Date();

      for (const r of rows) {
        const name = r.assigned_reviewer as string;
        if (!map.has(name)) map.set(name, { name, assigned: 0, reviewed: 0, pending: 0, overdue: 0, failedNoPostmortem: 0, completionRate: "0%" });
        const rev = map.get(name)!;
        rev.assigned++;

        if (r.execution_status === "completed" || r.outcome_success !== null) {
          rev.reviewed++;
        } else {
          rev.pending++;
          if (r.review_due_at && new Date(r.review_due_at) < now) rev.overdue++;
        }
        if (r.outcome_success === false && !r.postmortem_note) rev.failedNoPostmortem++;
      }

      return Array.from(map.values()).map(r => ({
        ...r,
        completionRate: r.assigned > 0 ? `${((r.reviewed / r.assigned) * 100).toFixed(0)}%` : "0%",
      })).sort((a, b) => b.reviewed - a.reviewed);
    },
    refetchInterval: 30000,
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Reviewer Closure</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Reviewer</TableHead>
              <TableHead className="text-xs text-center">Assigned</TableHead>
              <TableHead className="text-xs text-center">Reviewed</TableHead>
              <TableHead className="text-xs text-center">Pending</TableHead>
              <TableHead className="text-xs text-center">Overdue</TableHead>
              <TableHead className="text-xs text-center">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviewers.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">No reviewers with assignments</TableCell></TableRow>
            )}
            {reviewers.map(rev => (
              <TableRow key={rev.name}>
                <TableCell className="text-xs font-medium truncate max-w-[120px]">{rev.name}</TableCell>
                <TableCell className="text-xs text-center font-mono">{rev.assigned}</TableCell>
                <TableCell className="text-xs text-center font-mono">{rev.reviewed}</TableCell>
                <TableCell className="text-xs text-center font-mono">{rev.pending}</TableCell>
                <TableCell className="text-xs text-center">{rev.overdue > 0 ? <Badge variant="destructive" className="text-xs">{rev.overdue}</Badge> : "—"}</TableCell>
                <TableCell className="text-xs text-center font-mono">{rev.completionRate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
