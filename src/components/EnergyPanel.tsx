import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Zap, TrendingUp, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

export const EnergyPanel = () => {
  const [loading, setLoading] = useState(false);
  const [energyData, setEnergyData] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchEnergyData = async () => {
    try {
      const { data } = await supabase
        .from('energy_grid')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (data) setEnergyData(data);
    } catch (error) {
      console.error('Error fetching energy data:', error);
    }
  };

  const refreshData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-energy-live');
      if (error) throw error;
      
      toast({
        title: "Energy Data Refreshed",
        description: data.message || "Successfully updated energy grid data",
      });
      
      await fetchEnergyData();
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnergyData();
  }, []);

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-orbitron font-semibold text-primary">Energy Grid Monitor</h3>
            <p className="text-sm text-muted-foreground">Real-time grid stability & renewable integration</p>
          </div>
        </div>
        <Button onClick={refreshData} disabled={loading} size="sm">
          Refresh Data
        </Button>
      </div>

      <div className="space-y-4">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={energyData}>
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
            <Line type="monotone" dataKey="stability_index" stroke="hsl(var(--primary))" strokeWidth={2} />
            <Line type="monotone" dataKey="renewable_percentage" stroke="hsl(var(--chart-2))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
          {energyData.map((record) => (
            <div key={record.id} className="p-3 bg-background/50 rounded-lg border border-border/50">
              <div className="flex items-start justify-between mb-1">
                <span className="text-sm font-medium">{record.region}</span>
                {Number(record.stability_index) >= 90 ? (
                  <TrendingUp className="w-4 h-4 text-chart-2" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-destructive" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Stability:</span>
                  <span className={`font-medium ${
                    Number(record.stability_index) >= 90 ? 'text-chart-2' :
                    Number(record.stability_index) >= 70 ? 'text-yellow-500' :
                    'text-destructive'
                  }`}>
                    {Number(record.stability_index).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Renewable:</span>
                  <span className="font-medium text-chart-2">
                    {Number(record.renewable_percentage || 0).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Load:</span>
                  <span className="font-medium">{Number(record.grid_load).toFixed(0)} MW</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
