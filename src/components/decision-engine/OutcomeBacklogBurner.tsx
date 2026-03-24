import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, Clock, AlertTriangle, CheckCircle, XCircle, Play, User } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

interface BacklogItem {
  id: string;
  signal_title: string;
  domain: string | null;
  execution_status: string | null;
  recommendation_accepted: boolean | null;
  outcome_success: boolean | null;
  execution_owner: string | null;
  assigned_reviewer: string | null;
  created_at: string | null;
  signal_confidence: number | null;
  postmortem_note: string | null;
  action_taken: boolean | null;
  category: "completed_no_outcome" | "accepted_not_started" | "failed_no_postmortem";
  ageHours: number;
}

export default function OutcomeBacklogBurner() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Record<string, any>>({});

  const { data: backlog = [] } = useQuery<BacklogItem[]>({
    queryKey: ["outcome-backlog-burner"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("id, signal_title, domain, execution_status, recommendation_accepted, outcome_success, execution_owner, assigned_reviewer, created_at, signal_confidence, postmortem_note, action_taken")
        .order("created_at", { ascending: true })
        .limit(200);

      const now = Date.now();
      const items: BacklogItem[] = [];

      for (const r of (data as any[]) || []) {
        const ageHours = r.created_at ? Math.round((now - new Date(r.created_at).getTime()) / 3600000) : 0;

        if (r.execution_status === "completed" && r.outcome_success === null) {
          items.push({ ...r, category: "completed_no_outcome", ageHours });
        } else if (r.recommendation_accepted && (!r.execution_status || r.execution_status === "not_started")) {
          items.push({ ...r, category: "accepted_not_started", ageHours });
        } else if (r.recommendation_accepted && r.outcome_success === false && !r.postmortem_note) {
          items.push({ ...r, category: "failed_no_postmortem", ageHours });
        }
      }

      // Sort: completed_no_outcome first, then by age desc, then by confidence desc
      const categoryOrder = { completed_no_outcome: 0, accepted_not_started: 1, failed_no_postmortem: 2 };
      items.sort((a, b) => {
        const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
        if (catDiff !== 0) return catDiff;
        if (b.ageHours !== a.ageHours) return b.ageHours - a.ageHours;
        return (b.signal_confidence ?? 0) - (a.signal_confidence ?? 0);
      });

      return items;
    },
    staleTime: 30_000,
  });

  const quickAction = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from("decision_outcome_log")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outcome-backlog-burner"] });
      queryClient.invalidateQueries({ queryKey: ["decision-kpi-panel"] });
      queryClient.invalidateQueries({ queryKey: ["promotion-readiness-gate"] });
      toast.success("Record updated");
    },
    onError: () => toast.error("Update failed"),
  });

  const recordOutcome = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const { error } = await supabase.functions.invoke("record-decision-outcome", {
        body: { decision_id: id, ...payload },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outcome-backlog-burner"] });
      queryClient.invalidateQueries({ queryKey: ["decision-kpi-panel"] });
      queryClient.invalidateQueries({ queryKey: ["measured-outcome-kpi"] });
      toast.success("Outcome recorded");
      setExpandedId(null);
    },
    onError: () => toast.error("Failed to record outcome"),
  });

  const categoryLabel = {
    completed_no_outcome: { label: "No Outcome", color: "destructive" as const },
    accepted_not_started: { label: "Not Started", color: "outline" as const },
    failed_no_postmortem: { label: "No Postmortem", color: "destructive" as const },
  };

  const ageBadge = (hours: number) => {
    if (hours >= 72) return <Badge variant="destructive" className="text-[9px] h-4"><Clock className="h-2.5 w-2.5 mr-0.5" />{Math.round(hours / 24)}d</Badge>;
    if (hours >= 24) return <Badge variant="outline" className="text-[9px] h-4 border-destructive/50 text-destructive"><Clock className="h-2.5 w-2.5 mr-0.5" />{hours}h</Badge>;
    return <Badge variant="outline" className="text-[9px] h-4"><Clock className="h-2.5 w-2.5 mr-0.5" />{hours}h</Badge>;
  };

  if (backlog.length === 0) {
    return (
      <Card className="border-primary/30">
        <CardContent className="py-4 text-center">
          <CheckCircle className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">Backlog clear — all decisions have outcomes.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-destructive" /> Outcome Backlog Burner
          <Badge variant="destructive" className="text-[9px] h-4 ml-1">{backlog.length} gaps</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
        {backlog.map(item => (
          <div key={item.id} className={`border rounded p-2.5 space-y-2 ${item.category === "completed_no_outcome" ? "border-destructive/30 bg-destructive/5" : "border-border/50 bg-muted/10"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.signal_title || "Untitled"}</p>
                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                  {item.domain && <Badge variant="outline" className="text-[9px] h-4">{item.domain}</Badge>}
                  <Badge variant={categoryLabel[item.category].color} className="text-[9px] h-4">
                    {categoryLabel[item.category].label}
                  </Badge>
                  {ageBadge(item.ageHours)}
                </div>
              </div>

              <div className="flex gap-1 shrink-0">
                {item.category === "accepted_not_started" && (
                  <>
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                      onClick={() => quickAction.mutate({ id: item.id, updates: { execution_status: "in_progress", action_taken: true } })}>
                      <Play className="h-2.5 w-2.5 mr-0.5" />Start
                    </Button>
                    {!item.execution_owner && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                        onClick={() => quickAction.mutate({ id: item.id, updates: { execution_owner: "system-operator" } })}>
                        <User className="h-2.5 w-2.5 mr-0.5" />Assign
                      </Button>
                    )}
                  </>
                )}
                {item.category === "completed_no_outcome" && (
                  <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2"
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                    Record Outcome
                  </Button>
                )}
                {item.category === "failed_no_postmortem" && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2"
                    onClick={() => {
                      const note = prompt("Enter postmortem note:");
                      if (note) quickAction.mutate({ id: item.id, updates: { postmortem_note: note } });
                    }}>
                    Add Postmortem
                  </Button>
                )}
              </div>
            </div>

            {expandedId === item.id && item.category === "completed_no_outcome" && (
              <div className="border-t border-border/50 pt-2 space-y-2">
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs flex-1"
                    variant={formState[item.id]?.outcome_success === true ? "default" : "outline"}
                    onClick={() => setFormState(p => ({ ...p, [item.id]: { ...p[item.id], outcome_success: true } }))}>
                    <CheckCircle className="h-3 w-3 mr-1" />Success
                  </Button>
                  <Button size="sm" className="h-7 text-xs flex-1"
                    variant={formState[item.id]?.outcome_success === false ? "destructive" : "outline"}
                    onClick={() => setFormState(p => ({ ...p, [item.id]: { ...p[item.id], outcome_success: false } }))}>
                    <XCircle className="h-3 w-3 mr-1" />Failed
                  </Button>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Impact: {formState[item.id]?.impact ?? 50}/100</label>
                  <Slider min={0} max={100} value={[formState[item.id]?.impact ?? 50]}
                    onValueChange={([v]) => setFormState(p => ({ ...p, [item.id]: { ...p[item.id], impact: v } }))} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Cost</label>
                  <Input type="number" className="h-7 text-xs" placeholder="0"
                    onChange={e => setFormState(p => ({ ...p, [item.id]: { ...p[item.id], cost: Number(e.target.value) } }))} />
                </div>
                <Button size="sm" className="h-7 text-xs w-full"
                  disabled={formState[item.id]?.outcome_success === undefined}
                  onClick={() => {
                    const s = formState[item.id] || {};
                    recordOutcome.mutate({
                      id: item.id,
                      payload: {
                        outcome_success: s.outcome_success,
                        impact_score: s.impact ?? 50,
                        cost_of_action: s.cost ?? 0,
                        outcome_source: "manual",
                      },
                    });
                  }}>
                  Submit & Compute ROI
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
