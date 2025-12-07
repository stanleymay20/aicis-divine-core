import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Users, Shield, Heart, Utensils, Zap, CloudRain,
  Building2, TrendingUp, TrendingDown, Target, Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ALL_COUNTRIES } from "@/lib/geo/all-countries";

interface GlobalStat {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  icon: typeof Activity;
  color: string;
}

export const GlobalStatsBar = () => {
  const [stats, setStats] = useState<GlobalStat[]>([]);
  const [sdgAverage, setSdgAverage] = useState(0);

  useEffect(() => {
    const fetchGlobalStats = async () => {
      const [vulnRes, sdgRes, incidentsRes, countriesRes] = await Promise.all([
        supabase.from("vulnerability_scores").select("overall_score, health_risk, food_risk, energy_risk, climate_risk").order("calculated_at", { ascending: false }).limit(200),
        supabase.from("sdg_progress").select("progress_percent"),
        supabase.from("security_incidents").select("*", { count: "exact", head: true }).gte("detected_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("vulnerability_scores").select("country", { count: "exact", head: true }),
      ]);

      const vulnData = vulnRes.data || [];
      const avgRisk = vulnData.reduce((sum, v) => sum + (v.overall_score || 0), 0) / (vulnData.length || 1);
      const avgHealth = vulnData.reduce((sum, v) => sum + (v.health_risk || 0), 0) / (vulnData.length || 1);
      const avgFood = vulnData.reduce((sum, v) => sum + (v.food_risk || 0), 0) / (vulnData.length || 1);
      const avgEnergy = vulnData.reduce((sum, v) => sum + (v.energy_risk || 0), 0) / (vulnData.length || 1);
      const avgClimate = vulnData.reduce((sum, v) => sum + (v.climate_risk || 0), 0) / (vulnData.length || 1);

      const sdgData = sdgRes.data || [];
      const avgSDG = sdgData.reduce((sum, s) => sum + (Number(s.progress_percent) || 0), 0) / (sdgData.length || 1);
      setSdgAverage(avgSDG);

      setStats([
        {
          id: "countries",
          label: "Countries",
          value: countriesRes.count || ALL_COUNTRIES.length,
          icon: Globe,
          color: "text-primary",
        },
        {
          id: "risk",
          label: "Risk Index",
          value: `${avgRisk.toFixed(0)}%`,
          change: -2.1,
          icon: Shield,
          color: avgRisk > 60 ? "text-destructive" : avgRisk > 40 ? "text-warning" : "text-success",
        },
        {
          id: "health",
          label: "Health",
          value: `${(100 - avgHealth).toFixed(0)}%`,
          change: 1.5,
          icon: Heart,
          color: "text-pink-500",
        },
        {
          id: "food",
          label: "Food Sec.",
          value: `${(100 - avgFood).toFixed(0)}%`,
          change: 0.8,
          icon: Utensils,
          color: "text-amber-500",
        },
        {
          id: "energy",
          label: "Energy",
          value: `${(100 - avgEnergy).toFixed(0)}%`,
          change: 2.1,
          icon: Zap,
          color: "text-yellow-500",
        },
        {
          id: "climate",
          label: "Climate",
          value: `${(100 - avgClimate).toFixed(0)}%`,
          change: -0.5,
          icon: CloudRain,
          color: "text-cyan-500",
        },
        {
          id: "incidents",
          label: "24h Incidents",
          value: incidentsRes.count || 0,
          icon: Activity,
          color: (incidentsRes.count || 0) > 50 ? "text-destructive" : "text-muted-foreground",
        },
      ]);
    };

    fetchGlobalStats();
    const interval = setInterval(fetchGlobalStats, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-1 px-3 py-2 bg-card/90 backdrop-blur-xl border border-primary/20 rounded-full">
        {/* SDG Progress indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full border border-primary/30">
          <Target className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] text-muted-foreground">SDG</span>
          <span className="text-xs font-orbitron font-bold text-primary">{sdgAverage.toFixed(0)}%</span>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Stats */}
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-muted/30 transition-colors cursor-default"
              title={stat.label}
            >
              <Icon className={cn("h-3.5 w-3.5", stat.color)} />
              <span className="text-xs font-orbitron font-bold">{stat.value}</span>
              {stat.change !== undefined && (
                <span className={cn(
                  "text-[10px] flex items-center",
                  stat.change >= 0 ? "text-success" : "text-destructive"
                )}>
                  {stat.change >= 0 ? (
                    <TrendingUp className="h-2.5 w-2.5" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5" />
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
