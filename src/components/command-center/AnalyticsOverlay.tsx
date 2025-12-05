import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  X, BarChart3, TrendingUp, TrendingDown, Globe, 
  Activity, Heart, Zap, Utensils, Shield, Target,
  Maximize2, Minimize2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface AnalyticsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCountry?: { name: string; iso3: string } | null;
}

interface MetricCard {
  label: string;
  value: string | number;
  change?: number;
  icon: typeof Activity;
  color: string;
}

export const AnalyticsOverlay = ({ isOpen, onClose, selectedCountry }: AnalyticsOverlayProps) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [sdgProgress, setSdgProgress] = useState<{ goal: number; progress: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Fetch SDG progress
      const { data: sdgData } = await supabase
        .from("sdg_progress")
        .select("goal, progress_percent")
        .order("goal");

      if (sdgData) {
        setSdgProgress(sdgData.map(s => ({
          goal: s.goal,
          progress: Number(s.progress_percent) || 0
        })));
      }

      // Fetch division metrics
      const { data: divisionData } = await supabase
        .from("ai_divisions")
        .select("*");

      const { data: vulnData } = await supabase
        .from("vulnerability_scores")
        .select("overall_score, health_risk, food_risk, energy_risk")
        .order("calculated_at", { ascending: false })
        .limit(50);

      const avgScore = vulnData?.reduce((sum, v) => sum + (v.overall_score || 0), 0) / (vulnData?.length || 1);
      const avgHealth = vulnData?.reduce((sum, v) => sum + (v.health_risk || 0), 0) / (vulnData?.length || 1);
      const avgFood = vulnData?.reduce((sum, v) => sum + (v.food_risk || 0), 0) / (vulnData?.length || 1);
      const avgEnergy = vulnData?.reduce((sum, v) => sum + (v.energy_risk || 0), 0) / (vulnData?.length || 1);

      setMetrics([
        {
          label: "Global Risk Index",
          value: avgScore.toFixed(1),
          change: -2.3,
          icon: Shield,
          color: "text-destructive"
        },
        {
          label: "Health Risk",
          value: avgHealth.toFixed(1),
          change: -1.5,
          icon: Heart,
          color: "text-pink-500"
        },
        {
          label: "Food Security",
          value: (100 - avgFood).toFixed(1) + "%",
          change: 0.8,
          icon: Utensils,
          color: "text-amber-500"
        },
        {
          label: "Energy Stability",
          value: (100 - avgEnergy).toFixed(1) + "%",
          change: 1.2,
          icon: Zap,
          color: "text-yellow-500"
        },
        {
          label: "Active Divisions",
          value: divisionData?.filter(d => d.status === "active").length || 0,
          icon: Activity,
          color: "text-success"
        },
        {
          label: "Countries Monitored",
          value: vulnData?.length || 0,
          icon: Globe,
          color: "text-primary"
        },
      ]);

      setLoading(false);
    };

    if (isOpen) fetchData();
  }, [isOpen, selectedCountry]);

  const avgSDGProgress = sdgProgress.reduce((sum, s) => sum + s.progress, 0) / (sdgProgress.length || 1);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed z-40 bg-card/95 backdrop-blur-xl border border-primary/20 shadow-2xl transition-all duration-300 overflow-hidden",
        isFullscreen
          ? "inset-4 rounded-xl"
          : "top-4 left-4 w-[420px] h-[calc(100vh-180px)] rounded-xl"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-orbitron font-bold">
              {selectedCountry ? selectedCountry.name : "Global Analytics"}
            </h2>
            {selectedCountry && (
              <Badge variant="outline" className="mt-1">{selectedCountry.iso3}</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-[calc(100%-60px)]">
        <TabsList className="w-full justify-start rounded-none border-b border-border/50 h-10 bg-transparent px-4">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="sdg" className="text-xs">SDG Progress</TabsTrigger>
          <TabsTrigger value="risks" className="text-xs">Risk Analysis</TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[calc(100%-40px)]">
          {/* Overview Tab */}
          <TabsContent value="overview" className="p-4 mt-0">
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 bg-muted/30 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {metrics.map((metric) => {
                  const Icon = metric.icon;
                  return (
                    <Card
                      key={metric.label}
                      className="p-3 bg-muted/30 border-border/50 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={cn("h-4 w-4", metric.color)} />
                        <span className="text-xs text-muted-foreground truncate">
                          {metric.label}
                        </span>
                      </div>
                      <div className="flex items-end justify-between">
                        <span className="text-2xl font-orbitron font-bold">
                          {metric.value}
                        </span>
                        {metric.change !== undefined && (
                          <div className={cn(
                            "flex items-center gap-0.5 text-xs",
                            metric.change >= 0 ? "text-success" : "text-destructive"
                          )}>
                            {metric.change >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span>{Math.abs(metric.change)}%</span>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* SDG Progress Tab */}
          <TabsContent value="sdg" className="p-4 mt-0">
            <div className="mb-4 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Average SDG Progress</span>
                <Target className="h-4 w-4 text-primary" />
              </div>
              <div className="text-3xl font-orbitron font-bold text-primary">
                {avgSDGProgress.toFixed(1)}%
              </div>
              <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                  style={{ width: `${avgSDGProgress}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {sdgProgress.map((sdg) => (
                <div
                  key={sdg.goal}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {sdg.goal}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Goal {sdg.goal}</span>
                      <span className="font-medium">{sdg.progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          sdg.progress >= 70 ? "bg-success" :
                          sdg.progress >= 40 ? "bg-warning" : "bg-destructive"
                        )}
                        style={{ width: `${sdg.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Risk Analysis Tab */}
          <TabsContent value="risks" className="p-4 mt-0">
            <div className="space-y-4">
              {[
                { label: "Health Crisis Risk", value: 23, trend: -5 },
                { label: "Food Insecurity Risk", value: 34, trend: 2 },
                { label: "Energy Disruption Risk", value: 18, trend: -3 },
                { label: "Climate Impact Risk", value: 45, trend: 8 },
                { label: "Economic Instability", value: 29, trend: -1 },
                { label: "Political Unrest Risk", value: 31, trend: 4 },
              ].map((risk) => (
                <div key={risk.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{risk.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-orbitron font-bold">{risk.value}%</span>
                      <span className={cn(
                        "text-xs flex items-center gap-0.5",
                        risk.trend >= 0 ? "text-destructive" : "text-success"
                      )}>
                        {risk.trend >= 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {Math.abs(risk.trend)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        risk.value >= 50 ? "bg-destructive" :
                        risk.value >= 30 ? "bg-warning" : "bg-success"
                      )}
                      style={{ width: `${risk.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
};
