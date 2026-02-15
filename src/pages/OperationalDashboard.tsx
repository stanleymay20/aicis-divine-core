import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, AlertTriangle, CheckCircle2, Clock, Zap, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const OperationalDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // Telemetry data
  const { data: telemetry = [] } = useQuery({
    queryKey: ["op-telemetry"],
    queryFn: async () => {
      const { data } = await supabase
        .from("operational_telemetry")
        .select("function_name, execution_time_ms, status, items_processed, retry_count, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!user,
  });

  // Drift alerts
  const { data: driftAlerts = [] } = useQuery({
    queryKey: ["op-drift-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("drift_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  // Forecast job stats
  const { data: jobStats } = useQuery({
    queryKey: ["op-job-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("forecast_jobs")
        .select("status")
        .limit(200);
      if (!data) return { total: 0, completed: 0, failed: 0, pending: 0 };
      return {
        total: data.length,
        completed: data.filter((j: any) => j.status === "completed").length,
        failed: data.filter((j: any) => j.status === "failed").length,
        pending: data.filter((j: any) => j.status === "pending" || j.status === "running").length,
      };
    },
    enabled: !!user,
  });

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  // Compute aggregate stats
  const successCount = telemetry.filter((t: any) => t.status === "success").length;
  const failCount = telemetry.filter((t: any) => t.status !== "success").length;
  const successRate = telemetry.length > 0 ? Math.round((successCount / telemetry.length) * 100) : 0;
  const avgLatency = telemetry.length > 0
    ? Math.round(telemetry.reduce((s: number, t: any) => s + (t.execution_time_ms || 0), 0) / telemetry.length)
    : 0;
  const totalRetries = telemetry.reduce((s: number, t: any) => s + (t.retry_count || 0), 0);

  // P99 latency
  const latencies = telemetry.map((t: any) => t.execution_time_ms || 0).sort((a: number, b: number) => a - b);
  const p99 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.99)] : 0;

  // Latency chart data (last 20 entries)
  const chartData = telemetry.slice(0, 20).reverse().map((t: any) => ({
    name: new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    latency: t.execution_time_ms || 0,
    fn: t.function_name,
  }));

  const unackAlerts = driftAlerts.filter((a: any) => !a.acknowledged);

  return (
    <AICISLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Operational Observability</h1>
            <p className="text-sm text-muted-foreground">Runtime telemetry, drift alerts, job health</p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Success Rate</p>
              <p className="text-2xl font-bold font-mono">{successRate}%</p>
              <p className="text-[10px] text-muted-foreground">{successCount}/{telemetry.length} calls</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Avg Latency</p>
              <p className="text-2xl font-bold font-mono">{avgLatency}ms</p>
              <p className="text-[10px] text-muted-foreground">P99: {p99}ms</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Retries</p>
              <p className="text-2xl font-bold font-mono">{totalRetries}</p>
              <p className="text-[10px] text-muted-foreground">{failCount} failures</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Jobs</p>
              <p className="text-2xl font-bold font-mono">{jobStats?.completed ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">{jobStats?.failed ?? 0} failed, {jobStats?.pending ?? 0} pending</p>
            </CardContent>
          </Card>
          <Card className={cn(unackAlerts.length > 0 && "border-warning/50")}>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Drift Alerts</p>
              <p className="text-2xl font-bold font-mono">{unackAlerts.length}</p>
              <p className="text-[10px] text-muted-foreground">unacknowledged</p>
            </CardContent>
          </Card>
        </div>

        {/* Latency Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Edge Function Latency (recent)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Line type="monotone" dataKey="latency" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">No telemetry data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Drift Alerts */}
        {unackAlerts.length > 0 && (
          <Card className="border-warning/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Active Drift Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {unackAlerts.map((alert: any) => (
                <div key={alert.id} className={cn("border rounded-lg p-3 flex items-start gap-3",
                  alert.severity === "critical" ? "border-destructive/50 bg-destructive/5" : "border-warning/50 bg-warning/5"
                )}>
                  <AlertTriangle className={cn("h-4 w-4 mt-0.5 shrink-0",
                    alert.severity === "critical" ? "text-destructive" : "text-warning"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.alert_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {(alert.details as any)?.message || `${alert.current_value} vs baseline ${alert.baseline_value} (${alert.deviation_pct}% deviation)`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{alert.severity}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Telemetry Log */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Function Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {telemetry.slice(0, 25).map((t: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-border/30">
                  {t.status === "success"
                    ? <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
                    : <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                  <span className="font-mono text-muted-foreground w-24 truncate">{t.function_name}</span>
                  <span className="text-muted-foreground">{t.execution_time_ms}ms</span>
                  {(t.retry_count || 0) > 0 && <Badge variant="outline" className="text-[9px]">{t.retry_count} retries</Badge>}
                  <span className="ml-auto text-muted-foreground">{new Date(t.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
              {telemetry.length === 0 && <p className="text-center text-muted-foreground py-4">No telemetry recorded yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </AICISLayout>
  );
};

export default OperationalDashboard;
