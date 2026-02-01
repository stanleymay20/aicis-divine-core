/**
 * Human-in-the-Loop Governance - Decision Checkpoint System
 * Ensures AI never acts autonomously on critical decisions
 */
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { 
  Users, 
  UserCheck, 
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Shield,
  Eye,
  Gavel
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface PendingApproval {
  id: string;
  action: string;
  division: string;
  payload: Record<string, unknown> | null;
  requester: string | null;
  status: string | null;
  created_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
}

const GOVERNANCE_ROLES = [
  { 
    id: "analyst", 
    label: "Analyst", 
    description: "Reviews data, generates reports, flags anomalies",
    permissions: ["view", "analyze", "flag"],
    color: "bg-primary/20 text-primary"
  },
  { 
    id: "policy_maker", 
    label: "Policy Maker", 
    description: "Approves recommendations, sets thresholds",
    permissions: ["view", "analyze", "approve_recommendations"],
    color: "bg-warning/20 text-warning"
  },
  { 
    id: "coordinator", 
    label: "Emergency Coordinator", 
    description: "Fast-track approvals during crises",
    permissions: ["view", "analyze", "approve_emergency"],
    color: "bg-destructive/20 text-destructive"
  },
  { 
    id: "auditor", 
    label: "Auditor", 
    description: "Reviews decision logs, ensures compliance",
    permissions: ["view", "audit", "export"],
    color: "bg-success/20 text-success"
  },
  { 
    id: "executive", 
    label: "Executive", 
    description: "Final sign-off on major actions",
    permissions: ["view", "analyze", "approve_all", "override"],
    color: "bg-accent/20 text-accent-foreground"
  }
];

export const HumanInLoopGovernance = () => {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const fetchPendingApprovals = async () => {
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from("approvals")
          .select("*")
          .eq("status", "pending")
          .order("created_at", { ascending: false });
        
        if (data) {
          setPendingApprovals(data as PendingApproval[]);
        }
      } catch (error) {
        console.error("Error fetching approvals:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPendingApprovals();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("approvals-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, 
        () => fetchPendingApprovals()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDecision = async (approvalId: string, decision: "approved" | "rejected") => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("approvals")
        .update({
          status: decision,
          decided_at: new Date().toISOString(),
          decided_by: user?.id,
          payload: {
            ...selectedApproval?.payload,
            decision_note: decisionNote,
            decision_by_email: user?.email
          }
        })
        .eq("id", approvalId);

      if (error) throw error;

      // Log to decision ledger
      await supabase.from("ai_decision_logs").insert({
        model_name: "human-governance-loop",
        division_key: selectedApproval?.division || "governance",
        input_summary: `Approval request: ${selectedApproval?.action}`,
        output_summary: `Decision: ${decision}. Note: ${decisionNote}`,
        confidence: 100,
        reviewer_id: user?.id,
        explanation: { decision, note: decisionNote, approval_id: approvalId }
      });

      toast.success(`Request ${decision}`, {
        description: `Action has been ${decision} and logged to the decision ledger`
      });

      setSelectedApproval(null);
      setDecisionNote("");
    } catch (error) {
      console.error("Error processing decision:", error);
      toast.error("Failed to process decision");
    } finally {
      setIsProcessing(false);
    }
  };

  const getDivisionColor = (division: string) => {
    const colors: Record<string, string> = {
      health: "bg-destructive/20 text-destructive",
      food: "bg-warning/20 text-warning",
      energy: "bg-warning/20 text-warning",
      finance: "bg-success/20 text-success",
      security: "bg-destructive/20 text-destructive",
      governance: "bg-primary/20 text-primary",
      crisis: "bg-destructive/20 text-destructive"
    };
    return colors[division] || "bg-muted text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      {/* Governance Roles Overview */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Human-in-the-Loop Governance
            <Badge variant="outline" className="ml-2 text-xs">
              Decision Authority
            </Badge>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            AICIS is decision intelligence, not decision authority — humans remain in control
          </p>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {GOVERNANCE_ROLES.map((role) => (
              <div 
                key={role.id}
                className={cn("p-3 rounded-lg", role.color)}
              >
                <h4 className="font-semibold text-sm mb-1">{role.label}</h4>
                <p className="text-xs opacity-80">{role.description}</p>
              </div>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Decision Flow Diagram */}
          <div className="p-4 bg-muted/30 rounded-lg mb-4">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Gavel className="h-4 w-4" />
              Decision Flow
            </h4>
            <div className="flex items-center justify-between flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">1. AI Analysis</Badge>
                <span className="text-muted-foreground">→</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">2. Analyst Review</Badge>
                <span className="text-muted-foreground">→</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">3. Policy Approval</Badge>
                <span className="text-muted-foreground">→</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">4. Executive Sign-off</Badge>
                <span className="text-muted-foreground">→</span>
              </div>
              <Badge className="bg-success text-success-foreground">5. Action</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      <Card className="border-warning/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Pending Approvals
            {pendingApprovals.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingApprovals.length}
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Actions awaiting human review and authorization
          </p>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-success" />
              <p>No pending approvals</p>
              <p className="text-sm">All actions have been reviewed</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {pendingApprovals.map((approval) => (
                  <Dialog key={approval.id}>
                    <DialogTrigger asChild>
                      <div 
                        className="p-4 border rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedApproval(approval)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={getDivisionColor(approval.division)}>
                                {approval.division}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </Badge>
                            </div>
                            <p className="font-medium">{approval.action}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Requested {approval.created_at && format(new Date(approval.created_at), "MMM d, HH:mm")}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-success border-success">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive border-destructive">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DialogTrigger>

                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Gavel className="h-5 w-5" />
                          Review & Approve
                        </DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div className="p-4 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getDivisionColor(approval.division)}>
                              {approval.division}
                            </Badge>
                          </div>
                          <h4 className="font-semibold">{approval.action}</h4>
                          <p className="text-sm text-muted-foreground mt-2">
                            Requested {approval.created_at && format(new Date(approval.created_at), "PPpp")}
                          </p>
                        </div>

                        {approval.payload && (
                          <div className="p-3 bg-muted/20 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">
                              <FileText className="h-3 w-3 inline mr-1" />
                              Request Details
                            </p>
                            <pre className="text-xs overflow-auto max-h-32">
                              {JSON.stringify(approval.payload, null, 2)}
                            </pre>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Decision Note</label>
                          <Textarea
                            value={decisionNote}
                            onChange={(e) => setDecisionNote(e.target.value)}
                            placeholder="Add a note explaining your decision..."
                            rows={3}
                          />
                        </div>

                        <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium">Accountability Notice</p>
                              <p className="text-xs text-muted-foreground">
                                Your decision will be logged to the immutable ledger with your identity and timestamp.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <DialogFooter className="gap-2">
                        <Button
                          variant="outline"
                          className="text-destructive border-destructive"
                          onClick={() => handleDecision(approval.id, "rejected")}
                          disabled={isProcessing}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          className="bg-success hover:bg-success/90"
                          onClick={() => handleDecision(approval.id, "approved")}
                          disabled={isProcessing}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Governance Principles */}
      <Card className="border-success/30 bg-success/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-success" />
            Core Governance Principles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-success mt-0.5" />
              <div>
                <h5 className="font-semibold">Transparency</h5>
                <p className="text-sm text-muted-foreground">
                  Every AI recommendation is explainable and auditable
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserCheck className="h-5 w-5 text-success mt-0.5" />
              <div>
                <h5 className="font-semibold">Human Authority</h5>
                <p className="text-sm text-muted-foreground">
                  AI advises, humans decide — always
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-success mt-0.5" />
              <div>
                <h5 className="font-semibold">Accountability</h5>
                <p className="text-sm text-muted-foreground">
                  All decisions logged with identity and rationale
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
