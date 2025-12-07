import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Activity, Eye, Radar, Cpu, Database, Network,
  Satellite, Radio, Shield, Zap, Globe, Clock,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Brain, Wifi, Server, HardDrive
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface SystemMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  status: "optimal" | "warning" | "critical";
  icon: typeof Activity;
}

interface DataSource {
  name: string;
  status: "online" | "degraded" | "offline";
  latency: number;
  lastUpdate: string;
}

export const IntelligenceHUD = () => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([]);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [processingLoad, setProcessingLoad] = useState(0);
  const [dataIngestionRate, setDataIngestionRate] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchSystemStatus = async () => {
      const [divisionsRes, sourcesRes, alertsRes] = await Promise.all([
        supabase.from("ai_divisions").select("*"),
        supabase.from("data_source_log").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("alerts").select("*", { count: "exact", head: true }).eq("acknowledged", false),
      ]);

      const divisions = divisionsRes.data || [];
      const activeDivisions = divisions.filter(d => d.status === "operational" || d.status === "active").length;
      const avgPerformance = divisions.reduce((sum, d) => sum + (d.performance_score || 0), 0) / (divisions.length || 1);
      const avgUptime = divisions.reduce((sum, d) => sum + (d.uptime_percentage || 0), 0) / (divisions.length || 1);

      setSystemMetrics([
        { id: "divisions", label: "AI Divisions", value: activeDivisions, unit: `/${divisions.length}`, status: activeDivisions >= 8 ? "optimal" : activeDivisions >= 5 ? "warning" : "critical", icon: Cpu },
        { id: "performance", label: "Performance", value: avgPerformance, unit: "%", status: avgPerformance >= 90 ? "optimal" : avgPerformance >= 70 ? "warning" : "critical", icon: Activity },
        { id: "uptime", label: "Uptime", value: avgUptime, unit: "%", status: avgUptime >= 99 ? "optimal" : avgUptime >= 95 ? "warning" : "critical", icon: Clock },
        { id: "alerts", label: "Pending Alerts", value: alertsRes.count || 0, unit: "", status: (alertsRes.count || 0) < 5 ? "optimal" : (alertsRes.count || 0) < 15 ? "warning" : "critical", icon: AlertTriangle },
      ]);

      // Process data sources
      const sourceMap = new Map<string, DataSource>();
      (sourcesRes.data || []).forEach(log => {
        if (!sourceMap.has(log.source)) {
          sourceMap.set(log.source, {
            name: log.source,
            status: log.status === "success" ? "online" : log.status === "partial" ? "degraded" : "offline",
            latency: log.latency_ms || 0,
            lastUpdate: log.created_at || new Date().toISOString(),
          });
        }
      });
      setDataSources(Array.from(sourceMap.values()).slice(0, 8));

      // Simulated real-time metrics
      setProcessingLoad(Math.min(100, 45 + Math.random() * 30));
      setDataIngestionRate(Math.floor(1200 + Math.random() * 800));
    };

    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "optimal":
      case "online": return "text-success";
      case "warning":
      case "degraded": return "text-warning";
      case "critical":
      case "offline": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "optimal":
      case "online": return "bg-success/20 border-success/30";
      case "warning":
      case "degraded": return "bg-warning/20 border-warning/30";
      case "critical":
      case "offline": return "bg-destructive/20 border-destructive/30";
      default: return "bg-muted/20 border-border";
    }
  };

  return (
    <div className="absolute top-20 right-4 z-20">
      {/* Compact HUD */}
      <div
        className={cn(
          "bg-card/90 backdrop-blur-xl border border-primary/20 rounded-xl overflow-hidden transition-all duration-300",
          isExpanded ? "w-80" : "w-48"
        )}
      >
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full p-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <Brain className="h-4 w-4 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-success rounded-full animate-pulse" />
            </div>
            <span className="text-xs font-orbitron font-bold">AICIS CORE</span>
          </div>
          <Badge variant="outline" className="text-[10px] bg-success/20 border-success/30 text-success">
            <Wifi className="h-2.5 w-2.5 mr-1" />
            LIVE
          </Badge>
        </button>

        {/* Compact metrics row */}
        <div className="px-3 pb-3 space-y-2">
          {/* Processing bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground flex items-center gap-1">
                <Cpu className="h-3 w-3" /> Processing Load
              </span>
              <span className="font-orbitron">{processingLoad.toFixed(0)}%</span>
            </div>
            <Progress value={processingLoad} className="h-1.5" />
          </div>

          {/* Data ingestion */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" /> Data Rate
            </span>
            <span className="font-orbitron text-primary">{dataIngestionRate.toLocaleString()}/s</span>
          </div>

          {/* System status icons */}
          {!isExpanded && (
            <div className="flex items-center gap-1 pt-1">
              {systemMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.id}
                    className={cn(
                      "p-1.5 rounded-md border",
                      getStatusBg(metric.status)
                    )}
                    title={`${metric.label}: ${metric.value}${metric.unit}`}
                  >
                    <Icon className={cn("h-3 w-3", getStatusColor(metric.status))} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Expanded view */}
        {isExpanded && (
          <div className="border-t border-border/50 p-3 space-y-3 animate-fade-in">
            {/* System metrics grid */}
            <div className="grid grid-cols-2 gap-2">
              {systemMetrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div
                    key={metric.id}
                    className={cn(
                      "p-2 rounded-lg border",
                      getStatusBg(metric.status)
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={cn("h-3 w-3", getStatusColor(metric.status))} />
                      <span className="text-[10px] text-muted-foreground">{metric.label}</span>
                    </div>
                    <span className="font-orbitron font-bold text-sm">
                      {metric.value.toFixed(0)}{metric.unit}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Data sources */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Server className="h-3 w-3" />
                <span>DATA SOURCES</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {dataSources.slice(0, 6).map((source) => (
                  <div
                    key={source.name}
                    className="flex items-center gap-1.5 p-1.5 rounded bg-muted/30"
                  >
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      source.status === "online" ? "bg-success" :
                      source.status === "degraded" ? "bg-warning" : "bg-destructive"
                    )} />
                    <span className="text-[10px] truncate">{source.name.substring(0, 12)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
