import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { 
  Zap, TrendingUp, AlertTriangle, RefreshCw, 
  Activity, Eye, Waves, Target, Clock 
} from "lucide-react";
import { toast } from "sonner";
import { DataFreshnessBadge } from "./DataFreshnessBadge";

interface WeakSignal {
  id: string;
  type: "narrative_spike" | "correlation" | "emerging_risk" | "anomaly";
  title: string;
  description: string;
  confidence: number;
  severity: "low" | "medium" | "high";
  indicators: string[];
  detectedAt: string;
  region?: string;
  divisions: string[];
}

export const AnomalyDetection = () => {
  const [signals, setSignals] = useState<WeakSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const detectAnomalies = async () => {
    setScanning(true);
    try {
      // Fetch recent data for pattern analysis
      const [alertsRes, incidentsRes, crisesRes, healthRes] = await Promise.all([
        supabase.from("critical_alerts").select("*").order("triggered_at", { ascending: false }).limit(50),
        supabase.from("security_incidents").select("*").order("reported_at", { ascending: false }).limit(50),
        supabase.from("crisis_events").select("*").order("opened_at", { ascending: false }).limit(20),
        supabase.from("health_data").select("*").order("collected_at", { ascending: false }).limit(20),
      ]);

      const alerts = alertsRes.data || [];
      const incidents = incidentsRes.data || [];
      const crises = crisesRes.data || [];
      const healthData = healthRes.data || [];

      const detectedSignals: WeakSignal[] = [];

      // 1. Detect narrative spikes (sudden increase in similar events)
      const alertsByType = alerts.reduce((acc, a) => {
        const type = a.event_type || "unknown";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(alertsByType).forEach(([type, count]) => {
        if (count as number >= 5) {
          detectedSignals.push({
            id: `spike-${type}`,
            type: "narrative_spike",
            title: `${type} Event Surge Detected`,
            description: `Unusual concentration of ${count} "${type}" events in recent data stream`,
            confidence: Math.min(35 + (count as number) * 8, 75),
            severity: (count as number) >= 10 ? "high" : "medium",
            indicators: [`${count} events`, "Clustering pattern", "Time concentration"],
            detectedAt: new Date().toISOString(),
            divisions: ["security"],
          });
        }
      });

      // 2. Detect rare correlations (multiple divisions affected in same region)
      const regionEvents = alerts.reduce((acc, a) => {
        const region = a.country || a.iso3 || "global";
        if (!acc[region]) acc[region] = new Set();
        acc[region].add(a.event_type);
        return acc;
      }, {} as Record<string, Set<string>>);

      Object.entries(regionEvents).forEach(([region, types]) => {
        if (types.size >= 3) {
          detectedSignals.push({
            id: `corr-${region}`,
            type: "correlation",
            title: `Multi-Domain Stress: ${region}`,
            description: `${types.size} different event types co-occurring in ${region}`,
            confidence: Math.min(40 + types.size * 10, 70),
            severity: types.size >= 4 ? "high" : "medium",
            indicators: Array.from(types).slice(0, 4),
            detectedAt: new Date().toISOString(),
            region,
            divisions: Array.from(types).map(t => t.toLowerCase()),
          });
        }
      });

      // 3. Detect emerging risks (low confidence but rising patterns)
      const recentCrises = crises.filter(c => {
        const age = Date.now() - new Date(c.opened_at || c.created_at).getTime();
        return age < 24 * 60 * 60 * 1000; // Last 24h
      });

      if (recentCrises.length >= 3) {
        detectedSignals.push({
          id: "emerging-crisis-surge",
          type: "emerging_risk",
          title: "Crisis Event Acceleration",
          description: `${recentCrises.length} new crisis events in the last 24 hours - above normal baseline`,
          confidence: 45,
          severity: recentCrises.length >= 5 ? "high" : "medium",
          indicators: ["24h surge", "Multiple regions", "Above baseline"],
          detectedAt: new Date().toISOString(),
          divisions: ["crisis"],
        });
      }

      // 4. Detect health + security correlations
      const criticalHealth = healthData.filter(h => h.risk_level === "critical" || h.risk_level === "high");
      const highSecurityRegions = new Set(
        incidents.filter(i => (i.severity || 0) >= 7).map(i => i.country || i.iso3)
      );
      
      const overlappingRegions = criticalHealth.filter(h => 
        highSecurityRegions.has(h.region)
      );

      if (overlappingRegions.length > 0) {
        detectedSignals.push({
          id: "health-security-overlap",
          type: "correlation",
          title: "Health-Security Compound Risk",
          description: `${overlappingRegions.length} regions showing both health crisis and security incidents`,
          confidence: 55,
          severity: "high",
          indicators: ["Health stress", "Security incidents", "Compound risk"],
          detectedAt: new Date().toISOString(),
          divisions: ["health", "security"],
        });
      }

      // 5. Log anomaly detection run (skip insert if it would fail)
      try {
        await supabase.from("anomaly_detections").insert([{
          division: "global",
          anomaly_type: "weak_signal_scan",
          description: `Detected ${detectedSignals.length} weak signals`,
          severity: detectedSignals.some(s => s.severity === "high") ? "high" : "medium",
          metrics: JSON.parse(JSON.stringify({ signalCount: detectedSignals.length })),
          status: "active",
        }]);
      } catch (insertErr) {
        console.warn("Could not log anomaly scan:", insertErr);
      }

      setSignals(detectedSignals);
      toast.success(`Detected ${detectedSignals.length} weak signals`);
    } catch (error) {
      console.error("Anomaly detection error:", error);
      toast.error("Anomaly scan failed");
    } finally {
      setScanning(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    detectAnomalies();
    const interval = setInterval(detectAnomalies, 5 * 60 * 1000); // Every 5 min
    return () => clearInterval(interval);
  }, []);

  const getTypeIcon = (type: WeakSignal["type"]) => {
    switch (type) {
      case "narrative_spike": return <Waves className="h-4 w-4" />;
      case "correlation": return <Activity className="h-4 w-4" />;
      case "emerging_risk": return <TrendingUp className="h-4 w-4" />;
      case "anomaly": return <Zap className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "border-destructive/50 bg-destructive/5";
      case "medium": return "border-warning/50 bg-warning/5";
      default: return "border-muted bg-muted/5";
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary animate-pulse" />
            Anomaly & Weak Signal Detection
          </CardTitle>
          <div className="flex items-center gap-2">
            <DataFreshnessBadge 
              lastUpdated={signals[0]?.detectedAt || new Date().toISOString()} 
              showLabel={false}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={detectAnomalies}
              disabled={scanning}
              className="h-7 text-xs"
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", scanning && "animate-spin")} />
              {scanning ? "Scanning..." : "Scan"}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {loading && (
              <div className="text-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Analyzing patterns...</p>
              </div>
            )}
            
            {!loading && signals.length === 0 && (
              <div className="text-center py-8">
                <Eye className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground text-sm">No weak signals detected</p>
                <p className="text-xs text-muted-foreground mt-1">System operating within normal parameters</p>
              </div>
            )}
            
            {signals.map((signal) => (
              <div
                key={signal.id}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  getSeverityColor(signal.severity)
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    signal.severity === "high" ? "bg-destructive/20 text-destructive" :
                    signal.severity === "medium" ? "bg-warning/20 text-warning" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {getTypeIcon(signal.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">{signal.title}</h4>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[9px] shrink-0",
                          signal.severity === "high" ? "border-destructive text-destructive" :
                          signal.severity === "medium" ? "border-warning text-warning" :
                          "border-muted-foreground"
                        )}
                      >
                        {signal.severity.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                      {signal.description}
                    </p>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[9px] bg-muted/50">
                        <Target className="h-2.5 w-2.5 mr-1" />
                        {signal.confidence}% confidence
                      </Badge>
                      
                      {signal.region && (
                        <Badge variant="secondary" className="text-[9px]">
                          {signal.region}
                        </Badge>
                      )}
                      
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(signal.detectedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {signal.indicators.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {signal.indicators.map((ind, i) => (
                          <Badge key={i} variant="outline" className="text-[8px] bg-background/50">
                            {ind}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <div className="mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
          <p className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Weak signals indicate emerging patterns with low-to-medium confidence. Human review recommended.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
