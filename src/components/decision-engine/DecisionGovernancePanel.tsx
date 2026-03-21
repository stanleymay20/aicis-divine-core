import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardCheck, CheckCircle, XCircle, Eye, AlertTriangle,
  BarChart3, ChevronDown, ChevronUp
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
  outcome_success: boolean | null;
  impact_score: number | null;
  evidence_type: string | null;
  created_at: string | null;
  status: string | null;
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

  const { data: records } = useQuery<DecisionRecord[]>({
    queryKey: ["decision-governance-records"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("id, signal_title, action_type, domain, recommendation_accepted, recommendation_rejected_reason, review_status, reviewer_name, reviewer_role, override_reason, postmortem_note, review_completed_at, outcome_success, impact_score, evidence_type, created_at, status")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data as any) || [];
    },
    staleTime: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from("decision_outcome_log")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["decision-governance-records"] });
      toast.success("Decision record updated");
    },
    onError: () => toast.error("Failed to update record"),
  });

  const handleReviewStatusChange = (id: string, status: string) => {
    const updates: Record<string, any> = {
      review_status: status,
      review_completed_at: ["approved", "rejected", "overridden"].includes(status) ? new Date().toISOString() : null,
    };
    updateMutation.mutate({ id, updates });
  };

  const handleSaveNote = (id: string, field: "override_reason" | "postmortem_note") => {
    const value = editingNote[`${id}-${field}`];
    if (value === undefined) return;
    updateMutation.mutate({ id, updates: { [field]: value || null } });
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

          return (
            <div key={rec.id} className="border border-border rounded overflow-hidden">
              <div
                className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : rec.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{rec.signal_title || rec.action_type?.replace(/_/g, " ") || "Untitled"}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {rec.domain && <Badge variant="outline" className="text-[9px] h-4">{rec.domain}</Badge>}
                    <Badge variant={rvConfig.variant} className="text-[9px] h-4">{rvConfig.label}</Badge>
                    {rec.recommendation_accepted === true && (
                      <Badge variant="default" className="text-[9px] h-4"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Accepted</Badge>
                    )}
                    {rec.recommendation_accepted === false && (
                      <Badge variant="destructive" className="text-[9px] h-4"><XCircle className="h-2.5 w-2.5 mr-0.5" />Rejected</Badge>
                    )}
                    {rec.review_status === "overridden" && (
                      <Badge variant="destructive" className="text-[9px] h-4"><AlertTriangle className="h-2.5 w-2.5 mr-0.5" />Overridden</Badge>
                    )}
                    {rec.outcome_success != null && (
                      <Badge variant={rec.outcome_success ? "default" : "destructive"} className="text-[9px] h-4">
                        <BarChart3 className="h-2.5 w-2.5 mr-0.5" />Measured
                      </Badge>
                    )}
                    {rec.evidence_type && (
                      <span className="text-[9px] text-muted-foreground">{rec.evidence_type}</span>
                    )}
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
              </div>

              {isExpanded && (
                <div className="border-t border-border p-3 space-y-3 bg-muted/10">
                  {/* Review status */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Review Status</label>
                    <Select
                      value={rec.review_status || "pending"}
                      onValueChange={(v) => handleReviewStatusChange(rec.id, v)}
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
                      <label className="text-[10px] font-medium text-muted-foreground block mb-1">Override Reason</label>
                      <Textarea
                        className="text-xs min-h-[50px]"
                        placeholder="Why was this overridden?"
                        value={editingNote[`${rec.id}-override_reason`] ?? rec.override_reason ?? ""}
                        onChange={(e) => setEditingNote(prev => ({ ...prev, [`${rec.id}-override_reason`]: e.target.value }))}
                      />
                      {editingNote[`${rec.id}-override_reason`] !== undefined && (
                        <Button size="sm" variant="outline" className="mt-1 h-6 text-[10px]" onClick={() => handleSaveNote(rec.id, "override_reason")}>
                          Save
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Postmortem note */}
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">Postmortem Note</label>
                    <Textarea
                      className="text-xs min-h-[50px]"
                      placeholder="What was learned from this decision?"
                      value={editingNote[`${rec.id}-postmortem_note`] ?? rec.postmortem_note ?? ""}
                      onChange={(e) => setEditingNote(prev => ({ ...prev, [`${rec.id}-postmortem_note`]: e.target.value }))}
                    />
                    {editingNote[`${rec.id}-postmortem_note`] !== undefined && (
                      <Button size="sm" variant="outline" className="mt-1 h-6 text-[10px]" onClick={() => handleSaveNote(rec.id, "postmortem_note")}>
                        Save
                      </Button>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-3 text-[9px] text-muted-foreground flex-wrap">
                    {rec.reviewer_name && <span>Reviewer: {rec.reviewer_name}</span>}
                    {rec.reviewer_role && <span>Role: {rec.reviewer_role}</span>}
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
