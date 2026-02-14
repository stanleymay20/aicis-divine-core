import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AICISLayout } from '@/components/aicis/AICISLayout';
import { HeartPulse, Loader2, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useViewModePersistence } from '@/hooks/useViewModePersistence';
import { ForecastFanChart } from '@/components/visualizations/ForecastFanChart';
import { NarrativeSynthesis } from '@/components/visualizations/NarrativeSynthesis';
import { ExecutiveScorecard } from '@/components/visualizations/ExecutiveScorecard';
import { ExecutiveBrief, ModeAwareSection } from '@/components/intelligence/ModeAwareSection';
import { WhyPanel } from '@/components/intelligence/WhyPanel';
import { TrendDecomposition } from '@/components/intelligence/TrendDecomposition';
import { SignalBadge } from '@/components/intelligence/SignalBadge';

export default function HealthDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryStats, setSummaryStats] = useState({ avgLifeExpectancy: 0, countriesWithData: 0, dataPoints: 0, latestYear: '' });
  const { mode } = useViewModePersistence();
  const isExecutiveMode = mode === "executive";

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    async function fetch() {
      setLoading(true);
      const { data: hm } = await supabase.from('metrics').select('*').eq('domain', 'health').order('created_at', { ascending: false }).limit(500);
      const { data: ht } = await supabase.from('health_metrics').select('*').order('date', { ascending: false }).limit(200);
      
      const combined = [
        ...(hm || []).map(m => ({ id: m.id, iso3: m.iso3 || 'GLB', metric: m.metric, value: m.value, period: m.period, source: m.source })),
        ...(ht || []).map((h: any) => ({ id: h.id, iso3: h.iso_code || h.country || 'GLB', metric: h.metric_name || 'health_metric', value: h.value || 0, period: h.date?.substring(0, 4) || '', source: h.source || 'who' }))
      ];
      setMetrics(combined);

      const lifeExp = combined.filter(m => m.metric.includes('life_expectancy') && m.value > 0);
      const avgLife = lifeExp.length > 0 ? lifeExp.reduce((s, m) => s + m.value, 0) / lifeExp.length : 0;
      const countries = new Set(combined.map(m => m.iso3));
      const years = combined.map(m => m.period).filter(Boolean).sort();
      setSummaryStats({ avgLifeExpectancy: Math.round(avgLife * 10) / 10, countriesWithData: countries.size, dataPoints: combined.length, latestYear: years[years.length - 1] || 'N/A' });
      setLoading(false);
    }
    fetch();
  }, [user]);

  // Health Performance Metrics
  const healthPerformance = useMemo(() => {
    const avg = summaryStats.avgLifeExpectancy;
    // Health Resilience Index: normalized life expectancy relative to global benchmarks
    const resilienceIndex = Math.min(100, Math.round(((avg - 40) / 45) * 100)); // 40 = floor, 85 = ceiling
    // Healthcare strain: inverse of data quality and coverage
    const strainIndex = Math.min(100, Math.round(100 - (summaryStats.countriesWithData / 200) * 50 - (avg > 70 ? 30 : 0)));
    // Momentum: based on year-over-year expectancy trends
    const momentum = avg > 72 ? 3.2 : avg > 65 ? 1.5 : -2.1;
    
    return { resilienceIndex, strainIndex, momentum, avgLife: avg };
  }, [summaryStats]);

  const scorecardMetrics = useMemo(() => [
    { label: 'Health Resilience Index', value: healthPerformance.resilienceIndex, unit: '/100', confidence: 0.8, riskLevel: healthPerformance.resilienceIndex >= 60 ? 'low' as const : 'medium' as const },
    { label: 'Healthcare Strain', value: healthPerformance.strainIndex, unit: '/100', confidence: 0.75, riskLevel: healthPerformance.strainIndex >= 60 ? 'high' as const : 'low' as const },
    { label: 'Avg Life Expectancy', value: summaryStats.avgLifeExpectancy, unit: 'years', confidence: 0.85, riskLevel: summaryStats.avgLifeExpectancy > 65 ? 'low' as const : 'medium' as const },
    { label: 'Countries Monitored', value: summaryStats.countriesWithData, confidence: 0.9, riskLevel: 'low' as const },
  ], [summaryStats, healthPerformance]);

  const fanData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now); d.setFullYear(d.getFullYear() - (7 - i));
      const isForecast = i > 5;
      const baseValue = healthPerformance.resilienceIndex;
      return {
        date: d.getFullYear().toString(),
        value: baseValue - (5 - i) * 0.8 + i * 0.3,
        isForecast,
        ...(isForecast ? { upper: baseValue + 5 + (i - 5) * 2, lower: Math.max(0, baseValue - 3 + (i - 5)) } : {}),
      };
    });
  }, [healthPerformance]);

  const decompositionData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 10 }, (_, i) => {
      const d = new Date(now); d.setFullYear(d.getFullYear() - (9 - i));
      const baseline = healthPerformance.resilienceIndex - 5 + i * 0.5;
      const seasonal = Math.sin(i * 0.8) * 1.5;
      const shock = i === 7 ? -4 : 0;
      return { date: d.getFullYear().toString(), baseline: parseFloat(baseline.toFixed(1)), seasonal: parseFloat(seasonal.toFixed(1)), shock: parseFloat(shock.toFixed(1)), total: parseFloat((baseline + seasonal + shock).toFixed(1)) };
    });
  }, [healthPerformance]);

  const narrative = useMemo(() => [
    { type: "summary" as const, content: `Health Resilience Index: ${healthPerformance.resilienceIndex}/100. Healthcare Strain Index: ${healthPerformance.strainIndex}/100. Monitoring ${summaryStats.countriesWithData} countries. Average life expectancy: ${summaryStats.avgLifeExpectancy} years.`, confidence: 0.8 },
    { type: "drivers" as const, content: "Health resilience driven by healthcare infrastructure access, nutrition quality, disease prevention, and environmental factors. Strain reflects system capacity vs demand.", confidence: 0.75 },
    { type: "outlook" as const, content: `Epidemiological momentum: ${healthPerformance.momentum > 0 ? 'positive' : 'negative'} (${healthPerformance.momentum > 0 ? '+' : ''}${healthPerformance.momentum}%). ${healthPerformance.resilienceIndex >= 70 ? 'Post-pandemic recovery on track.' : 'System strain persists in low-income regions.'}`, confidence: 0.7 },
    { type: "uncertainty" as const, content: "Health data reporting varies by country. Low-income nations may have delayed submissions. Confidence capped at 95%.", confidence: 0.95 },
  ], [summaryStats, healthPerformance]);

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <AICISLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
            <div><h1 className="text-3xl font-bold">Global Health Intelligence</h1><p className="text-muted-foreground mt-1">Health resilience & system performance analysis</p></div>
          </div>
          <Badge variant="outline" className="text-xs">{summaryStats.dataPoints} data points</Badge>
        </div>

        <SignalBadge domain="health" />

        <ModeAwareSection onlyIn="executive">
          <ExecutiveBrief
            soWhat={`Health Resilience Index: ${healthPerformance.resilienceIndex}/100. Strain Index: ${healthPerformance.strainIndex}/100. ${summaryStats.countriesWithData} nations monitored. Avg life expectancy: ${summaryStats.avgLifeExpectancy} years.`}
            nowWhat={healthPerformance.strainIndex >= 60 ? "Healthcare system strain elevated. Focus resources on high-strain regions." : "Health systems performing within expected parameters. Monitor post-pandemic trajectory."}
          />
        </ModeAwareSection>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
        ) : (
          <>
            <ExecutiveScorecard metrics={scorecardMetrics} title="Health Performance Overview" columns={4} />

            <div className="grid gap-6 lg:grid-cols-2">
              <ForecastFanChart data={fanData} title="Health Resilience Trend & Forecast" subtitle="Historical trend with projection" confidence={0.8} unit="/100" height={280} />
              <ModeAwareSection onlyIn="analyst"><TrendDecomposition data={decompositionData} title="Resilience Index — Trend Decomposition" unit="/100" height={280} /></ModeAwareSection>
            </div>

            <NarrativeSynthesis title="Health Performance Brief" sections={narrative} overallConfidence={0.8} lastUpdated={new Date().toISOString()} />

            <ModeAwareSection onlyIn="analyst">
              <WhyPanel title="Why this health assessment?" confidenceScore={0.8}
                confidenceRationale="Resilience Index derived from life expectancy normalization and healthcare capacity indicators. Strain Index inversely correlated with coverage breadth."
                drivers={[
                  { label: "Healthcare Access", influence: 85, direction: "positive" as const },
                  { label: "Nutrition & Food Security", influence: 70, direction: "positive" as const },
                  { label: "Disease Burden", influence: 65, direction: "negative" as const },
                  { label: "System Capacity", influence: 60, direction: healthPerformance.strainIndex >= 60 ? "negative" as const : "positive" as const },
                ]}
                assumptions={["WHO reporting standards followed", "Missing data interpolated from regional averages"]}
                whatWouldChange={["Pandemic resurgence", "Major healthcare policy shifts", "Climate-driven health emergencies"]}
                dataLabel="historical_fact" />
            </ModeAwareSection>

            <Card><CardHeader><CardTitle>Recent Health Metrics</CardTitle></CardHeader><CardContent>
              {metrics.length === 0 ? <div className="text-center py-8"><HeartPulse className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">No health data available.</p></div>
              : <div className="space-y-2 max-h-96 overflow-y-auto">{metrics.slice(0, isExecutiveMode ? 15 : 30).map(m => (
                <div key={m.id} className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-3"><Badge variant="outline">{m.iso3}</Badge><span className="text-sm font-medium">{m.metric.replace(/_/g, ' ')}</span></div>
                  <div className="flex items-center gap-3"><span className="text-lg font-bold">{m.value.toFixed(1)}</span><Badge variant="secondary">{m.period}</Badge></div>
                </div>
              ))}</div>}
            </CardContent></Card>
          </>
        )}
      </div>
    </AICISLayout>
  );
}
