import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ListChecks, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

type SortMode = "oldest" | "confidence" | "stage";

interface BacklogRecord {
  id: string;
  signal_title: string;
  domain: string | null;
  signal_confidence: number | null;
  recommendation_accepted: boolean | null;
  action_taken: boolean | null;
  execution_status: string | null;
  outcome_success: boolean | null;
  impact_score: number | null;
  roi_estimate: number | null;
  evidence_type: string | null;
  postmortem_note: string | null;
  created_at: string | null;
  action_type: string | null;
}

type Stage = "accepted_not_started" | "started_no_completion" | "completed_no_outcome" | "outcome_not_measured";

function getStage(r: BacklogRecord): Stage | null {
  if (r.recommendation_accepted && (!r.execution_status || r.execution_status === "not_started")) return "accepted_not_started";
  if (r.execution_status === "in_progress") return "started_no_completion";
  if (r.execution_status === "completed" && r.outcome_success === null) return "completed_no_outcome";
  if (r.outcome_success !== null && r.evidence_type !== "measured") return "outcome_not_measured";
  return null;
}

function ageHours(created_at: string | null): number {
  if (!created_at) return 0;
  return Math.round((Date.now() - new Date(created_at).getTime()) / 3600000);
}

const stageLabel: Record<Stage, string> = {
  accepted_not_started: "Accepted — Not Started",
  started_no_completion: "Started — Not Completed",
  completed_no_outcome: "Completed — No Outcome",
  outcome_not_measured: "Outcome — Not Measured",
};

const stageSeverity: Record<Stage, number> = {
  completed_no_outcome: 3,
  started_no_completion: 2,
  accepted_not_started: 1,
  outcome_not_measured: 0,
};

export default function OutcomeBacklogPanel() {
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<SortMode>("oldest");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const { data: records = [] } = useQuery<BacklogRecord[]>({
    queryKey: ["outcome-backlog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("id, signal_title, domain, signal_confidence, recommendation_accepted, action_taken, execution_status, outcome_success, impact_score, roi_estimate, evidence_type, postmortem_note, created_at, action_type")
        .eq("recommendation_accepted", true)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data as any) || [];
    },
    staleTime: 30_000,
  });

  const submitQuickOutcome = useMutation({
    mutationFn: async ({ id, success, impact }: { id: string; success: boolean; impact: number }) => {
      const { error } = await supabase.functions.invoke("record-decision-outcome", {
        body: {
          decision_id: id,
          outcome_success: success,
          impact_score: impact,
          cost_of_action: 0,
          outcome_source: "manual",
          outcome_description: success ? "Quick success record" : "Quick failure record",
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outcome-backlog"] });
      toast.success("Outcome recorded");
    },
    onError: () => toast.error("Failed to record outcome"),
  });

  const backlog = records
    .map(r => ({ ...r, stage: getStage(r) }))
    .filter(r => r.stage !== null)
    .filter(r => stageFilter === "all" || r.stage === stageFilter);

  const sorted = [...backlog].sort((a, b) => {
    if (sort === "oldest") return ageHours(b.created_at) - ageHours(a.created_at);
    if (sort === "confidence") return (b.signal_confidence ?? 0) - (a.signal_confidence ?? 0);
    return stageSeverity[b.stage!] - stageSeverity[a.stage!];
  });

  const stageCounts = {
    accepted_not_started: backlog.filter(r => r.stage === "accepted_not_started").length,
    started_no_completion: backlog.filter(r => r.stage === "started_no_completion").length,
    completed_no_outcome: backlog.filter(r => r.stage === "completed_no_outcome").length,
    outcome_not_measured: backlog.filter(r => r.stage === "outcome_not_measured").length,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <ListChecks className="h-3.5 w-3.5 text-primary" /> Outcome Backlog
            <Badge variant="outline" className="text-[9px] ml-1">{sorted.length} items</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="completed_no_outcome">No Outcome ({stageCounts.completed_no_outcome})</SelectItem>
                <SelectItem value="accepted_not_started">Not Started ({stageCounts.accepted_not_started})</SelectItem>
                <SelectItem value="started_no_completion">In Progress ({stageCounts.started_no_completion})</SelectItem>
                <SelectItem value="outcome_not_measured">Not Measured ({stageCounts.outcome_not_measured})</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={v => setSort(v as SortMode)}>
              <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="confidence">High Confidence</SelectItem>
                <SelectItem value="stage">By Severity</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stage summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <StageStat label="No Outcome" value={stageCounts.completed_no_outcome} destructive={stageCounts.completed_no_outcome > 0} />
          <StageStat label="Not Started" value={stageCounts.accepted_not_started} warn={stageCounts.accepted_not_started > 3} />
          <StageStat label="In Progress" value={stageCounts.started_no_completion} />
          <StageStat label="Not Measured" value={stageCounts.outcome_not_measured} />
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">No outstanding backlog items.</p>
            </div>
          ) : sorted.map(rec => {
            const age = ageHours(rec.created_at);
            const isOld = age > 72;
            const isUrgent = age > 24 && rec.stage === "completed_no_outcome";

            return (
              <div key={rec.id} className={`p-3 rounded border ${isUrgent ? "border-destructive/50 bg-destructive/5" : isOld ? "border-warning/30 bg-warning/5" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{rec.signal_title || rec.action_type?.replace(/_/g, " ")}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {rec.domain && <Badge variant="outline" className="text-[9px] h-4">{rec.domain}</Badge>}
                      <Badge variant={rec.stage === "completed_no_outcome" ? "destructive" : "secondary"} className="text-[9px] h-4">
                        {stageLabel[rec.stage!]}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />{age}h
                      </span>
                      {isUrgent && <Badge variant="destructive" className="text-[9px] h-4"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Urgent</Badge>}
                    </div>
                  </div>

                  {rec.stage === "completed_no_outcome" && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="default" className="h-6 text-[10px] px-2"
                        onClick={() => submitQuickOutcome.mutate({ id: rec.id, success: true, impact: 60 })}
                        disabled={submitQuickOutcome.isPending}>
                        <CheckCircle className="h-2.5 w-2.5 mr-0.5" />Success
                      </Button>
                      <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2"
                        onClick={() => submitQuickOutcome.mutate({ id: rec.id, success: false, impact: 20 })}
                        disabled={submitQuickOutcome.isPending}>
                        <XCircle className="h-2.5 w-2.5 mr-0.5" />Fail
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StageStat({ label, value, warn, destructive }: { label: string; value: number; warn?: boolean; destructive?: boolean }) {
  return (
    <div className={`p-2 rounded text-center ${destructive ? "bg-destructive/10 border border-destructive/20" : warn ? "bg-warning/5 border border-warning/20" : "bg-muted/30"}`}>
      <p className={`text-sm font-bold ${destructive ? "text-destructive" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
