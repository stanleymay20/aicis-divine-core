import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { toast } from "sonner";

interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  division: string;
  country?: string;
  created_at: string;
  acknowledged: boolean;
}

export const AlertCenter = () => {
  const { data: alerts = [], refetch } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as Alert[];
    }
  });

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts'
        },
        (payload) => {
          const newAlert = payload.new as Alert;
          
          // Voice announcement for critical alerts
          if (newAlert.severity === 'critical') {
            const msg = new SpeechSynthesisUtterance(
              `Critical Alert: ${newAlert.title}. ${newAlert.message}`
            );
            msg.rate = 0.9;
            msg.pitch = 1.0;
            window.speechSynthesis.speak(msg);
          }
          
          // Toast notification
          toast.error(
            `${getSeverityIcon(newAlert.severity)} ${newAlert.title}`,
            { description: newAlert.message }
          );
          
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🟥';
      case 'high': return '🟧';
      case 'medium': return '🟨';
      case 'low': return '🟩';
      default: return '⚪';
    }
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical' && !a.acknowledged).length;
  const highCount = alerts.filter(a => a.severity === 'high' && !a.acknowledged).length;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Global Alert Center
        </CardTitle>
        <div className="flex gap-2">
          {criticalCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {criticalCount} Critical
            </Badge>
          )}
          {highCount > 0 && (
            <Badge variant="destructive">
              {highCount} High
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Info className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active alerts. System operating normally.</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.acknowledged ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={getSeverityColor(alert.severity)}>
                          {getSeverityIcon(alert.severity)} {alert.severity.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {alert.division}
                        </span>
                        {alert.country && (
                          <span className="text-xs text-muted-foreground">
                            • {alert.country}
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold mb-1">{alert.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {alert.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(alert.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
