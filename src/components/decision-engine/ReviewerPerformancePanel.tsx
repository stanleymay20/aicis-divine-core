import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye } from "lucide-react";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface ReviewerStats {
  reviewer: string;
  assigned: number;
  reviewed: number;
  pending: number;
  overrides: number;
  missingPostmortem: number;
}

export default function ReviewerPerformancePanel() {
  const { data: reviewers = [], isLoading } = useQuery({
    queryKey: ["reviewer-performance"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("assigned_reviewer, recommendation_accepted, outcome_success, postmortem_note, override_reason")
        .not("assigned_reviewer", "is", null);

      if (!data?.length) return [];

      const map = new Map<string, ReviewerStats>();
      data.forEach((d: any) => {
        const rev = d.assigned_reviewer;
        if (!map.has(rev)) map.set(rev, { reviewer: rev, assigned: 0, reviewed: 0, pending: 0, overrides: 0, missingPostmortem: 0 });
        const s = map.get(rev)!;
        s.assigned++;
        if (d.recommendation_accepted !== null) s.reviewed++; else s.pending++;
        if (d.override_reason) s.overrides++;
        if (d.outcome_success === false && !d.postmortem_note) s.missingPostmortem++;
      });

      return Array.from(map.values()).sort((a, b) => (b.pending + b.missingPostmortem) - (a.pending + a.missingPostmortem));
    },
  });

  if (isLoading) return <PanelSkeleton variant="table" rows={5} />;

  return (
    <ErrorBoundary compact>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" /> Reviewer Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[320px]">
            <div className="space-y-1.5">
              <div className="grid grid-cols-6 text-[10px] text-muted-foreground font-medium px-2 pb-1 border-b border-border/30">
                <span className="col-span-2">Reviewer</span>
                <span className="text-center">Reviewed</span>
                <span className="text-center">Pending</span>
                <span className="text-center">Overrides</span>
                <span className="text-center">No PM</span>
              </div>
              {reviewers.map((r) => {
                const completionPct = r.assigned > 0 ? Math.round((r.reviewed / r.assigned) * 100) : 0;
                return (
                  <div key={r.reviewer} className={`grid grid-cols-6 items-center px-2 py-1.5 rounded text-xs ${r.pending > 3 ? "bg-yellow-500/5 border border-yellow-500/20" : "border border-transparent"}`}>
                    <div className="col-span-2">
                      <p className="font-medium truncate">{r.reviewer}</p>
                      <p className="text-[10px] text-muted-foreground">{completionPct}% complete</p>
                    </div>
                    <span className="text-center font-mono text-green-500">{r.reviewed}</span>
                    <span className="text-center font-mono">{r.pending > 0 ? <Badge variant="outline" className="text-[9px] h-4">{r.pending}</Badge> : "0"}</span>
                    <span className="text-center font-mono">{r.overrides}</span>
                    <span className="text-center font-mono">{r.missingPostmortem > 0 ? <Badge variant="destructive" className="text-[9px] h-4">{r.missingPostmortem}</Badge> : "0"}</span>
                  </div>
                );
              })}
              {reviewers.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No reviewer data</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}
