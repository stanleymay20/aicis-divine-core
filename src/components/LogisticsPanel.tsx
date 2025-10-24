import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Truck, AlertCircle, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const LogisticsPanel = () => {
  const [loading, setLoading] = useState(false);
  const [logisticsData, setLogisticsData] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchLogisticsData = async () => {
    try {
      const { data } = await supabase
        .from('logistics_data' as any)
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (data) setLogisticsData(data);
    } catch (error) {
      console.error('Error fetching logistics data:', error);
    }
  };

  const optimizeRoutes = async () => {
    setLoading(true);
    try {
      // Simulate route optimization
      const optimizedCount = Math.floor(Math.random() * 5) + 1;
      
      toast({
        title: "Route Optimization Complete",
        description: `${optimizedCount} routes optimized for efficiency`,
      });
      
      await fetchLogisticsData();
    } catch (error) {
      toast({
        title: "Optimization Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogisticsData();
  }, []);

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-orbitron font-semibold text-primary">Logistics & Transport</h3>
            <p className="text-sm text-muted-foreground">Route optimization & supply chain tracking</p>
          </div>
        </div>
        <Button onClick={optimizeRoutes} disabled={loading} size="sm">
          Optimize Routes
        </Button>
      </div>

      <div className="space-y-4">
        {logisticsData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={logisticsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="route" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--primary))",
                    borderRadius: "8px"
                  }}
                />
                <Bar dataKey="delay_index" fill="hsl(var(--destructive))" />
                <Bar dataKey="efficiency_score" fill="hsl(var(--chart-2))" />
              </BarChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
              {logisticsData.map((record) => (
                <div key={record.id} className="p-3 bg-background/50 rounded-lg border border-border/50">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm font-medium">{record.route}</span>
                    {Number(record.delay_index) < 10 ? (
                      <CheckCircle className="w-4 h-4 text-chart-2" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{record.transport_type}</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Delay Index:</span>
                    <span className={`font-medium ${
                      Number(record.delay_index) < 10 ? 'text-chart-2' :
                      Number(record.delay_index) < 30 ? 'text-yellow-500' :
                      'text-destructive'
                    }`}>
                      {Number(record.delay_index).toFixed(1)}
                    </span>
                  </div>
                  {record.volume_tons && (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Volume:</span>
                      <span className="font-medium">{Number(record.volume_tons).toFixed(0)} tons</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No logistics data available. System is collecting route information.</p>
          </div>
        )}
      </div>
    </Card>
  );
};
