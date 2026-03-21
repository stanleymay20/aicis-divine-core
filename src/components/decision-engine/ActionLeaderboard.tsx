import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, CheckCircle, XCircle } from "lucide-react";

interface ActionRow {
  action_type: string;
  times_recommended: number;
  times_accepted: number;
  times_successful: number;
  avg_impact: number | null;
  avg_roi: number | null;
  success_rate_pct: number | null;
  domain_count: number;
}

export default function ActionLeaderboard() {
  const { data: rows } = useQuery<ActionRow[]>({
    queryKey: ["action-effectiveness-leaderboard"],
    queryFn: async () => {
      const { data } = await supabase
        .from("action_effectiveness_leaderboard" as any)
        .select("*")
        .limit(10);
      return (data as any) || [];
    },
    staleTime: 120_000,
  });

  if (!rows || rows.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 text-center">
          <Trophy className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No action effectiveness data yet. Capture recommendations to begin tracking.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-primary" /> Action Effectiveness
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.action_type} className="flex items-center gap-2 p-2 rounded bg-muted/30">
              <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{r.action_type.replace(/_/g, " ")}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{r.times_recommended} rec</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <CheckCircle className="h-2.5 w-2.5 text-primary" />{r.times_accepted} accepted
                  </span>
                  <span className="text-[10px] text-muted-foreground">{r.times_successful} success</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                {r.success_rate_pct != null ? (
                  <Badge variant={r.success_rate_pct >= 60 ? "default" : "outline"} className="text-[10px]">
                    {r.success_rate_pct}%
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">—</Badge>
                )}
                {r.avg_impact != null && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    <TrendingUp className="h-2.5 w-2.5 inline mr-0.5" />imp: {r.avg_impact}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
