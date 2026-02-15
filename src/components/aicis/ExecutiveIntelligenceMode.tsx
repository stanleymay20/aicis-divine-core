import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ExecutiveEscalationPanel } from "./ExecutiveEscalationPanel";
import { 
  AlertTriangle, 
  TrendingUp, 
  Clock, 
  Shield,
  Activity,
  Zap,
  ArrowRight,
  RefreshCw,
  Download,
  ChevronRight
} from "lucide-react";
import { DataFreshnessBadge, getFreshnessLevel, getFreshnessConfig } from "./DataFreshnessBadge";
import { VerificationScore, type SourceInfo, calculateVerificationScore } from "./VerificationScore";
import { InlineConfidence, capConfidence } from "./ConfidenceBand";

interface ExecutiveCard {
  id: string;
  title: string;
  value: string | number;
  status: "green" | "amber" | "red";
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  division: string;
  lastUpdated: string;
  sources: SourceInfo[];
  needsAttention?: boolean;
  confidenceLow?: number;
  confidenceHigh?: number;
}

interface AttentionItem {
  id: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium";
  division: string;
  deadline?: string;
  actionRequired: string;
}

export const ExecutiveIntelligenceMode = () => {
  const [cards, setCards] = useState<ExecutiveCard[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchExecutiveData();
    const interval = setInterval(fetchExecutiveData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchExecutiveData = async () => {
    try {
      // Fetch critical alerts for attention items
      const { data: alerts } = await supabase
        .from("critical_alerts")
        .select("*")
        .eq("acknowledged", false)
        .order("triggered_at", { ascending: false })
        .limit(5);

      // Fetch recent data for executive cards
      const { data: crises } = await supabase
        .from("crisis_events")
        .select("*")
        .eq("status", "active")
        .order("opened_at", { ascending: false })
        .limit(10);

      const { data: incidents } = await supabase
        .from("security_incidents")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: healthData } = await supabase
        .from("health_data")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(5);

      // Build executive cards
      const execCards: ExecutiveCard[] = [
        {
          id: "security",
          title: "Global Security Status",
          value: incidents?.length || 0,
          status: (incidents?.length || 0) > 5 ? "red" : (incidents?.length || 0) > 2 ? "amber" : "green",
          trend: "stable",
          trendValue: "+2 this week",
          division: "Security",
          lastUpdated: new Date().toISOString(),
          sources: [
            { name: "GDELT", type: "aggregator" },
            { name: "News APIs", type: "media" },
          ],
          confidenceLow: 65,
          confidenceHigh: 80,
          needsAttention: (incidents?.length || 0) > 5,
        },
        {
          id: "crises",
          title: "Active Crises",
          value: crises?.length || 0,
          status: (crises?.length || 0) > 3 ? "red" : (crises?.length || 0) > 1 ? "amber" : "green",
          trend: (crises?.length || 0) > 2 ? "up" : "stable",
          division: "Crisis",
          lastUpdated: crises?.[0]?.opened_at || new Date().toISOString(),
          sources: [
            { name: "NASA EONET", type: "satellite" },
            { name: "GDACS", type: "government" },
            { name: "ReliefWeb", type: "ngo" },
          ],
          confidenceLow: 70,
          confidenceHigh: 85,
          needsAttention: (crises?.length || 0) > 3,
        },
        {
          id: "health",
          title: "Health Index",
          value: healthData?.[0]?.risk_level ?? "Normal",
          status: (healthData?.[0]?.severity_index || 0) > 3 ? "red" : 
                  (healthData?.[0]?.severity_index || 0) > 1 ? "amber" : "green",
          division: "Health",
          lastUpdated: healthData?.[0]?.created_at || new Date().toISOString(),
          sources: [
            { name: "WHO", type: "government" },
            { name: "OWID", type: "academic" },
          ],
          confidenceLow: 75,
          confidenceHigh: 90,
        },
        {
          id: "alerts",
          title: "Critical Alerts",
          value: alerts?.length || 0,
          status: (alerts?.length || 0) > 2 ? "red" : (alerts?.length || 0) > 0 ? "amber" : "green",
          trend: (alerts?.length || 0) > 0 ? "up" : "stable",
          division: "System",
          lastUpdated: alerts?.[0]?.triggered_at || new Date().toISOString(),
          sources: [{ name: "AICIS Core", type: "aggregator" }],
          confidenceLow: 80,
          confidenceHigh: 95,
          needsAttention: (alerts?.length || 0) > 0,
        },
        {
          id: "data",
          title: "Data Feed Health",
          value: "Operational",
          status: "green",
          division: "System",
          lastUpdated: new Date().toISOString(),
          sources: [
            { name: "World Bank", type: "government" },
            { name: "FAO", type: "government" },
            { name: "USGS", type: "government" },
          ],
          confidenceLow: 85,
          confidenceHigh: 95,
        },
      ];

      // Build 72h attention items
      const attItems: AttentionItem[] = [];
      
      if (alerts && alerts.length > 0) {
        alerts.forEach((alert) => {
          attItems.push({
            id: alert.id,
            title: alert.headline || "Unacknowledged Alert",
            description: alert.event_type || "Requires immediate review",
            priority: alert.level === "critical" ? "critical" : "high",
            division: alert.event_type || "System",
            actionRequired: "Review and acknowledge alert",
          });
        });
      }

      if (crises && crises.length > 2) {
        attItems.push({
          id: "crisis-surge",
          title: "Crisis Event Surge Detected",
          description: `${crises.length} active crisis events require monitoring`,
          priority: "high",
          division: "Crisis",
          deadline: "24h",
          actionRequired: "Review crisis response protocols",
        });
      }

      setCards(execCards);
      setAttentionItems(attItems.slice(0, 5));
      setLastRefresh(new Date());
      setLoading(false);
    } catch (error) {
      console.error("Error fetching executive data:", error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: "green" | "amber" | "red") => {
    return {
      green: "bg-success",
      amber: "bg-warning",
      red: "bg-destructive",
    }[status];
  };

  const getStatusBorder = (status: "green" | "amber" | "red") => {
    return {
      green: "border-success/30",
      amber: "border-warning/30",
      red: "border-destructive/30",
    }[status];
  };

  const getPriorityColor = (priority: "critical" | "high" | "medium") => {
    return {
      critical: "bg-destructive/20 text-destructive border-destructive/30",
      high: "bg-orange-500/20 text-orange-500 border-orange-500/30",
      medium: "bg-warning/20 text-warning border-warning/30",
    }[priority];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-orbitron font-bold flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Executive Intelligence Mode
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            5-card summary • RAG indicators • 72h attention window
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Updated {Math.floor((Date.now() - lastRefresh.getTime()) / 60000)}m ago
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchExecutiveData}
            className="gap-1"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* RAG Summary Cards - 5 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card) => {
          const freshnessLevel = getFreshnessLevel(card.lastUpdated);
          const freshnessConfig = getFreshnessConfig(freshnessLevel);
          const verificationScore = calculateVerificationScore(card.sources);
          
          return (
            <Card 
              key={card.id} 
              className={cn(
                "relative overflow-hidden",
                getStatusBorder(card.status),
                card.needsAttention && "ring-1 ring-destructive/50"
              )}
            >
              {/* Status indicator bar */}
              <div className={cn(
                "absolute top-0 left-0 right-0 h-1",
                getStatusColor(card.status)
              )} />
              
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {card.title}
                  </span>
                  {card.needsAttention && (
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive animate-pulse" />
                  )}
                </div>
                
                <div className="text-2xl font-bold font-orbitron mb-2">
                  {card.value}
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    {card.trend === "up" && <TrendingUp className="h-3 w-3 text-destructive" />}
                    {card.trend === "down" && <TrendingUp className="h-3 w-3 text-success rotate-180" />}
                    {card.trendValue && (
                      <span className="text-muted-foreground">{card.trendValue}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                  <DataFreshnessBadge 
                    lastUpdated={card.lastUpdated} 
                    showLabel={false}
                  />
                  {card.confidenceLow && card.confidenceHigh && (
                    <InlineConfidence 
                      low={card.confidenceLow} 
                      high={card.confidenceHigh} 
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>


      {/* Executive Escalation Panel */}
      <ExecutiveEscalationPanel />

      {/* 72h Attention Window */}
      <Card className="border-warning/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              What Needs Attention in 72h
            </CardTitle>
            <Badge variant="outline" className={cn(
              attentionItems.length > 0 
                ? "bg-warning/10 text-warning border-warning/30" 
                : "bg-success/10 text-success border-success/30"
            )}>
              {attentionItems.length} items
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {attentionItems.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No items requiring immediate attention</p>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {attentionItems.map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <Badge 
                      variant="outline" 
                      className={cn("shrink-0 text-[10px]", getPriorityColor(item.priority))}
                    >
                      {item.priority.toUpperCase()}
                    </Badge>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{item.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {item.division}
                        </Badge>
                        {item.deadline && (
                          <span className="text-[10px] text-warning flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.deadline}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Export Brief (PDF)
        </Button>
        <Button variant="default" size="sm" className="gap-1.5">
          Full Assessment
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
