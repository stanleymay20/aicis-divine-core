import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface ReviewerWorkload {
  reviewer: string;
  pending: number;
  overdue: number;
  completed: number;
  avgReviewHours: number | null;
}

export default function ReviewerWorkloadPanel() {
  const { data: workloads = [] } = useQuery<ReviewerWorkload[]>({
    queryKey: ["reviewer-workloads"],
    queryFn: async () => {
      const { data: records } = await supabase
        .from("decision_outcome_log")
        .select("assigned_reviewer, review_status, review_due_at, review_completed_at, created_at")
        .not("assigned_reviewer", "is", null);

      if (!records || records.length === 0) return [];

      const now = Date.now();
      const map = new Map<string, { pending: number; overdue: number; completed: number; reviewHours: number[] }>();

      for (const r of records as any[]) {
        const rev = r.assigned_reviewer as string;
        if (!rev) continue;
        if (!map.has(rev)) map.set(rev, { pending: 0, overdue: 0, completed: 0, reviewHours: [] });
        const entry = map.get(rev)!;

        const isDone = r.review_status && ["approved", "rejected", "overridden"].includes(r.review_status);
        if (isDone) {
          entry.completed++;
          if (r.review_completed_at && r.created_at) {
            const hours = (new Date(r.review_completed_at).getTime() - new Date(r.created_at).getTime()) / 3600000;
            entry.reviewHours.push(hours);
          }
        } else {
          entry.pending++;
          if (r.review_due_at && new Date(r.review_due_at).getTime() < now) {
            entry.overdue++;
          }
        }
      }

      return Array.from(map.entries()).map(([reviewer, d]) => ({
        reviewer,
        pending: d.pending,
        overdue: d.overdue,
        completed: d.completed,
        avgReviewHours: d.reviewHours.length > 0
          ? Math.round(d.reviewHours.reduce((a, b) => a + b, 0) / d.reviewHours.length)
          : null,
      })).sort((a, b) => b.pending - a.pending);
    },
    staleTime: 30_000,
  });

  const { data: criticalityStats } = useQuery({
    queryKey: ["criticality-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("criticality_tier, requires_dual_approval, second_review_status")
        .not("criticality_tier", "is", null);

      if (!data || data.length === 0) return { critical: 0, elevated: 0, standard: 0, dualPending: 0 };

      let critical = 0, elevated = 0, standard = 0, dualPending = 0;
      for (const r of data as any[]) {
        if (r.criticality_tier === "critical") critical++;
        else if (r.criticality_tier === "elevated") elevated++;
        else standard++;
        if (r.requires_dual_approval && (!r.second_review_status || r.second_review_status === "pending")) {
          dualPending++;
        }
      }
      return { critical, elevated, standard, dualPending };
    },
    staleTime: 30_000,
  });

  const totalPending = workloads.reduce((a, w) => a + w.pending, 0);
  const totalOverdue = workloads.reduce((a, w) => a + w.overdue, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> Reviewer Workload & Criticality
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {criticalityStats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-2 rounded text-center bg-destructive/10 border border-destructive/20">
              <p className="text-sm font-bold text-destructive">{criticalityStats.critical}</p>
              <p className="text-[9px] text-muted-foreground">Critical (dual)</p>
            </div>
            <div className="p-2 rounded text-center bg-muted/30">
              <p className="text-sm font-bold">{criticalityStats.elevated}</p>
              <p className="text-[9px] text-muted-foreground">Elevated</p>
            </div>
            <div className="p-2 rounded text-center bg-muted/30">
              <p className="text-sm font-bold">{criticalityStats.standard}</p>
              <p className="text-[9px] text-muted-foreground">Standard</p>
            </div>
            <div className={`p-2 rounded text-center ${criticalityStats.dualPending > 0 ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
              <p className={`text-sm font-bold ${criticalityStats.dualPending > 0 ? "text-destructive" : ""}`}>{criticalityStats.dualPending}</p>
              <p className="text-[9px] text-muted-foreground">Dual Pending</p>
            </div>
          </div>
        )}

        {workloads.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">No reviewer assignments yet.</p>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-5 gap-1 text-[9px] text-muted-foreground font-medium px-2">
              <span className="col-span-1">Reviewer</span>
              <span className="text-center">Pending</span>
              <span className="text-center">Overdue</span>
              <span className="text-center">Done</span>
              <span className="text-center">Avg Time</span>
            </div>
            {workloads.map(w => (
              <div key={w.reviewer} className={`grid grid-cols-5 gap-1 text-xs px-2 py-1.5 rounded ${w.overdue > 0 ? "bg-destructive/5 border border-destructive/20" : "bg-muted/20"}`}>
                <span className="truncate font-medium">{w.reviewer}</span>
                <span className="text-center">
                  {w.pending > 0 ? (
                    <Badge variant="outline" className="text-[9px] h-4">{w.pending}</Badge>
                  ) : (
                    <CheckCircle className="h-3 w-3 text-primary mx-auto" />
                  )}
                </span>
                <span className="text-center">
                  {w.overdue > 0 ? (
                    <Badge variant="destructive" className="text-[9px] h-4">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{w.overdue}
                    </Badge>
                  ) : "—"}
                </span>
                <span className="text-center font-medium">{w.completed}</span>
                <span className="text-center flex items-center justify-center gap-0.5">
                  {w.avgReviewHours != null ? (
                    <><Clock className="h-2.5 w-2.5 text-muted-foreground" />{w.avgReviewHours}h</>
                  ) : "—"}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground pt-1">
              <span>Total pending: {totalPending}</span>
              {totalOverdue > 0 && <span className="text-destructive font-medium">Total overdue: {totalOverdue}</span>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
