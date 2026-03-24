import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Zap, CheckCircle2, XCircle, SkipForward } from "lucide-react";

interface PendingDecision {
  id: string;
  signal_title: string;
  domain: string;
  signal_confidence: number | null;
  execution_completed_at: string | null;
}

export default function MeasuredOutcomeFastPath() {
  const queryClient = useQueryClient();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [impact, setImpact] = useState("50");
  const [cost, setCost] = useState("0");
  const [source, setSource] = useState("internal_review");

  const { data: pending = [] } = useQuery({
    queryKey: ["fast-path-pending"],
    queryFn: async () => {
      const { data } = await supabase.from("decision_outcome_log")
        .select("id, signal_title, domain, signal_confidence, execution_completed_at")
        .eq("execution_status", "completed")
        .is("outcome_success", null)
        .order("signal_confidence", { ascending: false })
        .limit(50);
      return (data ?? []) as PendingDecision[];
    },
  });

  const record = useMutation({
    mutationFn: async ({ id, success }: { id: string; success: boolean }) => {
      const impactNum = parseInt(impact) || 50;
      const costNum = parseFloat(cost) || 0;
      const confidence = pending[currentIdx]?.signal_confidence ?? 50;
      const roi = (impactNum * confidence) / 100;
      const net = roi - costNum;

      const { error } = await supabase.from("decision_outcome_log").update({
        outcome_success: success,
        impact_score: impactNum,
        cost_of_action: costNum,
        roi_estimate: Math.round(roi * 100) / 100,
        net_value: Math.round(net * 100) / 100,
        outcome_source: source,
        evidence_type: "measured",
        outcome_timestamp: new Date().toISOString(),
        measured_outcome: success ? "Positive outcome confirmed" : "Negative outcome recorded",
      }).eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["fast-path-pending"] });
      queryClient.invalidateQueries({ queryKey: ["daily-closure-gaps"] });
      queryClient.invalidateQueries({ queryKey: ["closure-workflow-counts"] });
      queryClient.invalidateQueries({ queryKey: ["measured-outcome-kpi"] });
      toast.success("Outcome recorded");
      setImpact("50");
      setCost("0");
      setCurrentIdx(i => Math.min(i + 1, pending.length - 1));
    },
    onError: () => toast.error("Failed to record outcome"),
  });

  const current = pending[currentIdx];

  if (pending.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
          No pending outcomes — all caught up
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Fast Path
          </CardTitle>
          <Badge variant="outline" className="text-xs font-mono">{currentIdx + 1}/{pending.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {current && (
          <>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <p className="text-sm font-medium">{current.signal_title}</p>
              <div className="flex gap-2 mt-1.5">
                <Badge variant="outline" className="text-xs">{current.domain}</Badge>
                {current.signal_confidence && (
                  <Badge variant="secondary" className="text-xs">{current.signal_confidence}% conf</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Impact (0-100)</label>
                <Input value={impact} onChange={e => setImpact(e.target.value)} type="number" min={0} max={100}
                  className="h-9 text-sm" onKeyDown={e => {
                    if (e.key === "Enter") record.mutate({ id: current.id, success: true });
                  }} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cost</label>
                <Input value={cost} onChange={e => setCost(e.target.value)} type="number" min={0}
                  className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Source</label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal_review">Internal Review</SelectItem>
                    <SelectItem value="partner_report">Partner Report</SelectItem>
                    <SelectItem value="field_data">Field Data</SelectItem>
                    <SelectItem value="external_api">External API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="flex-1 h-10" onClick={() => record.mutate({ id: current.id, success: true })}
                disabled={record.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" /> Success
              </Button>
              <Button variant="destructive" className="flex-1 h-10" onClick={() => record.mutate({ id: current.id, success: false })}
                disabled={record.isPending}>
                <XCircle className="h-4 w-4 mr-1.5" /> Failure
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setCurrentIdx(i => Math.min(i + 1, pending.length - 1))}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
