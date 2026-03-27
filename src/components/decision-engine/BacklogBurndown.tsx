import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PanelSkeleton } from "@/components/ui/panel-skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";

interface BurndownRow {
  label: string;
  current: number;
  key: string;
}

export default function BacklogBurndown() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["backlog-burndown"],
    queryFn: async () => {
      const [cno, ans, np, mo] = await Promise.all([
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("execution_status", "completed").is("outcome_success", null),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true).eq("execution_status", "not_started"),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true).eq("outcome_success", false).is("postmortem_note", null),
        supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
          .eq("recommendation_accepted", true).is("execution_owner", null),
      ]);

      return [
        { label: "Completed / No Outcome", current: cno.count ?? 0, key: "cno" },
        { label: "Accepted / Not Started", current: ans.count ?? 0, key: "ans" },
        { label: "Failed / No Postmortem", current: np.count ?? 0, key: "np" },
        { label: "Missing Owner", current: mo.count ?? 0, key: "mo" },
      ] as BurndownRow[];
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <PanelSkeleton variant="list" rows={4} />;

  const totalOpen = rows.reduce((s, r) => s + r.current, 0);

  return (
    <ErrorBoundary compact>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Backlog Burndown</CardTitle>
            <Badge variant={totalOpen === 0 ? "default" : "outline"} className="text-xs font-mono">
              {totalOpen} open
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rows.map(row => (
              <div key={row.key} className="flex items-center justify-between p-2.5 rounded-lg border border-border/30">
                <span className="text-sm">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-mono font-bold ${row.current === 0 ? "text-green-500" : "text-foreground"}`}>
                    {row.current}
                  </span>
                  {row.current === 0 ? (
                    <Badge variant="default" className="text-[10px] h-5">Clear</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px] h-5">Open</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
}
