import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  Bell, AlertTriangle, MapPin, Clock, ChevronRight, 
  Eye, EyeOff, Filter, RefreshCw 
} from "lucide-react";
import { toast } from "sonner";
import { DataFreshnessBadge } from "./DataFreshnessBadge";

interface CriticalAlert {
  id: string;
  headline: string;
  country: string;
  iso3: string;
  event_type: string;
  severity: number;
  level: string;
  triggered_at: string;
  acknowledged: boolean;
  meta?: any;
}

interface LiveCriticalAlertsProps {
  onAlertClick?: (alert: CriticalAlert) => void;
  maxHeight?: string;
}

export const LiveCriticalAlerts = ({ onAlertClick, maxHeight = "400px" }: LiveCriticalAlertsProps) => {
  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "high">("all");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const fetchAlerts = async () => {
    try {
      let query = supabase
        .from("critical_alerts")
        .select("*")
        .order("triggered_at", { ascending: false })
        .limit(50);

      const { data, error } = await query;
      
      if (error) throw error;
      
      setAlerts((data || []) as CriticalAlert[]);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error fetching critical alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();

    // Real-time subscription
    const channel = supabase
      .channel("live-critical-alerts")
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "critical_alerts" 
      }, () => fetchAlerts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleAcknowledge = async (alertId: string) => {
    try {
      await supabase
        .from("critical_alerts")
        .update({ acknowledged: true, ack_by: "operator" })
        .eq("id", alertId);
      
      toast.success("Alert acknowledged");
      fetchAlerts();
    } catch (error) {
      toast.error("Failed to acknowledge alert");
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filter === "critical") return (alert.severity || 0) >= 8 || alert.level === "critical";
    if (filter === "high") return (alert.severity || 0) >= 6 || alert.level === "high";
    return true;
  });

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-destructive animate-pulse" />
            Live Critical Alerts
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unacknowledgedCount} new
              </Badge>
            )}
            <DataFreshnessBadge lastUpdated={lastUpdated.toISOString()} showLabel={false} />
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant={filter === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "critical" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter("critical")}
            >
              Critical
            </Button>
            <Button
              variant={filter === "high" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFilter("high")}
            >
              High
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea style={{ height: maxHeight }} className="pr-4">
          <div className="space-y-2">
            {loading && (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            )}
            
            {!loading && filteredAlerts.length === 0 && (
              <div className="text-center py-8">
                <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {alerts.length === 0 ? "No active critical alerts — system nominal" : "No alerts matching current filter"}
                </p>
              </div>
            )}
            
            {filteredAlerts.map((alert) => {
              const severity = alert.severity || 5;
              const isCritical = severity >= 8 || alert.level === "critical";
              const isHigh = severity >= 6 || alert.level === "high";
              
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50",
                    isCritical && "border-destructive/50 bg-destructive/5",
                    isHigh && !isCritical && "border-warning/50 bg-warning/5",
                    !isHigh && !isCritical && "border-warning/50 bg-warning/5",
                    alert.acknowledged && "opacity-60"
                  )}
                  onClick={() => onAlertClick?.(alert)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] shrink-0",
                            isCritical && "border-destructive text-destructive",
                            isHigh && !isCritical && "border-warning text-warning"
                          )}
                        >
                          {alert.level?.toUpperCase() || (isCritical ? "CRITICAL" : "HIGH")}
                        </Badge>
                        
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(alert.triggered_at)}
                        </span>
                      </div>
                      
                      <p className={cn(
                        "text-sm font-medium line-clamp-2",
                        isCritical && "text-destructive"
                      )}>
                        {alert.headline}
                      </p>
                      
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {alert.country || "Global"}
                        </span>
                        
                        {alert.event_type && (
                          <Badge variant="secondary" className="text-[10px]">
                            {alert.event_type}
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcknowledge(alert.id);
                        }}
                      >
                        {alert.acknowledged ? (
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing {filteredAlerts.length} of {alerts.length} alerts
          </span>
          <Button variant="link" size="sm" className="text-xs h-auto p-0">
            See All Alerts →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
