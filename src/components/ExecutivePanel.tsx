import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, TrendingUp, Activity, AlertTriangle } from "lucide-react";

export const ExecutivePanel = () => {
  const { toast } = useToast();
  const [revenue, setRevenue] = useState<number>(0);
  const [stability, setStability] = useState<number>(0);
  const [healthSeverity, setHealthSeverity] = useState<number>(0);
  const [foodRisk, setFoodRisk] = useState<number>(0);
  const [activeCrises, setActiveCrises] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const yesterday = new Date(Date.now() - 24 * 3600e3).toISOString();
      
      const [
        { data: rev }, 
        { data: energy }, 
        { data: health }, 
        { data: food }, 
        { data: crisis }
      ] = await Promise.all([
        supabase.from("revenue_streams").select("amount_usd").gte("timestamp", yesterday),
        supabase.from("energy_grid").select("stability_index").order("updated_at", { ascending: false }).limit(100),
        supabase.from("health_data").select("severity_index").order("updated_at", { ascending: false }).limit(100),
        supabase.from("food_security").select("yield_index, alert_level").order("updated_at", { ascending: false }).limit(100),
        supabase.from("crisis_events").select("id").in("status", ["monitoring", "escalated"]),
      ]);

      const totalRev = (rev ?? []).reduce((a: number, b: any) => a + Number(b.amount_usd || 0), 0);
      const avgStability = (energy ?? []).reduce((a: number, b: any) => a + Number(b.stability_index || 0), 0) / Math.max(1, (energy ?? []).length);
      const avgHealth = (health ?? []).reduce((a: number, b: any) => a + Number(b.severity_index || 0), 0) / Math.max(1, (health ?? []).length);
      const avgFoodIdx = (food ?? []).reduce((a: number, b: any) => a + Number(b.yield_index || 0), 0) / Math.max(1, (food ?? []).length);
      const foodRiskIdx = 100 - Math.min(100, avgFoodIdx);

      setRevenue(totalRev);
      setStability(isFinite(avgStability) ? Number(avgStability.toFixed(1)) : 0);
      setHealthSeverity(isFinite(avgHealth) ? Number(avgHealth.toFixed(1)) : 0);
      setFoodRisk(isFinite(foodRiskIdx) ? Number(foodRiskIdx.toFixed(1)) : 0);
      setActiveCrises((crisis ?? []).length);
    } catch (e: any) {
      toast({ 
        title: "Executive panel error", 
        description: e.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    load(); 
    const interval = setInterval(load, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Intelligence Score: 0..100 (higher better)
  const intelligenceScore = useMemo(() => {
    const financeScore = Math.min(100, Math.log10(1 + Math.max(0, revenue)) * 20);
    const energyScore = stability;
    const healthScore = Math.max(0, 100 - healthSeverity);
    const foodScore = Math.max(0, 100 - foodRisk);
    const crisisScore = Math.max(0, 100 - activeCrises * 10);

    // Weighted composite
    const score = 0.30 * financeScore + 0.25 * energyScore + 0.20 * healthScore + 0.15 * foodScore + 0.10 * crisisScore;
    return Number(score.toFixed(1));
  }, [revenue, stability, healthSeverity, foodRisk, activeCrises]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    if (score >= 40) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>Executive Intelligence</CardTitle>
          </div>
        </div>
        <CardDescription>
          Aggregated stability, risk, and opportunity metrics
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading metrics...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <div className="p-3 rounded-lg border bg-card/50">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>24h Finance</span>
                </div>
                <div className="text-xl font-bold">${Math.round(revenue).toLocaleString()}</div>
              </div>
              
              <div className="p-3 rounded-lg border bg-card/50">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Activity className="h-3 w-3" />
                  <span>Energy</span>
                </div>
                <div className="text-xl font-bold">{stability}</div>
              </div>
              
              <div className="p-3 rounded-lg border bg-card/50">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Activity className="h-3 w-3" />
                  <span>Health ↓</span>
                </div>
                <div className="text-xl font-bold">{healthSeverity}</div>
              </div>
              
              <div className="p-3 rounded-lg border bg-card/50">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <Activity className="h-3 w-3" />
                  <span>Food Risk ↓</span>
                </div>
                <div className="text-xl font-bold">{foodRisk}</div>
              </div>
              
              <div className="p-3 rounded-lg border bg-card/50">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Crises ↓</span>
                </div>
                <div className="text-xl font-bold">{activeCrises}</div>
              </div>
            </div>

            <div className="p-6 rounded-xl border bg-gradient-to-br from-primary/5 to-secondary/5">
              <div className="text-xs text-muted-foreground mb-2">
                AICIS Global Intelligence Score
              </div>
              <div className={`text-5xl font-extrabold ${getScoreColor(intelligenceScore)}`}>
                {intelligenceScore}
              </div>
              <div className="text-xs text-muted-foreground mt-3">
                Weighted composite: finance(30%) · energy(25%) · health(20%) · food(15%) · crisis(10%)
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
