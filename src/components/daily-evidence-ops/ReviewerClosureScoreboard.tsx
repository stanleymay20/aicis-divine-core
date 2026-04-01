import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      <CardHeader className="pb-2 sm:pb-3">
        <CardTitle className="text-sm sm:text-base font-semibold">Reviewer Closure</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[280px]">
          {reviewers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No reviewers with assignments</p>
          ) : (
            <div className="divide-y divide-border/30">
              {reviewers.map(rev => (
                <div key={rev.name} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate">{rev.name}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {rev.assigned} assigned · {rev.reviewed} reviewed · {rev.pending} pending
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-xs font-mono">{rev.completionRate}</Badge>
                    {rev.overdue > 0 && (
                      <Badge variant="destructive" className="text-xs font-mono">{rev.overdue}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
