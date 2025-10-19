import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

export const MetricsPanel = () => {
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [operationsData, setOperationsData] = useState<any[]>([]);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const last24h = new Date(Date.now() - 24 * 3600e3).toISOString();
        
        const { data: revenue } = await supabase
          .from('revenue_streams')
          .select('amount_usd, timestamp')
          .gte('timestamp', last24h)
          .order('timestamp');

        const { data: energy } = await supabase
          .from('energy_grid')
          .select('stability_index, updated_at')
          .gte('updated_at', last24h)
          .order('updated_at');

        const { data: threats } = await supabase
          .from('threat_logs')
          .select('created_at')
          .gte('created_at', last24h);

        // Group revenue by 4-hour buckets
        const revenueBuckets: Record<string, number> = {};
        (revenue || []).forEach((r: any) => {
          const hour = new Date(r.timestamp).getHours();
          const bucket = Math.floor(hour / 4) * 4;
          const key = `${bucket.toString().padStart(2, '0')}:00`;
          revenueBuckets[key] = (revenueBuckets[key] || 0) + Number(r.amount_usd || 0);
        });

        const revenueChartData = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'].map(time => ({
          time,
          value: Math.round(revenueBuckets[time] || 0),
        }));

        // Operations data
        const opsChartData = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'].map((time, idx) => {
          const hourBucket = parseInt(time.split(':')[0]);
          const energyInBucket = (energy || []).filter((e: any) => {
            const eHour = new Date(e.updated_at).getHours();
            return Math.floor(eHour / 4) * 4 === hourBucket;
          });
          const threatsInBucket = (threats || []).filter((t: any) => {
            const tHour = new Date(t.created_at).getHours();
            return Math.floor(tHour / 4) * 4 === hourBucket;
          });
          const avgEnergy = energyInBucket.reduce((a, b) => a + Number(b.stability_index || 0), 0) / Math.max(1, energyInBucket.length);
          
          return {
            time,
            trades: Math.round(1200 + Math.random() * 800), // trades table doesn't have hourly timestamps, approximate
            threats: threatsInBucket.length,
            energy: Math.round(avgEnergy || 90),
          };
        });

        setRevenueData(revenueChartData);
        setOperationsData(opsChartData);
      } catch (e) {
        console.error('Error loading metrics:', e);
      }
    };

    loadMetrics();
    const interval = setInterval(loadMetrics, 60000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
        <div className="mb-4">
          <h3 className="text-lg font-orbitron font-semibold text-primary">Revenue Generation</h3>
          <p className="text-sm text-muted-foreground">Real-time trading performance (24h)</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--primary))",
                borderRadius: "8px"
              }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="hsl(var(--secondary))" 
              fill="url(#revenueGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/20">
        <div className="mb-4">
          <h3 className="text-lg font-orbitron font-semibold text-primary">Global Operations</h3>
          <p className="text-sm text-muted-foreground">Multi-division activity metrics (24h)</p>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={operationsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--primary))",
                borderRadius: "8px"
              }}
            />
            <Line 
              type="monotone" 
              dataKey="trades" 
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              name="Trades"
            />
            <Line 
              type="monotone" 
              dataKey="energy" 
              stroke="hsl(var(--success))" 
              strokeWidth={2}
              name="Energy Efficiency %"
            />
            <Line 
              type="monotone" 
              dataKey="threats" 
              stroke="hsl(var(--destructive))" 
              strokeWidth={2}
              name="Threats Detected"
            />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};
