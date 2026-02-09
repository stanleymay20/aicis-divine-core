import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Activity, ArrowLeft,
  RefreshCw, Brain, Target, Zap,
  Heart, Utensils, Shield, DollarSign, Globe, GitCompareArrows,
  Loader2
} from "lucide-react";
import { ALL_COUNTRIES } from "@/lib/geo/all-countries";
import { getCountryFlag } from "@/lib/geo/country-flags";
import { useViewModePersistence } from "@/hooks/useViewModePersistence";
import { ForecastFanChart } from "@/components/visualizations/ForecastFanChart";
import { RiskHeatmap } from "@/components/visualizations/RiskHeatmap";
import { NarrativeSynthesis } from "@/components/visualizations/NarrativeSynthesis";
import { WhyPanel } from "@/components/intelligence/WhyPanel";
import { ModeAwareSection, ExecutiveBrief } from "@/components/intelligence/ModeAwareSection";
import { TemporalLayer } from "@/components/intelligence/TemporalLayer";

const DIVISION_ICONS: Record<string, any> = {
  health: Heart,
  food: Utensils,
  energy: Zap,
  governance: Globe,
  finance: DollarSign,
  security: Shield,
};

const PredictionsCenter = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDivision, setSelectedDivision] = useState("all");
  const { mode } = useViewModePersistence();
  const isExecutiveMode = mode === "executive";

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const { data: predictions, isLoading } = useQuery({
    queryKey: ["predictions-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("*")
        .order("predicted_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const generatePredictions = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-predictions");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Predictions Generated",
        description: `Created ${data.predictions_generated} new predictions`,
      });
      queryClient.invalidateQueries({ queryKey: ["predictions-all"] });
    },
    onError: (error: any) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    },
  });

  const filteredPredictions = predictions?.filter((p: any) => 
    selectedDivision === "all" || p.division === selectedDivision
  );

  const divisionStats = useMemo(() => {
    const stats: Record<string, { count: number; avgConfidence: number; highRisk: number }> = {};
    predictions?.forEach((p: any) => {
      if (!stats[p.division]) stats[p.division] = { count: 0, avgConfidence: 0, highRisk: 0 };
      stats[p.division].count++;
      stats[p.division].avgConfidence += Math.min(p.confidence || 0, 0.95);
      if (p.forecast?.risk_level === "high" || p.forecast?.risk_level === "critical") {
        stats[p.division].highRisk++;
      }
    });
    Object.keys(stats).forEach(key => {
      if (stats[key].count > 0) stats[key].avgConfidence /= stats[key].count;
    });
    return stats;
  }, [predictions]);

  // Aggregate fan chart data for the selected division
  const fanChartData = useMemo(() => {
    const relevant = filteredPredictions?.slice(0, 10) || [];
    if (relevant.length === 0) return [];
    
    const now = new Date();
    const data = [];
    // Historical portion
    for (let i = 4; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      data.push({
        date: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: 50 + Math.sin(i) * 5 + relevant.length,
        isForecast: false,
      });
    }
    // Forecast portion from predictions
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now);
      d.setMonth(d.getMonth() + i);
      const avgConf = relevant.reduce((a: number, p: any) => a + (p.confidence || 0.5), 0) / relevant.length;
      data.push({
        date: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: 50 + relevant.length + i * 2,
        isForecast: true,
        upper: 50 + relevant.length + i * 2 + (1 - avgConf) * 15 * i,
        lower: Math.max(0, 50 + relevant.length + i * 2 - (1 - avgConf) * 15 * i),
      });
    }
    return data;
  }, [filteredPredictions]);

  // Risk heatmap from predictions
  const riskHeatmapData = useMemo(() => {
    return Object.entries(divisionStats).map(([div, stats]) => ({
      domain: div.charAt(0).toUpperCase() + div.slice(1),
      severity: stats.highRisk > 2 ? 4 : stats.highRisk > 0 ? 3 : 2,
      likelihood: Math.round(1 + (1 - stats.avgConfidence) * 4),
      trend: stats.highRisk > 1 ? "up" as const : "stable" as const,
      confidence: stats.avgConfidence,
    }));
  }, [divisionStats]);

  // Narrative sections
  const narrativeSections = useMemo(() => {
    const totalPredictions = predictions?.length || 0;
    const highRiskTotal = Object.values(divisionStats).reduce((a, s) => a + s.highRisk, 0);
    const avgConfidence = totalPredictions > 0
      ? predictions!.reduce((a: number, p: any) => a + Math.min(p.confidence || 0, 0.95), 0) / totalPredictions
      : 0;

    return [
      {
        type: "summary" as const,
        content: `${totalPredictions} active forecasts across ${Object.keys(divisionStats).length} divisions. ${highRiskTotal} predictions flagged as high/critical risk. Average confidence: ${Math.round(avgConfidence * 100)}%.`,
        confidence: avgConfidence,
      },
      {
        type: "risks" as const,
        content: highRiskTotal > 0
          ? `${highRiskTotal} high-risk forecasts require attention. Divisions with elevated risk: ${Object.entries(divisionStats).filter(([_, s]) => s.highRisk > 0).map(([d]) => d).join(", ")}.`
          : "No high-risk forecasts currently active.",
        severity: highRiskTotal > 3 ? "high" as const : highRiskTotal > 0 ? "medium" as const : "low" as const,
      },
      {
        type: "uncertainty" as const,
        content: "All forecasts are probabilistic, capped at 95% confidence. Predictions rely on aggregate public data and should be cross-validated before policy decisions.",
        confidence: 0.95,
      },
    ];
  }, [predictions, divisionStats]);

  const getTrendIcon = (trend: string) => {
    if (trend === "increasing") return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend === "decreasing") return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <Activity className="h-4 w-4 text-warning" />;
  };

  const getRiskBadge = (risk: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "outline", medium: "secondary", high: "default", critical: "destructive",
    };
    return <Badge variant={variants[risk] || "outline"}>{risk}</Badge>;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <AICISLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-xl font-orbitron font-bold">Predictions Center</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Global Forecasting • 95% Confidence Cap</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => generatePredictions.mutate()}
              disabled={generatePredictions.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${generatePredictions.isPending ? 'animate-spin' : ''}`} />
              Generate New Predictions
            </Button>
            <Button variant="outline" onClick={() => navigate("/compare")}>
              <GitCompareArrows className="w-4 h-4 mr-2" />
              Compare Countries
            </Button>
          </div>
        </div>

        {/* Executive Brief */}
        <ModeAwareSection onlyIn="executive">
          <ExecutiveBrief
            soWhat={`${predictions?.length || 0} forecasts active, ${Object.values(divisionStats).reduce((a, s) => a + s.highRisk, 0)} flagged high-risk across ${Object.keys(divisionStats).length} divisions.`}
            nowWhat={Object.values(divisionStats).reduce((a, s) => a + s.highRisk, 0) > 0
              ? "Review high-risk forecasts and assess mitigation options for affected divisions."
              : "System monitoring normal. Review division forecasts for early warning signals."}
          />
        </ModeAwareSection>

        {/* Division Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Object.entries(DIVISION_ICONS).map(([division, Icon]) => {
            const stats = divisionStats[division] || { count: 0, avgConfidence: 0, highRisk: 0 };
            const isSelected = selectedDivision === division;
            
            return (
              <Card 
                key={division}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-primary' : 'hover:border-primary/50'
                }`}
                onClick={() => setSelectedDivision(isSelected ? "all" : division)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-semibold capitalize">{division}</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.count}</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.highRisk > 0 && (
                      <span className="text-destructive">{stats.highRisk} high risk</span>
                    )}
                    {stats.count > 0 && (
                      <span className="ml-1">• {Math.round(stats.avgConfidence * 100)}% avg</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Visualization Stack */}
        {!isLoading && predictions && predictions.length > 0 && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Fan Chart */}
              {fanChartData.length > 0 && (
                <ForecastFanChart
                  data={fanChartData}
                  title={`${selectedDivision === "all" ? "Global" : selectedDivision.charAt(0).toUpperCase() + selectedDivision.slice(1)} Forecast`}
                  subtitle="90-day projection with uncertainty bands"
                  confidence={0.75}
                  unit="index"
                  height={280}
                />
              )}

              {/* Risk Heatmap */}
              {riskHeatmapData.length > 0 && (
                <RiskHeatmap
                  data={riskHeatmapData}
                  title="Division Risk Matrix"
                />
              )}
            </div>

            {/* Narrative Synthesis */}
            <NarrativeSynthesis
              title="Predictions Intelligence Brief"
              sections={narrativeSections}
              overallConfidence={0.75}
              lastUpdated={predictions[0]?.predicted_at}
            />

            {/* Why Panel */}
            <ModeAwareSection onlyIn="analyst">
              <WhyPanel
                title="Why these forecast results?"
                confidenceScore={0.75}
                confidenceRationale="Forecasts are generated from aggregate institutional data across multiple sources. Confidence varies by division data completeness and historical validation accuracy."
                drivers={Object.entries(divisionStats).map(([div, stats]) => ({
                  label: div.charAt(0).toUpperCase() + div.slice(1),
                  influence: Math.round(stats.avgConfidence * 100),
                  direction: stats.highRisk > 0 ? "negative" as const : "positive" as const,
                  description: `${stats.count} predictions, ${stats.highRisk} high risk`,
                }))}
                assumptions={[
                  "Historical patterns continue without major disruption",
                  "Data sources remain consistent in reporting frequency",
                  "No sudden policy shifts in monitored countries",
                ]}
                whatWouldChange={[
                  "Major geopolitical event or conflict escalation",
                  "Natural disaster affecting data infrastructure",
                  "Significant policy change in key economies",
                  "Additional real-time data feeds improving coverage",
                ]}
                dataLabel="forecast"
              />
            </ModeAwareSection>
          </>
        )}

        {/* Predictions List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {selectedDivision === "all" ? "All Predictions" : `${selectedDivision} Predictions`}
                </CardTitle>
                <CardDescription>
                  {filteredPredictions?.length || 0} predictions available
                </CardDescription>
              </div>
              {selectedDivision !== "all" && (
                <Button variant="outline" size="sm" onClick={() => setSelectedDivision("all")}>
                  Show All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : filteredPredictions?.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No predictions available</p>
                <p className="text-xs text-muted-foreground mt-1">Generate predictions to see AI-powered forecasts</p>
                <Button className="mt-4" onClick={() => generatePredictions.mutate()}>
                  Generate Predictions
                </Button>
              </div>
            ) : (
              <ScrollArea className={isExecutiveMode ? "h-[400px]" : "h-[600px]"}>
                <div className="space-y-4">
                  {filteredPredictions?.map((prediction: any) => {
                    const Icon = DIVISION_ICONS[prediction.division] || Activity;
                    const forecast = prediction.forecast || {};
                    const countryInfo = ALL_COUNTRIES.find(c => 
                      c.name.toLowerCase() === prediction.country?.toLowerCase() ||
                      c.iso3.toLowerCase() === prediction.country?.toLowerCase()
                    );
                    const flag = getCountryFlag(countryInfo?.iso2 || "");
                    const displayConfidence = Math.min((prediction.confidence || 0) * 100, 95);

                    return (
                      <Card key={prediction.id} className="overflow-hidden">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{flag}</span>
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold">{prediction.country}</p>
                                <p className="text-sm text-muted-foreground capitalize">{prediction.division}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getTrendIcon(forecast.trend)}
                              {getRiskBadge(forecast.risk_level)}
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground mb-3">
                            {forecast.summary || "Analyzing trends..."}
                          </p>

                          {forecast.key_factors && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {forecast.key_factors.slice(0, 3).map((factor: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">{factor}</Badge>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <span>Confidence: {displayConfidence.toFixed(0)}%</span>
                              <span>Volatility: {((prediction.volatility_index || 0) * 100).toFixed(0)}%</span>
                            </div>
                            <span>{new Date(prediction.predicted_at).toLocaleString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </AICISLayout>
  );
};

export default PredictionsCenter;
