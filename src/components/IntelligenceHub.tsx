import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Brain, TrendingUp, AlertTriangle, Target, RefreshCw } from "lucide-react";

export const IntelligenceHub = () => {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: intelligence, refetch: refetchIntelligence } = useQuery({
    queryKey: ['intelligence-index'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intelligence_index')
        .select('*')
        .order('priority', { ascending: false })
        .order('generated_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: risks, refetch: refetchRisks } = useQuery({
    queryKey: ['risk-predictions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('risk_predictions')
        .select('*')
        .order('probability', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: anomalies, refetch: refetchAnomalies } = useQuery({
    queryKey: ['anomaly-detections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anomaly_detections')
        .select('*')
        .eq('status', 'active')
        .order('severity', { ascending: false })
        .order('detected_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleGlobalAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-global-status', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Global Analysis Complete",
        description: data.message,
      });

      refetchIntelligence();
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRiskPrediction = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('predict-risks', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Risk Prediction Complete",
        description: data.message,
      });

      refetchRisks();
    } catch (error: any) {
      toast({
        title: "Prediction Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAnomalyDetection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('detect-anomalies', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Anomaly Detection Complete",
        description: data.message,
      });

      refetchAnomalies();
    } catch (error: any) {
      toast({
        title: "Detection Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getIndexTypeBadge = (type: string) => {
    const variants: Record<string, any> = {
      global_status: "default",
      risk_assessment: "destructive",
      opportunity: "default",
      threat: "destructive",
      anomaly: "secondary",
    };
    return <Badge variant={variants[type] || "outline"}>{type.replace('_', ' ')}</Badge>;
  };

  const getRiskBadge = (level: string) => {
    const variants: Record<string, any> = {
      low: "outline",
      medium: "secondary",
      high: "destructive",
      critical: "destructive",
    };
    return <Badge variant={variants[level] || "outline"}>{level}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>AICIS Intelligence Hub</CardTitle>
          </div>
          <Button 
            onClick={handleGlobalAnalysis} 
            disabled={isAnalyzing}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
            Analyze
          </Button>
        </div>
        <CardDescription>
          Cross-division intelligence, risk prediction, and anomaly detection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="intelligence">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="risks">Risk Predictions</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
          </TabsList>

          <TabsContent value="intelligence" className="space-y-4 mt-4">
            {intelligence && intelligence.length > 0 ? (
              intelligence.map((item) => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{item.title}</h4>
                      <div className="flex gap-2 mt-1">
                        {getIndexTypeBadge(item.index_type)}
                        <Badge variant="outline">Priority: {item.priority}/10</Badge>
                        <Badge variant="outline">Confidence: {item.confidence_score}%</Badge>
                      </div>
                    </div>
                  </div>
                  {item.summary_md && (
                    <div className="text-sm prose prose-sm dark:prose-invert mt-2">
                      {item.summary_md.substring(0, 200)}...
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.affected_divisions.map((div: string) => (
                      <Badge key={div} variant="secondary" className="text-xs">
                        {div}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Generated: {new Date(item.generated_at).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 space-y-4">
                <p className="text-muted-foreground">No intelligence data available.</p>
                <Button onClick={handleGlobalAnalysis} variant="outline">
                  <Target className="h-4 w-4 mr-2" />
                  Run Analysis
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="risks" className="space-y-4 mt-4">
            <div className="flex justify-end mb-2">
              <Button onClick={handleRiskPrediction} size="sm" variant="outline">
                <TrendingUp className="h-4 w-4 mr-2" />
                Predict Risks
              </Button>
            </div>
            {risks && risks.length > 0 ? (
              risks.map((risk) => (
                <div key={risk.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{risk.title}</h4>
                      <div className="flex gap-2 mt-1">
                        {getRiskBadge(risk.risk_level)}
                        <Badge variant="outline">Probability: {risk.probability}%</Badge>
                        <Badge variant="outline">Impact: {risk.impact_score}/100</Badge>
                      </div>
                    </div>
                  </div>
                  {risk.description_md && (
                    <div className="text-sm prose prose-sm dark:prose-invert mt-2">
                      {risk.description_md.substring(0, 150)}...
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {risk.affected_divisions.map((div: string) => (
                      <Badge key={div} variant="secondary" className="text-xs">
                        {div}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Timeframe: {risk.predicted_timeframe} | Confidence: {risk.confidence_level}%
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No risk predictions available.
              </p>
            )}
          </TabsContent>

          <TabsContent value="anomalies" className="space-y-4 mt-4">
            <div className="flex justify-end mb-2">
              <Button onClick={handleAnomalyDetection} size="sm" variant="outline">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Detect Anomalies
              </Button>
            </div>
            {anomalies && anomalies.length > 0 ? (
              anomalies.map((anomaly) => (
                <div key={anomaly.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold capitalize">{anomaly.division} - {anomaly.anomaly_type}</h4>
                      <div className="flex gap-2 mt-1">
                        {getRiskBadge(anomaly.severity)}
                        <Badge variant="outline">{anomaly.status}</Badge>
                        {anomaly.deviation_percentage && (
                          <Badge variant="secondary">
                            {anomaly.deviation_percentage > 0 ? '↑' : '↓'} {Math.abs(anomaly.deviation_percentage).toFixed(1)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm mt-2">{anomaly.description}</div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Detected: {new Date(anomaly.detected_at).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No active anomalies detected.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};