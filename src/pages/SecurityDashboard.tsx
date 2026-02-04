import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Shield, AlertTriangle, TrendingUp, Globe, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SecurityIncident {
  id: string;
  country: string;
  severity: number;
  event_type: string;
  headline?: string;
  notes?: string;
  created_at: string;
}

interface SecurityMetric {
  label: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
  icon: typeof Shield;
}

export default function SecurityDashboard() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<SecurityMetric[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchSecurityData() {
      setLoading(true);
      
      // Fetch recent security incidents from DB
      const { data: incidentsData } = await supabase
        .from('security_incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      // Fetch critical alerts
      const { data: alertsData, count: alertCount } = await supabase
        .from('critical_alerts')
        .select('*', { count: 'exact' })
        .gte('triggered_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      
      // Fetch political stability metrics from metrics table
      const { data: stabilityData } = await supabase
        .from('metrics')
        .select('*')
        .eq('domain', 'security')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (incidentsData) {
        setIncidents(incidentsData.map(i => ({
          id: i.id,
          country: i.country || i.iso3 || 'Unknown',
          severity: i.severity,
          event_type: i.event_type,
          headline: i.event_type,
          created_at: i.created_at
        })));
      }
      
      // Calculate metrics from real data
      const totalIncidents = incidentsData?.length || 0;
      const highSeverity = incidentsData?.filter(i => i.severity >= 7).length || 0;
      const affectedCountries = new Set(incidentsData?.map(i => i.country)).size;
      
      setMetrics([
        { label: 'Total Incidents (7d)', value: totalIncidents, trend: 'stable', icon: Shield },
        { label: 'High Severity', value: highSeverity, trend: highSeverity > 5 ? 'up' : 'down', icon: AlertTriangle },
        { label: 'Countries Affected', value: affectedCountries, trend: 'stable', icon: Globe },
        { label: 'Active Alerts', value: alertCount || 0, trend: 'stable', icon: TrendingUp }
      ]);
      
      // Build trend data from stability metrics
      const trendMap = new Map<string, number>();
      stabilityData?.forEach(m => {
        const date = m.period || new Date(m.created_at).toISOString().substring(0, 10);
        trendMap.set(date, (trendMap.get(date) || 0) + 1);
      });
      
      const sortedTrend = Array.from(trendMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14)
        .map(([date, count]) => ({ date, incidents: count }));
      
      setTrendData(sortedTrend);
      setLoading(false);
    }
    
    fetchSecurityData();
  }, []);

  const getSeverityColor = (severity: number) => {
    if (severity >= 8) return 'destructive';
    if (severity >= 5) return 'secondary';
    return 'outline';
  };

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
            <h1 className="text-3xl font-bold">Security & Conflict Intelligence</h1>
            <p className="text-muted-foreground mt-1">Real-time global security monitoring</p>
          </div>
          <Badge variant="outline" className="text-xs">
            Last updated: {new Date().toLocaleTimeString()}
          </Badge>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <Card key={idx}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    {metric.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{metric.value}</div>
                  <Badge 
                    variant={metric.trend === 'up' ? 'destructive' : metric.trend === 'down' ? 'default' : 'outline'}
                    className="mt-2"
                  >
                    {metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '→'} {metric.trend}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Trend Chart */}
        {trendData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Incident Trend (14 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="incidents" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Recent Incidents */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Security Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            {incidents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No incidents reported</p>
            ) : (
              <div className="space-y-3">
                {incidents.slice(0, 20).map((incident) => (
                  <div key={incident.id} className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getSeverityColor(incident.severity)}>
                          Severity {incident.severity}
                        </Badge>
                        <span className="text-sm font-medium">{incident.country}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {incident.headline || incident.event_type}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(incident.created_at).toLocaleDateString()}
                    </span>
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
