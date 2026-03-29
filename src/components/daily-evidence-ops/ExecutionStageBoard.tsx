import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Play, CheckCircle2, User, RotateCcw, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StageItem {
  id: string;
  signal_title: string | null;
  domain: string | null;
  execution_owner: string | null;
  assigned_reviewer: string | null;
  execution_status: string | null;
  outcome_success: boolean | null;
  evidence_type: string | null;
  recommendation_accepted: boolean | null;
  created_at: string | null;
  execution_started_at: string | null;
  action_taken_at: string | null;
}

type Stage = "not_started" | "in_progress" | "completed_no_outcome" | "measured";

const OWNERS = ["Col. James Mensah", "Dr. Amara Osei", "Prof. Kwame Adjei"];
const REVIEWERS = ["Dr. Amara Osei", "Prof. Kwame Adjei", "Dr. Sarah Chen"];

function ageLabel(dateStr: string | null): string {
  if (!dateStr) return "—";
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / 3600000);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

function slaState(dateStr: string | null, thresholdH: number): "ok" | "warn" | "breach" {
  if (!dateStr) return "ok";
  const h = (Date.now() - new Date(dateStr).getTime()) / 3600000;
  if (h > thresholdH) return "breach";
  if (h > thresholdH * 0.75) return "warn";
  return "ok";
}

export default function ExecutionStageBoard() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: items = [] } = useQuery({
    queryKey: ["execution-stage-board"],
    queryFn: async () => {
      const { data } = await supabase.from("decision_outcome_log")
        .select("id, signal_title, domain, execution_owner, assigned_reviewer, execution_status, outcome_success, evidence_type, recommendation_accepted, created_at, execution_started_at, action_taken_at")
        .eq("recommendation_accepted", true)
        .order("created_at", { ascending: true })
        .limit(200);
      return (data ?? []) as StageItem[];
    },
    refetchInterval: 10000,
  });

  const transition = useMutation({
    mutationFn: async ({ ids, updates, auditAction }: { ids: string[]; updates: Record<string, unknown>; auditAction: string }) => {
      for (const id of ids) {
        const { error } = await supabase.from("decision_outcome_log").update(updates).eq("id", id);
        if (error) throw error;
        await supabase.from("audit_log").insert({
          action: auditAction,
          resource_type: "decision_outcome_log",
          resource_id: id,
          metadata: updates as Record<string, unknown>,
          severity: "info",
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["execution-stage-board"] });
      queryClient.invalidateQueries({ queryKey: ["rapid-outcome-queue"] });
      queryClient.invalidateQueries({ queryKey: ["daily-throughput"] });
      queryClient.invalidateQueries({ queryKey: ["daily-measured-queue"] });
      queryClient.invalidateQueries({ queryKey: ["completion-velocity"] });
      queryClient.invalidateQueries({ queryKey: ["new-decisions-inbox"] });
      setSelected(new Set());
      toast.success("Execution updated");
    },
    onError: (e) => toast.error(String(e)),
  });

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selIds = Array.from(selected);

  const classify = (item: StageItem): Stage => {
    if (item.evidence_type === "measured" || (item.execution_status === "completed" && item.outcome_success !== null)) return "measured";
    if (item.execution_status === "completed" && item.outcome_success === null) return "completed_no_outcome";
    if (item.execution_status === "in_progress") return "in_progress";
    return "not_started";
  };

  const stages: { key: Stage; label: string; color: string; slaH: number }[] = [
    { key: "not_started", label: "Accepted / Not Started", color: "border-destructive/30", slaH: 24 },
    { key: "in_progress", label: "In Progress", color: "border-primary/30", slaH: 48 },
    { key: "completed_no_outcome", label: "Completed / No Outcome", color: "border-yellow-500/30", slaH: 24 },
    { key: "measured", label: "Measured ✓", color: "border-green-500/30", slaH: 999 },
  ];

  const grouped = new Map<Stage, StageItem[]>();
  for (const s of stages) grouped.set(s.key, []);
  for (const item of items) {
    const stage = classify(item);
    grouped.get(stage)!.push(item);
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base font-semibold">Execution Stage Board</CardTitle>
          {selIds.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs">{selIds.length} selected</Badge>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={transition.isPending}
                onClick={() => transition.mutate({ ids: selIds, auditAction: "execution.owner_assigned", updates: {
                  execution_owner: OWNERS[Math.floor(Math.random() * OWNERS.length)],
                  assigned_reviewer: REVIEWERS[Math.floor(Math.random() * REVIEWERS.length)],
                } })}><User className="h-3 w-3 mr-1" />Assign</Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={transition.isPending}
                onClick={() => transition.mutate({ ids: selIds, auditAction: "execution.started", updates: { execution_status: "in_progress", action_taken: true } })}>
                <Play className="h-3 w-3 mr-1" />Start</Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={transition.isPending}
                onClick={() => transition.mutate({ ids: selIds, auditAction: "execution.completed", updates: { execution_status: "completed", execution_completed_at: new Date().toISOString() } })}>
                <CheckCircle2 className="h-3 w-3 mr-1" />Complete</Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stages.map(stage => {
            const stageItems = grouped.get(stage.key) ?? [];
            return (
              <div key={stage.key} className={`rounded-lg border-2 ${stage.color} p-2`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">{stage.label}</p>
                  <Badge variant="secondary" className="text-[10px] font-mono">{stageItems.length}</Badge>
                </div>
                <ScrollArea className="max-h-[280px]">
                  <div className="space-y-1.5">
                    {stageItems.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-3">Empty</p>}
                    {stageItems.map(item => {
                      const dateRef = stage.key === "not_started" ? item.action_taken_at || item.created_at
                        : stage.key === "in_progress" ? item.execution_started_at || item.created_at
                        : item.created_at;
                      const sla = slaState(dateRef, stage.slaH);
                      return (
                        <div key={item.id} className={`p-2 rounded border text-[10px] space-y-1 ${
                          sla === "breach" ? "border-destructive/50 bg-destructive/5" : sla === "warn" ? "border-yellow-500/30 bg-yellow-500/5" : "border-border/30"
                        }`}>
                          <div className="flex items-start gap-1.5">
                            {stage.key !== "measured" && (
                              <Checkbox className="mt-0.5 h-3.5 w-3.5" checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{item.signal_title?.slice(0, 50) || "Decision"}</p>
                              <p className="text-muted-foreground">{item.domain} · {item.execution_owner || "unowned"}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {sla === "breach" && <Clock className="h-3 w-3 text-destructive" />}
                              <span className="text-muted-foreground">{ageLabel(dateRef)}</span>
                            </div>
                          </div>
                          {stage.key === "not_started" && !item.execution_owner && (
                            <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5 w-full" disabled={transition.isPending}
                              onClick={() => transition.mutate({ ids: [item.id], auditAction: "execution.owner_assigned", updates: {
                                execution_owner: OWNERS[Math.floor(Math.random() * OWNERS.length)],
                                assigned_reviewer: REVIEWERS[Math.floor(Math.random() * REVIEWERS.length)],
                              } })}>Auto-Assign + Start</Button>
                          )}
                          {stage.key === "not_started" && item.execution_owner && (
                            <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5 w-full" disabled={transition.isPending}
                              onClick={() => transition.mutate({ ids: [item.id], auditAction: "execution.started", updates: { execution_status: "in_progress", action_taken: true } })}>
                              Start Execution</Button>
                          )}
                          {stage.key === "in_progress" && (
                            <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1.5 w-full" disabled={transition.isPending}
                              onClick={() => transition.mutate({ ids: [item.id], auditAction: "execution.completed", updates: { execution_status: "completed", execution_completed_at: new Date().toISOString() } })}>
                              Mark Completed</Button>
                          )}
                          {stage.key === "completed_no_outcome" && (
                            <Badge variant="outline" className="text-[9px]">→ Use Rapid Outcome Mode</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
