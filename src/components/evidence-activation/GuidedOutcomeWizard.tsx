import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  X, ChevronRight, ChevronLeft, CheckCircle2,
  Loader2, AlertTriangle,
} from "lucide-react";

const STEPS = [
  "Select Recommendation",
  "Accept & Assign",
  "Start Execution",
  "Complete & Record Outcome",
  "Confirmation",
] as const;

interface Props {
  onClose: () => void;
}

export default function GuidedOutcomeWizard({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [executionOwner, setExecutionOwner] = useState("");
  const [outcomeSuccess, setOutcomeSuccess] = useState<boolean | null>(null);
  const [impactScore, setImpactScore] = useState("");
  const [costOfAction, setCostOfAction] = useState("");
  const [outcomeDescription, setOutcomeDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [auditCount, setAuditCount] = useState(0);

  const queryClient = useQueryClient();

  // Step 0: fetch eligible recommendations (pending or with no outcome)
  const { data: candidates, isLoading } = useQuery({
    queryKey: ["wizard-candidates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("id, signal_summary, domain, iso3, recommendation_action, created_at, evidence_type, action_taken, outcome_success")
        .is("outcome_success", null)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const selected = candidates?.find((c) => c.id === selectedId);

  const writeAudit = async (action: string, metadata: Record<string, unknown> = {}) => {
    await supabase.from("audit_log").insert({
      action,
      resource_type: "decision_outcome_log",
      resource_id: selectedId,
      severity: "info",
      metadata,
    });
    setAuditCount((c) => c + 1);
  };

  const handleAcceptAndAssign = async () => {
    if (!selectedId || !reviewerName.trim() || !executionOwner.trim()) return;
    setSubmitting(true);
    try {
      // Accept recommendation
      await supabase
        .from("decision_outcome_log")
        .update({
          recommendation_accepted: true,
          reviewer_name: reviewerName.trim(),
          execution_owner: executionOwner.trim(),
          actor_role: "operator",
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedId);

      await writeAudit("decision.accepted", { reviewer: reviewerName, owner: executionOwner });
      await writeAudit("reviewer.assigned", { reviewer_name: reviewerName });
      await writeAudit("execution.owner_assigned", { execution_owner: executionOwner });

      setStep(2);
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartExecution = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await supabase
        .from("decision_outcome_log")
        .update({
          action_taken: true,
          action_taken_at: new Date().toISOString(),
          execution_status: "in_progress",
          execution_started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedId);

      await writeAudit("execution.started", { execution_owner: executionOwner });
      setStep(3);
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordOutcome = async () => {
    if (outcomeSuccess === null || !impactScore || !costOfAction) return;
    setSubmitting(true);
    try {
      const impact = Math.max(0, Math.min(100, Number(impactScore)));
      const cost = Number(costOfAction) || 0;

      // Use edge function for full outcome recording (ROI, training, proxy override)
      const { data: res, error } = await supabase.functions.invoke("record-decision-outcome", {
        body: {
          decision_id: selectedId,
          action_taken: true,
          outcome_success: outcomeSuccess,
          impact_score: impact,
          cost_of_action: cost,
          outcome_description: outcomeDescription.trim() || undefined,
          outcome_source: "guided_wizard",
          execution_status: "completed",
          execution_owner: executionOwner,
        },
      });

      if (error) throw error;

      // Write remaining audit events
      await writeAudit("execution.completed", {});
      await writeAudit("outcome.recorded", { outcome_success: outcomeSuccess, impact_score: impact });
      await writeAudit("outcome.measured", { impact_score: impact, cost_of_action: cost });
      await writeAudit("roi.computed", {
        roi_estimate: res?.roi_estimate,
        net_value: res?.net_value,
      });
      await writeAudit("training.measured_inserted", {
        evidence_type: res?.evidence_type,
      });

      setResult(res);
      queryClient.invalidateQueries({ queryKey: ["measured-evidence-progress"] });
      queryClient.invalidateQueries({ queryKey: ["activation-measured-count"] });
      setStep(4);
    } catch (e) {
      toast({ title: "Error recording outcome", description: String(e), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Guided Outcome Wizard</CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Step {step + 1}/{STEPS.length}: {STEPS[step]}</span>
              <span>{auditCount} audit events</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>

          {/* Step 0: Select */}
          {step === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Select a recommendation to process through the full evidence lifecycle.
              </p>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : !candidates?.length ? (
                <div className="flex items-center gap-2 text-sm text-warning py-4">
                  <AlertTriangle className="h-4 w-4" /> No pending recommendations found.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {candidates.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                        selectedId === c.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <div className="font-medium truncate">{c.signal_summary}</div>
                      <div className="flex gap-2 mt-1 text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{c.domain}</Badge>
                        <span>{c.iso3}</span>
                        {c.action_taken && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Started</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <Button
                className="w-full"
                disabled={!selectedId}
                onClick={() => setStep(1)}
              >
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 1: Accept & Assign */}
          {step === 1 && selected && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-lg p-3 text-xs">
                <div className="font-medium">{selected.signal_summary}</div>
                <div className="text-muted-foreground mt-1">{selected.domain} · {selected.iso3}</div>
              </div>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Reviewer Name *</Label>
                  <Input
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="e.g. Dr. Chen"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Execution Owner *</Label>
                  <Input
                    value={executionOwner}
                    onChange={(e) => setExecutionOwner(e.target.value)}
                    placeholder="e.g. Operations Desk"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep(0)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={!reviewerName.trim() || !executionOwner.trim() || submitting}
                  onClick={handleAcceptAndAssign}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept & Assign"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Start Execution */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="text-sm">
                <p className="text-muted-foreground">
                  Recommendation accepted. Reviewer: <span className="text-foreground font-medium">{reviewerName}</span>.
                  Owner: <span className="text-foreground font-medium">{executionOwner}</span>.
                </p>
                <p className="text-muted-foreground mt-2">
                  Click below to mark execution as started.
                </p>
              </div>
              <Button
                className="w-full"
                disabled={submitting}
                onClick={handleStartExecution}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Execution"}
              </Button>
            </div>
          )}

          {/* Step 3: Complete & Record Outcome */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Execution started. Record the outcome to complete the evidence loop.
              </p>
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Outcome *</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      size="sm"
                      variant={outcomeSuccess === true ? "default" : "outline"}
                      onClick={() => setOutcomeSuccess(true)}
                      className="flex-1"
                    >
                      ✓ Success
                    </Button>
                    <Button
                      size="sm"
                      variant={outcomeSuccess === false ? "destructive" : "outline"}
                      onClick={() => setOutcomeSuccess(false)}
                      className="flex-1"
                    >
                      ✗ Failed
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Impact Score (0-100) *</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={impactScore}
                    onChange={(e) => setImpactScore(e.target.value)}
                    placeholder="e.g. 65"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cost of Action (units) *</Label>
                  <Input
                    type="number"
                    min={0}
                    value={costOfAction}
                    onChange={(e) => setCostOfAction(e.target.value)}
                    placeholder="e.g. 10"
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Outcome Description</Label>
                  <Input
                    value={outcomeDescription}
                    onChange={(e) => setOutcomeDescription(e.target.value)}
                    placeholder="Brief description of what happened"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={outcomeSuccess === null || !impactScore || !costOfAction || submitting}
                  onClick={handleRecordOutcome}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Measured Outcome"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
              <h3 className="text-base font-semibold">Measured Evidence Created</h3>

              <div className="bg-muted/50 rounded-lg p-3 text-xs text-left space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Evidence Type</span>
                  <Badge variant="default" className="text-[10px]">
                    {String(result?.evidence_type ?? "measured")}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Proxy Overridden</span>
                  <span>{result?.proxy_overridden ? "Yes" : "No"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Audit Events Written</span>
                  <span className="font-medium">{auditCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impact Score</span>
                  <span>{impactScore}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost of Action</span>
                  <span>{costOfAction}</span>
                </div>
              </div>

              <Button className="w-full" onClick={onClose}>
                Done
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
