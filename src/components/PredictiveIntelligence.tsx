import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Activity, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface Prediction {
  id: string;
  division: string;
  country: string;
  forecast: any;
  confidence: number;
  volatility_index: number;
  predicted_at: string;
}

export const PredictiveIntelligence = () => {
  const { data: predictions = [] } = useQuery({
    queryKey: ['predictions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .order('predicted_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as Prediction[];
    }
  });

  const divisions = ['health', 'food', 'energy', 'governance', 'finance', 'security'];
  
  const getPredictionsByDivision = (division: string) => {
    return predictions.filter(p => p.division === division);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return { variant: 'default', label: 'Very High' };
    if (confidence >= 0.75) return { variant: 'default', label: 'High' };
    if (confidence >= 0.6) return { variant: 'secondary', label: 'Medium' };
    return { variant: 'destructive', label: 'Low' };
  };

  const getTrendIcon = (forecast: any) => {
    if (forecast?.trend === 'increasing') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (forecast?.trend === 'decreasing') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Activity className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Predictive Intelligence System
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          90-day forecasts with AI-driven confidence metrics
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="health" className="space-y-4">
          <TabsList className="grid grid-cols-6 w-full">
            {divisions.map(div => (
              <TabsTrigger key={div} value={div} className="capitalize">
                {div}
              </TabsTrigger>
            ))}
          </TabsList>

          {divisions.map(division => (
            <TabsContent key={division} value={division} className="space-y-4">
              <div className="grid gap-4">
                {getPredictionsByDivision(division).length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No predictions available for {division}</p>
                    <p className="text-xs mt-2">Forecasts will appear after data collection</p>
                  </div>
                ) : (
                  getPredictionsByDivision(division).slice(0, 5).map((pred) => {
                    const confidenceBadge = getConfidenceBadge(pred.confidence);
                    
                    return (
                      <div key={pred.id} className="p-4 border rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{pred.country}</h4>
                              {getTrendIcon(pred.forecast)}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {pred.forecast?.summary || 'Analyzing trends...'}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant={confidenceBadge.variant as any}>
                                Confidence: {(pred.confidence * 100).toFixed(1)}% ({confidenceBadge.label})
                              </Badge>
                              <Badge variant="outline">
                                Volatility: {(pred.volatility_index * 100).toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {pred.forecast?.timeline && (
                          <div className="mt-4 h-[150px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={pred.forecast.timeline}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis 
                                  dataKey="date" 
                                  className="text-xs" 
                                  tick={{ fill: 'currentColor' }}
                                />
                                <YAxis 
                                  className="text-xs"
                                  tick={{ fill: 'currentColor' }}
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
                                  stroke="hsl(var(--primary))" 
                                  fill="hsl(var(--primary) / 0.2)" 
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        <div className="mt-3 text-xs text-muted-foreground">
                          Forecast generated: {new Date(pred.predicted_at).toLocaleString()}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
