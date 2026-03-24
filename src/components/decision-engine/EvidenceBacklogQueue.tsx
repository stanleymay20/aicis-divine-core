import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, AlertTriangle, Clock } from "lucide-react";
import { useState } from "react";

interface BacklogItem {
  id: string;
  signal_title: string;
  domain: string | null;
  gap_type: string;
  created_at: string;
  age_hours: number;
  age_bucket: string;
}

type GapFilter = "all" | "not_executed" | "no_outcome" | "no_postmortem" | "no_roi";
type SortMode = "oldest" | "severity";

const gapSeverity: Record<string, number> = {
  no_postmortem: 3,
  no_outcome: 2,
  not_executed: 1,
  no_roi: 0,
};

export default function EvidenceBacklogQueue() {
  const [filter, setFilter] = useState<GapFilter>("all");
  const [sort, setSort] = useState<SortMode>("oldest");

  const { data } = useQuery({
    queryKey: ["evidence-backlog"],
    queryFn: async () => {
      const { data: records } = await supabase
        .from("decision_outcome_log")
        .select("id, signal_title, domain, recommendation_accepted, action_taken, outcome_success, evidence_type, postmortem_note, roi_estimate, impact_score, cost_of_action, created_at, execution_status")
        .order("created_at", { ascending: true });

      const all = (records as any[]) || [];
      const now = Date.now();
      const items: BacklogItem[] = [];

      const ageBucket = (hours: number): string => {
        if (hours <= 24) return "24h";
        if (hours <= 72) return "72h";
        if (hours <= 168) return "7d";
        return "14d+";
      };

      for (const r of all) {
        const ageH = Math.round((now - new Date(r.created_at).getTime()) / 3600000);
        const bucket = ageBucket(ageH);
        const base = { id: r.id, signal_title: r.signal_title || "Untitled", domain: r.domain, created_at: r.created_at, age_hours: ageH, age_bucket: bucket };

        if (r.recommendation_accepted === true && (!r.execution_status || r.execution_status === "not_started") && !r.action_taken) {
          items.push({ ...base, gap_type: "not_executed" });
        }
        if (r.action_taken === true && r.outcome_success === null) {
          items.push({ ...base, gap_type: "no_outcome" });
        }
        if (r.recommendation_accepted === true && r.outcome_success === false && !r.postmortem_note) {
          items.push({ ...base, gap_type: "no_postmortem" });
        }
        if (r.evidence_type === "measured" && (r.roi_estimate === null || r.cost_of_action === null)) {
          items.push({ ...base, gap_type: "no_roi" });
        }
      }

      const counts = {
        all: items.length,
        not_executed: items.filter(i => i.gap_type === "not_executed").length,
        no_outcome: items.filter(i => i.gap_type === "no_outcome").length,
        no_postmortem: items.filter(i => i.gap_type === "no_postmortem").length,
        no_roi: items.filter(i => i.gap_type === "no_roi").length,
      };

      const buckets = {
        "24h": items.filter(i => i.age_bucket === "24h").length,
        "72h": items.filter(i => i.age_bucket === "72h").length,
        "7d": items.filter(i => i.age_bucket === "7d").length,
        "14d+": items.filter(i => i.age_bucket === "14d+").length,
      };

      return { items, counts, buckets };
    },
    staleTime: 30_000,
  });

  if (!data || data.items.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 text-center">
          <ClipboardList className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No evidence gaps detected. All decisions are properly tracked.</p>
        </CardContent>
      </Card>
    );
  }

  const filtered = (filter === "all" ? data.items : data.items.filter(i => i.gap_type === filter))
    .sort((a, b) => sort === "severity" 
      ? (gapSeverity[b.gap_type] ?? 0) - (gapSeverity[a.gap_type] ?? 0) || b.age_hours - a.age_hours
      : b.age_hours - a.age_hours);

  const gapLabels: Record<string, string> = {
    not_executed: "Accepted, not executed",
    no_outcome: "Executed, no outcome",
    no_postmortem: "Failed, no postmortem",
    no_roi: "Measured, missing ROI",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5 text-destructive" /> Evidence Backlog Queue
          <Badge variant="destructive" className="text-[9px] h-4">{data.items.length} gaps</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Aging buckets */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {(["24h", "72h", "7d", "14d+"] as const).map(b => (
            <div key={b} className={`p-1.5 rounded ${b === "14d+" && data.buckets[b] > 0 ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
              <p className={`text-xs font-bold ${b === "14d+" && data.buckets[b] > 0 ? "text-destructive" : ""}`}>{data.buckets[b]}</p>
              <p className="text-[9px] text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>

        {/* Sort toggle */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-muted-foreground">Sort:</span>
          <button onClick={() => setSort("oldest")} className={`px-2 py-0.5 rounded ${sort === "oldest" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>Oldest first</button>
          <button onClick={() => setSort("severity")} className={`px-2 py-0.5 rounded ${sort === "severity" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>Severity first</button>
        </div>

        {/* Filter tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as GapFilter)}>
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="all" className="text-xs">All ({data.counts.all})</TabsTrigger>
            <TabsTrigger value="not_executed" className="text-xs">Not Executed ({data.counts.not_executed})</TabsTrigger>
            <TabsTrigger value="no_outcome" className="text-xs">No Outcome ({data.counts.no_outcome})</TabsTrigger>
            <TabsTrigger value="no_postmortem" className="text-xs">No PM ({data.counts.no_postmortem})</TabsTrigger>
            <TabsTrigger value="no_roi" className="text-xs">No ROI ({data.counts.no_roi})</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-2 space-y-1.5">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No gaps in this category.</p>
            ) : (
              filtered.slice(0, 20).map(item => (
                <div key={`${item.id}-${item.gap_type}`} className={`flex items-center gap-2 p-2 rounded border ${item.age_bucket === "14d+" ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/10"}`}>
                  {item.age_bucket === "14d+" ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.signal_title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.domain && <Badge variant="outline" className="text-[9px] h-3.5">{item.domain}</Badge>}
                      <Badge variant="destructive" className="text-[9px] h-3.5">{gapLabels[item.gap_type]}</Badge>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{item.age_bucket}</span>
                </div>
              ))
            )}
            {filtered.length > 20 && (
              <p className="text-[10px] text-muted-foreground text-center">+ {filtered.length - 20} more</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
