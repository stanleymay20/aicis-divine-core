import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Radio, Zap, AlertTriangle, Globe, Heart, Shield,
  Utensils, CloudRain, Building2, Plane, DollarSign, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface DataEvent {
  id: string;
  timestamp: Date;
  type: "alert" | "data" | "crisis" | "update" | "intel";
  source: string;
  message: string;
  severity: "info" | "warning" | "critical";
  country?: string;
}

const getEventIcon = (source: string) => {
  if (source.toLowerCase().includes("health")) return Heart;
  if (source.toLowerCase().includes("energy")) return Zap;
  if (source.toLowerCase().includes("food")) return Utensils;
  if (source.toLowerCase().includes("climate") || source.toLowerCase().includes("weather")) return CloudRain;
  if (source.toLowerCase().includes("security") || source.toLowerCase().includes("defense")) return Shield;
  if (source.toLowerCase().includes("finance")) return DollarSign;
  if (source.toLowerCase().includes("governance") || source.toLowerCase().includes("diplomacy")) return Building2;
  if (source.toLowerCase().includes("crisis")) return AlertTriangle;
  return Globe;
};

export const DataStreamPanel = () => {
  const [events, setEvents] = useState<DataEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchRecentEvents = useCallback(async () => {
    const [alertsRes, logsRes, incidentsRes, intelRes, crisisRes] = await Promise.all([
      supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(10),
      supabase.from("data_source_log").select("*").order("created_at", { ascending: false }).limit(5),
      supabase.from("security_incidents").select("*").order("detected_at", { ascending: false }).limit(5),
      supabase.from("intel_events").select("*").order("published_at", { ascending: false }).limit(10),
      supabase.from("crisis_events").select("*").order("opened_at", { ascending: false }).limit(5),
    ]);

    const allEvents: DataEvent[] = [];

    (alertsRes.data || []).forEach(alert => {
      allEvents.push({
        id: `alert-${alert.id}`,
        timestamp: new Date(alert.created_at || new Date()),
        type: "alert",
        source: alert.division,
        message: alert.title,
        severity: alert.severity === "critical" ? "critical" : alert.severity === "high" ? "warning" : "info",
        country: alert.country || undefined,
      });
    });

    (logsRes.data || []).forEach(log => {
      allEvents.push({
        id: `log-${log.id}`,
        timestamp: new Date(log.created_at || new Date()),
        type: "data",
        source: log.source,
        message: `Ingested ${log.records_ingested} records from ${log.source}`,
        severity: log.status === "success" ? "info" : "warning",
      });
    });

    (incidentsRes.data || []).forEach(incident => {
      const severityNum = typeof incident.severity === 'number' ? incident.severity : 0;
      const sev: "critical" | "warning" | "info" = severityNum >= 7 ? "critical" : "warning";
      allEvents.push({
        id: `incident-${incident.id}`,
        timestamp: new Date(incident.start_time || incident.created_at || new Date()),
        type: "crisis",
        source: "Security",
        message: incident.title || incident.summary?.slice(0, 100) || incident.event_type || "Security incident",
        severity: sev,
        country: incident.country || undefined,
      });
    });

    (intelRes.data || []).forEach(intel => {
      allEvents.push({
        id: `intel-${intel.id}`,
        timestamp: new Date(intel.published_at || new Date()),
        type: "intel",
        source: intel.division,
        message: intel.title,
        severity: intel.severity === "critical" || intel.severity === "emergency" ? "critical" : 
                 intel.severity === "warning" ? "warning" : "info",
        country: (intel.payload as Record<string, unknown>)?.country as string | undefined,
      });
    });

    (crisisRes.data || []).forEach(crisis => {
      allEvents.push({
        id: `crisis-${crisis.id}`,
        timestamp: new Date(crisis.opened_at || new Date()),
        type: "crisis",
        source: crisis.kind || "Crisis",
        message: `${crisis.kind}: ${crisis.region}`,
        severity: (crisis.severity || 0) >= 7 ? "critical" : "warning",
        country: crisis.region,
      });
    });

    // Sort by timestamp descending
    allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    setEvents(allEvents.slice(0, 25));
    setEventCount(allEvents.length);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Trigger live data fetch
      await supabase.functions.invoke("seed-live-data");
      await fetchRecentEvents();
    } catch (error) {
      console.error("Error refreshing data:", error);
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchRecentEvents();

    // Refresh every 2 minutes
    const refreshInterval = setInterval(fetchRecentEvents, 120000);

    // Real-time subscriptions
    const channel = supabase
      .channel("data-stream-full")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (payload) => {
        if (!isPaused) {
          const alert = payload.new as Record<string, unknown>;
          const newEvent: DataEvent = {
            id: `alert-${alert.id}`,
            timestamp: new Date((alert.created_at as string) || new Date().toISOString()),
            type: "alert",
            source: alert.division as string,
            message: alert.title as string,
            severity: alert.severity === "critical" ? "critical" : "warning",
            country: (alert.country as string) || undefined,
          };
          setEvents(prev => [newEvent, ...prev].slice(0, 25));
          setEventCount(c => c + 1);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "intel_events" }, (payload) => {
        if (!isPaused) {
          const intel = payload.new as Record<string, unknown>;
          const newEvent: DataEvent = {
            id: `intel-${intel.id}`,
            timestamp: new Date(),
            type: "intel",
            source: intel.division as string,
            message: intel.title as string,
            severity: intel.severity === "critical" || intel.severity === "emergency" ? "critical" : "warning",
            country: (intel.payload as Record<string, unknown>)?.country as string | undefined,
          };
          setEvents(prev => [newEvent, ...prev].slice(0, 25));
          setEventCount(c => c + 1);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crisis_events" }, (payload) => {
        if (!isPaused) {
          const crisis = payload.new as Record<string, unknown>;
          const newEvent: DataEvent = {
            id: `crisis-${crisis.id}`,
            timestamp: new Date(),
            type: "crisis",
            source: (crisis.kind as string) || "Crisis",
            message: `${crisis.kind}: ${crisis.region}`,
            severity: ((crisis.severity as number) || 0) >= 7 ? "critical" : "warning",
            country: crisis.region as string,
          };
          setEvents(prev => [newEvent, ...prev].slice(0, 25));
          setEventCount(c => c + 1);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "security_incidents" }, (payload) => {
        if (!isPaused) {
          const incident = payload.new as Record<string, unknown>;
          const newEvent: DataEvent = {
            id: `incident-${incident.id}`,
            timestamp: new Date(),
            type: "crisis",
            source: "Security",
            message: ((incident.description as string)?.slice(0, 100)) || (incident.incident_type as string) || "Security incident",
            severity: "critical",
            country: incident.country as string | undefined,
          };
          setEvents(prev => [newEvent, ...prev].slice(0, 25));
          setEventCount(c => c + 1);
        }
      })
      .subscribe();

    return () => {
      clearInterval(refreshInterval);
      supabase.removeChannel(channel);
    };
  }, [isPaused, fetchRecentEvents]);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const secs = Math.floor(diff / 1000);
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);

    if (secs < 60) return `${secs}s ago`;
    if (mins < 60) return `${mins}m ago`;
    return `${hours}h ago`;
  };

  return (
    <div className="absolute bottom-28 right-4 w-72 z-20">
      <div className="bg-card/90 backdrop-blur-xl border border-primary/20 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={cn(
              "h-3.5 w-3.5",
              isPaused ? "text-muted-foreground" : "text-success animate-pulse"
            )} />
            <span className="text-xs font-orbitron font-bold">LIVE FEED</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Refresh global data"
            >
              <RefreshCw className={cn(
                "h-3 w-3 text-muted-foreground",
                isRefreshing && "animate-spin text-primary"
              )} />
            </button>
            <Badge variant="outline" className="text-[10px] h-5">
              {eventCount} events
            </Badge>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full transition-colors",
                isPaused ? "bg-warning/20 text-warning" : "bg-success/20 text-success"
              )}
            >
              {isPaused ? "PAUSED" : "LIVE"}
            </button>
          </div>
        </div>

        {/* Events stream */}
        <ScrollArea className="h-48">
          <div className="p-2 space-y-1">
            {events.map((event, index) => {
              const Icon = getEventIcon(event.source);
              return (
                <div
                  key={event.id}
                  className={cn(
                    "p-2 rounded-lg border transition-all",
                    index === 0 && !isPaused && "animate-fade-in",
                    event.severity === "critical" && "bg-destructive/10 border-destructive/20",
                    event.severity === "warning" && "bg-warning/10 border-warning/20",
                    event.severity === "info" && "bg-muted/30 border-border/50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={cn(
                      "h-3.5 w-3.5 mt-0.5 shrink-0",
                      event.severity === "critical" && "text-destructive",
                      event.severity === "warning" && "text-warning",
                      event.severity === "info" && "text-muted-foreground"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs line-clamp-1">{event.message}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{event.source}</span>
                        {event.country && (
                          <>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-primary">{event.country}</span>
                          </>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
