import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserCheck, AlertTriangle, Clock, CheckCircle, ShieldAlert } from "lucide-react";

interface ReviewerStat {
  reviewer: string;
  assigned: number;
  pending: number;
  overdue: number;
  completed: number;
  medianHours: number | null;
  overrideCount: number;
}

export default function ReviewerAccountabilityPanel() {
  const { data: reviewers = [] } = useQuery<ReviewerStat[]>({
    queryKey: ["reviewer-accountability"],
    queryFn: async () => {
      const { data: records } = await supabase
        .from("decision_outcome_log")
        .select("assigned_reviewer, reviewer_name, review_status, review_due_at, review_completed_at, created_at")
        .not("assigned_reviewer", "is", null);

      if (!records || records.length === 0) return [];

      const now = Date.now();
      const map = new Map<string, { assigned: number; pending: number; overdue: number; completed: number; hours: number[]; overrides: number }>();

      for (const r of records as any[]) {
        const rev = r.assigned_reviewer as string;
        if (!rev) continue;
        if (!map.has(rev)) map.set(rev, { assigned: 0, pending: 0, overdue: 0, completed: 0, hours: [], overrides: 0 });
        const entry = map.get(rev)!;
        entry.assigned++;

        const isDone = r.review_status && ["approved", "rejected", "overridden"].includes(r.review_status);
        if (isDone) {
          entry.completed++;
          if (r.review_status === "overridden") entry.overrides++;
          if (r.review_completed_at && r.created_at) {
            entry.hours.push((new Date(r.review_completed_at).getTime() - new Date(r.created_at).getTime()) / 3600000);
          }
        } else {
          entry.pending++;
          if (r.review_due_at && new Date(r.review_due_at).getTime() < now) entry.overdue++;
        }
      }

      return Array.from(map.entries()).map(([reviewer, d]) => {
        const sorted = d.hours.sort((a, b) => a - b);
        return {
          reviewer,
          assigned: d.assigned,
          pending: d.pending,
          overdue: d.overdue,
          completed: d.completed,
          medianHours: sorted.length > 0 ? Math.round(sorted[Math.floor(sorted.length / 2)]) : null,
          overrideCount: d.overrides,
        };
      }).sort((a, b) => b.overdue - a.overdue || b.pending - a.pending);
    },
    staleTime: 30_000,
  });

  const { data: discrepancies = [] } = useQuery({
    queryKey: ["governance-discrepancies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("governance_discrepancies" as any)
        .select("id, discrepancy_type, description, detected_at, resolved")
        .eq("resolved", false)
        .order("detected_at", { ascending: false })
        .limit(5);
      return (data as any) || [];
    },
    staleTime: 30_000,
  });

  if (reviewers.length === 0 && discrepancies.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 text-center">
          <UserCheck className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No reviewer assignments yet.</p>
        </CardContent>
      </Card>
    );
  }

  const totalOverdue = reviewers.reduce((a, r) => a + r.overdue, 0);
  const totalOverrides = reviewers.reduce((a, r) => a + r.overrideCount, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5 flex-wrap">
          <UserCheck className="h-3.5 w-3.5 text-primary" /> Reviewer Accountability
          {totalOverdue > 0 && <Badge variant="destructive" className="text-[10px] h-5">{totalOverdue} overdue</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-bold">{reviewers.length}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Reviewers</p>
          </div>
          <div className={`p-2 rounded ${totalOverdue > 0 ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
            <p className={`text-sm font-bold ${totalOverdue > 0 ? "text-destructive" : ""}`}>{totalOverdue}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total Overdue</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-bold">{totalOverrides}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total Overrides</p>
          </div>
        </div>

        {/* Reviewer table */}
        {reviewers.length > 0 && (
          <div className="space-y-1">
            <div className="grid grid-cols-6 gap-1 text-[10px] sm:text-xs text-muted-foreground font-medium px-2">
              <span className="col-span-1">Reviewer</span>
              <span className="text-center">Assigned</span>
              <span className="text-center">Pending</span>
              <span className="text-center">Overdue</span>
              <span className="text-center">Median</span>
              <span className="text-center">Overrides</span>
            </div>
            {reviewers.map(r => (
              <div key={r.reviewer} className={`grid grid-cols-6 gap-1 text-xs px-2 py-1.5 rounded ${r.overdue > 0 ? "bg-destructive/5 border border-destructive/20" : "bg-muted/20"}`}>
                <span className="truncate font-medium">{r.reviewer}</span>
                <span className="text-center">{r.assigned}</span>
                <span className="text-center">
                  {r.pending > 0 ? <Badge variant="outline" className="text-[9px] h-4">{r.pending}</Badge> : <CheckCircle className="h-3 w-3 text-primary mx-auto" />}
                </span>
                <span className="text-center">
                  {r.overdue > 0 ? (
                    <Badge variant="destructive" className="text-[9px] h-4"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{r.overdue}</Badge>
                  ) : "—"}
                </span>
                <span className="text-center flex items-center justify-center gap-0.5 text-[10px]">
                  {r.medianHours != null ? <><Clock className="h-2.5 w-2.5" />{r.medianHours}h</> : "—"}
                </span>
                <span className="text-center">
                  {r.overrideCount > 0 ? (
                    <Badge variant="outline" className="text-[9px] h-4 border-destructive/50">{r.overrideCount}</Badge>
                  ) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Discrepancies */}
        {discrepancies.length > 0 && (
          <div>
            <p className="text-[10px] font-medium text-destructive mb-1 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" /> Governance Discrepancies ({discrepancies.length})
            </p>
            {discrepancies.map((d: any) => (
              <div key={d.id} className="text-[10px] p-1.5 rounded bg-destructive/5 border border-destructive/20 mb-1">
                <Badge variant="outline" className="text-[8px] h-3.5 mr-1">{d.discrepancy_type}</Badge>
                <span className="text-muted-foreground">{d.description}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
