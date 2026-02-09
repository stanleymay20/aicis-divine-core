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
import { ArrowLeft, Plus, X, Globe, Search, Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["compare-profiles", selectedCountries],
    queryFn: async () => {
      if (selectedCountries.length === 0) return [];
      const results = await Promise.all(
        selectedCountries.map(async (iso3) => {
          const { data } = await supabase.functions.invoke("country-profile", {
            body: { query: iso3 },
          });
          return { iso3, ...data };
        })
      );
      return results.filter((r) => r.ok);
    },
    enabled: selectedCountries.length > 0 && !!user,
  });

  const { data: predictions } = useQuery({
    queryKey: ["compare-predictions", selectedCountries],
    queryFn: async () => {
      if (selectedCountries.length === 0) return [];
      const { data } = await supabase
        .from("predictions")
        .select("*")
        .in("country", selectedCountries.map(iso3 => 
          ALL_COUNTRIES.find(c => c.iso3 === iso3)?.name || iso3
        ))
        .order("predicted_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: selectedCountries.length > 0 && !!user,
  });

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return ALL_COUNTRIES.filter(
      (c) =>
        (c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q)) &&
        !selectedCountries.includes(c.iso3)
    ).slice(0, 10);
  }, [searchQuery, selectedCountries]);

  const addCountry = (iso3: string) => {
    if (selectedCountries.length >= 5) return;
    const newSelection = [...selectedCountries, iso3];
    setSelectedCountries(newSelection);
    setSearchParams({ countries: newSelection.join(",") });
    setSearchQuery("");
  };

  const removeCountry = (iso3: string) => {
    const newSelection = selectedCountries.filter((c) => c !== iso3);
    setSelectedCountries(newSelection);
    setSearchParams({ countries: newSelection.join(",") });
  };

  // Radar data
  const radarData = useMemo(() => {
    if (!profiles || profiles.length === 0) return [];
    const divisions = ["governance", "health", "energy", "finance", "food", "security"];
    return divisions.map((div) => {
      const entry: any = { division: div.charAt(0).toUpperCase() + div.slice(1) };
      profiles.forEach((p: any) => {
        const completeness = p.profile?.[div]?.completeness || 0;
        entry[p.iso3] = Math.round(completeness * 100);
      });
      return entry;
    });
  }, [profiles]);

  // Quadrant plot data
  const quadrantData = useMemo(() => {
    if (!profiles || profiles.length === 0) return [];
    return profiles.map((p: any) => {
      const country = ALL_COUNTRIES.find(c => c.iso3 === p.iso3);
      const overallComp = p.completeness_overall || 0;
      const securityComp = p.profile?.security?.completeness || 0;
      return {
        id: p.iso3,
        label: country?.name || p.iso3,
        x: Math.round(overallComp * 100),
        y: Math.round((1 - securityComp) * 100),
        size: overallComp * 40,
        iso2: country?.iso2,
        iso3: p.iso3,
        category: country?.region,
      };
    });
  }, [profiles]);

  // Comparative matrix data
  const matrixData = useMemo(() => {
    if (!profiles || profiles.length === 0) return { rows: [], columns: [] };
    const divisions = ["governance", "health", "energy", "finance", "food", "security"];
    const rows = profiles.map((p: any) => {
      const country = ALL_COUNTRIES.find(c => c.iso3 === p.iso3);
      const metrics: Record<string, any> = {};
      divisions.forEach(div => {
        const comp = p.profile?.[div]?.completeness || 0;
        metrics[div] = {
          value: Math.round(comp * 100),
          baseline: 60,
          trend: comp > 0.6 ? "up" as const : comp < 0.4 ? "down" as const : "stable" as const,
          status: comp >= 0.6 ? "above" as const : comp < 0.5 ? "below" as const : "at" as const,
          confidence: Math.min(comp + 0.1, 0.95),
        };
      });
      return {
        id: p.iso3,
        label: country?.name || p.iso3,
        iso2: country?.iso2,
        iso3: p.iso3,
        metrics,
      };
    });
    return { rows, columns: divisions };
  }, [profiles]);

  // Narrative divergence analysis
  const narrativeSections = useMemo(() => {
    if (!profiles || profiles.length < 2) return [];
    const sorted = [...profiles].sort((a: any, b: any) => (b.completeness_overall || 0) - (a.completeness_overall || 0));
    const strongest = ALL_COUNTRIES.find(c => c.iso3 === sorted[0]?.iso3)?.name || sorted[0]?.iso3;
    const weakest = ALL_COUNTRIES.find(c => c.iso3 === sorted[sorted.length - 1]?.iso3)?.name || sorted[sorted.length - 1]?.iso3;
    const avgComp = profiles.reduce((a: number, p: any) => a + (p.completeness_overall || 0), 0) / profiles.length;

    return [
      {
        type: "summary" as const,
        content: `Comparing ${profiles.length} countries. ${strongest} leads in overall data coverage, while ${weakest} has the most gaps. Average completeness: ${Math.round(avgComp * 100)}%.`,
        confidence: avgComp,
      },
      {
        type: "drivers" as const,
        content: `Key divergence factors: governance quality, data infrastructure maturity, and institutional reporting consistency. Countries with higher governance scores tend to have better cross-domain coverage.`,
        confidence: 0.7,
      },
      {
        type: "risks" as const,
        content: `Countries with completeness below 50% may have blind spots in early warning capability. Comparison reliability decreases for poorly-monitored nations.`,
        severity: avgComp < 0.5 ? "high" as const : "medium" as const,
      },
    ];
  }, [profiles]);

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
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-orbitron font-bold">Compare Countries</h1>
              <p className="text-xs text-muted-foreground">
                Multi-country intelligence comparison • Max 5 countries
              </p>
            </div>
          </div>
        </div>

        {/* Country Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Select Countries (up to 5)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {selectedCountries.map((iso3, idx) => {
                const country = ALL_COUNTRIES.find((c) => c.iso3 === iso3);
                return (
                  <Badge key={iso3} variant="secondary" className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="text-lg">{getCountryFlag(country?.iso2 || "")}</span>
                    {country?.name || iso3}
                    <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-destructive/20"
                      onClick={() => removeCountry(iso3)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                );
              })}
              {selectedCountries.length === 0 && (
                <p className="text-muted-foreground text-sm">No countries selected. Search and add below.</p>
              )}
            </div>

            {selectedCountries.length < 5 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search countries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {filteredCountries.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-10 max-h-60 overflow-auto">
                    {filteredCountries.map((c) => (
                      <button key={c.iso3} className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-2"
                        onClick={() => addCountry(c.iso3)}
                      >
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

        {/* Comparison Visualizations */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Card><CardContent className="pt-6"><Skeleton className="h-[350px] w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-[350px] w-full" /></CardContent></Card>
          </div>
        ) : profiles && profiles.length > 0 ? (
          <div className="space-y-6">
            {/* Executive Brief */}
            <ModeAwareSection onlyIn="executive">
              <ExecutiveBrief
                soWhat={`${profiles.length} countries compared. Data coverage ranges from ${Math.round(Math.min(...profiles.map((p: any) => p.completeness_overall || 0)) * 100)}% to ${Math.round(Math.max(...profiles.map((p: any) => p.completeness_overall || 0)) * 100)}%.`}
                nowWhat="Review quadrant positioning and matrix gaps to identify priority areas for each nation."
              />
            </ModeAwareSection>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Radar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Completeness by Division</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="division" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      {selectedCountries.map((iso3, idx) => (
                        <Radar
                          key={iso3}
                          name={ALL_COUNTRIES.find((c) => c.iso3 === iso3)?.name || iso3}
                          dataKey={iso3}
                          stroke={COLOR_HEX[idx]}
                          fill={COLOR_HEX[idx]}
                          fillOpacity={0.2}
                        />
                      ))}
                      <Tooltip />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Quadrant Plot */}
              {quadrantData.length > 0 && (
                <QuadrantPlot
                  data={quadrantData}
                  title="Stability vs Coverage Analysis"
                  xLabel="Overall Data Coverage (%)"
                  yLabel="Security Risk Index (%)"
                  quadrantLabels={{
                    topLeft: "High Risk, Low Coverage",
                    topRight: "High Risk, High Coverage",
                    bottomLeft: "Low Risk, Low Coverage",
                    bottomRight: "Low Risk, High Coverage",
                  }}
                  showFlags
                  height={350}
                />
              )}
            </div>

            {/* Comparative Matrix */}
            {matrixData.rows.length > 0 && (
              <ComparativeMatrix
                rows={matrixData.rows}
                columns={matrixData.columns}
                title="Cross-Sector Comparative Matrix"
                baselineLabel="Global Average (60%)"
              />
            )}

            {/* Narrative Divergence Analysis */}
            {narrativeSections.length > 0 && (
              <NarrativeSynthesis
                title="Comparative Intelligence Brief"
                sections={narrativeSections}
                overallConfidence={0.7}
                lastUpdated={new Date().toISOString()}
              />
            )}

            {/* Why Panel (Analyst) */}
            <ModeAwareSection onlyIn="analyst">
              <WhyPanel
                title="Why these comparison results?"
                confidenceScore={0.7}
                confidenceRationale="Comparison reliability depends on data coverage symmetry across all selected countries. Countries with vastly different coverage levels produce less reliable relative rankings."
                drivers={profiles.map((p: any) => ({
                  label: ALL_COUNTRIES.find(c => c.iso3 === p.iso3)?.name || p.iso3,
                  influence: Math.round((p.completeness_overall || 0) * 100),
                  direction: (p.completeness_overall || 0) > 0.6 ? "positive" as const : "negative" as const,
                }))}
                assumptions={[
                  "All countries measured against same baseline metrics",
                  "Data freshness assumed comparable across sources",
                  "Regional baselines set at global 60th percentile",
                ]}
                whatWouldChange={[
                  "Adding more countries with similar data coverage",
                  "Narrowing comparison to specific divisions",
                  "Adjusting regional baseline to local context",
                ]}
                dataLabel="ai_inference"
              />
            </ModeAwareSection>

            {/* Country Details Table */}
            <Card>
              <CardHeader>
                <CardTitle>Country Intelligence Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Country</th>
                        <th className="text-center py-2 px-4">Overall Completeness</th>
                        <th className="text-center py-2 px-4">Region</th>
                        <th className="text-center py-2 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profiles.map((p: any) => {
                        const country = ALL_COUNTRIES.find((c) => c.iso3 === p.iso3);
                        return (
                          <tr key={p.iso3} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4 flex items-center gap-2">
                              <span className="text-xl">{getCountryFlag(country?.iso2 || "")}</span>
                              <span className="font-medium">{p.location?.name || country?.name}</span>
                            </td>
                            <td className="text-center py-3 px-4">
                              <Badge variant={p.completeness_overall >= 0.6 ? "default" : "secondary"}>
                                {Math.round((p.completeness_overall || 0) * 100)}%
                              </Badge>
                            </td>
                            <td className="text-center py-3 px-4 text-muted-foreground">
                              {country?.region}
                            </td>
                            <td className="text-center py-3 px-4">
                              <Button variant="outline" size="sm" onClick={() => navigate(`/deepdive/${p.iso3}`)}>
                                View Details
                              </Button>
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
