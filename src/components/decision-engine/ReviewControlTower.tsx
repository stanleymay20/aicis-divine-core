import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Clock, AlertTriangle, CheckCircle, XCircle,
  FileWarning, ChevronDown, ChevronUp, Timer, BarChart3
} from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ReviewRecord {
  id: string;
  signal_title: string;
  action_type: string | null;
  domain: string | null;
  review_status: string | null;
  reviewer_name: string | null;
  reviewer_role: string | null;
  assigned_reviewer: string | null;
  review_due_at: string | null;
  review_sla_hours: number | null;
  review_completed_at: string | null;
  override_reason: string | null;
  postmortem_note: string | null;
  recommendation_accepted: boolean | null;
  outcome_success: boolean | null;
  impact_score: number | null;
  evidence_type: string | null;
  created_at: string | null;
}

interface ReviewHistoryEntry {
  id: string;
  decision_id: string;
  changed_by: string | null;
  changed_role: string | null;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  note: string | null;
}

type FilterTab = "all" | "pending" | "overdue" | "approved" | "rejected" | "overridden" | "missing_postmortem";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pending", variant: "outline" },
  reviewed: { label: "Reviewed", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  overridden: { label: "Overridden", variant: "destructive" },
};

function getSlaStatus(record: ReviewRecord): { overdue: boolean; hoursRemaining: number | null; label: string } {
  if (!record.review_due_at) return { overdue: false, hoursRemaining: null, label: "No SLA" };
  if (record.review_status && ["approved", "rejected", "overridden"].includes(record.review_status)) {
    return { overdue: false, hoursRemaining: null, label: "Completed" };
  }
  const now = Date.now();
  const due = new Date(record.review_due_at).getTime();
  const remaining = Math.round((due - now) / 3600000);
  if (remaining < 0) return { overdue: true, hoursRemaining: remaining, label: `${Math.abs(remaining)}h overdue` };
  return { overdue: false, hoursRemaining: remaining, label: `${remaining}h remaining` };
}

export default function ReviewControlTower() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: records = [] } = useQuery<ReviewRecord[]>({
    queryKey: ["review-tower-records"],
    queryFn: async () => {
      const { data } = await supabase
        .from("decision_outcome_log")
        .select("id, signal_title, action_type, domain, review_status, reviewer_name, reviewer_role, assigned_reviewer, review_due_at, review_sla_hours, review_completed_at, override_reason, postmortem_note, recommendation_accepted, outcome_success, impact_score, evidence_type, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return (data as any) || [];
    },
    staleTime: 30_000,
  });

  const { data: historyMap = {} } = useQuery<Record<string, ReviewHistoryEntry[]>>({
    queryKey: ["review-history-all"],
    queryFn: async () => {
      const ids = records.map(r => r.id);
      if (!ids.length) return {};
      const { data } = await supabase
        .from("decision_review_history")
        .select("*")
        .in("decision_id", ids)
        .order("changed_at", { ascending: true });
      const map: Record<string, ReviewHistoryEntry[]> = {};
      ((data as any) || []).forEach((h: ReviewHistoryEntry) => {
        if (!map[h.decision_id]) map[h.decision_id] = [];
        map[h.decision_id].push(h);
      });
      return map;
    },
    enabled: records.length > 0,
    staleTime: 30_000,
  });

  // Compute filtered lists
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now - 7 * 86400000);

  const pendingRecords = records.filter(r => !r.review_status || r.review_status === "pending");
  const overdueRecords = records.filter(r => {
    if (r.review_status && ["approved", "rejected", "overridden"].includes(r.review_status)) return false;
    return r.review_due_at && new Date(r.review_due_at).getTime() < now;
  });
  const approvedToday = records.filter(r => r.review_status === "approved" && r.review_completed_at && new Date(r.review_completed_at) >= todayStart);
  const overriddenWeek = records.filter(r => r.review_status === "overridden" && r.review_completed_at && new Date(r.review_completed_at) >= weekAgo);
  const missingPostmortem = records.filter(r => 
    r.recommendation_accepted === true && r.outcome_success === false && !r.postmortem_note
  );
  const rejectedRecords = records.filter(r => r.review_status === "rejected");

  const getFilteredRecords = (): ReviewRecord[] => {
    switch (activeTab) {
      case "pending": return pendingRecords;
      case "overdue": return overdueRecords;
      case "approved": return approvedToday;
      case "rejected": return rejectedRecords;
      case "overridden": return overriddenWeek;
      case "missing_postmortem": return missingPostmortem;
      default: return records;
    }
  };

  // Governance KPIs
  const totalWithReview = records.filter(r => r.review_status && r.review_status !== "pending").length;
  const reviewCompletionRate = records.length > 0 ? Math.round((totalWithReview / records.length) * 100) : 0;
  const overdueRate = records.length > 0 ? Math.round((overdueRecords.length / records.length) * 100) : 0;
  const overrideRate = totalWithReview > 0 ? Math.round((records.filter(r => r.review_status === "overridden").length / totalWithReview) * 100) : 0;
  const failedAccepted = records.filter(r => r.recommendation_accepted && r.outcome_success === false);
  const postmortemRate = failedAccepted.length > 0 ? Math.round((failedAccepted.filter(r => !!r.postmortem_note).length / failedAccepted.length) * 100) : 100;

  const completedReviews = records.filter(r => r.review_completed_at && r.created_at);
  const medianReviewHours = (() => {
    if (!completedReviews.length) return null;
    const hours = completedReviews.map(r =>
      Math.round((new Date(r.review_completed_at!).getTime() - new Date(r.created_at!).getTime()) / 3600000)
    ).sort((a, b) => a - b);
    return hours[Math.floor(hours.length / 2)];
  })();

  const filtered = getFilteredRecords();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-primary" /> Review Control Tower
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <KpiBox label="Pending" value={pendingRecords.length} />
          <KpiBox label="Overdue" value={overdueRecords.length} destructive={overdueRecords.length > 0} />
          <KpiBox label="Approved Today" value={approvedToday.length} />
          <KpiBox label="Overridden (7d)" value={overriddenWeek.length} destructive={overriddenWeek.length > 0} />
          <KpiBox label="Missing Postmortem" value={missingPostmortem.length} destructive={missingPostmortem.length > 0} />
          <KpiBox label="Review Rate" value={`${reviewCompletionRate}%`} />
        </div>

        {/* Governance Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          <MetricBox label="Overdue Rate" value={`${overdueRate}%`} warn={overdueRate > 20} />
          <MetricBox label="Override Rate" value={`${overrideRate}%`} warn={overrideRate > 15} />
          <MetricBox label="Postmortem Rate" value={`${postmortemRate}%`} warn={postmortemRate < 80} />
          <MetricBox label="Median Review" value={medianReviewHours != null ? `${medianReviewHours}h` : "—"} />
          <MetricBox label="Total Decisions" value={records.length} />
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
          <TabsList className="w-full flex-wrap h-auto gap-1">
            <TabsTrigger value="all" className="text-xs">All ({records.length})</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs">Pending ({pendingRecords.length})</TabsTrigger>
            <TabsTrigger value="overdue" className="text-xs">Overdue ({overdueRecords.length})</TabsTrigger>
            <TabsTrigger value="approved" className="text-xs">Approved ({approvedToday.length})</TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">Rejected ({rejectedRecords.length})</TabsTrigger>
            <TabsTrigger value="overridden" className="text-xs">Overridden ({overriddenWeek.length})</TabsTrigger>
            <TabsTrigger value="missing_postmortem" className="text-xs">
              <FileWarning className="h-3 w-3 mr-0.5" />Missing PM ({missingPostmortem.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-3 space-y-2">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No records in this category.</p>
            ) : (
              filtered.map(rec => {
                const sla = getSlaStatus(rec);
                const sc = statusConfig[rec.review_status || "pending"] || statusConfig.pending;
                const history = historyMap[rec.id] || [];
                const isOpen = expandedId === rec.id;

                return (
                  <Collapsible key={rec.id} open={isOpen} onOpenChange={() => setExpandedId(isOpen ? null : rec.id)}>
                    <div className={`border rounded overflow-hidden ${sla.overdue ? "border-destructive/50 bg-destructive/5" : "border-border"}`}>
                      <CollapsibleTrigger className="w-full text-left">
                        <div className="flex items-center gap-2 p-2.5 hover:bg-muted/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">
                              {rec.signal_title || rec.action_type?.replace(/_/g, " ") || "Untitled"}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {rec.domain && <Badge variant="outline" className="text-[9px] h-4">{rec.domain}</Badge>}
                              <Badge variant={sc.variant} className="text-[9px] h-4">{sc.label}</Badge>
                              {sla.overdue && (
                                <Badge variant="destructive" className="text-[9px] h-4">
                                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />{sla.label}
                                </Badge>
                              )}
                              {!sla.overdue && sla.hoursRemaining != null && (
                                <Badge variant="outline" className="text-[9px] h-4">
                                  <Timer className="h-2.5 w-2.5 mr-0.5" />{sla.label}
                                </Badge>
                              )}
                              {rec.recommendation_accepted === true && rec.outcome_success === false && !rec.postmortem_note && (
                                <Badge variant="destructive" className="text-[9px] h-4">
                                  <FileWarning className="h-2.5 w-2.5 mr-0.5" />Needs postmortem
                                </Badge>
                              )}
                            </div>
                          </div>
                          {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="border-t border-border p-3 space-y-3 bg-muted/10">
                          {/* Decision details */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                            <div>
                              <span className="text-muted-foreground">Assigned to</span>
                              <p className="font-medium">{rec.assigned_reviewer || "Unassigned"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">SLA</span>
                              <p className="font-medium">{rec.review_sla_hours ? `${rec.review_sla_hours}h` : "—"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Reviewer</span>
                              <p className="font-medium">{rec.reviewer_name || "—"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Completed</span>
                              <p className="font-medium">{rec.review_completed_at ? new Date(rec.review_completed_at).toLocaleDateString() : "—"}</p>
                            </div>
                          </div>

                          {/* Acceptance / Outcome */}
                          <div className="flex gap-2 flex-wrap text-[10px]">
                            {rec.recommendation_accepted === true && <Badge variant="default" className="text-[9px] h-4"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Accepted</Badge>}
                            {rec.recommendation_accepted === false && <Badge variant="destructive" className="text-[9px] h-4"><XCircle className="h-2.5 w-2.5 mr-0.5" />Rejected</Badge>}
                            {rec.outcome_success === true && <Badge variant="default" className="text-[9px] h-4"><BarChart3 className="h-2.5 w-2.5 mr-0.5" />Success</Badge>}
                            {rec.outcome_success === false && <Badge variant="destructive" className="text-[9px] h-4"><BarChart3 className="h-2.5 w-2.5 mr-0.5" />Failed</Badge>}
                            {rec.impact_score != null && <span className="text-muted-foreground">Impact: {rec.impact_score}</span>}
                          </div>

                          {/* Override / Postmortem notes */}
                          {rec.override_reason && (
                            <div className="text-[10px]">
                              <span className="text-muted-foreground font-medium">Override reason: </span>
                              <span>{rec.override_reason}</span>
                            </div>
                          )}
                          {rec.postmortem_note && (
                            <div className="text-[10px]">
                              <span className="text-muted-foreground font-medium">Postmortem: </span>
                              <span>{rec.postmortem_note}</span>
                            </div>
                          )}

                          {/* Review History */}
                          {history.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1">Review History</p>
                              <div className="space-y-1 border-l-2 border-border pl-2">
                                {history.map(h => (
                                  <div key={h.id} className="text-[10px]">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-muted-foreground">{new Date(h.changed_at).toLocaleString()}</span>
                                      <span className="font-medium">{h.from_status || "—"} → {h.to_status}</span>
                                      {h.changed_by && <span className="text-muted-foreground">by {h.changed_by}</span>}
                                    </div>
                                    {h.note && <p className="text-muted-foreground ml-2">"{h.note}"</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <p className="text-[9px] text-muted-foreground">
                            Created: {rec.created_at ? new Date(rec.created_at).toLocaleString() : "—"} · ID: {rec.id.slice(0, 8)}
                          </p>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function KpiBox({ label, value, destructive }: { label: string; value: number | string; destructive?: boolean }) {
  return (
    <div className={`p-2 rounded text-center ${destructive ? "bg-destructive/10 border border-destructive/20" : "bg-muted/30"}`}>
      <p className={`text-sm font-bold ${destructive ? "text-destructive" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

function MetricBox({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className="p-1.5 rounded bg-muted/20">
      <p className={`text-xs font-bold ${warn ? "text-destructive" : ""}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
