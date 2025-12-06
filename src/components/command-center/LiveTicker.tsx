import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, AlertTriangle, Globe, Heart, Zap, 
  Utensils, Shield, TrendingUp, TrendingDown, Radio
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TickerItem {
  id: string;
  icon: typeof Activity;
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  severity?: "normal" | "warning" | "critical";
}

export const LiveTicker = () => {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      // Parallel fetch all metrics
      const [alertsRes, vulnRes, crisisRes, divisionsRes] = await Promise.all([
        supabase.from("alerts").select("*", { count: "exact", head: true }).eq("acknowledged", false),
        supabase.from("vulnerability_scores").select("overall_score, health_risk, food_risk, energy_risk").order("calculated_at", { ascending: false }).limit(100),
        supabase.from("crisis_events").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("ai_divisions").select("status"),
      ]);

      const vulnData = vulnRes.data || [];
      const avgRisk = vulnData.reduce((sum, v) => sum + (v.overall_score || 0), 0) / (vulnData.length || 1);
      const avgHealth = vulnData.reduce((sum, v) => sum + (v.health_risk || 0), 0) / (vulnData.length || 1);
      const avgFood = vulnData.reduce((sum, v) => sum + (v.food_risk || 0), 0) / (vulnData.length || 1);
      const avgEnergy = vulnData.reduce((sum, v) => sum + (v.energy_risk || 0), 0) / (vulnData.length || 1);

      const activeAlerts = alertsRes.count || 0;
      const activeCrises = crisisRes.count || 0;
      const operationalDivisions = divisionsRes.data?.filter(d => d.status === "operational").length || 0;

      setItems([
        {
          id: "alerts",
          icon: AlertTriangle,
          label: "Active Alerts",
          value: activeAlerts,
          severity: activeAlerts > 10 ? "critical" : activeAlerts > 5 ? "warning" : "normal",
        },
        {
          id: "crises",
          icon: Shield,
          label: "Active Crises",
          value: activeCrises,
          severity: activeCrises > 3 ? "critical" : activeCrises > 0 ? "warning" : "normal",
        },
        {
          id: "risk",
          icon: Activity,
          label: "Global Risk",
          value: `${avgRisk.toFixed(0)}%`,
          trend: avgRisk > 50 ? "up" : "down",
          severity: avgRisk > 70 ? "critical" : avgRisk > 40 ? "warning" : "normal",
        },
        {
          id: "health",
          icon: Heart,
          label: "Health Index",
          value: `${(100 - avgHealth).toFixed(0)}%`,
          trend: avgHealth < 30 ? "up" : "down",
        },
        {
          id: "food",
          icon: Utensils,
          label: "Food Security",
          value: `${(100 - avgFood).toFixed(0)}%`,
          trend: avgFood < 30 ? "up" : "down",
        },
        {
          id: "energy",
          icon: Zap,
          label: "Energy Stability",
          value: `${(100 - avgEnergy).toFixed(0)}%`,
          trend: avgEnergy < 30 ? "up" : "down",
        },
        {
          id: "divisions",
          icon: Globe,
          label: "Systems Online",
          value: `${operationalDivisions}/9`,
          severity: operationalDivisions < 9 ? "warning" : "normal",
        },
      ]);
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {/* Live indicator */}
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-destructive/20 border border-destructive/30 shrink-0">
        <Radio className="h-3 w-3 text-destructive animate-pulse" />
        <span className="text-[10px] font-medium text-destructive uppercase tracking-wider">Live</span>
      </div>

      <div className="w-px h-4 bg-border mx-1 shrink-0" />

      {/* Ticker items */}
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md shrink-0 transition-colors",
              item.severity === "critical" && "bg-destructive/10 border border-destructive/20",
              item.severity === "warning" && "bg-warning/10 border border-warning/20",
              item.severity === "normal" && "hover:bg-muted/30"
            )}
          >
            <Icon className={cn(
              "h-3 w-3",
              item.severity === "critical" && "text-destructive",
              item.severity === "warning" && "text-warning",
              item.severity === "normal" && "text-muted-foreground"
            )} />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
            <span className={cn(
              "text-xs font-orbitron font-bold",
              item.severity === "critical" && "text-destructive",
              item.severity === "warning" && "text-warning"
            )}>
              {item.value}
            </span>
            {item.trend && (
              item.trend === "up" ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : item.trend === "down" ? (
                <TrendingDown className="h-3 w-3 text-destructive" />
              ) : null
            )}
          </div>
        );
      })}
    </div>
  );
};
