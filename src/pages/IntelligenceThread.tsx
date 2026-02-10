/**
 * Intelligence Thread Page
 * Narrative backbone of AICIS — timeline of signals, evidence, and escalation history.
 */
import { useIntelligenceMemory } from "@/contexts/IntelligenceMemoryContext";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, CheckCircle, GitBranch, TrendingDown,
  Zap, Clock, Shield, Filter, Layers
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const SIGNAL_ICONS: Record<string, typeof AlertTriangle> = {
  cross_domain: GitBranch,
  confidence_drop: TrendingDown,
  scenario_divergence: Zap,
  escalation: AlertTriangle,
  anomaly_correlation: Layers,
};

const SEVERITY_STYLES: Record<string, string> = {
  low: "border-muted bg-muted/20",
  medium: "border-warning/40 bg-warning/5",
  high: "border-destructive/40 bg-destructive/5",
  critical: "border-destructive bg-destructive/10",
};

const SEVERITY_DOT: Record<string, string> = {
  low: "bg-muted-foreground",
  medium: "bg-warning",
  high: "bg-destructive",
  critical: "bg-destructive animate-pulse",
};

type FilterSeverity = "all" | "low" | "medium" | "high" | "critical";

const IntelligenceThread = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { signals, isLoading, acknowledgeSignal } = useIntelligenceMemory();
  const [filter, setFilter] = useState<FilterSeverity>("all");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  const filtered = filter === "all" ? signals : signals.filter(s => s.severity === filter);

  // Group by date
  const grouped = new Map<string, typeof signals>();
  filtered.forEach(s => {
    const day = new Date(s.created_at).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    const existing = grouped.get(day) || [];
    existing.push(s);
    grouped.set(day, existing);
  });

  const stats = {
    total: signals.length,
    active: signals.filter(s => !s.acknowledged).length,
    critical: signals.filter(s => s.severity === "critical" || s.severity === "high").length,
    domains: [...new Set(signals.flatMap(s => s.domains))].length,
  };

  return (
    <AICISLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-orbitron font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              Intelligence Thread
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cross-domain signal timeline — what AICIS detected, why, and how it evolved.
            </p>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Shield className="h-3 w-3" />
            Aggregate data only
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Signals", value: stats.total, icon: Layers },
            { label: "Active", value: stats.active, icon: AlertTriangle },
            { label: "High/Critical", value: stats.critical, icon: Zap },
            { label: "Domains Affected", value: stats.domains, icon: GitBranch },
          ].map(s => (
            <Card key={s.label} className="bg-card/50">
              <CardContent className="p-3 flex items-center gap-3">
                <s.icon className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-xl font-bold">{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Filter:</span>
          {(["all", "critical", "high", "medium", "low"] as FilterSeverity[]).map(f => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="text-xs h-7 capitalize"
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="bg-card/50">
            <CardContent className="p-8 text-center text-muted-foreground">
              <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No intelligence signals detected yet.</p>
              <p className="text-xs mt-1">Cross-domain detection runs automatically every 2 minutes.</p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="space-y-6">
              {[...grouped.entries()].map(([day, daySignals]) => (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{day}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <div className="space-y-3 pl-4 border-l-2 border-border ml-1">
                    {daySignals.map(signal => {
                      const Icon = SIGNAL_ICONS[signal.signal_type] || AlertTriangle;
                      return (
                        <div
                          key={signal.id}
                          className={cn(
                            "relative border rounded-lg p-4 transition-colors",
                            SEVERITY_STYLES[signal.severity]
                          )}
                        >
                          {/* Timeline dot */}
                          <div className={cn(
                            "absolute -left-[calc(1rem+5px)] top-5 w-2.5 h-2.5 rounded-full border-2 border-background",
                            SEVERITY_DOT[signal.severity]
                          )} />

                          <div className="flex items-start gap-3">
                            <Icon className={cn(
                              "h-5 w-5 mt-0.5 shrink-0",
                              signal.severity === "critical" ? "text-destructive" : "text-primary"
                            )} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-sm font-semibold">{signal.title}</span>
                                <Badge variant="outline" className="text-[9px] capitalize">{signal.signal_type.replace(/_/g, " ")}</Badge>
                                <Badge
                                  variant={signal.severity === "critical" ? "destructive" : "secondary"}
                                  className="text-[9px]"
                                >
                                  {signal.severity.toUpperCase()}
                                </Badge>
                                {signal.acknowledged && (
                                  <Badge variant="outline" className="text-[9px] text-success border-success/30">
                                    <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Acknowledged
                                  </Badge>
                                )}
                              </div>

                              <p className="text-xs text-muted-foreground">{signal.description}</p>

                              {/* Evidence */}
                              {signal.evidence && (signal.evidence as any[]).length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <span className="text-[10px] font-semibold text-muted-foreground">Evidence:</span>
                                  {(signal.evidence as any[]).slice(0, 4).map((ev, i) => (
                                    <div key={i} className="text-[10px] text-muted-foreground pl-2 border-l border-border">
                                      {ev.source}: {ev.detail}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {signal.escalation_reason && (
                                <div className="mt-2 text-[10px] text-warning italic">
                                  ⚡ Escalation: {signal.escalation_reason}
                                </div>
                              )}

                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <div className="flex gap-1">
                                  {signal.domains.map(d => (
                                    <Badge key={d} variant="outline" className="text-[8px]">{d}</Badge>
                                  ))}
                                </div>
                                {signal.countries.length > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    Countries: {signal.countries.join(", ")}
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                  Confidence: {signal.confidence}% •{" "}
                                  {new Date(signal.created_at).toLocaleTimeString()}
                                </span>
                              </div>
                            </div>

                            {!signal.acknowledged && (signal.severity === "critical" || signal.severity === "high") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 text-[10px] gap-1 h-7"
                                onClick={() => acknowledgeSignal(signal.id)}
                              >
                                <CheckCircle className="h-3 w-3" />
                                Ack
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground border-t border-border pt-3">
          <Shield className="h-3 w-3" />
          <span>All signals are advisory only. No autonomous action is taken. Human-in-the-loop governance enforced.</span>
        </div>
      </div>
    </AICISLayout>
  );
};

export default IntelligenceThread;
