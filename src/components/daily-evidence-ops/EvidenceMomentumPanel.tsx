import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function EvidenceMomentumPanel() {
  const { data } = useQuery({
    queryKey: ["evidence-momentum"],
    queryFn: async () => {
      const now = new Date();
      const days: { date: string; measured: number; audits: number; postmortems: number }[] = [];

      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayEnd = new Date(dayStart.getTime() + 86400000);
        const ds = dayStart.toISOString();
        const de = dayEnd.toISOString();

        const [measured, audits, postmortems] = await Promise.all([
          supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
            .eq("evidence_type", "measured").gte("outcome_timestamp", ds).lt("outcome_timestamp", de),
          supabase.from("audit_log").select("id", { count: "exact", head: true })
            .gte("created_at", ds).lt("created_at", de),
          supabase.from("decision_outcome_log").select("id", { count: "exact", head: true })
            .not("postmortem_note", "is", null).gte("outcome_timestamp", ds).lt("outcome_timestamp", de),
        ]);

        days.push({
          date: dayStart.toLocaleDateString("en", { weekday: "short" }),
          measured: measured.count ?? 0,
          audits: audits.count ?? 0,
          postmortems: postmortems.count ?? 0,
        });
      }

      const recentMeasured = days.slice(-3).reduce((s, d) => s + d.measured, 0);
      const olderMeasured = days.slice(0, 3).reduce((s, d) => s + d.measured, 0);
      const trend = recentMeasured > olderMeasured ? "improving" : recentMeasured < olderMeasured ? "declining" : "flat";

      return { days, trend };
    },
    refetchInterval: 60000,
  });

  const trend = data?.trend ?? "flat";
  const TrendIcon = trend === "improving" ? TrendingUp : trend === "declining" ? TrendingDown : Minus;
  const trendColor = trend === "improving" ? "text-[hsl(var(--success))]" : trend === "declining" ? "text-destructive" : "text-muted-foreground";

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base font-semibold">Evidence Momentum</CardTitle>
          <Badge variant="outline" className={`text-xs ${trendColor}`}>
            <TrendIcon className="h-3 w-3 mr-1" />{trend}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-1 text-center">
            {data?.days.map(d => (
              <div key={d.date} className="text-[10px] sm:text-xs text-muted-foreground">{d.date}</div>
            ))}
          </div>
          {/* Measured row */}
          <div className="grid grid-cols-7 gap-1">
            {data?.days.map(d => (
              <div key={`m-${d.date}`} className={`h-9 sm:h-10 rounded-md flex items-center justify-center text-xs font-mono font-semibold ${
                d.measured > 0 ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground"
              }`}>{d.measured}</div>
            ))}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Measured outcomes per day</p>
          {/* Audits row */}
          <div className="grid grid-cols-7 gap-1">
            {data?.days.map(d => (
              <div key={`a-${d.date}`} className={`h-7 sm:h-8 rounded-md flex items-center justify-center text-[10px] sm:text-xs font-mono ${
                d.audits > 0 ? "bg-accent text-accent-foreground" : "bg-muted/20 text-muted-foreground"
              }`}>{d.audits}</div>
            ))}
          </div>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Audit events per day</p>
        </div>
      </CardContent>
    </Card>
  );
}
