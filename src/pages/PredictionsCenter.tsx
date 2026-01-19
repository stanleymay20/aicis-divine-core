import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, TrendingDown, Activity, ArrowLeft,
  RefreshCw, Brain, Target, AlertTriangle, Zap,
  Heart, Utensils, Factory, Shield, DollarSign, Globe
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const DIVISION_ICONS: Record<string, any> = {
  health: Heart,
  food: Utensils,
  energy: Zap,
  governance: Globe,
  finance: DollarSign,
  security: Shield,
};

const DIVISION_COLORS: Record<string, string> = {
  health: "#10b981",
  food: "#f59e0b",
  energy: "#3b82f6",
  governance: "#8b5cf6",
  finance: "#06b6d4",
  security: "#ef4444",
};

const PredictionsCenter = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDivision, setSelectedDivision] = useState("all");

  // Fetch all predictions
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
  });

  // Generate predictions mutation
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
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter predictions by division
  const filteredPredictions = predictions?.filter((p: any) => 
    selectedDivision === "all" || p.division === selectedDivision
  );

  // Get division stats
  const divisionStats = predictions?.reduce((acc: any, p: any) => {
    if (!acc[p.division]) {
      acc[p.division] = { count: 0, avgConfidence: 0, highRisk: 0 };
    }
    acc[p.division].count++;
    acc[p.division].avgConfidence += p.confidence || 0;
    if (p.forecast?.risk_level === "high" || p.forecast?.risk_level === "critical") {
      acc[p.division].highRisk++;
    }
    return acc;
  }, {});

  Object.keys(divisionStats || {}).forEach(key => {
    if (divisionStats[key].count > 0) {
      divisionStats[key].avgConfidence /= divisionStats[key].count;
    }
  });

  const getTrendIcon = (trend: string) => {
    if (trend === "increasing") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === "decreasing") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-yellow-500" />;
  };

  const getRiskBadge = (risk: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "outline",
      medium: "secondary",
      high: "default",
      critical: "destructive",
    };
    return <Badge variant={variants[risk] || "outline"}>{risk}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-xl font-orbitron font-bold">Predictions Center</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Global Forecasting</p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => generatePredictions.mutate()}
            disabled={generatePredictions.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${generatePredictions.isPending ? 'animate-spin' : ''}`} />
            Generate New Predictions
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Division Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {Object.entries(DIVISION_ICONS).map(([division, Icon]) => {
            const stats = divisionStats?.[division] || { count: 0, avgConfidence: 0, highRisk: 0 };
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
                    <Icon className="h-5 w-5" style={{ color: DIVISION_COLORS[division] }} />
                    <span className="font-semibold capitalize">{division}</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.count}</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.highRisk > 0 && (
                      <span className="text-destructive">{stats.highRisk} high risk</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

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
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredPredictions?.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No predictions available</p>
                <Button className="mt-4" onClick={() => generatePredictions.mutate()}>
                  Generate Predictions
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {filteredPredictions?.map((prediction: any) => {
                    const Icon = DIVISION_ICONS[prediction.division] || Activity;
                    const color = DIVISION_COLORS[prediction.division] || "#888";
                    const forecast = prediction.forecast || {};

                    return (
                      <Card key={prediction.id} className="overflow-hidden">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div 
                                className="p-2 rounded-lg" 
                                style={{ backgroundColor: `${color}20` }}
                              >
                                <Icon className="h-5 w-5" style={{ color }} />
                              </div>
                              <div>
                                <p className="font-semibold">{prediction.country}</p>
                                <p className="text-sm text-muted-foreground capitalize">
                                  {prediction.division}
                                </p>
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

                          {/* Key Factors */}
                          {forecast.key_factors && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {forecast.key_factors.slice(0, 3).map((factor: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {factor}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Timeline Chart */}
                          {forecast.timeline && forecast.timeline.length > 0 && (
                            <div className="h-[120px] mt-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={forecast.timeline}>
                                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                  <XAxis 
                                    dataKey="date" 
                                    className="text-xs"
                                    tick={{ fill: 'currentColor', fontSize: 10 }}
                                  />
                                  <YAxis 
                                    className="text-xs"
                                    tick={{ fill: 'currentColor', fontSize: 10 }}
                                  />
                                  <Tooltip 
                                    contentStyle={{ 
                                      backgroundColor: 'hsl(var(--card))',
                                      border: '1px solid hsl(var(--border))'
                                    }}
                                  />
                                  <Area 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke={color}
                                    fill={`${color}30`}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-4">
                              <span>Confidence: {((prediction.confidence || 0) * 100).toFixed(0)}%</span>
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
      </main>
    </div>
  );
};

export default PredictionsCenter;
