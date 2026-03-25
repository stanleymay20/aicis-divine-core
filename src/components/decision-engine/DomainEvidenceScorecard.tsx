import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3 } from "lucide-react";

const DOMAINS = ["economy", "health", "security", "energy", "food", "governance", "education"];

interface DomainRow {
  domain: string;
  total: number;
  accepted: number;
  executed: number;
  completed: number;
  measured: number;
  measured7d: number;
  avgRoi: number;
  postmortemRate: number;
  score: number;
}

export default function DomainEvidenceScorecard() {
  const { data: domains = [] } = useQuery({
    queryKey: ["domain-evidence-scorecard"],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

      const { data: all } = await supabase
        .from("decision_outcome_log")
        .select("domain, recommendation_accepted, action_taken, execution_status, evidence_type, outcome_success, outcome_timestamp, roi_estimate, postmortem_note");

      if (!all?.length) return [];

      const map = new Map<string, DomainRow>();
      DOMAINS.forEach(d => map.set(d, { domain: d, total: 0, accepted: 0, executed: 0, completed: 0, measured: 0, measured7d: 0, avgRoi: 0, postmortemRate: 0, score: 0 }));

      const roiSums = new Map<string, { sum: number; count: number }>();
      const pmData = new Map<string, { failed: number; withPm: number }>();

      all.forEach((r: any) => {
        const d = r.domain;
        if (!map.has(d)) map.set(d, { domain: d, total: 0, accepted: 0, executed: 0, completed: 0, measured: 0, measured7d: 0, avgRoi: 0, postmortemRate: 0, score: 0 });
        const s = map.get(d)!;
        s.total++;
        if (r.recommendation_accepted) s.accepted++;
        if (r.action_taken) s.executed++;
        if (r.execution_status === "completed") s.completed++;
        if (r.evidence_type === "measured") {
          s.measured++;
          if (r.outcome_timestamp && r.outcome_timestamp >= weekAgo) s.measured7d++;
        }
        if (r.roi_estimate != null) {
          if (!roiSums.has(d)) roiSums.set(d, { sum: 0, count: 0 });
          roiSums.get(d)!.sum += r.roi_estimate;
          roiSums.get(d)!.count++;
        }
        if (r.outcome_success === false) {
          if (!pmData.has(d)) pmData.set(d, { failed: 0, withPm: 0 });
          pmData.get(d)!.failed++;
          if (r.postmortem_note) pmData.get(d)!.withPm++;
        }
      });

      return Array.from(map.values()).map(s => {
        const roi = roiSums.get(s.domain);
        s.avgRoi = roi && roi.count > 0 ? Math.round((roi.sum / roi.count) * 100) / 100 : 0;
        const pm = pmData.get(s.domain);
        s.postmortemRate = pm && pm.failed > 0 ? Math.round((pm.withPm / pm.failed) * 100) : 100;
        // Evidence score: weighted composite
        s.score = Math.min(100, Math.round(
          (s.measured * 10) + (s.completed * 3) + (s.postmortemRate * 0.2) + (s.measured7d * 15)
        ));
        return s;
      }).filter(s => s.total > 0).sort((a, b) => b.score - a.score);
    },
    refetchInterval: 30000,
  });

  const scoreColor = (s: number) => s >= 60 ? "text-green-500" : s >= 30 ? "text-yellow-500" : "text-red-500";

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Domain Evidence Scorecard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[340px]">
          <div className="space-y-1.5">
            <div className="grid grid-cols-9 text-[10px] text-muted-foreground font-medium px-2 pb-1 border-b border-border/30">
              <span className="col-span-2">Domain</span>
              <span className="text-center">Total</span>
              <span className="text-center">Accepted</span>
              <span className="text-center">Done</span>
              <span className="text-center">Measured</span>
              <span className="text-center">7d</span>
              <span className="text-center">PM%</span>
              <span className="text-center">Score</span>
            </div>
            {domains.map((d) => (
              <div key={d.domain} className="grid grid-cols-9 items-center px-2 py-1.5 text-xs border-b border-border/10 last:border-0">
                <span className="col-span-2 font-medium capitalize">{d.domain}</span>
                <span className="text-center font-mono">{d.total}</span>
                <span className="text-center font-mono">{d.accepted}</span>
                <span className="text-center font-mono">{d.completed}</span>
                <span className="text-center font-mono">{d.measured}</span>
                <span className="text-center font-mono">{d.measured7d}</span>
                <span className="text-center font-mono">{d.postmortemRate}%</span>
                <span className={`text-center font-mono font-semibold ${scoreColor(d.score)}`}>{d.score}</span>
              </div>
            ))}
            {domains.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No domain data</p>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
