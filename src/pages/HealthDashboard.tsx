import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AICISLayout } from '@/components/aicis/AICISLayout';
import { HeartPulse, Activity, TrendingUp, Globe, Loader2, ArrowLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface HealthMetric {
  id: string;
  iso3: string;
  metric: string;
  value: number;
  period: string;
  source: string;
}

export default function HealthDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
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
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    async function fetchHealthData() {
      setLoading(true);
      
      const { data: healthMetrics } = await supabase
        .from('metrics')
        .select('*')
        .eq('domain', 'health')
        .order('created_at', { ascending: false })
        .limit(500);
      
      const { data: healthTable } = await supabase
        .from('health_metrics')
        .select('*')
        .order('date', { ascending: false })
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
        ...(healthTable || []).map((h: any) => ({
          id: h.id,
          iso3: h.iso_code || h.country || 'GLB',
          metric: h.metric_name || 'health_metric',
          value: h.value || 0,
          period: h.date?.substring(0, 4) || '',
          source: h.source || 'who'
        }))
      ];
      
      setMetrics(combinedData);
      
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
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <AICISLayout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Global Health Intelligence</h1>
                <p className="text-muted-foreground mt-1">WHO & institutional health data analysis</p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {summaryStats.dataPoints} data points
            </Badge>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : (
            <>
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
                    <div className="text-3xl font-bold">{summaryStats.avgLifeExpectancy || '—'}</div>
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
              {chartData.length > 0 ? (
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
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <HeartPulse className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No life expectancy trend data available yet.</p>
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
                    <div className="text-center py-8">
                      <HeartPulse className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">No health data available. Data will populate as sources are ingested.</p>
                    </div>
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
            </>
          )}
        </div>
      </div>
    </AICISLayout>
  );
}