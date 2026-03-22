import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface PendingOutcome {
  id: string;
  signal_title: string;
  domain: string | null;
  execution_status: string | null;
  outcome_success: boolean | null;
  action_type: string | null;
  created_at: string | null;
}

export default function OutcomeInputPanel() {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<Record<string, any>>({});

  const { data: pendingRecords = [] } = useQuery<PendingOutcome[]>({
    queryKey: ["pending-outcome-records"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("id, signal_title, domain, execution_status, outcome_success, action_type, created_at")
        .eq("execution_status", "completed")
        .is("outcome_success", null)
        .order("created_at", { ascending: true })
        .limit(50);
      return (data as any) || [];
    },
    staleTime: 30_000,
  });

  const submitOutcome = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { data, error } = await supabase.functions.invoke("record-decision-outcome", {
        body: { decision_id: id, ...payload },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pending-outcome-records"] });
      queryClient.invalidateQueries({ queryKey: ["daily-task-stats"] });
      queryClient.invalidateQueries({ queryKey: ["execution-command-records"] });
      toast.success(`Outcome recorded — evidence: ${data?.evidence_type || "recorded"}`);
    },
    onError: () => toast.error("Failed to record outcome"),
  });

  const handleSubmit = (id: string) => {
    const state = formState[id] || {};
    if (state.outcome_success === undefined) {
      toast.error("Select success or failure");
      return;
    }
    submitOutcome.mutate({
      id,
      payload: {
        outcome_success: state.outcome_success,
        impact_score: state.impact_score ?? 50,
        cost_of_action: state.cost_of_action ?? 0,
        outcome_description: state.description || null,
        outcome_source: state.source || "manual",
        evidence_note: state.evidence_note || null,
      },
    });
    setFormState(prev => { const next = { ...prev }; delete next[id]; return next; });
  };

  if (pendingRecords.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 text-center">
          <CheckCircle className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">All completed executions have recorded outcomes.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5 text-primary" /> Outcome Capture
          <Badge variant="destructive" className="text-[9px] ml-2">{pendingRecords.length} pending</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingRecords.map(rec => {
          const state = formState[rec.id] || {};
          return (
            <div key={rec.id} className="border border-destructive/20 rounded p-3 bg-destructive/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">{rec.signal_title || rec.action_type?.replace(/_/g, " ")}</p>
                  <div className="flex gap-1.5 mt-0.5">
                    {rec.domain && <Badge variant="outline" className="text-[9px] h-4">{rec.domain}</Badge>}
                    <Badge variant="destructive" className="text-[9px] h-4">
                      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Outcome Required
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Success / Failure */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Outcome *</label>
                <div className="flex gap-2">
                  <Button size="sm" variant={state.outcome_success === true ? "default" : "outline"} className="h-7 text-xs flex-1"
                    onClick={() => setFormState(p => ({ ...p, [rec.id]: { ...state, outcome_success: true } }))}>
                    <CheckCircle className="h-3 w-3 mr-1" /> Success
                  </Button>
                  <Button size="sm" variant={state.outcome_success === false ? "destructive" : "outline"} className="h-7 text-xs flex-1"
                    onClick={() => setFormState(p => ({ ...p, [rec.id]: { ...state, outcome_success: false } }))}>
                    <XCircle className="h-3 w-3 mr-1" /> Failed
                  </Button>
                </div>
              </div>

              {/* Impact Score */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Impact Score: {state.impact_score ?? 50}/100</label>
                <Slider min={0} max={100} step={1} value={[state.impact_score ?? 50]}
                  onValueChange={([v]) => setFormState(p => ({ ...p, [rec.id]: { ...state, impact_score: v } }))} />
              </div>

              {/* Cost */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Cost of Action</label>
                <Input className="h-7 text-xs" type="number" placeholder="0" value={state.cost_of_action ?? ""}
                  onChange={e => setFormState(p => ({ ...p, [rec.id]: { ...state, cost_of_action: Number(e.target.value) } }))} />
              </div>

              {/* Source */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Evidence Source</label>
                <Select value={state.source || "manual"} onValueChange={v => setFormState(p => ({ ...p, [rec.id]: { ...state, source: v } }))}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Entry</SelectItem>
                    <SelectItem value="internal_report">Internal Report</SelectItem>
                    <SelectItem value="partner_memo">Partner Memo</SelectItem>
                    <SelectItem value="external_data">External Data</SelectItem>
                    <SelectItem value="api">API / Automated</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Outcome Description</label>
                <Textarea className="text-xs min-h-[40px]" placeholder="What happened?"
                  value={state.description || ""}
                  onChange={e => setFormState(p => ({ ...p, [rec.id]: { ...state, description: e.target.value } }))} />
              </div>

              <Button size="sm" className="h-7 text-xs w-full" onClick={() => handleSubmit(rec.id)}
                disabled={submitOutcome.isPending}>
                Record Outcome & Compute ROI
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
