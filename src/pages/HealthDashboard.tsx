import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { HeartPulse, Activity, TrendingUp, Globe, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface HealthMetric {
  id: string;
  iso3: string;
  metric: string;
  value: number;
  period: string;
  source: string;
}

export default function HealthDashboard() {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryStats, setSummaryStats] = useState({
    avgLifeExpectancy: 0,
    countriesWithData: 0,
    dataPoints: 0,
    latestYear: ''
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchHealthData() {
      setLoading(true);
      
      // Fetch health metrics from DB
      const { data: healthMetrics } = await supabase
        .from('metrics')
        .select('*')
        .eq('domain', 'health')
        .order('created_at', { ascending: false })
        .limit(500);
      
      // Also query health_metrics table if exists
      const { data: healthTable } = await supabase
        .from('health_metrics')
        .select('*')
        .order('year', { ascending: false })
        .limit(200);
      
      const combinedData = [
        ...(healthMetrics || []).map(m => ({
          id: m.id,
          iso3: m.iso3 || 'GLB',
          metric: m.metric,
          value: m.value,
          period: m.period,
          source: m.source
        })),
        ...(healthTable || []).map(h => ({
          id: h.id,
          iso3: h.iso_code || h.country || 'GLB',
          metric: h.metric_name || 'health_metric',
          value: h.value || 0,
          period: h.date?.substring(0, 4) || '',
          source: h.source || 'who'
        }))
      ];
      
      setMetrics(combinedData);
      
      // Calculate summary
      const lifeExpMetrics = combinedData.filter(m => m.metric.includes('life_expectancy') && m.value > 0);
      const avgLife = lifeExpMetrics.length > 0 
        ? lifeExpMetrics.reduce((sum, m) => sum + m.value, 0) / lifeExpMetrics.length 
        : 0;
      
      const countries = new Set(combinedData.map(m => m.iso3));
      const years = combinedData.map(m => m.period).filter(Boolean).sort();
      
      setSummaryStats({
        avgLifeExpectancy: Math.round(avgLife * 10) / 10,
        countriesWithData: countries.size,
        dataPoints: combinedData.length,
        latestYear: years[years.length - 1] || 'N/A'
      });
      
      // Build chart data - life expectancy by year
      const yearMap = new Map<string, { sum: number; count: number }>();
      lifeExpMetrics.forEach(m => {
        const existing = yearMap.get(m.period) || { sum: 0, count: 0 };
        yearMap.set(m.period, { sum: existing.sum + m.value, count: existing.count + 1 });
      });
      
      const sorted = Array.from(yearMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-20)
        .map(([year, data]) => ({
          year,
          lifeExpectancy: Math.round(data.sum / data.count * 10) / 10
        }));
      
      setChartData(sorted);
      setLoading(false);
    }
    
    fetchHealthData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Global Health Intelligence</h1>
            <p className="text-muted-foreground mt-1">WHO & institutional health data analysis</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {summaryStats.dataPoints} data points
          </Badge>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-primary" />
                Avg Life Expectancy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summaryStats.avgLifeExpectancy}</div>
              <span className="text-xs text-muted-foreground">years (global avg)</span>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Countries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summaryStats.countriesWithData}</div>
              <span className="text-xs text-muted-foreground">with health data</span>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Data Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summaryStats.dataPoints}</div>
              <span className="text-xs text-muted-foreground">metrics collected</span>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Latest Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summaryStats.latestYear}</div>
              <span className="text-xs text-muted-foreground">most recent year</span>
            </CardContent>
          </Card>
        </div>

        {/* Life Expectancy Trend */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Global Life Expectancy Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="lifeExpectancy" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Life Expectancy (years)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent Metrics Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Health Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No health data available</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {metrics.slice(0, 30).map((metric) => (
                  <div key={metric.id} className="flex items-center justify-between border-b border-border pb-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{metric.iso3}</Badge>
                      <span className="text-sm font-medium">{metric.metric.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold">{metric.value.toFixed(1)}</span>
                      <Badge variant="secondary">{metric.period}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
