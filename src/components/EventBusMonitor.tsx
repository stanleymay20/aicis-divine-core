import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Radio, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { 
  IntelEvent, 
  SeverityLevel, 
  DivisionKey, 
  BadgeVariant,
  SEVERITY_BADGE_VARIANTS,
  DIVISION_COLORS 
} from "@/types/aicis";

const severityVariants: Record<SeverityLevel, BadgeVariant> = {
  info: "outline",
  warning: "secondary",
  critical: "destructive",
  emergency: "destructive",
};

const divisionColors: Record<DivisionKey, string> = {
  finance: "text-success",
  energy: "text-warning",
  health: "text-destructive",
  food: "text-warning",
  governance: "text-primary",
  defense: "text-secondary",
  diplomacy: "text-accent-foreground",
  crisis: "text-destructive",
  system: "text-muted-foreground",
};

export const EventBusMonitor = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<IntelEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const loadEvents = async () => {
      const { data } = await supabase
        .from('intel_events')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(20);
      
      if (data) {
        setEvents(data as IntelEvent[]);
      }
    };

    loadEvents();

    const channel = supabase
      .channel('intel-events-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'intel_events'
        },
        (payload) => {
          const newEvent = payload.new as IntelEvent;
          
          setEvents((prev) => [newEvent, ...prev].slice(0, 20));
          
          if (newEvent.severity === 'critical' || newEvent.severity === 'emergency') {
            toast({
              title: `${newEvent.severity.toUpperCase()}: ${newEvent.division}`,
              description: newEvent.title,
              variant: "destructive",
            });
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const getSeverityBadge = (severity: string) => {
    const variant = severityVariants[severity as SeverityLevel] || "outline";
    return <Badge variant={variant}>{severity}</Badge>;
  };

  const getDivisionColor = (division: string) => {
    return divisionColors[division as DivisionKey] || "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={`h-5 w-5 ${isConnected ? 'text-success animate-pulse' : 'text-muted-foreground'}`} />
            <CardTitle>Inter-Division Event Bus</CardTitle>
          </div>
          {isConnected ? (
            <Badge variant="outline" className="text-success border-success">
              ● LIVE
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              ○ Connecting
            </Badge>
          )}
        </div>
        <CardDescription>
          Real-time intelligence events across all AICIS divisions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {events.length > 0 ? (
              events.map((event) => (
                <div 
                  key={event.id} 
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold capitalize ${getDivisionColor(event.division)}`}>
                        {event.division}
                      </span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-sm text-muted-foreground">{event.event_type}</span>
                    </div>
                    {getSeverityBadge(event.severity)}
                  </div>
                  <h4 className="font-medium text-sm mb-1">{event.title}</h4>
                  {event.description && (
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(event.published_at).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-12 space-y-2">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">No events yet. Waiting for intel...</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};