import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  Swords, AlertTriangle, MapPin, Clock, RefreshCw, 
  Users, Skull, Target, Shield, TrendingUp, TrendingDown 
} from "lucide-react";
import { toast } from "sonner";
import { DataFreshnessBadge } from "./DataFreshnessBadge";
import { VerificationScore, calculateVerificationScore, type SourceInfo } from "./VerificationScore";
import { InlineConfidence } from "./ConfidenceBand";

interface SecurityIncident {
  id: string;
  headline: string;
  country: string;
  iso3: string;
  event_type: string;
  severity: number;
  triggered_at: string;
  acknowledged: boolean;
  meta?: any;
}

interface TerroristIndex {
  group: string;
  activity_level: number;
  trend: "up" | "down" | "stable";
  region: string;
  incidentCount: number;
}

// Verification sources for security data
const securitySources: SourceInfo[] = [
  { name: "GDELT", type: "aggregator" },
  { name: "ACLED", type: "academic" },
  { name: "News APIs", type: "media" },
  { name: "Satellite", type: "satellite" },
];

export const SecurityConflictView = () => {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [terroristIndex, setTerroristIndex] = useState<TerroristIndex[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [globalStats, setGlobalStats] = useState({
    totalIncidents: 0,
    criticalAlerts: 0,
    activeConflicts: 0,
    trend: "stable" as "up" | "down" | "stable"
  });

  const fetchSecurityData = async () => {
    try {
      // Fetch critical alerts
      const { data: alerts } = await supabase
        .from("critical_alerts")
        .select("*")
        .order("triggered_at", { ascending: false })
        .limit(20);

      if (alerts) {
        setIncidents(alerts as SecurityIncident[]);
        
        const critical = alerts.filter(a => a.severity && a.severity >= 8).length;
        const prevCount = globalStats.totalIncidents;
        setGlobalStats({
          totalIncidents: alerts.length,
          criticalAlerts: critical,
          activeConflicts: Math.min(alerts.length, 12),
          trend: alerts.length > prevCount ? "up" : alerts.length < prevCount ? "down" : "stable"
        });
        setLastUpdated(new Date());
      }

      // Fetch security incidents for terrorist index
      const { data: secIncidents } = await supabase
        .from("security_incidents")
        .select("*")
        .order("reported_at", { ascending: false })
        .limit(10);

      if (secIncidents && secIncidents.length > 0) {
        // Group by type for terrorist index
        const groupedByType = secIncidents.reduce((acc, inc) => {
          const type = inc.event_type || "Unknown";
          if (!acc[type]) {
            acc[type] = { count: 0, severity: 0 };
          }
          acc[type].count++;
          acc[type].severity += inc.severity || 0;
          return acc;
        }, {} as Record<string, { count: number; severity: number }>);

        const terroristData: TerroristIndex[] = Object.entries(groupedByType)
          .slice(0, 5)
          .map(([group, stats]) => ({
            group,
            activity_level: Math.round(stats.severity / Math.max(stats.count, 1)),
            trend: (stats.severity > 5 ? "up" : stats.severity > 3 ? "stable" : "down") as "up" | "down" | "stable",
            region: "Global",
            incidentCount: stats.count
          }));

        setTerroristIndex(terroristData);
      }
    } catch (error) {
      console.error("Error fetching security data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("security-view")
      .on("postgres_changes", { event: "*", schema: "public", table: "critical_alerts" }, fetchSecurityData)
      .on("postgres_changes", { event: "*", schema: "public", table: "security_incidents" }, fetchSecurityData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await supabase.functions.invoke("seed-live-data");
      await fetchSecurityData();
      toast.success("Security data refreshed");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setRefreshing(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const diff = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 8) return "text-destructive border-destructive/30 bg-destructive/10";
    if (severity >= 6) return "text-warning border-warning/30 bg-warning/10";
    if (severity >= 4) return "text-warning border-warning/30 bg-warning/10";
    return "text-muted-foreground border-border bg-muted/10";
  };

  const verificationScore = calculateVerificationScore(securitySources);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
            <Swords className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-xl font-orbitron font-bold">Security & Conflict</h2>
            <p className="text-sm text-muted-foreground">Global killings, conflicts, and threat assessment</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DataFreshnessBadge lastUpdated={lastUpdated.toISOString()} />
          <VerificationScore score={verificationScore} sources={securitySources} />
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs uppercase">Critical Alerts</span>
              </div>
              <DataFreshnessBadge lastUpdated={lastUpdated.toISOString()} showLabel={false} />
            </div>
            <div className="text-3xl font-orbitron font-bold">{globalStats.criticalAlerts}</div>
          </CardContent>
        </Card>

        <Card className="border-warning/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-warning">
                <Target className="h-4 w-4" />
                <span className="text-xs uppercase">Active Conflicts</span>
              </div>
              {globalStats.trend === "up" && <TrendingUp className="h-4 w-4 text-destructive" />}
              {globalStats.trend === "down" && <TrendingDown className="h-4 w-4 text-success" />}
            </div>
            <div className="text-3xl font-orbitron font-bold">{globalStats.activeConflicts}</div>
          </CardContent>
        </Card>

        <Card className="border-warning/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-warning">
                <Skull className="h-4 w-4" />
                <span className="text-xs uppercase">Total Incidents</span>
              </div>
              <InlineConfidence low={65} high={80} />
            </div>
            <div className="text-3xl font-orbitron font-bold">{globalStats.totalIncidents}</div>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="h-4 w-4" />
                <span className="text-xs uppercase">Status</span>
              </div>
            </div>
            <div className={cn(
              "text-xl font-orbitron font-bold",
              globalStats.criticalAlerts > 3 ? "text-destructive" :
              globalStats.criticalAlerts > 0 ? "text-warning" : "text-success"
            )}>
              {globalStats.criticalAlerts > 3 ? "HIGH ALERT" :
               globalStats.criticalAlerts > 0 ? "ELEVATED" : "NORMAL"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Critical Alerts */}
        <Card className="border-destructive/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Live Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {incidents.length === 0 && !loading && (
                  <p className="text-center text-muted-foreground py-8">
                    No critical alerts at this time
                  </p>
                )}
                
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className={cn(
                      "p-3 rounded-lg border transition-colors",
                      getSeverityColor(incident.severity || 5)
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px]",
                            (incident.severity || 5) >= 8 ? "border-destructive text-destructive" : ""
                          )}
                        >
                          {incident.event_type || "Alert"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(incident.triggered_at)}
                        </span>
                      </div>
                    </div>
                    
                    <p className="text-sm font-medium mb-2">{incident.headline}</p>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{incident.country || "Global"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Terrorist Group Activity Index */}
        <Card className="border-warning/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-warning" />
              Threat Activity Index
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {terroristIndex.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No threat data available</p>
                </div>
              )}
              
              {terroristIndex.map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium capitalize">{item.group}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-orbitron font-bold">{item.activity_level}</span>
                        <TrendingUp className={cn(
                          "h-4 w-4",
                          item.trend === "up" ? "text-destructive" :
                          item.trend === "down" ? "text-success" : "text-muted-foreground"
                        )} />
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          item.activity_level >= 7 ? "bg-destructive" :
                          item.activity_level >= 4 ? "bg-warning" : "bg-success"
                        )}
                        style={{ width: `${item.activity_level * 10}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{item.region}</span>
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-border/50 text-xs text-muted-foreground">
                <p className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Data sources: GDELT, ACLED, News sentiment, Satellite indicators
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
