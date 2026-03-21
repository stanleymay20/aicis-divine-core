import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Target, TrendingUp, TrendingDown, Activity, AlertTriangle, Zap, BarChart3 } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ScatterChart, Scatter, ReferenceLine,
} from "recharts";

const PredictionAccuracy = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // ── Queries ────────────────────────────────────────────────────────

  const { data: validationResults, isLoading: vrLoading } = useQuery({
    queryKey: ["validation-results"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forecast_validation_results")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: vulnCorrelations, isLoading: vcLoading } = useQuery({
    queryKey: ["vuln-correlations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vulnerability_event_correlations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: residuals, isLoading: resLoading } = useQuery({
    queryKey: ["residual-trend"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calibration_metrics")
        .select("metric_name, metric_value, computed_at, sample_size, domain")
        .in("metric_name", ["mae", "rmse", "mape"])
        .order("computed_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const isLoading = vrLoading || vcLoading || resLoading;

  // ── Compute Stats ──────────────────────────────────────────────────

  const results1d = (validationResults || []).filter((r: any) => r.horizon_days === 1);
  const results7d = (validationResults || []).filter((r: any) => r.horizon_days === 7);

  const dirAccuracy = (rows: any[]) => {
    if (!rows.length) return null;
    const hits = rows.filter((r: any) => r.direction_hit).length;
    return Math.round((hits / rows.length) * 100);
  };

  const avgMAE = (rows: any[]) => {
    if (!rows.length) return null;
    const sum = rows.reduce((s: number, r: any) => s + (r.absolute_error || 0), 0);
    return Math.round((sum / rows.length) * 100) / 100;
  };

  const acc1d = dirAccuracy(results1d);
  const acc7d = dirAccuracy(results7d);
  const mae1d = avgMAE(results1d);
  const mae7d = avgMAE(results7d);

  // Directional accuracy by date
  const accByDate = (rows: any[]) => {
    const byDate: Record<string, { hits: number; total: number }> = {};
    for (const r of rows) {
      const d = r.realized_date;
      if (!byDate[d]) byDate[d] = { hits: 0, total: 0 };
      byDate[d].total++;
      if (r.direction_hit) byDate[d].hits++;
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), accuracy: Math.round((v.hits / v.total) * 100), count: v.total }));
  };

  const acc1dTrend = accByDate(results1d);
  const acc7dTrend = accByDate(results7d);

  // Error distribution for histogram
  const errorBins = () => {
    const all = (validationResults || []).filter((r: any) => r.absolute_error != null);
    if (!all.length) return [];
    const bins = [0, 0.5, 1, 2, 5, 10, 20, 50, 100];
    const counts = bins.map(() => 0);
    for (const r of all) {
      const e = r.absolute_error;
      let placed = false;
      for (let i = 0; i < bins.length - 1; i++) {
        if (e >= bins[i] && e < bins[i + 1]) { counts[i]++; placed = true; break; }
      }
      if (!placed) counts[counts.length - 1]++;
    }
    return bins.map((b, i) => ({
      range: i < bins.length - 1 ? `${b}-${bins[i + 1]}` : `${b}+`,
      count: counts[i],
    }));
  };

  // MAE trend from calibration_metrics
  const maeTrend = (residuals || [])
    .filter((r: any) => r.metric_name === "mae" && r.metric_value < 100) // filter sane scale
    .map((r: any) => ({
      date: new Date(r.computed_at).toLocaleDateString("en", { month: "short", day: "numeric" }),
      mae: r.metric_value,
      domain: r.domain || "global",
    }));

  // Vulnerability correlation summary
  const corrSummary = () => {
    const corrs = vulnCorrelations || [];
    if (!corrs.length) return { total: 0, avgDays: 0, avgSignal: 0, byType: [] as any[] };
    const avgDays = Math.round(corrs.reduce((s: number, c: any) => s + c.days_between, 0) / corrs.length);
    const avgSignal = Math.round(corrs.reduce((s: number, c: any) => s + (c.signal_strength || 0), 0) / corrs.length * 100) / 100;
    const typeMap: Record<string, number> = {};
    for (const c of corrs) { typeMap[c.event_type] = (typeMap[c.event_type] || 0) + 1; }
    const byType = Object.entries(typeMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([type, count]) => ({ type, count }));
    return { total: corrs.length, avgDays, avgSignal, byType };
  };

  const corr = corrSummary();

  if (authLoading || !user) return null;

  return (
    <AICISLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-orbitron font-bold text-foreground flex items-center gap-3">
              <Target className="h-7 w-7 text-primary" />
              Prediction Accuracy
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Read-only validation layer — Does the engine predict reality?
            </p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              AI-assisted analysis • Shadow mode • Not validated intelligence
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            {(validationResults || []).length >= 1000 ? "1,000+ (sampled)" : (validationResults || []).length} validations
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ── KPI Cards ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICard
                icon={<TrendingUp className="h-5 w-5" />}
                label="1-Day Directional"
                value={acc1d !== null ? `${acc1d}%` : "—"}
                target="Target: 55–65%"
                status={acc1d !== null ? (acc1d >= 55 ? "good" : acc1d >= 45 ? "warn" : "bad") : "neutral"}
              />
              <KPICard
                icon={<Activity className="h-5 w-5" />}
                label="7-Day Directional"
                value={acc7d !== null ? `${acc7d}%` : "—"}
                target="Target: 50–58%"
                status={acc7d !== null ? (acc7d >= 50 ? "good" : acc7d >= 40 ? "warn" : "bad") : "neutral"}
              />
              <KPICard
                icon={<BarChart3 className="h-5 w-5" />}
                label="1-Day MAE"
                value={mae1d !== null ? mae1d.toFixed(2) : "—"}
                target="Lower is better"
                status="neutral"
              />
              <KPICard
                icon={<Zap className="h-5 w-5" />}
                label="Vuln→Crisis Signals"
                value={corr.total.toString()}
                target={corr.total > 0 ? `Avg ${corr.avgDays}d lag` : "Accumulating..."}
                status={corr.total > 5 ? "good" : "neutral"}
              />
            </div>

            {/* ── Chart Row 1: Directional Accuracy Trends ────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-orbitron">1-Day Directional Accuracy Trend</CardTitle>
                  <CardDescription className="text-xs">Did the predicted direction match reality?</CardDescription>
                </CardHeader>
                <CardContent>
                  {acc1dTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={acc1dTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <ReferenceLine y={55} stroke="hsl(var(--primary))" strokeDasharray="5 5" label="Target" />
                        <ReferenceLine y={50} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label="Random" />
                        <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState message="Validation data accumulating — first results after 1 day of operation" />
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-orbitron">7-Day Directional Accuracy Trend</CardTitle>
                  <CardDescription className="text-xs">Signal persistence across a week</CardDescription>
                </CardHeader>
                <CardContent>
                  {acc7dTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={acc7dTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <ReferenceLine y={50} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label="Random" />
                        <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState message="7-day validation requires 7+ days of snapshots" />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Chart Row 2: Error Distribution + MAE Trend ──── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-orbitron">Forecast Error Distribution</CardTitle>
                  <CardDescription className="text-xs">Absolute error histogram across all horizons</CardDescription>
                </CardHeader>
                <CardContent>
                  {errorBins().some(b => b.count > 0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={errorBins()}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                        <XAxis dataKey="range" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                          {errorBins().map((_, i) => (
                            <Cell key={i} fill={i < 3 ? "hsl(var(--chart-1))" : i < 6 ? "hsl(var(--chart-3))" : "hsl(var(--destructive))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState message="Error data accumulating..." />
                  )}
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-orbitron">MAE Trend (Model Learning)</CardTitle>
                  <CardDescription className="text-xs">
                    If MAE declines → model is learning. If flat → model static.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {maeTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={maeTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="mae" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState message="MAE trend data accumulating from calibration engine..." />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Vulnerability → Crisis Correlation ──────────── */}
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-orbitron flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Vulnerability → Crisis/Anomaly Correlation
                </CardTitle>
                <CardDescription className="text-xs">
                  When vulnerability spikes, do crises/anomalies follow within 14 days?
                </CardDescription>
              </CardHeader>
              <CardContent>
                {corr.total > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-orbitron font-bold text-foreground">{corr.total}</div>
                        <div className="text-xs text-muted-foreground">Correlations Found</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-orbitron font-bold text-foreground">{corr.avgDays}d</div>
                        <div className="text-xs text-muted-foreground">Avg Lead Time</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-orbitron font-bold text-foreground">{corr.avgSignal}</div>
                        <div className="text-xs text-muted-foreground">Avg Signal Strength</div>
                      </div>
                    </div>
                    {corr.byType.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {corr.byType.map(t => (
                          <Badge key={t.type} variant="secondary" className="text-xs">
                            {t.type}: {t.count}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <ResponsiveContainer width="100%" height={180}>
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                        <XAxis dataKey="days_between" name="Days Before Event" tick={{ fontSize: 10 }} label={{ value: "Days After Vuln Spike", position: "bottom", fontSize: 10 }} />
                        <YAxis dataKey="signal_strength" name="Signal Strength" tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Scatter data={vulnCorrelations} fill="hsl(var(--chart-5))" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState message="Vulnerability-event correlations accumulating (requires 14+ days of vulnerability data)..." />
                )}
              </CardContent>
            </Card>

            {/* ── Methodology Note ────────────────────────────── */}
            <Card className="border-muted/30 bg-muted/5">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Validation Doctrine:</strong> This layer is strictly read-only — it never modifies forecast weights, 
                  calibration parameters, or model logic. Directional accuracy above 55% at 1-day horizon indicates the system 
                  is not random. MAE decline over time proves learning. Vulnerability-crisis correlation with lead times of 
                  3–14 days validates early-warning capability. No engine modifications will be made until 60–90 days of 
                  validation evidence exists.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AICISLayout>
  );
};

// ── Sub-components ─────────────────────────────────────────────────

const KPICard = ({ icon, label, value, target, status }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  target: string;
  status: "good" | "warn" | "bad" | "neutral";
}) => {
  const colors = {
    good: "text-success",
    warn: "text-warning",
    bad: "text-destructive",
    neutral: "text-foreground",
  };
  return (
    <Card className="border-primary/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
        <div className={`text-2xl font-orbitron font-bold ${colors[status]}`}>{value}</div>
        <div className="text-[10px] text-muted-foreground mt-1">{target}</div>
      </CardContent>
    </Card>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex items-center justify-center h-[180px] text-center">
    <div>
      <TrendingDown className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  </div>
);

export default PredictionAccuracy;
