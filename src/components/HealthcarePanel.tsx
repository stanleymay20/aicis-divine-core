import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Activity, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const HealthcarePanel = () => {
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchHealthData = async () => {
    try {
      const { data } = await supabase
        .from('health_data')
        .select('*')
        .order('risk_level', { ascending: false })
        .limit(10);

      if (data) setHealthData(data);
    } catch (error) {
      console.error('Error fetching health data:', error);
    }
  };

  const analyzeHealth = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-health');
      if (error) throw error;
      
      toast({
        title: "Health Analysis Complete",
        description: `${data.metrics.total_tracked} regions monitored. ${data.metrics.critical_regions} critical alerts.`,
      });
      
      await fetchHealthData();
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-orbitron font-semibold text-primary">Global Healthcare Monitor</h3>
            <p className="text-sm text-muted-foreground">AI-powered disease tracking & risk assessment</p>
          </div>
        </div>
        <Button onClick={analyzeHealth} disabled={loading} size="sm">
          Analyze Health Risks
        </Button>
      </div>

      <div className="space-y-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={healthData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="region" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--primary))",
                borderRadius: "8px"
              }}
            />
            <Bar dataKey="affected_count" fill="hsl(var(--destructive))" />
          </BarChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
          {healthData.map((record) => (
            <div key={record.id} className="p-3 bg-background/50 rounded-lg border border-border/50">
              <div className="flex items-start justify-between mb-1">
                <span className="text-sm font-medium">{record.region}</span>
                {(record.risk_level === 'critical' || record.risk_level === 'high') && (
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{record.disease}</p>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-muted-foreground">Cases: {record.affected_count}</span>
                <span className={`text-xs font-medium ${
                  record.risk_level === 'critical' ? 'text-destructive' :
                  record.risk_level === 'high' ? 'text-orange-500' :
                  record.risk_level === 'medium' ? 'text-yellow-500' :
                  'text-green-500'
                }`}>
                  {record.risk_level}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
