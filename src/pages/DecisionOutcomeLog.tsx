import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardCheck, CheckCircle2, Clock, AlertTriangle, Target, Zap } from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Open — Awaiting Confirmation", variant: "outline" },
  confirmed: { label: "Event Confirmed", variant: "default" },
  missed: { label: "Signal Missed", variant: "destructive" },
  expired: { label: "Window Expired", variant: "secondary" },
};

const DecisionOutcomeLog = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

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

  const confirmed = entries?.filter((e: any) => e.status === "confirmed") || [];
  const open = entries?.filter((e: any) => e.status === "open") || [];

  return (
    <AICISLayout>
      <div className="space-y-6 p-4 md:p-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-orbitron font-bold flex items-center gap-3">
            <ClipboardCheck className="h-7 w-7 text-primary" />
            Decision Outcome Log
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tracking the path from signal detection → recommended action → real-world confirmation → decision value
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-orbitron font-bold">{entries?.length || 0}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Total Signals Logged</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-orbitron font-bold text-success">{confirmed.length}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Events Confirmed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-orbitron font-bold text-warning">{open.length}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Awaiting Confirmation</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-orbitron font-bold text-primary">
                {entries?.length ? Math.round((confirmed.length / entries.length) * 100) : 0}%
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Confirmation Rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Context */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Purpose:</strong> This log tracks whether AICIS signals translate into
            real-world decision value. Each entry records: the signal raised, the recommended action window,
            whether reality confirmed the signal, and the hypothetical (or actual) decision impact.
            This is how AICIS moves from "intelligence signal" to "decision-support product."
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : entries && entries.length > 0 ? (
          <div className="space-y-4">
            {entries.map((entry: any) => {
              const sc = statusConfig[entry.status] || statusConfig.open;
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
                      <Badge variant={sc.variant} className="text-[10px]">{sc.label}</Badge>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {entry.iso3 && <Badge variant="outline" className="text-[10px]">{entry.iso3}</Badge>}
                      {entry.domain && <Badge variant="outline" className="text-[10px]">{entry.domain}</Badge>}
                      {entry.signal_direction && (
                        <Badge variant="secondary" className="text-[10px]">Direction: {entry.signal_direction}</Badge>
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

                    {/* Recommended action */}
                    {entry.recommended_action && (
                      <div className="border border-border/30 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                          <Target className="h-3 w-3" /> Recommended Action
                        </p>
                        <p className="text-muted-foreground">{entry.recommended_action}</p>
                      </div>
                    )}

                    {/* Event description */}
                    {entry.event_description && (
                      <div className="border border-success/20 bg-success/5 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-success" /> What Actually Happened
                        </p>
                        <p className="text-muted-foreground">{entry.event_description}</p>
                      </div>
                    )}

                    {/* Decision value */}
                    {entry.hypothetical_decision_value && (
                      <div className="border border-primary/20 bg-primary/5 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                          <Zap className="h-3 w-3 text-primary" /> Decision Value
                        </p>
                        <p className="text-muted-foreground">{entry.hypothetical_decision_value}</p>
                      </div>
                    )}

                    {/* Pilot action if exists */}
                    {entry.pilot_action_taken && (
                      <div className="border border-warning/20 bg-warning/5 rounded-lg p-2.5">
                        <p className="text-[10px] text-muted-foreground mb-1 font-medium">Pilot Action Taken</p>
                        <p className="text-muted-foreground">{entry.pilot_action_taken}</p>
                        {entry.pilot_outcome && <p className="text-muted-foreground mt-1">Outcome: {entry.pilot_outcome}</p>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No decision outcomes logged yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Entries are added when validated signals are mapped to decision windows.</p>
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
              Decision values shown as "hypothetical" are analytical estimates of what earlier action could achieve —
              not measured outcomes. As pilot partnerships are established, this log will include actual decision
              actions and measured impact. Both hits and misses are recorded.
            </p>
          </CardContent>
        </Card>
      </div>
    </AICISLayout>
  );
};

export default DecisionOutcomeLog;
