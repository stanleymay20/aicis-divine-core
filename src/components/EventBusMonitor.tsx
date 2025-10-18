import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Radio, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IntelEvent {
  id: string;
  division: string;
  event_type: string;
  severity: string;
  title: string;
  description: string | null;
  published_at: string;
}

export const EventBusMonitor = () => {
  const { toast } = useToast();
  const [events, setEvents] = useState<IntelEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Load initial events
    const loadEvents = async () => {
      const { data } = await supabase
        .from('intel_events')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(20);
      
      if (data) {
        setEvents(data);
      }
    };

    loadEvents();

    // Subscribe to realtime events
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
          console.log('New intel event:', payload);
          const newEvent = payload.new as IntelEvent;
          
          setEvents((prev) => [newEvent, ...prev].slice(0, 20));
          
          // Show toast for critical/emergency events
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
        console.log('Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, any> = {
      info: "outline",
      warning: "secondary",
      critical: "destructive",
      emergency: "destructive",
    };
    return <Badge variant={variants[severity] || "outline"}>{severity}</Badge>;
  };

  const getDivisionColor = (division: string) => {
    const colors: Record<string, string> = {
      finance: "text-green-500",
      energy: "text-yellow-500",
      health: "text-red-500",
      food: "text-orange-500",
      governance: "text-blue-500",
      defense: "text-purple-500",
      diplomacy: "text-cyan-500",
      crisis: "text-pink-500",
      system: "text-gray-500",
    };
    return colors[division] || "text-gray-500";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={`h-5 w-5 ${isConnected ? 'text-green-500 animate-pulse' : 'text-gray-500'}`} />
            <CardTitle>Inter-Division Event Bus</CardTitle>
          </div>
          {isConnected ? (
            <Badge variant="outline" className="text-green-500 border-green-500">
              ● LIVE
            </Badge>
          ) : (
            <Badge variant="outline" className="text-gray-500">
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