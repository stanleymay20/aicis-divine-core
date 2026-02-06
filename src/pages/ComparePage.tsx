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
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { useViewModePersistence } from "@/hooks/useViewModePersistence";

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--secondary))"];
const COLOR_HEX = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]; // For recharts which needs hex

const ComparePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCountries = searchParams.get("countries")?.split(",").filter(Boolean) || [];
  const [selectedCountries, setSelectedCountries] = useState<string[]>(initialCountries);
  const [searchQuery, setSearchQuery] = useState("");
  const { mode } = useViewModePersistence();
  const isExecutiveMode = mode === "executive";

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Fetch country profiles for selected countries
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

  // Fetch predictions for selected countries
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

  // Prepare radar data for completeness comparison
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

  // Prepare bar data for predictions comparison
  const predictionData = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];
    const byCountry: Record<string, { confidence: number; count: number }> = {};
    predictions.forEach((p: any) => {
      const key = p.country;
      if (!byCountry[key]) byCountry[key] = { confidence: 0, count: 0 };
      byCountry[key].confidence += Math.min(p.confidence || 0, 0.95); // Enforce 95% cap
      byCountry[key].count++;
    });
    return Object.entries(byCountry).map(([country, stats]) => ({
      country,
      avgConfidence: Math.round((stats.confidence / stats.count) * 100),
    }));
  }, [predictions]);

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
            {/* Selected Countries */}
            <div className="flex flex-wrap gap-2">
              {selectedCountries.map((iso3, idx) => {
                const country = ALL_COUNTRIES.find((c) => c.iso3 === iso3);
                return (
                  <Badge
                    key={iso3}
                    variant="secondary"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm"
                  >
                    <span className="text-lg">{getCountryFlag(country?.iso2 || "")}</span>
                    {country?.name || iso3}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-destructive/20"
                      onClick={() => removeCountry(iso3)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                );
              })}
              {selectedCountries.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No countries selected. Search and add countries below.
                </p>
              )}
            </div>

            {/* Search Input */}
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
                      <button
                        key={c.iso3}
                        className="w-full px-4 py-2 text-left hover:bg-muted flex items-center gap-2"
                        onClick={() => addCountry(c.iso3)}
                      >
                        <span className="text-lg">{getCountryFlag(c.iso2)}</span>
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {c.iso3}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comparison Charts */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Card><CardContent className="pt-6"><Skeleton className="h-[350px] w-full" /></CardContent></Card>
            <Card><CardContent className="pt-6"><Skeleton className="h-[350px] w-full" /></CardContent></Card>
          </div>
        ) : profiles && profiles.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Radar Chart - Data Completeness */}
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

            {/* Bar Chart - Prediction Confidence */}
            <Card>
              <CardHeader>
                <CardTitle>Average Prediction Confidence</CardTitle>
              </CardHeader>
              <CardContent>
                {predictionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={predictionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="country" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="avgConfidence" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                    No prediction data available for selected countries
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Country Details Table */}
            <Card className="md:col-span-2">
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/deepdive/${p.iso3}`)}
                              >
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