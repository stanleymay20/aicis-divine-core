import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ClipboardCheck, CheckCircle2, Clock, AlertTriangle, Target, Zap, FlaskConical, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import EvidenceFilter from "@/components/decision-log/EvidenceFilter";
import PilotRecordForm from "@/components/decision-log/PilotRecordForm";
import ImpactScoringDoctrine from "@/components/decision-log/ImpactScoringDoctrine";
import ProofMaturitySummary from "@/components/decision-log/ProofMaturitySummary";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Awaiting Confirmation", variant: "outline" },
  confirmed: { label: "Event Confirmed", variant: "default" },
  missed: { label: "Signal Missed", variant: "destructive" },
  expired: { label: "Window Expired", variant: "secondary" },
};

const evidenceBadge: Record<string, { label: string; className: string }> = {
  hypothetical: { label: "Hypothetical", className: "bg-muted text-muted-foreground" },
  pilot: { label: "Pilot", className: "bg-accent/20 text-accent-foreground" },
  measured: { label: "Measured", className: "bg-success/20 text-success" },
};

const DecisionOutcomeLog = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["decision-outcome-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("decision_outcome_log")
        .select("*")
        .order("signal_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  if (authLoading || !user) return null;

  const counts = {
    all: entries?.length || 0,
    hypothetical: entries?.filter((e: any) => (e.evidence_type || "hypothetical") === "hypothetical").length || 0,
    pilot: entries?.filter((e: any) => e.evidence_type === "pilot").length || 0,
    measured: entries?.filter((e: any) => e.evidence_type === "measured").length || 0,
  };

  const filtered = filter === "all"
    ? entries
    : entries?.filter((e: any) => (e.evidence_type || "hypothetical") === filter);

  const confirmed = entries?.filter((e: any) => e.status === "confirmed") || [];
  const withPilot = entries?.filter((e: any) => e.pilot_action_taken) || [];

  return (
    <AICISLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-orbitron font-bold flex items-center gap-3">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            Decision Outcome Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Signal → recommended action → real-world confirmation → decision value
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { value: counts.all, label: "Total Signals", color: "" },
            { value: confirmed.length, label: "Confirmed", color: "text-success" },
            { value: counts.pilot, label: "Pilot Actions", color: "text-accent-foreground" },
            { value: counts.measured, label: "Measured", color: "text-primary" },
            { value: counts.all ? Math.round((confirmed.length / counts.all) * 100) : 0, label: "Confirmation %", color: "text-primary", suffix: "%" },
          ].map((s, i) => (
            <Card key={i}>
              <CardContent className="p-3 text-center">
                <p className={`text-xl font-orbitron font-bold ${s.color}`}>{s.value}{s.suffix || ""}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Evidence filter + proof maturity */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
          <EvidenceFilter activeFilter={filter} onFilterChange={setFilter} counts={counts} />
          <ProofMaturitySummary hypothetical={counts.hypothetical} pilot={counts.pilot} measured={counts.measured} />
        </div>

        {/* Impact scoring doctrine */}
        <ImpactScoringDoctrine />

        {/* Context */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Purpose:</strong> This log tracks whether AICIS signals translate into
            real-world decision value. Filter by evidence type: <strong>Hypothetical</strong> (analytical estimates),
            <strong> Pilot</strong> (actions recorded by partners), or <strong>Measured</strong> (verified outcomes with impact scores).
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered && filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((entry: any) => {
              const sc = statusConfig[entry.status] || statusConfig.open;
              const eb = evidenceBadge[entry.evidence_type || "hypothetical"] || evidenceBadge.hypothetical;

              if (editingId === entry.id) {
                return <PilotRecordForm key={entry.id} entry={entry} onClose={() => setEditingId(null)} />;
              }

              return (
                <Card key={entry.id} className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {entry.status === "confirmed" ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Clock className="h-4 w-4 text-warning" />
                        )}
                        <span className="font-mono text-muted-foreground text-xs">{entry.signal_id}</span>
                        {entry.signal_title}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${eb.className}`}>{eb.label}</span>
                        <Badge variant={sc.variant} className="text-[10px]">{sc.label}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {entry.iso3 && <Badge variant="outline" className="text-[10px]">{entry.iso3}</Badge>}
                      {entry.domain && <Badge variant="outline" className="text-[10px]">{entry.domain}</Badge>}
                      {entry.pilot_partner && (
                        <Badge variant="secondary" className="text-[10px]">
                          <FlaskConical className="h-2.5 w-2.5 mr-1" />
                          {entry.pilot_partner}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    {/* Timeline */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="bg-muted/30 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium">Signal Raised</p>
                        <p className="font-medium">{entry.signal_date ? format(new Date(entry.signal_date), "MMM d, yyyy") : "—"}</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium">Action Window</p>
                        <p className="font-medium">{entry.action_window_days || 7} days</p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium">Event Confirmed</p>
                        <p className="font-medium">
                          {entry.event_confirmed_date ? format(new Date(entry.event_confirmed_date), "MMM d, yyyy") : "Pending"}
                        </p>
                      </div>
                    </div>

                    {entry.recommended_action && (
                      <div className="border border-border/30 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                          <Target className="h-3 w-3" /> Recommended Action
                        </p>
                        <p className="text-muted-foreground">{entry.recommended_action}</p>
                      </div>
                    )}

                    {entry.event_description && (
                      <div className="border border-success/20 bg-success/5 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-success" /> What Actually Happened
                        </p>
                        <p className="text-muted-foreground">{entry.event_description}</p>
                      </div>
                    )}

                    {entry.hypothetical_decision_value && (
                      <div className="border border-primary/20 bg-primary/5 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                          <Zap className="h-3 w-3 text-primary" /> Decision Value
                        </p>
                        <p className="text-muted-foreground">{entry.hypothetical_decision_value}</p>
                      </div>
                    )}

                    {entry.pilot_action_taken && (
                      <div className="border border-accent/20 bg-accent/5 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                          <FlaskConical className="h-3 w-3" /> Pilot Action
                        </p>
                        <p className="text-muted-foreground">{entry.pilot_action_taken}</p>
                        {entry.pilot_outcome && <p className="text-muted-foreground mt-1">→ {entry.pilot_outcome}</p>}
                      </div>
                    )}

                    {entry.measured_outcome && (
                      <div className="border border-success/20 bg-success/5 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                          <BarChart3 className="h-3 w-3 text-success" /> Measured Outcome
                        </p>
                        <p className="text-muted-foreground">{entry.measured_outcome}</p>
                        {entry.measured_impact_score != null && (
                          <p className="text-success font-medium mt-1">Impact Score: {entry.measured_impact_score}/100</p>
                        )}
                      </div>
                    )}

                    {/* Record pilot action button */}
                    <div className="pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setEditingId(entry.id)}
                      >
                        <FlaskConical className="h-3 w-3 mr-1" />
                        {entry.pilot_action_taken ? "Update Pilot Record" : "Record Pilot Action"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {filter === "all" ? "No decision outcomes logged yet." : `No ${filter} entries yet.`}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Transparency */}
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="p-4 text-xs text-muted-foreground">
            <strong className="text-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Transparency Note
            </strong>
            <p className="mt-1">
              Entries are classified by evidence type: <strong>Hypothetical</strong> values are analytical estimates.
              <strong> Pilot</strong> entries record actions taken by institutional partners.
              <strong> Measured</strong> entries have verified outcomes with quantified impact.
              Both hits and misses are recorded.
            </p>
          </CardContent>
        </Card>
      </div>
    </AICISLayout>
  );
};

export default DecisionOutcomeLog;
