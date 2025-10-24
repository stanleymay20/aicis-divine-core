import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Scale, Brain, AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function EthicsDashboard() {
  const { data: decisions, isLoading: decisionsLoading } = useQuery({
    queryKey: ['ai-decision-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_decision_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    }
  });

  const { data: ethicsCases } = useQuery({
    queryKey: ['ethics-cases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ethics_cases')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const calculateTrustScore = () => {
    if (!decisions || decisions.length === 0) return 0;
    
    const avgConfidence = decisions.reduce((sum, d) => sum + (Number(d.confidence) || 0), 0) / decisions.length;
    const avgBias = decisions.reduce((sum, d) => sum + (Number(d.bias_score) || 0), 0) / decisions.length;
    
    // Trust score = (confidence) - (bias penalty)
    return Math.max(0, Math.min(100, avgConfidence - (avgBias * 2)));
  };

  const getBiasCategory = (biasScore: number) => {
    if (biasScore < 5) return { label: 'Low', color: 'text-green-600' };
    if (biasScore < 15) return { label: 'Medium', color: 'text-yellow-600' };
    return { label: 'High', color: 'text-red-600' };
  };

  const trustScore = calculateTrustScore();

  const chartData = decisions?.slice(0, 20).reverse().map((d, i) => ({
    index: i + 1,
    bias: Number(d.bias_score) || 0,
    confidence: Number(d.confidence) || 0,
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Scale className="w-8 h-8" />
            AI Ethics & Transparency Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">Monitoring AI decisions, bias, and accountability</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Shield className="w-4 h-4" />
          Ethics Report
        </Button>
      </div>

      {/* Trust Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Trust Score</h3>
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold">{trustScore.toFixed(1)}%</div>
            <Progress value={trustScore} className="h-2" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Total Decisions</h3>
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold">{decisions?.length || 0}</div>
          <p className="text-xs text-muted-foreground mt-2">Logged decisions</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Ethics Cases</h3>
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-3xl font-bold">{ethicsCases?.length || 0}</div>
          <p className="text-xs text-muted-foreground mt-2">Active appeals</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Avg Bias Score</h3>
            <Scale className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold">
            {decisions?.length 
              ? (decisions.reduce((sum, d) => sum + (Number(d.bias_score) || 0), 0) / decisions.length).toFixed(1)
              : 0}%
          </div>
          <p className="text-xs text-muted-foreground mt-2">Lower is better</p>
        </Card>
      </div>

      {/* Bias Trend Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Bias & Confidence Trends</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="index" label={{ value: 'Recent Decisions', position: 'insideBottom', offset: -5 }} />
            <YAxis label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }} />
            <Tooltip />
            <Line type="monotone" dataKey="bias" stroke="hsl(var(--destructive))" name="Bias Score" />
            <Line type="monotone" dataKey="confidence" stroke="hsl(var(--primary))" name="Confidence" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Decision Log Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent AI Decisions</h3>
        <div className="space-y-3">
          {decisionsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading decisions...</div>
          ) : decisions && decisions.length > 0 ? (
            decisions.slice(0, 10).map((decision) => {
              const biasCategory = getBiasCategory(Number(decision.bias_score) || 0);
              
              return (
                <div key={decision.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{decision.model_name}</Badge>
                        <Badge variant="secondary">{decision.division_key}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{decision.input_summary}</p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {new Date(decision.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Confidence:</span>{' '}
                      <span className="font-medium">{Number(decision.confidence || 0).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bias:</span>{' '}
                      <span className={`font-medium ${biasCategory.color}`}>
                        {Number(decision.bias_score || 0).toFixed(1)}% ({biasCategory.label})
                      </span>
                    </div>
                  </div>

                  {decision.ethical_flags && decision.ethical_flags.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {decision.ethical_flags.map((flag: string, i: number) => (
                        <Badge key={i} variant="destructive" className="text-xs">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">No decisions logged yet</div>
          )}
        </div>
      </Card>
    </div>
  );
}