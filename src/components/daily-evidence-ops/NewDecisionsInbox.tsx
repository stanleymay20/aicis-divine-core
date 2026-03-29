import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { CheckCircle2, Play, User, Inbox } from "lucide-react";
import { Input } from "@/components/ui/input";

interface DecisionRow {
  id: string;
  signal_title: string | null;
  domain: string | null;
  recommendation_accepted: boolean | null;
  execution_owner: string | null;
  execution_status: string | null;
  assigned_reviewer: string | null;
  created_at: string | null;
}

const REVIEWERS = ["Dr. Amara Osei", "Prof. Kwame Adjei", "Dr. Sarah Chen"];
const OWNERS = ["Col. James Mensah", "Dr. Amara Osei", "Prof. Kwame Adjei"];

export default function NewDecisionsInbox() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchOwner, setBatchOwner] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["new-decisions-inbox"],
    queryFn: async () => {
      const { data } = await supabase.from("decision_outcome_log")
        .select("id, signal_title, domain, recommendation_accepted, execution_owner, execution_status, assigned_reviewer, created_at")
        .or("recommendation_accepted.is.null,recommendation_accepted.eq.false,execution_owner.is.null,execution_status.is.null,execution_status.eq.not_started")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as DecisionRow[];
    },
    refetchInterval: 10000,
  });

  const action = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Record<string, unknown> }) => {
      for (const id of ids) {
        const { error } = await supabase.from("decision_outcome_log").update(updates).eq("id", id);
        if (error) throw error;
        await supabase.from("audit_log").insert({
          action: Object.keys(updates).includes("recommendation_accepted") ? "decision.accepted" :
                  Object.keys(updates).includes("execution_owner") ? "execution.owner_assigned" :
                  Object.keys(updates).includes("assigned_reviewer") ? "reviewer.assigned" :
                  "execution.started",
          resource_type: "decision_outcome_log",
          resource_id: id,
          metadata: updates as Record<string, unknown>,
          severity: "info",
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["new-decisions-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["daily-measured-queue"] });
      queryClient.invalidateQueries({ queryKey: ["daily-throughput"] });
      setSelected(new Set());
      toast.success("Updated");
    },
    onError: (e) => toast.error(String(e)),
  });

  const toggle = (id: string) => setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selIds = Array.from(selected);
  const hasSelection = selIds.length > 0;

  const notAccepted = items.filter(i => !i.recommendation_accepted);
  const noOwner = items.filter(i => i.recommendation_accepted && !i.execution_owner);
  const notStarted = items.filter(i => i.recommendation_accepted && i.execution_owner && (!i.execution_status || i.execution_status === "not_started"));

  if (isLoading) return <Card className="border-border/50 animate-pulse h-32" />;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <Inbox className="h-4 w-4 text-primary" /> New Decisions Inbox
          </CardTitle>
          <Badge variant="outline" className="text-xs font-mono">{items.length} pending</Badge>
        </div>
        {hasSelection && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/30">
            <span className="text-xs text-muted-foreground self-center">{selIds.length} selected:</span>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={action.isPending}
              onClick={() => action.mutate({ ids: selIds, updates: { recommendation_accepted: true } })}>
              <CheckCircle2 className="h-3 w-3 mr-1" />Accept
            </Button>
            <div className="flex gap-1">
              <Input placeholder="Owner" className="h-7 w-28 text-xs" value={batchOwner}
                onChange={e => setBatchOwner(e.target.value)} />
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={action.isPending || !batchOwner}
                onClick={() => action.mutate({ ids: selIds, updates: { execution_owner: batchOwner, assigned_reviewer: REVIEWERS[Math.floor(Math.random() * REVIEWERS.length)] } })}>
                <User className="h-3 w-3 mr-1" />Assign
              </Button>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={action.isPending}
              onClick={() => action.mutate({ ids: selIds, updates: { execution_status: "in_progress", action_taken: true } })}>
              <Play className="h-3 w-3 mr-1" />Start
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-1 max-h-[400px] overflow-y-auto">
        {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No pending decisions. Run inference to generate new ones.</p>}
        {items.map(item => {
          const status = !item.recommendation_accepted ? "unaccepted" : !item.execution_owner ? "no_owner" : "not_started";
          return (
            <div key={item.id} className="flex items-center gap-2 p-2 rounded border border-border/30 hover:bg-muted/20">
              <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{item.signal_title?.slice(0, 70) || "Decision"}</p>
                <p className="text-[10px] text-muted-foreground">{item.domain}</p>
              </div>
              <Badge variant={status === "unaccepted" ? "destructive" : "secondary"} className="text-[10px] shrink-0">
                {status.replace("_", " ")}
              </Badge>
              {status === "unaccepted" && (
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" disabled={action.isPending}
                  onClick={() => action.mutate({ ids: [item.id], updates: {
                    recommendation_accepted: true,
                    execution_owner: OWNERS[Math.floor(Math.random() * OWNERS.length)],
                    assigned_reviewer: REVIEWERS[Math.floor(Math.random() * REVIEWERS.length)],
                  } })}>Quick Accept</Button>
              )}
              {status === "no_owner" && (
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" disabled={action.isPending}
                  onClick={() => action.mutate({ ids: [item.id], updates: {
                    execution_owner: OWNERS[Math.floor(Math.random() * OWNERS.length)],
                    assigned_reviewer: REVIEWERS[Math.floor(Math.random() * REVIEWERS.length)],
                  } })}>Auto-Assign</Button>
              )}
              {status === "not_started" && (
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" disabled={action.isPending}
                  onClick={() => action.mutate({ ids: [item.id], updates: { execution_status: "in_progress", action_taken: true } })}>Start</Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
