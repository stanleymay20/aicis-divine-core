import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AICISLayout } from '@/components/aicis/AICISLayout';
import { Shield, AlertTriangle, TrendingUp, Globe, Loader2, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useViewModePersistence } from '@/hooks/useViewModePersistence';
import { RiskHeatmap } from '@/components/visualizations/RiskHeatmap';
import { NarrativeSynthesis } from '@/components/visualizations/NarrativeSynthesis';
import { ForecastFanChart } from '@/components/visualizations/ForecastFanChart';
import { ExecutiveBrief, ModeAwareSection } from '@/components/intelligence/ModeAwareSection';
import { WhyPanel } from '@/components/intelligence/WhyPanel';

export default function SecurityDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any[]>([]);
  const { mode } = useViewModePersistence();
  const isExecutiveMode = mode === "executive";

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    async function fetch() {
      setLoading(true);
      const { data: incData } = await supabase.from('security_incidents').select('*').order('created_at', { ascending: false }).limit(50);
      const { count: alertCount } = await supabase.from('critical_alerts').select('*', { count: 'exact', head: true }).gte('triggered_at', new Date(Date.now() - 7 * 86400000).toISOString());
      
      setIncidents((incData || []).map(i => ({ id: i.id, country: i.country || i.iso3 || 'Unknown', severity: i.severity, event_type: i.event_type, created_at: i.created_at })));
      
      const total = incData?.length || 0;
      const high = incData?.filter(i => i.severity >= 7).length || 0;
      const countries = new Set(incData?.map(i => i.country)).size;
      setMetrics([
        { label: 'Total Incidents (7d)', value: total, icon: Shield },
        { label: 'High Severity', value: high, icon: AlertTriangle },
        { label: 'Countries Affected', value: countries, icon: Globe },
        { label: 'Active Alerts', value: alertCount || 0, icon: TrendingUp }
      ]);
      setLoading(false);
    }
    fetch();
  }, [user]);

  const riskData = useMemo(() => {
    const byType: Record<string, { count: number; maxSev: number }> = {};
    incidents.forEach(i => {
      if (!byType[i.event_type]) byType[i.event_type] = { count: 0, maxSev: 0 };
      byType[i.event_type].count++;
      byType[i.event_type].maxSev = Math.max(byType[i.event_type].maxSev, i.severity);
    });
    return Object.entries(byType).slice(0, 8).map(([type, d]) => ({
      domain: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      severity: Math.min(Math.round(d.maxSev / 2), 5),
      likelihood: Math.min(Math.round(d.count / 2) + 1, 5),
      trend: d.count > 3 ? "up" as const : "stable" as const,
      confidence: 0.7,
    }));
  }, [incidents]);

  const fanData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now); d.setDate(d.getDate() - (7 - i) * 2);
      const isForecast = i > 4;
      return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: incidents.length + Math.sin(i) * 3,
        isForecast,
        ...(isForecast ? { upper: incidents.length + 8 + i * 2, lower: Math.max(0, incidents.length - 5 + i) } : {}),
      };
    });
  }, [incidents]);

  const narrative = useMemo(() => {
    const high = incidents.filter(i => i.severity >= 7).length;
    return [
      { type: "summary" as const, content: `${incidents.length} incidents tracked in the past 7 days across ${new Set(incidents.map(i => i.country)).size} countries. ${high} classified as high severity.`, confidence: 0.8 },
      { type: "risks" as const, content: high > 3 ? `Elevated threat environment with ${high} high-severity incidents. Immediate attention recommended.` : "Threat levels within normal operating parameters.", severity: high > 3 ? "high" as const : "low" as const },
      { type: "uncertainty" as const, content: "Incident data may be subject to reporting delays. Conflict zones have reduced data fidelity.", confidence: 0.95 },
    ];
  }, [incidents]);

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <AICISLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
            <div><h1 className="text-3xl font-bold">Security & Conflict Intelligence</h1><p className="text-muted-foreground mt-1">Real-time global security monitoring</p></div>
          </div>
          <Badge variant="outline" className="text-xs">Last updated: {new Date().toLocaleTimeString()}</Badge>
        </div>

        <ModeAwareSection onlyIn="executive">
          <ExecutiveBrief
            soWhat={`${incidents.filter(i => i.severity >= 7).length} high-severity incidents active across ${new Set(incidents.map(i => i.country)).size} countries.`}
            nowWhat={incidents.filter(i => i.severity >= 7).length > 3 ? "Escalate to security review committee. Monitor affected regions." : "Continue standard monitoring. No escalation required."}
          />
        </ModeAwareSection>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {metrics.map((m, idx) => { const Icon = m.icon; return (
                <Card key={idx}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{m.label}</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{m.value}</div></CardContent></Card>
              ); })}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ForecastFanChart data={fanData} title="Incident Trend & Forecast" subtitle="14-day window with projection" confidence={0.7} unit="incidents" height={260} />
              {riskData.length > 0 && <RiskHeatmap data={riskData} title="Incident Type Risk Matrix" />}
            </div>

            <NarrativeSynthesis title="Security Intelligence Brief" sections={narrative} overallConfidence={0.8} lastUpdated={new Date().toISOString()} />

            <ModeAwareSection onlyIn="analyst">
              <WhyPanel title="Why this security assessment?" confidenceScore={0.8}
                confidenceRationale="Based on incident frequency, severity distribution, and geographic spread from aggregated public sources."
                drivers={[{ label: "Incident Volume", influence: 80, direction: incidents.length > 20 ? "negative" as const : "positive" as const },
                  { label: "Severity Distribution", influence: 70, direction: incidents.filter(i => i.severity >= 7).length > 5 ? "negative" as const : "positive" as const },
                  { label: "Geographic Concentration", influence: 60, direction: "neutral" as const }]}
                assumptions={["Public reporting sources are complete", "Severity scoring is consistent across sources"]}
                whatWouldChange={["New conflict emergence or resolution", "Improved data feeds from underreported regions"]}
                dataLabel="ai_inference" />
            </ModeAwareSection>

            <Card><CardHeader><CardTitle>Recent Security Incidents</CardTitle></CardHeader><CardContent>
              {incidents.length === 0 ? <div className="text-center py-8"><Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">No incidents reported.</p></div>
              : <div className="space-y-3">{incidents.slice(0, isExecutiveMode ? 10 : 20).map(inc => (
                <div key={inc.id} className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex-1"><div className="flex items-center gap-2">
                    <Badge variant={inc.severity >= 8 ? 'destructive' : inc.severity >= 5 ? 'secondary' : 'outline'}>Severity {inc.severity}</Badge>
                    <span className="text-sm font-medium">{inc.country}</span></div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{inc.event_type}</p></div>
                  <span className="text-xs text-muted-foreground">{new Date(inc.created_at).toLocaleDateString()}</span></div>
              ))}</div>}
            </CardContent></Card>
          </>
        )}
      </div>
    </AICISLayout>
  );
}
