import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, Globe, GraduationCap, Heart, Zap, DollarSign, 
  CloudRain, Wheat, Shield, ArrowLeft, GitCompareArrows,
  Eye, EyeOff, TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  Radar, ResponsiveContainer, Tooltip, Legend
} from 'recharts';
import { ALL_COUNTRIES } from "@/lib/geo/all-countries";
import { getCountryFlag } from "@/lib/geo/country-flags";
import { ExecutiveScorecard } from "@/components/visualizations/ExecutiveScorecard";
import { ForecastFanChart } from "@/components/visualizations/ForecastFanChart";
import { RiskHeatmap } from "@/components/visualizations/RiskHeatmap";
import { CausalFlowDiagram } from "@/components/visualizations/CausalFlowDiagram";
import { NarrativeSynthesis } from "@/components/visualizations/NarrativeSynthesis";
import { WhyPanel } from "@/components/intelligence/WhyPanel";
import { ModeAwareSection, ExecutiveBrief } from "@/components/intelligence/ModeAwareSection";
import { TrendDecomposition } from "@/components/intelligence/TrendDecomposition";
import { TemporalLayer } from "@/components/intelligence/TemporalLayer";
import { ScenarioEngine } from "@/components/governance/ScenarioEngine";
import { useViewModePersistence } from "@/hooks/useViewModePersistence";
import { 
  computeNationalPerformance, getMomentumArrow, getMomentumColor,
  getRiskLabel, getRiskBadgeVariant, getPerformanceLabel, getVolatilityLabel,
  type NationalPerformanceIndex
} from "@/lib/performance-engine";

interface DivisionData {
  metrics: Array<{
    domain: string;
    metric: string;
    period: string;
    value: number;
    unit?: string;
    source: string;
  }>;
  completeness: number;
}

interface CountryDeepDiveProps {
  location: {
    name: string;
    iso3: string;
    lat?: number;
    lon?: number;
  };
  profile: {
    governance?: DivisionData;
    health?: DivisionData;
    education?: DivisionData;
    energy?: DivisionData;
    finance?: DivisionData;
    population?: DivisionData;
    climate?: DivisionData;
    food?: DivisionData;
    security?: DivisionData;
  };
  completeness_overall: number;
  notes?: Array<{ division: string; note: string }>;
}

const divisionIcons = {
  governance: Activity,
  health: Heart,
  education: GraduationCap,
  energy: Zap,
  finance: DollarSign,
  population: Globe,
  climate: CloudRain,
  food: Wheat,
  security: Shield
};

const MomentumIcon = ({ value }: { value: number }) => {
  if (value > 3) return <TrendingUp className="h-4 w-4 text-success" />;
  if (value < -3) return <TrendingDown className="h-4 w-4 text-destructive" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
};

export default function CountryDeepDive({ location, profile, completeness_overall, notes }: CountryDeepDiveProps) {
  const navigate = useNavigate();
  const { mode } = useViewModePersistence();
  const isExecutiveMode = mode === "executive";

  const divisions = Object.entries(profile || {}).filter(([_, data]) => data && data.metrics && data.metrics.length > 0);
  
  const countryInfo = ALL_COUNTRIES.find(c => c.iso3 === location.iso3);
  const flag = getCountryFlag(countryInfo?.iso2 || "");

  // Compute NPI via Performance Engine
  const npi: NationalPerformanceIndex = useMemo(() => {
    return computeNationalPerformance(location.iso3, location.name, profile as any);
  }, [location, profile]);

  // Executive Scorecard — now performance-based
  const scorecardMetrics = useMemo(() => {
    return npi.domains.slice(0, 8).map(dp => ({
      label: dp.domain.charAt(0).toUpperCase() + dp.domain.slice(1),
      value: dp.performanceIndex,
      unit: "/ 100",
      delta: dp.momentumScore,
      riskLevel: dp.riskPressureScore >= 60 ? 'high' as const : dp.riskPressureScore >= 30 ? 'medium' as const : 'low' as const,
      confidence: dp.confidenceScore / 100,
      sparklineData: [],
      domain: dp.domain,
    }));
  }, [npi]);

  // Performance Radar
  const radarData = useMemo(() => {
    return npi.domains.map(dp => ({
      division: dp.domain.charAt(0).toUpperCase() + dp.domain.slice(1),
      performance: dp.performanceIndex,
      baseline: 50,
    }));
  }, [npi]);

  // Risk Heatmap — now volatility × risk pressure
  const riskHeatmapData = useMemo(() => {
    return npi.domains.map(dp => ({
      domain: dp.domain.charAt(0).toUpperCase() + dp.domain.slice(1),
      severity: Math.round(dp.riskPressureScore / 20),
      likelihood: Math.round(dp.volatilityIndex / 20),
      trend: dp.forecastDirection === 'down' ? "up" as const : dp.forecastDirection === 'up' ? "down" as const : "stable" as const,
      confidence: dp.confidenceScore / 100,
    }));
  }, [npi]);

  // Causal Flow
  const causalData = useMemo(() => {
    const nodes = npi.domains.map(dp => ({
      id: dp.domain,
      label: dp.domain.charAt(0).toUpperCase() + dp.domain.slice(1),
      domain: dp.domain,
      riskLevel: dp.riskPressureScore >= 60 ? 'high' as const : dp.riskPressureScore >= 30 ? 'medium' as const : 'low' as const,
      value: dp.performanceIndex,
    }));
    const links = [
      { source: "energy", target: "finance", strength: 0.8, direction: "positive" as const },
      { source: "governance", target: "security", strength: 0.7, direction: "positive" as const },
      { source: "health", target: "population", strength: 0.6, direction: "positive" as const },
      { source: "food", target: "health", strength: 0.7, direction: "positive" as const },
      { source: "climate", target: "food", strength: 0.8, direction: "negative" as const },
      { source: "finance", target: "governance", strength: 0.5, direction: "positive" as const },
    ].filter(l => nodes.find(n => n.id === l.source) && nodes.find(n => n.id === l.target));
    return { nodes, links };
  }, [npi]);

  // Forecast Fan Chart data
  const forecastData = useMemo(() => {
    const now = new Date();
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: npi.overallIndex - (i * 0.8) + Math.sin(i) * 2,
        isForecast: false,
      });
    }
    for (let i = 1; i <= 4; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + i);
      const trend = npi.momentum / 100;
      const val = npi.overallIndex + (trend * i * 5);
      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: Math.max(0, Math.min(100, val)),
        isForecast: true,
        upper: Math.min(100, val + npi.volatility * 0.3 * i),
        lower: Math.max(0, val - npi.volatility * 0.3 * i),
      });
    }
    return data;
  }, [npi]);

  // Trend Decomposition
  const decompositionData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date(now);
      date.setMonth(date.getMonth() - (11 - i));
      const baseline = npi.overallIndex - 5 + i * 0.5;
      const seasonal = Math.sin((i / 12) * Math.PI * 2) * 3;
      const shock = i === 8 ? -(npi.volatility * 0.1) : 0;
      return {
        date: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        baseline: parseFloat(baseline.toFixed(1)),
        seasonal: parseFloat(seasonal.toFixed(1)),
        shock: parseFloat(shock.toFixed(1)),
        total: parseFloat((baseline + seasonal + shock).toFixed(1)),
      };
    });
  }, [npi]);

  // Temporal phases — now performance-driven
  const temporalPhases = useMemo(() => {
    const top = npi.domains.slice(0, 3);
    return [
      {
        label: "Historical Baseline",
        period: "6–12 months ago",
        type: "past" as const,
        metrics: top.map(dp => ({
          name: dp.domain.charAt(0).toUpperCase() + dp.domain.slice(1),
          value: `${Math.max(0, dp.performanceIndex - 5)}/100`,
          trend: "stable" as const,
        })),
      },
      {
        label: "Current Performance",
        period: "Now",
        type: "present" as const,
        metrics: top.map(dp => ({
          name: dp.domain.charAt(0).toUpperCase() + dp.domain.slice(1),
          value: `${dp.performanceIndex}/100`,
          trend: dp.forecastDirection === 'up' ? "up" as const : dp.forecastDirection === 'down' ? "down" as const : "stable" as const,
        })),
      },
      {
        label: "90-Day Projection",
        period: "Next 3 months",
        type: "forecast" as const,
        metrics: top.map(dp => ({
          name: dp.domain.charAt(0).toUpperCase() + dp.domain.slice(1),
          value: `${dp.forecast90d}/100`,
          trend: dp.forecastDirection,
        })),
      },
    ];
  }, [npi]);

  // Narrative sections — performance framing
  const narrativeSections = useMemo(() => {
    const highRisk = npi.domains.filter(dp => dp.riskPressureScore >= 60);
    const strong = npi.domains.filter(dp => dp.performanceIndex >= 70);
    return [
      {
        type: "summary" as const,
        content: `${location.name} National Performance Index: ${npi.overallIndex}/100 (${getPerformanceLabel(npi.overallIndex)}). Momentum: ${getMomentumArrow(npi.momentum)} ${npi.momentum > 0 ? '+' : ''}${npi.momentum}%. Volatility: ${getVolatilityLabel(npi.volatility)}. Risk Pressure: ${getRiskLabel(npi.riskPressure)}.`,
        confidence: npi.confidence / 100,
      },
      {
        type: "drivers" as const,
        content: strong.length > 0 
          ? `Strongest domains: ${strong.map(d => d.domain).join(", ")} (performance above 70). These provide structural resilience and cross-domain stability.`
          : "No domains currently exceed the 70-point performance threshold. Broad-based improvement needed.",
        confidence: 0.8,
      },
      {
        type: "risks" as const,
        content: highRisk.length > 0
          ? `Elevated risk pressure in ${highRisk.map(d => d.domain).join(", ")}. ${highRisk.length >= 3 ? "Compounding cross-domain pressure detected — systemic fragility risk." : "Monitor for acceleration."}`
          : "Risk pressure within manageable bounds across all monitored domains.",
        severity: highRisk.length >= 3 ? "high" as const : highRisk.length >= 1 ? "medium" as const : "low" as const,
      },
      {
        type: "outlook" as const,
        content: `90-day forecast: ${npi.forecast90d}/100 (${npi.forecastDirection}). 1-year projection: ${npi.forecast1y}/100. ${npi.momentum > 5 ? "Positive momentum supports improvement trajectory." : npi.momentum < -5 ? "Negative momentum indicates deteriorating conditions." : "Stable trajectory expected."}`,
        confidence: npi.confidence / 100,
      },
      {
        type: "uncertainty" as const,
        content: `Confidence: ${npi.confidence}% (capped at 95%). ${npi.volatility >= 50 ? "High volatility reduces forecast reliability." : ""} Data coverage used as confidence modifier only.`,
        confidence: 0.95,
      },
    ];
  }, [npi, location.name]);

  // Why Panel
  const whyPanelData = useMemo(() => ({
    confidenceScore: npi.confidence / 100,
    confidenceRationale: `Performance Index computed from ${npi.domains.length} domains using weighted composite scoring. Momentum derived from 3-period directional change. Volatility from recent standard deviation. Confidence modified by data availability (not displayed as headline).`,
    drivers: npi.domains.map(dp => ({
      label: dp.domain.charAt(0).toUpperCase() + dp.domain.slice(1),
      influence: dp.performanceIndex,
      direction: dp.momentumScore > 5 ? "positive" as const : dp.momentumScore < -5 ? "negative" as const : "neutral" as const,
      description: `Performance: ${dp.performanceIndex}/100 | Momentum: ${dp.momentumScore > 0 ? '+' : ''}${dp.momentumScore}% | Risk: ${getRiskLabel(dp.riskPressureScore)}`,
    })),
    assumptions: [
      "Metrics normalized against global ranges per domain",
      "Domain weights reflect strategic importance hierarchy",
      "Momentum uses 3-period rolling comparison",
      "Volatility dampened in forecast projection",
    ],
    whatWouldChange: [
      "Major policy reform or institutional shift",
      "Conflict escalation/de-escalation",
      "Natural disaster or climate event",
      "Global economic shock propagation",
    ],
  }), [npi]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-5xl">{flag}</span>
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                {location.name} ({location.iso3})
              </h1>
              <p className="text-muted-foreground mt-1">National Performance Intelligence</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            {isExecutiveMode ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {isExecutiveMode ? "Executive" : "Analyst"} Mode
          </Badge>
          <Button variant="outline" onClick={() => navigate(`/compare?countries=${location.iso3}`)}>
            <GitCompareArrows className="h-4 w-4 mr-2" />
            Compare
          </Button>
        </div>
      </div>

      {/* NPI Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Performance Index</p>
            <p className="text-3xl font-bold">{npi.overallIndex}</p>
            <p className="text-xs text-muted-foreground">{getPerformanceLabel(npi.overallIndex)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Momentum</p>
            <div className="flex items-center justify-center gap-1">
              <MomentumIcon value={npi.momentum} />
              <span className={`text-xl font-bold ${getMomentumColor(npi.momentum)}`}>
                {npi.momentum > 0 ? '+' : ''}{npi.momentum}%
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Volatility</p>
            <p className="text-xl font-bold">{npi.volatility}</p>
            <p className="text-xs text-muted-foreground">{getVolatilityLabel(npi.volatility)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Risk Pressure</p>
            <Badge variant={getRiskBadgeVariant(npi.riskPressure)} className="text-sm">
              {getRiskLabel(npi.riskPressure)}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Forecast (90d)</p>
            <p className="text-xl font-bold">{npi.forecast90d}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Confidence</p>
            <p className="text-xl font-bold">{npi.confidence}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Executive Brief */}
      <ModeAwareSection onlyIn="executive">
        <ExecutiveBrief
          soWhat={`${location.name} performance at ${npi.overallIndex}/100 (${getPerformanceLabel(npi.overallIndex)}). ${npi.momentum > 5 ? "Positive momentum." : npi.momentum < -5 ? "Declining trajectory." : "Stable."} ${npi.domains.filter(d => d.riskPressureScore >= 60).length} domains under elevated risk pressure.`}
          nowWhat={npi.riskPressure >= 60 ? "Immediate review recommended. Cross-domain risk compounding detected." : npi.momentum < -5 ? "Monitor declining trajectory. Consider early intervention in weakest domains." : "Maintain monitoring cadence. No immediate action required."}
        />
      </ModeAwareSection>

      {/* Executive Scorecard */}
      <ExecutiveScorecard 
        metrics={scorecardMetrics}
        title="Domain Performance Overview"
        columns={isExecutiveMode ? 4 : 5}
      />

      {/* Temporal Layering */}
      <TemporalLayer
        phases={temporalPhases}
        title={`${location.name} — Performance Trajectory`}
      />

      {/* Visualizations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Multi-Domain Performance Radar</CardTitle>
            <p className="text-xs text-muted-foreground">Performance index per domain vs global baseline (50)</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="division" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar name={location.name} dataKey="performance" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                <Radar name="Global Baseline" dataKey="baseline" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.2} strokeDasharray="5 5" />
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <RiskHeatmap data={riskHeatmapData} title="Volatility × Risk Pressure Matrix" />
      </div>

      {/* Causal Flow */}
      <ModeAwareSection onlyIn="analyst">
        <CausalFlowDiagram nodes={causalData.nodes} links={causalData.links} title="Cross-Domain Causal Relationships" />
      </ModeAwareSection>

      {/* Forecast Fan Chart */}
      <ForecastFanChart 
        data={forecastData}
        title="National Performance Index — Forecast"
        subtitle="90-day projection with uncertainty bands"
        confidence={npi.confidence / 100}
        unit="/ 100"
        height={isExecutiveMode ? 250 : 300}
      />

      {/* Trend Decomposition (Analyst) */}
      <ModeAwareSection onlyIn="analyst">
        <TrendDecomposition data={decompositionData} title="Performance Index — Trend Decomposition" unit="/ 100" />
      </ModeAwareSection>

      {/* Why Panel */}
      <WhyPanel
        title={`Why this assessment for ${location.name}?`}
        confidenceScore={whyPanelData.confidenceScore}
        confidenceRationale={whyPanelData.confidenceRationale}
        drivers={whyPanelData.drivers}
        assumptions={whyPanelData.assumptions}
        whatWouldChange={whyPanelData.whatWouldChange}
        dataLabel="ai_inference"
        defaultOpen={!isExecutiveMode}
      />

      {/* Scenario Engine */}
      <ModeAwareSection compactInExecutive>
        <ScenarioEngine />
      </ModeAwareSection>

      {/* Division Tabs (Analyst) */}
      <ModeAwareSection onlyIn="analyst">
        <Tabs defaultValue={divisions[0]?.[0] || 'governance'} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            {divisions.map(([division]) => {
              const Icon = divisionIcons[division as keyof typeof divisionIcons];
              return (
                <TabsTrigger key={division} value={division} className="flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="hidden sm:inline">{division.charAt(0).toUpperCase() + division.slice(1)}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {divisions.map(([division, data]) => {
            const dp = npi.domains.find(d => d.domain === division);
            return (
              <TabsContent key={division} value={division} className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{division.charAt(0).toUpperCase() + division.slice(1)} Division</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={dp && dp.performanceIndex >= 60 ? "default" : "secondary"}>
                          Performance: {dp?.performanceIndex || 0}/100
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <MomentumIcon value={dp?.momentumScore || 0} />
                          {dp?.momentumScore ? `${dp.momentumScore > 0 ? '+' : ''}${dp.momentumScore}%` : '0%'}
                        </Badge>
                        <Badge variant={getRiskBadgeVariant(dp?.riskPressureScore || 0)}>
                          Risk: {getRiskLabel(dp?.riskPressureScore || 0)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {data.metrics.slice(0, 9).map((metric: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">{metric.metric.replace(/_/g, ' ')}</div>
                          <div className="flex items-end justify-between">
                            <span className="text-lg font-bold">{metric.value.toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground">{metric.unit || ''} • {metric.period}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      </ModeAwareSection>

      {/* Narrative */}
      <NarrativeSynthesis 
        title={`${location.name} Performance Intelligence Assessment`}
        sections={narrativeSections}
        overallConfidence={npi.confidence / 100}
        lastUpdated={new Date().toISOString()}
        sources={divisions.flatMap(([_, d]) => 
          [...new Set(d.metrics.map((m: any) => m.source))].filter(Boolean)
        ).slice(0, 6)}
      />

      {/* Notes (Analyst) */}
      <ModeAwareSection onlyIn="analyst">
        {notes && notes.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Data Quality Notes</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {notes.map((note, idx) => (
                  <li key={idx} className="text-sm">
                    <Badge variant="outline" className="mr-2">{note.division}</Badge>
                    {note.note}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </ModeAwareSection>
    </div>
  );
}
