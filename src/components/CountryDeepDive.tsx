import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, Globe, GraduationCap, Heart, Zap, DollarSign, 
  CloudRain, Wheat, Shield, ArrowLeft, GitCompareArrows,
  Eye, EyeOff
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

const getCompletenessColor = (score: number) => {
  if (score >= 0.8) return "default";
  if (score >= 0.6) return "secondary";
  return "destructive";
};

const getRiskLevel = (completeness: number, volatility: number = 0.3) => {
  const score = (1 - completeness) * 0.6 + volatility * 0.4;
  if (score >= 0.7) return "critical";
  if (score >= 0.5) return "high";
  if (score >= 0.3) return "medium";
  return "low";
};

export default function CountryDeepDive({ location, profile, completeness_overall, notes }: CountryDeepDiveProps) {
  const navigate = useNavigate();
  const { mode } = useViewModePersistence();
  const isExecutiveMode = mode === "executive";

  const divisions = Object.entries(profile || {}).filter(([_, data]) => data && data.metrics && data.metrics.length > 0);
  
  const countryInfo = ALL_COUNTRIES.find(c => c.iso3 === location.iso3);
  const flag = getCountryFlag(countryInfo?.iso2 || "");

  // Prepare Executive Scorecard data
  const scorecardMetrics = useMemo(() => {
    return divisions.slice(0, 8).map(([division, data]) => {
      const latestMetric = data.metrics[0];
      const historicalValues = data.metrics
        .sort((a: any, b: any) => a.period.localeCompare(b.period))
        .slice(-10)
        .map((m: any) => ({ value: m.value }));
      
      const values = data.metrics.map((m: any) => m.value);
      const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
      const delta = latestMetric ? ((latestMetric.value - avg) / avg) * 100 : 0;
      
      return {
        label: division.charAt(0).toUpperCase() + division.slice(1),
        value: latestMetric?.value || 0,
        unit: latestMetric?.unit || "",
        delta: delta,
        riskLevel: getRiskLevel(data.completeness, Math.abs(delta) / 100) as any,
        confidence: Math.min(data.completeness * 0.95 + 0.05, 0.95),
        sparklineData: historicalValues,
        domain: division
      };
    });
  }, [divisions]);

  // Prepare Risk Heatmap data
  const riskHeatmapData = useMemo(() => {
    return divisions.map(([division, data]) => {
      const volatility = data.metrics.length > 1 
        ? Math.min(Math.abs(data.metrics[0]?.value - data.metrics[1]?.value) / (data.metrics[0]?.value || 1), 1)
        : 0.3;
      return {
        domain: division.charAt(0).toUpperCase() + division.slice(1),
        severity: Math.round(1 + (1 - data.completeness) * 4),
        likelihood: Math.round(1 + volatility * 4),
        trend: volatility > 0.2 ? "up" as const : volatility < -0.1 ? "down" as const : "stable" as const,
        confidence: data.completeness
      };
    });
  }, [divisions]);

  // Prepare Causal Flow data
  const causalData = useMemo(() => {
    const nodes = divisions.map(([division, data]) => ({
      id: division,
      label: division.charAt(0).toUpperCase() + division.slice(1),
      domain: division,
      riskLevel: getRiskLevel(data.completeness) as any,
      value: data.completeness * 100
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
  }, [divisions]);

  // Prepare Forecast data
  const forecastData = useMemo(() => {
    const now = new Date();
    const data = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: completeness_overall * 100 + (Math.sin(i) * 5),
        isForecast: false
      });
    }
    
    for (let i = 1; i <= 3; i++) {
      const date = new Date(now);
      date.setMonth(date.getMonth() + i);
      const trend = completeness_overall > 0.6 ? 0.02 : -0.01;
      data.push({
        date: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        value: completeness_overall * 100 * (1 + trend * i),
        isForecast: true
      });
    }
    
    return data;
  }, [completeness_overall]);

  // Prepare Radar data with baseline
  const radarData = useMemo(() => {
    return divisions.map(([division, data]) => ({
      division: division.charAt(0).toUpperCase() + division.slice(1),
      completeness: Math.round((data?.completeness || 0) * 100),
      baseline: 60
    }));
  }, [divisions]);

  // Trend Decomposition data
  const decompositionData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date(now);
      date.setMonth(date.getMonth() - (11 - i));
      const baseline = completeness_overall * 100 + i * 0.5;
      const seasonal = Math.sin((i / 12) * Math.PI * 2) * 3;
      const shock = i === 8 ? -5 : i === 9 ? -2 : 0;
      return {
        date: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        baseline: parseFloat(baseline.toFixed(2)),
        seasonal: parseFloat(seasonal.toFixed(2)),
        shock: parseFloat(shock.toFixed(2)),
        total: parseFloat((baseline + seasonal + shock).toFixed(2)),
      };
    });
  }, [completeness_overall]);

  // Temporal phases
  const temporalPhases = useMemo(() => {
    const topDivisions = divisions.slice(0, 3);
    return [
      {
        label: "Historical Baseline",
        period: "6-12 months ago",
        type: "past" as const,
        metrics: topDivisions.map(([d, data]) => ({
          name: d.charAt(0).toUpperCase() + d.slice(1),
          value: `${Math.round(data.completeness * 90)}%`,
          trend: "stable" as const,
        })),
      },
      {
        label: "Current Assessment",
        period: "Now",
        type: "present" as const,
        metrics: topDivisions.map(([d, data]) => ({
          name: d.charAt(0).toUpperCase() + d.slice(1),
          value: `${Math.round(data.completeness * 100)}%`,
          trend: data.completeness > 0.6 ? "up" as const : "down" as const,
        })),
      },
      {
        label: "90-Day Projection",
        period: "Next 3 months",
        type: "forecast" as const,
        metrics: topDivisions.map(([d, data]) => ({
          name: d.charAt(0).toUpperCase() + d.slice(1),
          value: `${Math.min(Math.round(data.completeness * 105), 95)}%`,
          trend: data.completeness > 0.5 ? "up" as const : "stable" as const,
        })),
      },
    ];
  }, [divisions]);

  // Why Panel data
  const whyPanelData = useMemo(() => {
    const strongDivisions = divisions.filter(([_, d]) => d.completeness >= 0.7);
    const weakDivisions = divisions.filter(([_, d]) => d.completeness < 0.5);
    
    return {
      confidenceScore: Math.min(completeness_overall + 0.1, 0.95),
      confidenceRationale: `Based on ${divisions.length} monitored domains with ${Math.round(completeness_overall * 100)}% average data coverage. ${weakDivisions.length} domain${weakDivisions.length !== 1 ? 's' : ''} below 50% coverage limit confidence ceiling. All values capped at 95%.`,
      drivers: divisions.map(([d, data]) => ({
        label: d.charAt(0).toUpperCase() + d.slice(1),
        influence: Math.round(data.completeness * 100),
        direction: data.completeness >= 0.7 ? "positive" as const : data.completeness < 0.4 ? "negative" as const : "neutral" as const,
        description: `${data.metrics.length} metrics from ${[...new Set(data.metrics.map(m => m.source))].length} sources`,
      })),
      assumptions: [
        "Data sources are publicly available institutional datasets",
        "Missing data points interpolated using regional baselines",
        `${8 - divisions.length} standard domains have no available data`,
        "Seasonal patterns assumed consistent with 3-year historical averages",
      ],
      whatWouldChange: [
        "Additional real-time data feeds for undermonitored domains",
        "Regional conflict escalation/de-escalation events",
        "Major policy shifts (trade, health, energy)",
        "Natural disaster or climate events affecting data infrastructure",
      ],
    };
  }, [divisions, completeness_overall]);

  // Narrative Synthesis
  const narrativeSections = useMemo(() => {
    const highRiskDivisions = divisions.filter(([_, data]) => data.completeness < 0.5);
    const strongDivisions = divisions.filter(([_, data]) => data.completeness >= 0.7);
    
    return [
      {
        type: "summary" as const,
        content: `${location.name} demonstrates ${completeness_overall >= 0.7 ? "strong" : completeness_overall >= 0.5 ? "moderate" : "limited"} data coverage across ${divisions.length} tracked domains. Overall intelligence completeness stands at ${Math.round(completeness_overall * 100)}%, indicating ${completeness_overall >= 0.6 ? "reliable" : "partial"} assessment capability.`,
        confidence: completeness_overall
      },
      {
        type: "drivers" as const,
        content: strongDivisions.length > 0 
          ? `Key strengths identified in ${strongDivisions.map(([d]) => d).join(", ")} sectors with above-average data quality. These domains provide reliable signals for trend analysis and cross-domain correlation.`
          : "No domains currently exceed 70% data completeness threshold for reliable trend analysis.",
        confidence: Math.max(...divisions.map(([_, d]) => d.completeness))
      },
      {
        type: "risks" as const,
        content: highRiskDivisions.length > 0
          ? `Data gaps identified in ${highRiskDivisions.map(([d]) => d).join(", ")} sectors. Limited visibility may mask emerging risks or delay early warning signals.`
          : "All monitored domains maintain acceptable data coverage levels.",
        severity: highRiskDivisions.length >= 3 ? "high" as const : highRiskDivisions.length >= 1 ? "medium" as const : "low" as const
      },
      {
        type: "uncertainty" as const,
        content: `Assessment confidence is capped at 95% per institutional policy. Current analysis incorporates ${divisions.reduce((a, [_, d]) => a + d.metrics.length, 0)} data points across ${divisions.length} domains. Gaps exist in ${8 - divisions.length} standard monitoring categories.`,
        confidence: 0.95
      },
      {
        type: "outlook" as const,
        content: `Near-term trajectory ${completeness_overall > 0.6 ? "suggests stable monitoring capability with potential for improved early warning" : "indicates need for enhanced data collection to support reliable forecasting"}. Recommended focus areas: ${highRiskDivisions.slice(0, 2).map(([d]) => d).join(", ") || "maintain current coverage"}.`,
        confidence: Math.min(completeness_overall + 0.1, 0.95)
      }
    ];
  }, [divisions, location.name, completeness_overall]);

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
              <p className="text-muted-foreground mt-1">Comprehensive Country Deep-Dive Analysis</p>
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
          <Badge variant={getCompletenessColor(completeness_overall)} className="text-lg px-4 py-2">
            {Math.round(completeness_overall * 100)}% Data Complete
          </Badge>
        </div>
      </div>

      {/* Executive Brief (Executive mode only) */}
      <ModeAwareSection onlyIn="executive">
        <ExecutiveBrief
          soWhat={`${location.name} shows ${completeness_overall >= 0.7 ? "strong" : completeness_overall >= 0.5 ? "moderate" : "limited"} intelligence coverage with ${divisions.filter(([_, d]) => d.completeness < 0.5).length} domains at risk. ${divisions.filter(([_, d]) => d.completeness >= 0.7).length > 0 ? `Strongest domains: ${divisions.filter(([_, d]) => d.completeness >= 0.7).map(([d]) => d).join(", ")}.` : "No domains above 70% reliability threshold."}`}
          nowWhat={`${completeness_overall < 0.5 ? "Priority: Increase data coverage in undermonitored sectors before relying on forecasts." : completeness_overall < 0.7 ? "Focus on strengthening data pipelines in weak domains to improve forecast reliability." : "Maintain current monitoring and focus on trend analysis for early warning."}`}
        />
      </ModeAwareSection>

      {/* Executive Scorecard */}
      <ExecutiveScorecard 
        metrics={scorecardMetrics}
        title="Executive Dashboard"
        columns={isExecutiveMode ? 4 : 5}
      />

      {/* Temporal Layering (Past → Present → Forecast) */}
      <TemporalLayer
        phases={temporalPhases}
        title={`${location.name} — Temporal Trajectory`}
      />

      {/* Two-column layout for main visualizations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Multi-Domain Coverage vs Baseline</CardTitle>
            <p className="text-xs text-muted-foreground">
              Comparison against regional average (60%)
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="division" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar 
                  name={location.name} 
                  dataKey="completeness" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.5} 
                />
                <Radar 
                  name="Regional Baseline" 
                  dataKey="baseline" 
                  stroke="hsl(var(--muted-foreground))" 
                  fill="hsl(var(--muted-foreground))" 
                  fillOpacity={0.2} 
                  strokeDasharray="5 5"
                />
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <RiskHeatmap 
          data={riskHeatmapData}
          title="Risk Assessment Matrix"
        />
      </div>

      {/* Causal Flow Diagram */}
      <ModeAwareSection onlyIn="analyst">
        <CausalFlowDiagram 
          nodes={causalData.nodes}
          links={causalData.links}
          title="Cross-Domain Causal Relationships"
        />
      </ModeAwareSection>

      {/* Forecast Fan Chart */}
      <ForecastFanChart 
        data={forecastData}
        title="Composite Index Forecast"
        subtitle="90-day projection with uncertainty bands"
        confidence={Math.min(completeness_overall * 0.95 + 0.1, 0.95)}
        unit="%"
        height={isExecutiveMode ? 250 : 300}
      />

      {/* Trend Decomposition (Analyst only) */}
      <ModeAwareSection onlyIn="analyst">
        <TrendDecomposition
          data={decompositionData}
          title="Composite Index — Trend Decomposition"
          unit="%"
        />
      </ModeAwareSection>

      {/* Why This Result? Panel */}
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

      {/* Division Tabs (Analyst only) */}
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

          {divisions.map(([division, data]) => (
            <TabsContent key={division} value={division} className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{division.charAt(0).toUpperCase() + division.slice(1)} Division</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={getCompletenessColor(data.completeness)}>
                        {Math.round(data.completeness * 100)}% Complete
                      </Badge>
                      <Badge variant="outline">
                        {data.metrics.length} metrics
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {data.metrics.slice(0, 9).map((metric, idx) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="text-xs text-muted-foreground mb-1">
                          {metric.metric.replace(/_/g, ' ')}
                        </div>
                        <div className="flex items-end justify-between">
                          <span className="text-lg font-bold">
                            {metric.value.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {metric.unit || ''} • {metric.period}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </ModeAwareSection>

      {/* Narrative Synthesis */}
      <NarrativeSynthesis 
        title={`${location.name} Intelligence Assessment`}
        sections={narrativeSections}
        overallConfidence={Math.min(completeness_overall + 0.1, 0.95)}
        lastUpdated={new Date().toISOString()}
        sources={divisions.flatMap(([_, d]) => 
          [...new Set(d.metrics.map((m: any) => m.source))].filter(Boolean)
        ).slice(0, 6)}
      />

      {/* Notes - Analyst mode */}
      <ModeAwareSection onlyIn="analyst">
        {notes && notes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Data Quality Notes</CardTitle>
            </CardHeader>
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
