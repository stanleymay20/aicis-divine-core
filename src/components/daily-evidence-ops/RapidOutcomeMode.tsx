import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, XCircle, SkipForward, Target } from "lucide-react";

interface CompletedItem {
  id: string;
  signal_title: string | null;
  domain: string | null;
  execution_owner: string | null;
}

export default function RapidOutcomeMode() {
  const queryClient = useQueryClient();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [impact, setImpact] = useState("3");
  const [cost, setCost] = useState("1000");
  const [source, setSource] = useState("internal_report");

  const { data: queue = [] } = useQuery({
    queryKey: ["rapid-outcome-queue"],
    queryFn: async () => {
      const { data } = await supabase.from("decision_outcome_log")
        .select("id, signal_title, domain, execution_owner")
        .eq("execution_status", "completed")
        .is("outcome_success", null)
        .order("created_at", { ascending: true })
        .limit(50);
      return (data ?? []) as CompletedItem[];
    },
    refetchInterval: 15000,
  });

  const record = useMutation({
    mutationFn: async ({ id, success }: { id: string; success: boolean }) => {
      const impactScore = parseInt(impact);
      const costVal = parseFloat(cost);
      const roiEst = costVal > 0 ? ((impactScore * 1000 - costVal) / costVal) * 100 : 0;
      const netVal = impactScore * 1000 - costVal;

      const { error } = await supabase.from("decision_outcome_log").update({
        outcome_success: success,
        outcome_timestamp: new Date().toISOString(),
        evidence_type: "measured",
        measured_impact_score: impactScore,
        impact_score: impactScore,
        cost_of_action: costVal,
        roi_estimate: Math.round(roiEst * 100) / 100,
        net_value: Math.round(netVal * 100) / 100,
        outcome_source: source,
        execution_status: "completed",
      }).eq("id", id);
      if (error) throw error;

      await supabase.from("audit_log").insert([
        { action: "outcome.recorded", resource_type: "decision_outcome_log", resource_id: id, severity: "info", metadata: { success, impact: impactScore, cost: costVal } },
        { action: "outcome.measured", resource_type: "decision_outcome_log", resource_id: id, severity: "info", metadata: { evidence_type: "measured", roi: roiEst } },
        { action: "roi.computed", resource_type: "decision_outcome_log", resource_id: id, severity: "info", metadata: { roi: roiEst, net_value: netVal } },
      ] as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rapid-outcome-queue"] });
      queryClient.invalidateQueries({ queryKey: ["daily-measured-queue"] });
      queryClient.invalidateQueries({ queryKey: ["daily-throughput"] });
      queryClient.invalidateQueries({ queryKey: ["measured-evidence-today"] });
      queryClient.invalidateQueries({ queryKey: ["evidence-momentum"] });
      queryClient.invalidateQueries({ queryKey: ["operator-closure-scoreboard"] });
      setCurrentIdx(i => i);
      setImpact("3");
      setCost("1000");
      toast.success("Measured outcome recorded — advancing");
    },
    onError: (e) => toast.error(String(e)),
  });

  const current = queue[currentIdx];

  if (queue.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center">
          <Target className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No decisions awaiting outcomes</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Complete executions first, then record outcomes here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader className="pb-2 sm:pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-1.5">
            <Target className="h-4 w-4 text-primary" /> Rapid Outcome Mode
          </CardTitle>
          <Badge className="text-xs font-mono">{currentIdx + 1} / {queue.length}</Badge>
        </div>
      </CardHeader>
      {current && (
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-sm font-medium leading-snug">{current.signal_title?.slice(0, 80) || "Decision"}</p>
            <p className="text-xs text-muted-foreground mt-1">{current.domain} · Owner: {current.execution_owner || "—"}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Impact (1–5)</label>
              <Select value={impact} onValueChange={setImpact}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5].map(v => <SelectItem key={v} value={String(v)}>{v} — {["Negligible","Low","Moderate","High","Transformative"][v-1]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cost ($)</label>
              <Input type="number" className="h-9 text-xs" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Evidence Source</label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal_report">Internal Report</SelectItem>
                <SelectItem value="partner_memo">Partner Memo</SelectItem>
                <SelectItem value="field_observation">Field Observation</SelectItem>
                <SelectItem value="statistical_analysis">Statistical Analysis</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-1">
            <Button className="flex-1 h-10 text-xs" disabled={record.isPending}
              onClick={() => record.mutate({ id: current.id, success: true })}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Success
            </Button>
            <Button variant="destructive" className="flex-1 h-10 text-xs" disabled={record.isPending}
              onClick={() => record.mutate({ id: current.id, success: false })}>
              <XCircle className="h-4 w-4 mr-1.5" /> Failed
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" disabled={currentIdx >= queue.length - 1}
              onClick={() => setCurrentIdx(i => Math.min(i + 1, queue.length - 1))}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
