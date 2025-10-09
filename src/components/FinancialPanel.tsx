import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))'];

export const FinancialPanel = () => {
  const [loading, setLoading] = useState(false);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [exchangeBalances, setExchangeBalances] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchFinancialData = async () => {
    try {
      const { data: revenues } = await supabase
        .from('revenue_streams')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: exchanges } = await supabase
        .from('exchange_accounts')
        .select('*');

      if (revenues) {
        const aggregated = revenues.reduce((acc: any, curr) => {
          const existing = acc.find((item: any) => item.division === curr.division);
          if (existing) {
            existing.amount += Number(curr.amount_usd);
          } else {
            acc.push({ division: curr.division, amount: Number(curr.amount_usd) });
          }
          return acc;
        }, []);
        setRevenueData(aggregated);
      }

      if (exchanges) {
        setExchangeBalances(exchanges.map(e => ({
          name: e.exchange,
          value: Number(e.balance_usd)
        })));
      }
    } catch (error) {
      console.error('Error fetching financial data:', error);
    }
  };

  const analyzeRevenue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-revenue');
      if (error) throw error;
      
      toast({
        title: "Revenue Analysis Complete",
        description: `Total Revenue: $${data.metrics.total_revenue.toLocaleString()}`,
      });
      
      await fetchFinancialData();
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

  const updateBalances = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-exchange-balances');
      if (error) throw error;
      
      toast({
        title: "Balances Updated",
        description: `Updated ${data.updated} exchange accounts`,
      });
      
      await fetchFinancialData();
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-orbitron font-semibold text-primary">Revenue by Division</h3>
            <p className="text-sm text-muted-foreground">AI-driven income streams</p>
          </div>
          <Button onClick={analyzeRevenue} disabled={loading} size="sm">
            Analyze
          </Button>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="division" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--primary))",
                borderRadius: "8px"
              }}
            />
            <Bar dataKey="amount" fill="hsl(var(--secondary))" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
        <div className="mb-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-orbitron font-semibold text-primary">Exchange Balances</h3>
            <p className="text-sm text-muted-foreground">Real-time portfolio distribution</p>
          </div>
          <Button onClick={updateBalances} disabled={loading} size="sm">
            Update
          </Button>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={exchangeBalances}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: $${(value / 1000).toFixed(0)}K`}
              outerRadius={80}
              fill="hsl(var(--primary))"
              dataKey="value"
            >
              {exchangeBalances.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};
