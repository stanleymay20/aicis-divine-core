import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Wheat, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const FoodSecurityPanel = () => {
  const [loading, setLoading] = useState(false);
  const [foodData, setFoodData] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchFoodData = async () => {
    try {
      const { data } = await supabase
        .from('food_security')
        .select('*')
        .order('alert_level', { ascending: false })
        .limit(10);

      if (data) setFoodData(data);
    } catch (error) {
      console.error('Error fetching food security data:', error);
    }
  };

  const optimizeFood = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-food');
      if (error) throw error;
      
      toast({
        title: "Food Security Optimization Complete",
        description: `Avg yield: ${data.metrics.average_yield_index}%. ${data.metrics.critical_regions} critical regions identified.`,
      });
      
      await fetchFoodData();
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
    fetchFoodData();
  }, []);

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Wheat className="w-5 h-5 text-primary" />
          <div>
            <h3 className="text-lg font-orbitron font-semibold text-primary">Food Security Intelligence</h3>
            <p className="text-sm text-muted-foreground">AI-optimized agricultural monitoring</p>
          </div>
        </div>
        <Button onClick={optimizeFood} disabled={loading} size="sm">
          Optimize Distribution
        </Button>
      </div>

      <div className="space-y-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={foodData}>
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
            <Legend />
            <Bar dataKey="yield_index" fill="hsl(var(--primary))" name="Yield Index" />
            <Bar dataKey="supply_days" fill="hsl(var(--secondary))" name="Supply Days" />
          </BarChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
          {foodData.map((record) => (
            <div key={record.id} className="p-3 bg-background/50 rounded-lg border border-border/50">
              <div className="flex items-start justify-between mb-1">
                <span className="text-sm font-medium">{record.region}</span>
                {(record.alert_level === 'critical' || record.alert_level === 'high') && (
                  <TrendingDown className="w-4 h-4 text-destructive" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{record.crop}</p>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-muted-foreground">Yield: {record.yield_index}%</span>
                <span className="text-xs text-muted-foreground">Supply: {record.supply_days}d</span>
              </div>
              <span className={`text-xs font-medium ${
                record.alert_level === 'critical' ? 'text-destructive' :
                record.alert_level === 'high' ? 'text-orange-500' :
                record.alert_level === 'medium' ? 'text-yellow-500' :
                'text-green-500'
              }`}>
                {record.alert_level}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
