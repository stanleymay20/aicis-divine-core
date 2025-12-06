import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  X, MapPin, TrendingUp, TrendingDown, Heart, Utensils,
  Zap, Shield, Users, Building2, GraduationCap, CloudRain,
  Loader2, ExternalLink, Target
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface CountryPanelProps {
  country: { name: string; iso3: string; lat: number; lng: number } | null;
  onClose: () => void;
}

interface CountryData {
  vulnerability?: {
    overall_score: number;
    health_risk: number;
    food_risk: number;
    energy_risk: number;
    climate_risk: number;
  };
  profile?: {
    summary: any;
    kpis: any;
  };
  incidents: number;
  alerts: number;
}

export const CountryPanel = ({ country, onClose }: CountryPanelProps) => {
  const [data, setData] = useState<CountryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!country) return;

    const fetchCountryData = async () => {
      setLoading(true);

      const [vulnRes, profileRes, alertsRes, incidentsRes] = await Promise.all([
        supabase
          .from("vulnerability_scores")
          .select("*")
          .ilike("country", `%${country.name}%`)
          .order("calculated_at", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("country_profiles")
          .select("summary, kpis")
          .eq("iso3", country.iso3)
          .single(),
        supabase
          .from("alerts")
          .select("*", { count: "exact", head: true })
          .ilike("country", `%${country.name}%`)
          .eq("acknowledged", false),
        supabase
          .from("security_incidents")
          .select("*", { count: "exact", head: true })
          .ilike("country", `%${country.name}%`),
      ]);

      setData({
        vulnerability: vulnRes.data ? {
          overall_score: vulnRes.data.overall_score || 0,
          health_risk: vulnRes.data.health_risk || 0,
          food_risk: vulnRes.data.food_risk || 0,
          energy_risk: vulnRes.data.energy_risk || 0,
          climate_risk: vulnRes.data.climate_risk || 0,
        } : undefined,
        profile: profileRes.data || undefined,
        incidents: incidentsRes.count || 0,
        alerts: alertsRes.count || 0,
      });

      setLoading(false);
    };

    fetchCountryData();
  }, [country]);

  if (!country) return null;

  const riskMetrics = data?.vulnerability ? [
    { label: "Overall Risk", value: data.vulnerability.overall_score, icon: Shield },
    { label: "Health Risk", value: data.vulnerability.health_risk, icon: Heart },
    { label: "Food Risk", value: data.vulnerability.food_risk, icon: Utensils },
    { label: "Energy Risk", value: data.vulnerability.energy_risk, icon: Zap },
    { label: "Climate Risk", value: data.vulnerability.climate_risk, icon: CloudRain },
  ] : [];

  return (
    <div className="fixed top-16 right-4 w-96 bg-card/95 backdrop-blur-xl border border-primary/20 rounded-xl shadow-2xl z-30 animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="relative p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
            <MapPin className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="font-orbitron font-bold text-lg">{country.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{country.iso3}</Badge>
              <span className="text-xs text-muted-foreground">
                {country.lat.toFixed(2)}°, {country.lng.toFixed(2)}°
              </span>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4 mt-4">
          <div className="flex-1 text-center p-2 rounded-lg bg-muted/30">
            <div className="text-xl font-orbitron font-bold text-destructive">
              {data?.alerts || 0}
            </div>
            <div className="text-[10px] text-muted-foreground">Active Alerts</div>
          </div>
          <div className="flex-1 text-center p-2 rounded-lg bg-muted/30">
            <div className="text-xl font-orbitron font-bold text-warning">
              {data?.incidents || 0}
            </div>
            <div className="text-[10px] text-muted-foreground">Incidents</div>
          </div>
          <div className="flex-1 text-center p-2 rounded-lg bg-muted/30">
            <div className={cn(
              "text-xl font-orbitron font-bold",
              (data?.vulnerability?.overall_score || 0) > 60 ? "text-destructive" :
              (data?.vulnerability?.overall_score || 0) > 30 ? "text-warning" : "text-success"
            )}>
              {data?.vulnerability?.overall_score?.toFixed(0) || "N/A"}
            </div>
            <div className="text-[10px] text-muted-foreground">Risk Score</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start rounded-none border-b border-border/50 h-10 bg-transparent px-4">
          <TabsTrigger value="overview" className="text-xs">Risk Analysis</TabsTrigger>
          <TabsTrigger value="intelligence" className="text-xs">Intelligence</TabsTrigger>
        </TabsList>

        <ScrollArea className="h-[320px]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <TabsContent value="overview" className="p-4 mt-0 space-y-3">
                {riskMetrics.length > 0 ? (
                  riskMetrics.map((metric) => {
                    const Icon = metric.icon;
                    const value = metric.value || 0;
                    return (
                      <div key={metric.label} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={cn(
                              "h-4 w-4",
                              value > 60 ? "text-destructive" :
                              value > 30 ? "text-warning" : "text-success"
                            )} />
                            <span className="text-sm">{metric.label}</span>
                          </div>
                          <span className="font-orbitron font-bold">{value.toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              value > 60 ? "bg-destructive" :
                              value > 30 ? "bg-warning" : "bg-success"
                            )}
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No risk data available for this country</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="intelligence" className="p-4 mt-0">
                {data?.profile?.summary ? (
                  <div className="space-y-4">
                    {typeof data.profile.summary === 'object' && (
                      <div className="prose prose-sm prose-invert">
                        <p className="text-sm text-muted-foreground">
                          {JSON.stringify(data.profile.summary).slice(0, 300)}...
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No intelligence data available</p>
                    <p className="text-xs mt-1">Run a country analysis to generate insights</p>
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </ScrollArea>
      </Tabs>
    </div>
  );
};
