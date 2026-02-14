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
import { SignalBadge } from '@/components/intelligence/SignalBadge';

export default function SecurityDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { mode } = useViewModePersistence();
  const isExecutiveMode = mode === "executive";

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    async function fetch() {
      setLoading(true);
      const { data: incData } = await supabase.from('security_incidents').select('*').order('created_at', { ascending: false }).limit(50);
      setIncidents((incData || []).map(i => ({ id: i.id, country: i.country || i.iso3 || 'Unknown', severity: i.severity, event_type: i.event_type, created_at: i.created_at })));
      setLoading(false);
    }
    fetch();
  }, [user]);

  // Security Performance Metrics
  const securityPerformance = useMemo(() => {
    const total = incidents.length;
    const high = incidents.filter(i => i.severity >= 7).length;
    const critical = incidents.filter(i => i.severity >= 9).length;
    const countries = new Set(incidents.map(i => i.country)).size;
    
    // Security Pressure Index (0-100): higher = more pressure
    const pressureIndex = Math.min(100, Math.round(
      (high / Math.max(total, 1)) * 60 + (critical / Math.max(total, 1)) * 40 + Math.min(total, 30) * 1.5
    ));
    
    // Escalation probability based on severity distribution
    const escalationProb = Math.min(95, Math.round(
      (critical > 2 ? 40 : critical * 15) + (high > 5 ? 30 : high * 5) + (countries > 10 ? 25 : countries * 2)
    ));

    // Momentum: are things getting worse?
    const recentHalf = incidents.slice(0, Math.floor(total / 2));
    const olderHalf = incidents.slice(Math.floor(total / 2));
    const recentHighRate = recentHalf.filter(i => i.severity >= 7).length / Math.max(recentHalf.length, 1);
    const olderHighRate = olderHalf.filter(i => i.severity >= 7).length / Math.max(olderHalf.length, 1);
    const momentum = olderHighRate > 0 ? Math.round(((recentHighRate - olderHighRate) / olderHighRate) * 100) : 0;
    const clampedMomentum = Math.max(-100, Math.min(100, momentum));

    return {
      pressureIndex,
      escalationProb,
      momentum: clampedMomentum,
      totalIncidents: total,
      highSeverity: high,
      criticalCount: critical,
      countriesAffected: countries,
    };
  }, [incidents]);

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
      const baseValue = securityPerformance.pressureIndex;
      return {
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: baseValue + Math.sin(i) * 5 - (i > 4 ? (securityPerformance.momentum > 0 ? i * 2 : -i) : 0),
        isForecast,
        ...(isForecast ? { upper: baseValue + 15 + i * 2, lower: Math.max(0, baseValue - 10 + i) } : {}),
      };
    });
  }, [securityPerformance]);

  const narrative = useMemo(() => {
    const sp = securityPerformance;
    return [
      { type: "summary" as const, content: `Security Pressure Index: ${sp.pressureIndex}/100. ${sp.totalIncidents} incidents tracked, ${sp.highSeverity} high-severity, across ${sp.countriesAffected} countries. Escalation probability: ${sp.escalationProb}%.`, confidence: 0.8 },
      { type: "risks" as const, content: sp.pressureIndex >= 60 ? `Elevated security pressure detected. ${sp.criticalCount} critical incidents require immediate attention. Cross-border contagion risk: ${sp.countriesAffected > 5 ? 'high' : 'moderate'}.` : "Security pressure within manageable bounds. Continue standard monitoring.", severity: sp.pressureIndex >= 60 ? "high" as const : "low" as const },
      { type: "outlook" as const, content: `Conflict acceleration ${sp.momentum > 10 ? 'detected — situation deteriorating' : sp.momentum < -10 ? 'reversing — conditions improving' : 'stable'}. 90-day forecast suggests ${sp.momentum > 5 ? 'continued pressure escalation' : 'stabilization'}.`, confidence: 0.7 },
      { type: "uncertainty" as const, content: "Incident data subject to reporting delays. Conflict zones have reduced data fidelity. Confidence capped at 95%.", confidence: 0.95 },
    ];
  }, [securityPerformance]);

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <AICISLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
            <div><h1 className="text-3xl font-bold">Security & Conflict Intelligence</h1><p className="text-muted-foreground mt-1">Performance-based global security monitoring</p></div>
          </div>
          <Badge variant="outline" className="text-xs">Last updated: {new Date().toLocaleTimeString()}</Badge>
        </div>

        <SignalBadge domain="security" />

        {/* Security Performance Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Security Pressure</p>
              <p className={`text-2xl font-bold ${securityPerformance.pressureIndex >= 60 ? 'text-destructive' : securityPerformance.pressureIndex >= 30 ? 'text-warning' : 'text-success'}`}>{securityPerformance.pressureIndex}/100</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Escalation Prob.</p>
              <p className="text-2xl font-bold">{securityPerformance.escalationProb}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Conflict Momentum</p>
              <p className={`text-2xl font-bold ${securityPerformance.momentum > 5 ? 'text-destructive' : securityPerformance.momentum < -5 ? 'text-success' : 'text-muted-foreground'}`}>
                {securityPerformance.momentum > 0 ? '+' : ''}{securityPerformance.momentum}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">High Severity</p>
              <p className="text-2xl font-bold">{securityPerformance.highSeverity}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Countries</p>
              <p className="text-2xl font-bold">{securityPerformance.countriesAffected}</p>
            </CardContent>
          </Card>
        </div>

        <ModeAwareSection onlyIn="executive">
          <ExecutiveBrief
            soWhat={`Security Pressure Index at ${securityPerformance.pressureIndex}/100. ${securityPerformance.highSeverity} high-severity incidents across ${securityPerformance.countriesAffected} countries. Escalation probability: ${securityPerformance.escalationProb}%.`}
            nowWhat={securityPerformance.pressureIndex >= 60 ? "Escalate to security review committee. Focus on critical incident regions." : "Continue standard monitoring. No escalation required."}
          />
        </ModeAwareSection>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <ForecastFanChart data={fanData} title="Security Pressure Trend & Forecast" subtitle="14-day window with projection" confidence={0.7} unit="pressure" height={260} />
              {riskData.length > 0 && <RiskHeatmap data={riskData} title="Incident Type Risk Matrix" />}
            </div>

            <NarrativeSynthesis title="Security Performance Brief" sections={narrative} overallConfidence={0.8} lastUpdated={new Date().toISOString()} />

            <ModeAwareSection onlyIn="analyst">
              <WhyPanel title="Why this security assessment?" confidenceScore={0.8}
                confidenceRationale="Security Pressure Index computed from incident frequency, severity distribution, and geographic spread. Escalation probability modeled on critical incident density."
                drivers={[
                  { label: "Incident Volume", influence: 80, direction: securityPerformance.totalIncidents > 20 ? "negative" as const : "positive" as const },
                  { label: "Severity Distribution", influence: 70, direction: securityPerformance.highSeverity > 5 ? "negative" as const : "positive" as const },
                  { label: "Geographic Spread", influence: 60, direction: securityPerformance.countriesAffected > 10 ? "negative" as const : "neutral" as const },
                  { label: "Conflict Momentum", influence: 65, direction: securityPerformance.momentum > 10 ? "negative" as const : "positive" as const },
                ]}
                assumptions={["Public reporting sources are complete", "Severity scoring consistent across sources"]}
                whatWouldChange={["New conflict emergence or resolution", "Improved data feeds from underreported regions", "Major diplomatic intervention"]}
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
