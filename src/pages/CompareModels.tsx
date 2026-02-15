import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, GitCompare, ArrowLeft, TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useState } from "react";

const CompareModels = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [versionA, setVersionA] = useState<string>("");
  const [versionB, setVersionB] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Load model registry
  const { data: models } = useQuery({
    queryKey: ["model-registry-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("model_registry")
        .select("*")
        .order("release_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Load calibration metrics for both versions
  const { data: metricsA } = useQuery({
    queryKey: ["model-metrics", versionA],
    queryFn: async () => {
      const { data } = await supabase
        .from("calibration_metrics")
        .select("*")
        .eq("model_version", versionA)
        .order("computed_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user && !!versionA,
  });

  const { data: metricsB } = useQuery({
    queryKey: ["model-metrics", versionB],
    queryFn: async () => {
      const { data } = await supabase
        .from("calibration_metrics")
        .select("*")
        .eq("model_version", versionB)
        .order("computed_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user && !!versionB,
  });

  // Load domain weights for both
  const { data: weightsA } = useQuery({
    queryKey: ["model-weights", versionA],
    queryFn: async () => {
      const { data } = await supabase
        .from("domain_weights")
        .select("domain, weight")
        .eq("model_version", versionA);
      return data || [];
    },
    enabled: !!user && !!versionA,
  });

  const { data: weightsB } = useQuery({
    queryKey: ["model-weights", versionB],
    queryFn: async () => {
      const { data } = await supabase
        .from("domain_weights")
        .select("domain, weight")
        .eq("model_version", versionB);
      return data || [];
    },
    enabled: !!user && !!versionB,
  });

  // Auto-select first two models
  useEffect(() => {
    if (models && models.length >= 1 && !versionA) setVersionA(models[0].model_version);
    if (models && models.length >= 2 && !versionB) setVersionB(models[1].model_version);
  }, [models]);

  const getLatestMetric = (metrics: any[], name: string): number | null => {
    const m = metrics?.find((m: any) => m.metric_name === name);
    return m ? m.metric_value : null;
  };

  const comparisonData = useMemo(() => {
    if (!metricsA || !metricsB) return [];
    const metricNames = ["rmse", "mae", "avg_bias", "hit_rate_80", "hit_rate_95", "mape", "nrmse"];
    return metricNames.map(name => ({
      metric: name.toUpperCase().replace(/_/g, " "),
      [versionA || "A"]: getLatestMetric(metricsA, name),
      [versionB || "B"]: getLatestMetric(metricsB, name),
    })).filter(d => d[versionA || "A"] !== null || d[versionB || "B"] !== null);
  }, [metricsA, metricsB, versionA, versionB]);

  const weightComparison = useMemo(() => {
    if (!weightsA || !weightsB) return [];
    const allDomains = new Set([
      ...(weightsA || []).map((w: any) => w.domain),
      ...(weightsB || []).map((w: any) => w.domain),
    ]);
    return Array.from(allDomains).map(domain => ({
      domain: domain.charAt(0).toUpperCase() + domain.slice(1),
      [versionA || "A"]: weightsA?.find((w: any) => w.domain === domain)?.weight || 0,
      [versionB || "B"]: weightsB?.find((w: any) => w.domain === domain)?.weight || 0,
    }));
  }, [weightsA, weightsB, versionA, versionB]);

  const handleExport = () => {
    const report = {
      exportedAt: new Date().toISOString(),
      versionA, versionB,
      metricsComparison: comparisonData,
      weightComparison,
      modelA: models?.find(m => m.model_version === versionA),
      modelB: models?.find(m => m.model_version === versionB),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `model-comparison-${versionA}-vs-${versionB}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const modelA = models?.find(m => m.model_version === versionA);
  const modelB = models?.find(m => m.model_version === versionB);

  return (
    <AICISLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
          <GitCompare className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Model Version Comparison</h1>
            <p className="text-sm text-muted-foreground">Compare accuracy, weights, and calibration across model versions</p>
          </div>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        {/* Version Selectors */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Version A</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={versionA} onValueChange={setVersionA}>
                <SelectTrigger><SelectValue placeholder="Select version" /></SelectTrigger>
                <SelectContent>
                  {(models || []).map((m: any) => (
                    <SelectItem key={m.model_version} value={m.model_version}>
                      {m.model_version} {m.status === "current" && "✦"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modelA && (
                <div className="mt-3 space-y-1">
                  <Badge variant={modelA.status === "current" ? "default" : "secondary"}>{modelA.status}</Badge>
                  <p className="text-xs text-muted-foreground">Released: {new Date(modelA.release_date).toLocaleDateString()}</p>
                  <p className="text-xs text-muted-foreground">α={modelA.alpha_default}, β={modelA.beta_default}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Version B</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={versionB} onValueChange={setVersionB}>
                <SelectTrigger><SelectValue placeholder="Select version" /></SelectTrigger>
                <SelectContent>
                  {(models || []).map((m: any) => (
                    <SelectItem key={m.model_version} value={m.model_version}>
                      {m.model_version} {m.status === "current" && "✦"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modelB && (
                <div className="mt-3 space-y-1">
                  <Badge variant={modelB.status === "current" ? "default" : "secondary"}>{modelB.status}</Badge>
                  <p className="text-xs text-muted-foreground">Released: {new Date(modelB.release_date).toLocaleDateString()}</p>
                  <p className="text-xs text-muted-foreground">α={modelB.alpha_default}, β={modelB.beta_default}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Metrics Comparison */}
        {comparisonData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Accuracy Metrics Comparison</CardTitle>
              <CardDescription>Latest calibration metrics for each model version</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="metric" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={versionA || "A"} fill="hsl(var(--primary))" />
                  <Bar dataKey={versionB || "B"} fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Select two model versions with calibration data to compare</p>
            </CardContent>
          </Card>
        )}

        {/* Weight Comparison */}
        {weightComparison.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Domain Weight Changes</CardTitle>
              <CardDescription>How domain importance shifted between versions</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weightComparison}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="domain" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={versionA || "A"} fill="hsl(var(--primary))" />
                  <Bar dataKey={versionB || "B"} fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Model Details Table */}
        {modelA && modelB && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Parameter Comparison</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Parameter</th>
                    <th className="text-center py-2 px-3">{versionA}</th>
                    <th className="text-center py-2 px-3">{versionB}</th>
                    <th className="text-center py-2 px-3">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Alpha Default", a: modelA.alpha_default, b: modelB.alpha_default },
                    { label: "Beta Default", a: modelA.beta_default, b: modelB.beta_default },
                    { label: "Break Method", a: modelA.structural_break_method, b: modelB.structural_break_method },
                    { label: "Status", a: modelA.status, b: modelB.status },
                  ].map(row => (
                    <tr key={row.label} className="border-b">
                      <td className="py-2 px-3 font-medium">{row.label}</td>
                      <td className="py-2 px-3 text-center font-mono">{String(row.a ?? "—")}</td>
                      <td className="py-2 px-3 text-center font-mono">{String(row.b ?? "—")}</td>
                      <td className="py-2 px-3 text-center">
                        {typeof row.a === "number" && typeof row.b === "number"
                          ? <span className={row.b - row.a > 0 ? "text-success" : row.b - row.a < 0 ? "text-destructive" : ""}>
                              {(row.b - row.a) > 0 ? "+" : ""}{(row.b - row.a).toFixed(2)}
                            </span>
                          : row.a === row.b ? <Minus className="h-4 w-4 mx-auto text-muted-foreground" /> : "Changed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </AICISLayout>
  );
};

export default CompareModels;
