import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardCheck, CheckCircle, XCircle, AlertTriangle,
  BarChart3, ChevronDown, ChevronUp, Timer
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface DecisionRecord {
  id: string;
  signal_title: string;
  action_type: string | null;
  domain: string | null;
  recommendation_accepted: boolean | null;
  recommendation_rejected_reason: string | null;
  review_status: string | null;
  reviewer_name: string | null;
  reviewer_role: string | null;
  override_reason: string | null;
  postmortem_note: string | null;
  review_completed_at: string | null;
  review_due_at: string | null;
  review_sla_hours: number | null;
  assigned_reviewer: string | null;
  outcome_success: boolean | null;
  impact_score: number | null;
  evidence_type: string | null;
  created_at: string | null;
  status: string | null;
  actor_role: string | null;
  criticality_tier: string | null;
  requires_dual_approval: boolean | null;
  second_reviewer_name: string | null;
  second_review_status: string | null;
  recommender_id: string | null;
}

const reviewStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  reviewed: { label: "Reviewed", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  overridden: { label: "Overridden", variant: "destructive" },
};

export default function DecisionGovernancePanel() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Record<string, string>>({});
  const [reviewerInput, setReviewerInput] = useState<Record<string, { name: string; role: string }>>({});

  const { data: records } = useQuery<DecisionRecord[]>({
    queryKey: ["decision-governance-records"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("id, signal_title, action_type, domain, recommendation_accepted, recommendation_rejected_reason, review_status, reviewer_name, reviewer_role, override_reason, postmortem_note, review_completed_at, review_due_at, review_sla_hours, assigned_reviewer, outcome_success, impact_score, evidence_type, created_at, status, actor_role, criticality_tier, requires_dual_approval, second_reviewer_name, second_review_status, recommender_id")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data as any) || [];
    },
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates, historyEntry }: { id: string; updates: Record<string, any>; historyEntry?: { from_status: string | null; to_status: string; note?: string } }) => {
      const { error } = await supabase
        .from("decision_outcome_log")
        .update(updates)
        .eq("id", id);
      if (error) throw error;

      // Append to immutable review history
      if (historyEntry) {
        await supabase.from("decision_review_history").insert({
          decision_id: id,
          changed_by: updates.reviewer_name || null,
          changed_role: updates.reviewer_role || null,
          from_status: historyEntry.from_status,
          to_status: historyEntry.to_status,
          note: historyEntry.note || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-governance-records"] });
      queryClient.invalidateQueries({ queryKey: ["review-tower-records"] });
      queryClient.invalidateQueries({ queryKey: ["review-history-all"] });
      toast.success("Decision record updated");
    },
    onError: () => toast.error("Failed to update record"),
  });

  const handleReviewStatusChange = (rec: DecisionRecord, newStatus: string) => {
    const reviewer = reviewerInput[rec.id] || { name: rec.reviewer_name || "", role: rec.reviewer_role || "" };

    // Governance rules validation
    if (newStatus === "approved" && (!reviewer.name || !reviewer.role)) {
      toast.error("Reviewer name and role are required to approve a decision.");
      return;
    }
    if (newStatus === "overridden") {
      const reason = editingNote[`${rec.id}-override_reason`] ?? rec.override_reason;
      if (!reason) {
        toast.error("Override reason is required before marking as overridden.");
        return;
      }
    }

    // Separation of duties: recommender cannot approve their own recommendation
    if (["approved", "overridden"].includes(newStatus) && rec.actor_role && reviewer.name) {
      if (rec.recommender_id && rec.recommender_id === reviewer.name) {
        toast.error("Separation of duties violation: recommender cannot approve their own recommendation.");
        return;
      }
    }

    const updates: Record<string, any> = {
      review_status: newStatus,
      review_completed_at: ["approved", "rejected", "overridden"].includes(newStatus) ? new Date().toISOString() : null,
      separation_of_duties_verified: true,
    };
    if (reviewer.name) updates.reviewer_name = reviewer.name;
    if (reviewer.role) updates.reviewer_role = reviewer.role;

    updateMutation.mutate({
      id: rec.id,
      updates,
      historyEntry: {
        from_status: rec.review_status || "pending",
        to_status: newStatus,
      },
    });
  };

  const handleSaveNote = (id: string, field: "override_reason" | "postmortem_note", rec: DecisionRecord) => {
    const value = editingNote[`${id}-${field}`];
    if (value === undefined) return;

    updateMutation.mutate({
      id,
      updates: { [field]: value || null },
      historyEntry: {
        from_status: rec.review_status || "pending",
        to_status: rec.review_status || "pending",
        note: `${field === "override_reason" ? "Override reason" : "Postmortem note"} ${value ? "updated" : "cleared"}`,
      },
    });
    setEditingNote(prev => {
      const next = { ...prev };
      delete next[`${id}-${field}`];
      return next;
    });
  };

  if (!records || records.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-4 text-center">
          <ClipboardCheck className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No decision records to govern. Capture recommendations first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <ClipboardCheck className="h-3.5 w-3.5 text-primary" /> Decision Governance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {records.map(rec => {
          const isExpanded = expanded === rec.id;
          const rvConfig = reviewStatusConfig[rec.review_status || "pending"] || reviewStatusConfig.pending;
          const isOverdue = rec.review_due_at && !["approved", "rejected", "overridden"].includes(rec.review_status || "") && new Date(rec.review_due_at).getTime() < Date.now();
          const slaHoursLeft = rec.review_due_at ? Math.round((new Date(rec.review_due_at).getTime() - Date.now()) / 3600000) : null;
          const needsPostmortem = rec.recommendation_accepted === true && rec.outcome_success === false && !rec.postmortem_note;
          const reviewer = reviewerInput[rec.id] || { name: rec.reviewer_name || "", role: rec.reviewer_role || "" };

          return (
            <div key={rec.id} className={`border rounded overflow-hidden ${isOverdue ? "border-destructive/50 bg-destructive/5" : "border-border"}`}>
              <div
                className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : rec.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{rec.signal_title || rec.action_type?.replace(/_/g, " ") || "Untitled"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {rec.domain && <Badge variant="outline" className="text-[9px] h-4">{rec.domain}</Badge>}
                    <Badge variant={rvConfig.variant} className="text-[9px] h-4">{rvConfig.label}</Badge>
                    {isOverdue && (
                      <Badge variant="destructive" className="text-[9px] h-4">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{Math.abs(slaHoursLeft!)}h overdue
                      </Badge>
                    )}
                    {!isOverdue && slaHoursLeft != null && slaHoursLeft > 0 && !["approved", "rejected", "overridden"].includes(rec.review_status || "") && (
                      <Badge variant="outline" className="text-[9px] h-4">
                        <Timer className="h-2.5 w-2.5 mr-0.5" />{slaHoursLeft}h left
                      </Badge>
                    )}
                    {rec.recommendation_accepted === true && (
                      <Badge variant="default" className="text-[9px] h-4"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Accepted</Badge>
                    )}
                    {rec.recommendation_accepted === false && (
                      <Badge variant="destructive" className="text-[9px] h-4"><XCircle className="h-2.5 w-2.5 mr-0.5" />Rejected</Badge>
                    )}
                    {rec.outcome_success != null && (
                      <Badge variant={rec.outcome_success ? "default" : "destructive"} className="text-[9px] h-4">
                        <BarChart3 className="h-2.5 w-2.5 mr-0.5" />{rec.outcome_success ? "Success" : "Failed"}
                      </Badge>
                    )}
                    {needsPostmortem && (
                      <Badge variant="destructive" className="text-[9px] h-4">Needs postmortem</Badge>
                    )}
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
              </div>

              {isExpanded && (
                <div className="border-t border-border p-3 space-y-3 bg-muted/10">
                  {/* Reviewer assignment */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1">Reviewer Name *</label>
                      <Input
                        className="h-7 text-xs"
                        placeholder="Reviewer name"
                        value={reviewer.name}
                        onChange={(e) => setReviewerInput(prev => ({ ...prev, [rec.id]: { ...reviewer, name: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1">Reviewer Role *</label>
                      <Input
                        className="h-7 text-xs"
                        placeholder="e.g. Senior Analyst"
                        value={reviewer.role}
                        onChange={(e) => setReviewerInput(prev => ({ ...prev, [rec.id]: { ...reviewer, role: e.target.value } }))}
                      />
                    </div>
                  </div>

                  {/* Review status */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Review Status</label>
                    <Select
                      value={rec.review_status || "pending"}
                      onValueChange={(v) => handleReviewStatusChange(rec, v)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="reviewed">Reviewed</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="overridden">Overridden</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Override reason */}
                  {(rec.review_status === "overridden" || rec.override_reason) && (
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1">Override Reason *</label>
                      <Textarea
                        className="text-xs min-h-[50px]"
                        placeholder="Why was this overridden? (required)"
                        value={editingNote[`${rec.id}-override_reason`] ?? rec.override_reason ?? ""}
                        onChange={(e) => setEditingNote(prev => ({ ...prev, [`${rec.id}-override_reason`]: e.target.value }))}
                      />
                      {editingNote[`${rec.id}-override_reason`] !== undefined && (
                        <Button size="sm" variant="outline" className="mt-1 h-6 text-[10px]" onClick={() => handleSaveNote(rec.id, "override_reason", rec)}>
                          Save
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Postmortem note */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                      Postmortem Note {needsPostmortem && <span className="text-destructive">* Required — failed accepted decision</span>}
                    </label>
                    <Textarea
                      className={`text-xs min-h-[50px] ${needsPostmortem ? "border-destructive/50" : ""}`}
                      placeholder="What was learned from this decision?"
                      value={editingNote[`${rec.id}-postmortem_note`] ?? rec.postmortem_note ?? ""}
                      onChange={(e) => setEditingNote(prev => ({ ...prev, [`${rec.id}-postmortem_note`]: e.target.value }))}
                    />
                    {editingNote[`${rec.id}-postmortem_note`] !== undefined && (
                      <Button size="sm" variant="outline" className="mt-1 h-6 text-[10px]" onClick={() => handleSaveNote(rec.id, "postmortem_note", rec)}>
                        Save
                      </Button>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 text-[9px] text-muted-foreground flex-wrap">
                    {rec.assigned_reviewer && <span>Assigned: {rec.assigned_reviewer}</span>}
                    {rec.review_sla_hours && <span>SLA: {rec.review_sla_hours}h</span>}
                    {rec.review_completed_at && <span>Completed: {new Date(rec.review_completed_at).toLocaleDateString()}</span>}
                    {rec.impact_score != null && <span>Impact: {rec.impact_score}</span>}
                    {rec.created_at && <span>Created: {new Date(rec.created_at).toLocaleDateString()}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
