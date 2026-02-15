import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, X, Globe, Search, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ALL_COUNTRIES } from "@/lib/geo/all-countries";
import { getCountryFlag } from "@/lib/geo/country-flags";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, Legend,
} from "recharts";
import { useViewModePersistence } from "@/hooks/useViewModePersistence";
import { QuadrantPlot } from "@/components/visualizations/QuadrantPlot";
import { ComparativeMatrix } from "@/components/visualizations/ComparativeMatrix";
import { NarrativeSynthesis } from "@/components/visualizations/NarrativeSynthesis";
import { ModeAwareSection, ExecutiveBrief } from "@/components/intelligence/ModeAwareSection";
import { WhyPanel } from "@/components/intelligence/WhyPanel";
import {
  computeNationalPerformanceV2 as computeNationalPerformance, getMomentumArrow, getMomentumColor,
  getPerformanceLabel, getRiskLabel, getRiskBadgeVariant,
  type NationalPerformanceIndexV2 as NationalPerformanceIndex,
} from "@/lib/performance-engine-v2";

const COLOR_HEX = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const ComparePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCountries = searchParams.get("countries")?.split(",").filter(Boolean) || [];
  const [selectedCountries, setSelectedCountries] = useState<string[]>(initialCountries);
  const [searchQuery, setSearchQuery] = useState("");
  const { mode } = useViewModePersistence();
  const isExecutiveMode = mode === "executive";

  useEffect(() => { if (!authLoading && !user) navigate('/auth'); }, [user, authLoading, navigate]);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["compare-profiles", selectedCountries],
    queryFn: async () => {
      if (selectedCountries.length === 0) return [];
      const results = await Promise.all(
        selectedCountries.map(async (iso3) => {
          const { data } = await supabase.functions.invoke("country-profile", { body: { query: iso3 } });
          return { iso3, ...data };
        })
      );
      return results.filter((r) => r.ok);
    },
    enabled: selectedCountries.length > 0 && !!user,
  });

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return ALL_COUNTRIES.filter(
      (c) => (c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q)) && !selectedCountries.includes(c.iso3)
    ).slice(0, 10);
  }, [searchQuery, selectedCountries]);

  const addCountry = (iso3: string) => {
    if (selectedCountries.length >= 5) return;
    const n = [...selectedCountries, iso3];
    setSelectedCountries(n);
    setSearchParams({ countries: n.join(",") });
    setSearchQuery("");
  };

  const removeCountry = (iso3: string) => {
    const n = selectedCountries.filter((c) => c !== iso3);
    setSelectedCountries(n);
    setSearchParams({ countries: n.join(",") });
  };

  // Compute NPI for each country
  const npiList: NationalPerformanceIndex[] = useMemo(() => {
    if (!profiles || profiles.length === 0) return [];
    return profiles.map((p: any) => {
      const country = ALL_COUNTRIES.find(c => c.iso3 === p.iso3);
      return computeNationalPerformance(p.iso3, country?.name || p.iso3, p.profile || {}, {}, {});
    });
  }, [profiles]);

  // Performance Radar
  const radarData = useMemo(() => {
    if (npiList.length === 0) return [];
    const domains = ["governance", "health", "energy", "finance", "food", "security"];
    return domains.map(div => {
      const entry: any = { division: div.charAt(0).toUpperCase() + div.slice(1) };
      npiList.forEach(npi => {
        const dp = npi.domains.find(d => d.domain === div);
        entry[npi.iso3] = dp?.performanceIndex || 0;
      });
      return entry;
    });
  }, [npiList]);

  // Quadrant: X = Performance, Y = Stability (100 - volatility)
  const quadrantData = useMemo(() => {
    return npiList.map(npi => {
      const country = ALL_COUNTRIES.find(c => c.iso3 === npi.iso3);
      return {
        id: npi.iso3,
        label: npi.countryName,
        x: npi.overallIndex,
        y: Math.max(0, 100 - npi.volatility),
        size: npi.riskPressure * 0.5,
        iso2: country?.iso2,
        iso3: npi.iso3,
        category: country?.region,
      };
    });
  }, [npiList]);

  // Comparative Matrix — performance-based
  const matrixData = useMemo(() => {
    if (npiList.length === 0) return { rows: [], columns: [] };
    const divisions = ["governance", "health", "energy", "finance", "food", "security"];
    const rows = npiList.map(npi => {
      const metrics: Record<string, any> = {};
      divisions.forEach(div => {
        const dp = npi.domains.find(d => d.domain === div);
        metrics[div] = {
          value: dp?.performanceIndex || 0,
          baseline: 50,
          trend: dp?.forecastDirection || "stable",
          status: (dp?.performanceIndex || 0) >= 60 ? "above" as const : (dp?.performanceIndex || 0) < 40 ? "below" as const : "at" as const,
          confidence: (dp?.confidenceScore || 30) / 100,
        };
      });
      return {
        id: npi.iso3,
        label: npi.countryName,
        iso2: ALL_COUNTRIES.find(c => c.iso3 === npi.iso3)?.iso2,
        iso3: npi.iso3,
        metrics,
      };
    });
    return { rows, columns: divisions };
  }, [npiList]);

  // Narrative
  const narrativeSections = useMemo(() => {
    if (npiList.length < 2) return [];
    const sorted = [...npiList].sort((a, b) => b.overallIndex - a.overallIndex);
    return [
      {
        type: "summary" as const,
        content: `Comparing ${npiList.length} countries. Performance ranges from ${sorted[sorted.length - 1].overallIndex}/100 (${sorted[sorted.length - 1].countryName}) to ${sorted[0].overallIndex}/100 (${sorted[0].countryName}). Average momentum: ${(npiList.reduce((s, n) => s + n.momentum, 0) / npiList.length).toFixed(1)}%.`,
        confidence: Math.min(0.95, npiList.reduce((s, n) => s + n.confidence, 0) / npiList.length / 100),
      },
      {
        type: "drivers" as const,
        content: `Performance divergence driven by governance quality, economic resilience, and security stability. Countries with higher governance scores show stronger cross-domain performance.`,
        confidence: 0.75,
      },
      {
        type: "risks" as const,
        content: `${npiList.filter(n => n.riskPressure >= 60).length} countries show elevated risk pressure. ${npiList.filter(n => n.momentum < -5).length} countries on declining trajectory.`,
        severity: npiList.filter(n => n.riskPressure >= 60).length >= 2 ? "high" as const : "medium" as const,
      },
    ];
  }, [npiList]);

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  return (
    <AICISLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-orbitron font-bold">Compare Countries</h1>
              <p className="text-xs text-muted-foreground">Performance & stability comparison • Max 5 countries</p>
            </div>
          </div>
        </div>

        {/* Country Selection */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Select Countries (up to 5)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {selectedCountries.map((iso3) => {
                const country = ALL_COUNTRIES.find(c => c.iso3 === iso3);
                return (
                  <Badge key={iso3} variant="secondary" className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="text-lg">{getCountryFlag(country?.iso2 || "")}</span>
                    {country?.name || iso3}
                    <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-destructive/20" onClick={() => removeCountry(iso3)}><X className="h-3 w-3" /></Button>
                  </Badge>
                );
              })}
              {selectedCountries.length === 0 && <p className="text-muted-foreground text-sm">No countries selected.</p>}
            </div>
            {selectedCountries.length < 5 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search countries..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
                {filteredCountries.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-10 max-h-60 overflow-auto">
                    {filteredCountries.map(c => (
                      <button key={c.iso3} className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-2" onClick={() => addCountry(c.iso3)}>
                        <span className="text-lg">{getCountryFlag(c.iso2)}</span>
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{c.iso3}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Card><CardContent className="pt-6"><Skeleton className="h-[350px] w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-[350px] w-full" /></CardContent></Card>
          </div>
        ) : npiList.length > 0 ? (
          <div className="space-y-6">
            <ModeAwareSection onlyIn="executive">
              <ExecutiveBrief
                soWhat={`${npiList.length} countries compared. Performance range: ${Math.min(...npiList.map(n => n.overallIndex))} – ${Math.max(...npiList.map(n => n.overallIndex))}/100. ${npiList.filter(n => n.momentum < -5).length} on declining trajectory.`}
                nowWhat="Review quadrant positioning for strategic prioritization. Focus on countries with high risk pressure and negative momentum."
              />
            </ModeAwareSection>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Performance Radar */}
              <Card>
                <CardHeader><CardTitle>Domain Performance Comparison</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="division" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      {selectedCountries.map((iso3, idx) => (
                        <Radar key={iso3} name={ALL_COUNTRIES.find(c => c.iso3 === iso3)?.name || iso3} dataKey={iso3} stroke={COLOR_HEX[idx]} fill={COLOR_HEX[idx]} fillOpacity={0.2} />
                      ))}
                      <Tooltip />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Quadrant: Performance vs Stability */}
              {quadrantData.length > 0 && (
                <QuadrantPlot
                  data={quadrantData}
                  title="Performance vs Stability"
                  xLabel="Performance Index"
                  yLabel="Stability (100 − Volatility)"
                  quadrantLabels={{
                    topLeft: "Stable but Weak",
                    topRight: "Strong & Stable",
                    bottomLeft: "Weak & Fragile",
                    bottomRight: "Strong but Volatile",
                  }}
                  showFlags
                  height={350}
                />
              )}
            </div>

            {/* Comparative Matrix */}
            {matrixData.rows.length > 0 && (
              <ComparativeMatrix rows={matrixData.rows} columns={matrixData.columns} title="Cross-Sector Performance Matrix" baselineLabel="Global Baseline (50)" />
            )}

            {/* Narrative */}
            {narrativeSections.length > 0 && (
              <NarrativeSynthesis title="Comparative Performance Brief" sections={narrativeSections} overallConfidence={0.75} lastUpdated={new Date().toISOString()} />
            )}

            <ModeAwareSection onlyIn="analyst">
              <WhyPanel
                title="Why these comparison results?"
                confidenceScore={0.75}
                confidenceRationale="Performance indices computed using weighted domain composites. Momentum from 3-period rolling comparison. Volatility from standard deviation of recent values."
                drivers={npiList.map(n => ({
                  label: n.countryName,
                  influence: n.overallIndex,
                  direction: n.momentum > 5 ? "positive" as const : n.momentum < -5 ? "negative" as const : "neutral" as const,
                  description: `NPI: ${n.overallIndex} | Momentum: ${n.momentum > 0 ? '+' : ''}${n.momentum}% | Risk: ${getRiskLabel(n.riskPressure)}`,
                }))}
                assumptions={["Domain weights reflect strategic importance", "Volatility computed from available time-series", "Global baseline set at 50th percentile"]}
                whatWouldChange={["Adding more countries for broader context", "Narrowing to specific domains", "Changing assessment timeframe"]}
                dataLabel="ai_inference"
              />
            </ModeAwareSection>

            {/* Country Summary Table */}
            <Card>
              <CardHeader><CardTitle>Country Performance Summary</CardTitle></CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Country</th>
                        <th className="text-center py-2 px-4">Performance</th>
                        <th className="text-center py-2 px-4">Momentum</th>
                        <th className="text-center py-2 px-4">Risk</th>
                        <th className="text-center py-2 px-4">Forecast (90d)</th>
                        <th className="text-center py-2 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {npiList.map(n => {
                        const country = ALL_COUNTRIES.find(c => c.iso3 === n.iso3);
                        return (
                          <tr key={n.iso3} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4 flex items-center gap-2">
                              <span className="text-xl">{getCountryFlag(country?.iso2 || "")}</span>
                              <span className="font-medium">{n.countryName}</span>
                            </td>
                            <td className="text-center py-3 px-4">
                              <Badge variant={n.overallIndex >= 60 ? "default" : "secondary"}>{n.overallIndex}/100</Badge>
                            </td>
                            <td className="text-center py-3 px-4">
                              <span className={getMomentumColor(n.momentum)}>
                                {getMomentumArrow(n.momentum)} {n.momentum > 0 ? '+' : ''}{n.momentum}%
                              </span>
                            </td>
                            <td className="text-center py-3 px-4">
                              <Badge variant={getRiskBadgeVariant(n.riskPressure)}>{getRiskLabel(n.riskPressure)}</Badge>
                            </td>
                            <td className="text-center py-3 px-4">{n.forecast90d}/100</td>
                            <td className="text-center py-3 px-4">
                              <Button variant="outline" size="sm" onClick={() => navigate(`/deepdive/${n.iso3}`)}>Details</Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ) : selectedCountries.length > 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            Loading country intelligence data...
          </div>
        ) : null}
      </div>
    </AICISLayout>
  );
};

export default ComparePage;
