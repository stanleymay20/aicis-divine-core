import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, CheckCircle2, XCircle } from "lucide-react";

type TimeFilter = "24h" | "7d" | "30d";

export default function MeasuredEvidenceJournal() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("7d");

  const { data: entries = [] } = useQuery({
    queryKey: ["evidence-journal", timeFilter],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - (timeFilter === "24h" ? 86400000 : timeFilter === "7d" ? 7 * 86400000 : 30 * 86400000)).toISOString();

      const { data } = await supabase.from("decision_outcome_log")
        .select("id, signal_title, domain, impact_score, cost_of_action, roi_estimate, net_value, outcome_source, outcome_success, outcome_timestamp, evidence_type")
        .eq("evidence_type", "measured")
        .gte("outcome_timestamp", cutoff)
        .order("outcome_timestamp", { ascending: false })
        .limit(100);

      return data ?? [];
    },
  });

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> Measured Evidence Journal
          </CardTitle>
          <div className="flex gap-1">
            {(["24h", "7d", "30d"] as TimeFilter[]).map(f => (
              <Button key={f} variant={timeFilter === f ? "default" : "ghost"} size="sm" className="text-xs h-7 px-2.5"
                onClick={() => setTimeFilter(f)}>{f}</Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No measured outcomes in this period</p>
        ) : (
          <ScrollArea className="h-[360px]">
            <div className="space-y-2">
              {entries.map(e => (
                <div key={e.id} className="p-3 rounded-lg border border-border/30 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{e.signal_title}</p>
                    {e.outcome_success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{e.domain}</Badge>
                    {e.impact_score != null && <Badge variant="secondary" className="text-[10px]">Impact: {e.impact_score}</Badge>}
                    {e.cost_of_action != null && <Badge variant="secondary" className="text-[10px]">Cost: {e.cost_of_action}</Badge>}
                    {e.roi_estimate != null && <Badge variant="secondary" className="text-[10px]">ROI: {e.roi_estimate.toFixed(1)}</Badge>}
                    {e.net_value != null && (
                      <Badge variant={e.net_value >= 0 ? "default" : "destructive"} className="text-[10px]">
                        Net: {e.net_value >= 0 ? "+" : ""}{e.net_value.toFixed(1)}
                      </Badge>
                    )}
                    {e.outcome_source && <Badge variant="outline" className="text-[10px]">{e.outcome_source}</Badge>}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {e.outcome_timestamp ? new Date(e.outcome_timestamp).toLocaleString() : "—"}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
