import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Play, User, FileText, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface QueueItem {
  id: string;
  signal_title: string | null;
  domain: string | null;
  gap_type: string;
  execution_status: string | null;
  execution_owner: string | null;
  outcome_success: boolean | null;
  postmortem_note: string | null;
  roi_estimate: number | null;
  created_at: string | null;
}

const GAP_CONFIG = {
  completed_no_outcome: { label: "Completed / No Outcome", icon: AlertTriangle, severity: "destructive" as const },
  no_owner: { label: "No Execution Owner", icon: User, severity: "destructive" as const },
  not_started_sla: { label: "Not Started Past SLA", icon: Clock, severity: "destructive" as const },
  failed_no_postmortem: { label: "Failed / No Postmortem", icon: FileText, severity: "secondary" as const },
  measured_no_roi: { label: "Measured / Missing ROI", icon: Calculator, severity: "secondary" as const },
};

export default function DailyMeasuredQueue() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const { data: queueItems = [], isLoading } = useQuery({
    queryKey: ["daily-measured-queue"],
    queryFn: async () => {
      const items: (QueueItem & { gap_type: string })[] = [];
      const now = new Date();
      const h24 = new Date(now.getTime() - 24 * 3600000).toISOString();
      const fields = "id, signal_summary, domain, execution_status, execution_owner, outcome_success, postmortem_note, roi_estimate, created_at";

      const [completedNoOutcome, noOwner, notStarted, failedNoPost, measuredNoRoi] = await Promise.all([
        supabase.from("decision_outcome_log").select(fields)
          .eq("execution_status", "completed").is("outcome_success", null).limit(20),
        supabase.from("decision_outcome_log").select(fields)
          .eq("recommendation_accepted", true).is("execution_owner", null).limit(20),
        supabase.from("decision_outcome_log").select(fields)
          .eq("recommendation_accepted", true).or("execution_status.is.null,execution_status.eq.not_started").lt("created_at", h24).limit(20),
        supabase.from("decision_outcome_log").select(fields)
          .eq("outcome_success", false).is("postmortem_note", null).limit(20),
        supabase.from("decision_outcome_log").select(fields)
          .eq("evidence_type", "measured").is("roi_estimate", null).limit(20),
      ]);

      const addItems = (data: typeof completedNoOutcome.data, gapType: string) => {
        data?.forEach(r => items.push({
          id: r.id, signal_summary: r.signal_summary, domain: r.domain,
          execution_status: r.execution_status, execution_owner: r.execution_owner,
          outcome_success: r.outcome_success, postmortem_note: r.postmortem_note,
          roi_estimate: r.roi_estimate, created_at: r.created_at, gap_type: gapType,
        }));
      };
      addItems(completedNoOutcome.data, "completed_no_outcome");
      addItems(noOwner.data, "no_owner");
      addItems(notStarted.data, "not_started_sla");
      addItems(failedNoPost.data, "failed_no_postmortem");
      addItems(measuredNoRoi.data, "measured_no_roi");

      const seen = new Set<string>();
      return items.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
    },
    refetchInterval: 15000,
  });

  const fix = useMutation({
    mutationFn: async ({ id, action, value }: { id: string; action: string; value?: string }) => {
      const owners = ["Dr. Amara Osei", "Prof. Kwame Adjei", "Col. James Mensah"];
      let updateData: Record<string, unknown> = {};

      if (action === "assign_owner") {
        updateData = { execution_owner: value || owners[Math.floor(Math.random() * owners.length)] };
      } else if (action === "start_execution") {
        updateData = { execution_status: "in_progress", action_taken: true };
      } else if (action === "complete_execution") {
        updateData = { execution_status: "completed", execution_completed_at: new Date().toISOString() };
      } else if (action === "record_outcome") {
        const success = value === "true";
        updateData = { outcome_success: success, outcome_timestamp: new Date().toISOString(), evidence_type: "measured" };
      } else if (action === "add_postmortem") {
        updateData = { postmortem_note: value || "Postmortem recorded via daily ops." };
      } else if (action === "set_roi") {
        updateData = { roi_estimate: parseFloat(value || "0") };
      }

      const { error } = await supabase.from("decision_outcome_log").update(updateData).eq("id", id);
      if (error) throw error;

      await supabase.from("audit_log").insert([{
        action: `enforcement.${action}` as string,
        resource_type: "decision_outcome_log",
        resource_id: id,
        metadata: updateData as Record<string, unknown>,
        severity: "info",
      }] as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-measured-queue"] });
      queryClient.invalidateQueries({ queryKey: ["measured-evidence-today"] });
      queryClient.invalidateQueries({ queryKey: ["evidence-momentum"] });
      toast.success("Queue item updated");
    },
    onError: (e) => toast.error(String(e)),
  });

  if (isLoading) return <Card className="border-border/50 animate-pulse h-48" />;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Daily Measured Queue</CardTitle>
          <Badge variant={queueItems.length === 0 ? "default" : "destructive"} className="text-xs font-mono">
            {queueItems.length === 0 ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Clear</> : `${queueItems.length} items`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
        {queueItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">All evidence gaps resolved for now.</p>
        )}
        {queueItems.map((item) => {
          const config = GAP_CONFIG[item.gap_type as keyof typeof GAP_CONFIG];
          const Icon = config?.icon || AlertTriangle;
          const isExpanded = expandedId === item.id;

          return (
            <div key={`${item.id}-${item.gap_type}`} className="border border-border/40 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                <div className="flex items-start gap-2 min-w-0">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.signal_summary?.slice(0, 60) || "Decision"}</p>
                    <p className="text-xs text-muted-foreground">{item.domain} · {config?.label}</p>
                  </div>
                </div>
                <Badge variant={config?.severity || "secondary"} className="text-xs shrink-0">{item.gap_type.replace(/_/g, " ")}</Badge>
              </div>

              {isExpanded && (
                <div className="space-y-2 pt-2 border-t border-border/30">
                  {item.gap_type === "no_owner" && (
                    <div className="flex gap-2">
                      <Input placeholder="Owner name" className="h-8 text-xs" value={inputValues[item.id] || ""}
                        onChange={e => setInputValues(p => ({ ...p, [item.id]: e.target.value }))} />
                      <Button size="sm" className="h-8 text-xs" onClick={() => fix.mutate({ id: item.id, action: "assign_owner", value: inputValues[item.id] })}
                        disabled={fix.isPending}><User className="h-3 w-3 mr-1" />Assign</Button>
                    </div>
                  )}
                  {item.gap_type === "not_started_sla" && (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => fix.mutate({ id: item.id, action: "start_execution" })}
                      disabled={fix.isPending}><Play className="h-3 w-3 mr-1" />Start Execution</Button>
                  )}
                  {item.gap_type === "completed_no_outcome" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => fix.mutate({ id: item.id, action: "record_outcome", value: "true" })}
                        disabled={fix.isPending}><CheckCircle2 className="h-3 w-3 mr-1" />Success</Button>
                      <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={() => fix.mutate({ id: item.id, action: "record_outcome", value: "false" })}
                        disabled={fix.isPending}>Failed</Button>
                    </div>
                  )}
                  {item.gap_type === "failed_no_postmortem" && (
                    <div className="space-y-2">
                      <Textarea placeholder="Postmortem notes…" className="text-xs min-h-[60px]" value={inputValues[item.id] || ""}
                        onChange={e => setInputValues(p => ({ ...p, [item.id]: e.target.value }))} />
                      <Button size="sm" className="h-8 text-xs" onClick={() => fix.mutate({ id: item.id, action: "add_postmortem", value: inputValues[item.id] })}
                        disabled={fix.isPending || !inputValues[item.id]}><FileText className="h-3 w-3 mr-1" />Save Postmortem</Button>
                    </div>
                  )}
                  {item.gap_type === "measured_no_roi" && (
                    <div className="flex gap-2">
                      <Input type="number" placeholder="ROI estimate" className="h-8 text-xs" value={inputValues[item.id] || ""}
                        onChange={e => setInputValues(p => ({ ...p, [item.id]: e.target.value }))} />
                      <Button size="sm" className="h-8 text-xs" onClick={() => fix.mutate({ id: item.id, action: "set_roi", value: inputValues[item.id] })}
                        disabled={fix.isPending || !inputValues[item.id]}><Calculator className="h-3 w-3 mr-1" />Set ROI</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
