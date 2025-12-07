import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Radio, Zap, AlertTriangle, Globe, Heart, Shield,
  Utensils, CloudRain, Building2, Plane, DollarSign
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
  if (source.toLowerCase().includes("climate")) return CloudRain;
  if (source.toLowerCase().includes("security")) return Shield;
  if (source.toLowerCase().includes("finance")) return DollarSign;
  if (source.toLowerCase().includes("governance")) return Building2;
  return Globe;
};

export const DataStreamPanel = () => {
  const [events, setEvents] = useState<DataEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecentEvents = async () => {
      const [alertsRes, logsRes, incidentsRes] = await Promise.all([
        supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("data_source_log").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("security_incidents").select("*").order("detected_at", { ascending: false }).limit(5),
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
        const sev: "critical" | "warning" | "info" = (incident.severity || 0) > 70 ? "critical" : "warning";
        allEvents.push({
          id: `incident-${incident.id}`,
          timestamp: new Date(incident.created_at || new Date()),
          type: "crisis",
          source: "Security",
          message: incident.event_type || "Security incident detected",
          severity: sev,
          country: incident.country || undefined,
        });
      });

      // Sort by timestamp descending
      allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setEvents(allEvents.slice(0, 20));
      setEventCount(allEvents.length);
    };

    fetchRecentEvents();

    // Real-time subscription
    const channel = supabase
      .channel("data-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, (payload) => {
        if (!isPaused) {
          const alert = payload.new as any;
          const newEvent: DataEvent = {
            id: `alert-${alert.id}`,
            timestamp: new Date(alert.created_at || new Date()),
            type: "alert",
            source: alert.division,
            message: alert.title,
            severity: alert.severity === "critical" ? "critical" : "warning",
            country: alert.country || undefined,
          };
          setEvents(prev => [newEvent, ...prev].slice(0, 20));
          setEventCount(c => c + 1);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "security_incidents" }, (payload) => {
        if (!isPaused) {
          const incident = payload.new as any;
          const newEvent: DataEvent = {
            id: `incident-${incident.id}`,
            timestamp: new Date(),
            type: "crisis",
            source: "Security",
            message: incident.event_type || "New security incident",
            severity: "critical",
            country: incident.country,
          };
          setEvents(prev => [newEvent, ...prev].slice(0, 20));
          setEventCount(c => c + 1);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPaused]);

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
