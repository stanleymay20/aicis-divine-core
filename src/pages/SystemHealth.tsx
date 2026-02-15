import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, Activity, AlertTriangle, CheckCircle, RefreshCw, Wrench,
  Database, Cpu, Server, Wifi, Clock, ArrowLeft, Shield, Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { type DiagnosticResult, type FailedApi, getErrorMessage } from '@/types/aicis';
import { cn } from '@/lib/utils';
import { AICISLayout } from '@/components/aicis/AICISLayout';

export default function SystemHealth() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [healing, setHealing] = useState(false);
  const [apiUptime, setApiUptime] = useState<Record<string, { status: string; lastSuccess: string | null }>>({});
  const [modelBias, setModelBias] = useState<{ division: string; biasScore: number }[]>([]);
  const [predictionConfidence, setPredictionConfidence] = useState<number>(0);

  useEffect(() => {
    if (!authLoading && !session) {
      navigate('/auth');
    }
  }, [session, authLoading, navigate]);

  useEffect(() => {
    loadLatestDiagnostics();
    loadApiUptime();
    loadModelMetrics();
  }, []);

  const loadLatestDiagnostics = async () => {
    try {
      const { data } = await supabase
        .from('diagnostics_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        const failedApis: FailedApi[] = Array.isArray(data.failed_apis) 
          ? (data.failed_apis as unknown[]).map((api) => {
              const obj = api as Record<string, unknown>;
              return {
                name: String(obj.name || 'Unknown'),
                error: String(obj.error || 'Unknown error'),
                status: typeof obj.status === 'number' ? obj.status : undefined,
              };
            })
          : [];
        
        setDiagnostics({
          status: data.status as DiagnosticResult['status'],
          missing_env: data.missing_env || [],
          failed_apis: failedApis,
          failed_tables: data.failed_tables || [],
          latency_ms: data.latency_ms || 0,
          timestamp: data.created_at,
        });
      }
    } catch (error) {
      // Silent fail for initial load
    }
  };

  const loadApiUptime = async () => {
    try {
      const { data } = await supabase
        .from('data_source_log')
        .select('source, status, last_success, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        const uptimeMap: Record<string, { status: string; lastSuccess: string | null }> = {};
        data.forEach(entry => {
          if (!uptimeMap[entry.source]) {
            uptimeMap[entry.source] = {
              status: entry.status,
              lastSuccess: entry.last_success
            };
          }
        });
        setApiUptime(uptimeMap);
      }
    } catch (error) {
      console.error('Failed to load API uptime:', error);
    }
  };

  const loadModelMetrics = async () => {
    try {
      const { data: biasData } = await supabase
        .from('ai_decision_logs')
        .select('division_key, bias_score, confidence')
        .order('created_at', { ascending: false })
        .limit(20);

      if (biasData) {
        const biasMap: Record<string, number[]> = {};
        let totalConfidence = 0;
        let confCount = 0;

        biasData.forEach(entry => {
          if (entry.bias_score !== null) {
            if (!biasMap[entry.division_key]) biasMap[entry.division_key] = [];
            biasMap[entry.division_key].push(entry.bias_score);
          }
          if (entry.confidence !== null) {
            totalConfidence += entry.confidence;
            confCount++;
          }
        });

        const avgBias = Object.entries(biasMap).map(([division, scores]) => ({
          division,
          biasScore: scores.reduce((a, b) => a + b, 0) / scores.length
        }));

        setModelBias(avgBias);
        setPredictionConfidence(confCount > 0 ? totalConfidence / confCount : 0);
      }
    } catch (error) {
      console.error('Failed to load model metrics:', error);
    }
  };

  const runDiagnostics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('log-system-health');
      
      if (error) throw error;
      
      setDiagnostics(data);
      
      toast({
        title: data.ok ? "System Healthy" : "Issues Detected",
        description: data.ok ? "All systems operational" : "Review diagnostic results below",
        variant: data.ok ? "default" : "destructive"
      });
      
      await loadLatestDiagnostics();
      await loadApiUptime();
    } catch (error: any) {
      toast({
        title: "Diagnostic Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const runSelfHeal = async () => {
    setHealing(true);
    try {
      const { data, error } = await supabase.functions.invoke('aicis-self-heal');
      
      if (error) throw error;
      
      toast({
        title: data.healed ? "Repairs Applied" : "System Stable",
        description: data.healed ? `${data.actions.length} actions taken` : data.message,
        variant: "default"
      });
      
      await loadLatestDiagnostics();
    } catch (error: any) {
      toast({
        title: "Self-Heal Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setHealing(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;

  const isHealthy = diagnostics?.status === 'healthy';
  const onlineApis = Object.values(apiUptime).filter(a => a.status === 'success' || a.status === 'ok').length;
  const totalApis = Object.keys(apiUptime).length;

  return (
    <AICISLayout>
      <div className="p-6 container mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-orbitron font-bold">System Health & Transparency</h1>
                <p className="text-muted-foreground text-sm">Real-time diagnostic & self-healing monitoring</p>
              </div>
            </div>
          </div>
            
            <div className="flex gap-2">
              <Button onClick={runDiagnostics} disabled={loading} variant="outline">
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Run Diagnostics
              </Button>
              <Button onClick={runSelfHeal} disabled={healing} variant="default">
                <Wrench className={cn("h-4 w-4 mr-2", healing && "animate-spin")} />
                Auto Heal
              </Button>
            </div>
          </div>

          {/* Status Overview */}
          <Card className={cn(
            "p-6 border-2",
            isHealthy ? "border-success/50 bg-success/5" : "border-destructive/50 bg-destructive/5"
          )}>
            <div className="flex items-center gap-4">
              {isHealthy ? (
                <CheckCircle className="h-12 w-12 text-success" />
              ) : (
                <AlertTriangle className="h-12 w-12 text-destructive" />
              )}
              <div className="flex-1">
                <h2 className="text-2xl font-bold">
                  {isHealthy ? 'All Systems Operational' : 'Issues Detected'}
                </h2>
                <p className="text-muted-foreground">
                  {diagnostics?.timestamp ? new Date(diagnostics.timestamp).toLocaleString() : 'No diagnostics run yet'}
                </p>
              </div>
              {diagnostics?.latency_ms && (
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  <Clock className="h-4 w-4 mr-2" />
                  {diagnostics.latency_ms}ms
                </Badge>
              )}
            </div>
          </Card>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-card/50 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Server className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">API Uptime</span>
              </div>
              <div className="text-2xl font-orbitron font-bold">
                {totalApis > 0 ? Math.round((onlineApis / totalApis) * 100) : 0}%
              </div>
              <Progress value={totalApis > 0 ? (onlineApis / totalApis) * 100 : 0} className="mt-2" />
            </Card>

            <Card className="p-4 bg-card/50 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="h-4 w-4 text-secondary" />
                <span className="text-sm text-muted-foreground">Prediction Confidence</span>
              </div>
              <div className="text-2xl font-orbitron font-bold">
                {Math.round(predictionConfidence * 100)}%
              </div>
              <Progress value={predictionConfidence * 100} className="mt-2" />
            </Card>

            <Card className="p-4 bg-card/50 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-success" />
                <span className="text-sm text-muted-foreground">Data Sources</span>
              </div>
              <div className="text-2xl font-orbitron font-bold">
                {onlineApis}/{totalApis}
              </div>
              <span className="text-xs text-muted-foreground">Active connections</span>
            </Card>

            <Card className="p-4 bg-card/50 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-warning" />
                <span className="text-sm text-muted-foreground">Latency</span>
              </div>
              <div className="text-2xl font-orbitron font-bold">
                {diagnostics?.latency_ms || '--'}ms
              </div>
              <span className="text-xs text-muted-foreground">Avg response time</span>
            </Card>
          </div>

          {/* API Uptime Section */}
          <Card className="p-6 bg-card/50 border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Wifi className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Data Source Status</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(apiUptime).map(([source, info]) => (
                <div key={source} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <span className="text-sm font-medium truncate">{source}</span>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      (info.status === 'success' || info.status === 'ok') ? "bg-success" : "bg-warning"
                    )} />
                    <span className="text-xs text-muted-foreground">
                      {info.lastSuccess ? new Date(info.lastSuccess).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </div>
              ))}
              {Object.keys(apiUptime).length === 0 && (
                <p className="text-muted-foreground text-sm col-span-full">No data source logs available</p>
              )}
            </div>
          </Card>

          {/* Model Bias Indicators */}
          <Card className="p-6 bg-card/50 border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Model Bias Indicators</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {modelBias.map(({ division, biasScore }) => (
                <div key={division} className="p-4 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium capitalize">{division}</span>
                    <Badge variant={biasScore < 0.3 ? "default" : biasScore < 0.6 ? "secondary" : "destructive"}>
                      {(biasScore * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress value={(1 - biasScore) * 100} className="h-2" />
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    {biasScore < 0.3 ? 'Low bias' : biasScore < 0.6 ? 'Moderate bias' : 'High bias - review recommended'}
                  </span>
                </div>
              ))}
              {modelBias.length === 0 && (
                <p className="text-muted-foreground text-sm col-span-full">No bias data available</p>
              )}
            </div>
          </Card>

          {diagnostics && (
            <>
              {/* Missing Environment Variables */}
              {diagnostics.missing_env && diagnostics.missing_env.length > 0 && (
                <Card className="p-6 border-destructive/50 bg-destructive/5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <h3 className="text-lg font-semibold">Missing Environment Variables</h3>
                      <Badge variant="destructive">{diagnostics.missing_env.length}</Badge>
                    </div>
                    <div className="grid gap-2">
                      {diagnostics.missing_env.map((env) => (
                        <div key={env} className="p-3 rounded bg-destructive/10 text-destructive font-mono text-sm">
                          {env}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Failed APIs */}
              {diagnostics.failed_apis && diagnostics.failed_apis.length > 0 && (
                <Card className="p-6 border-warning/50 bg-warning/5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-warning" />
                      <h3 className="text-lg font-semibold">API Issues</h3>
                      <Badge variant="secondary">{diagnostics.failed_apis.length}</Badge>
                    </div>
                    <div className="grid gap-2">
                      {diagnostics.failed_apis.map((api: any, idx: number) => (
                        <div key={idx} className="p-3 rounded bg-warning/10">
                          <p className="font-medium">{api.name}</p>
                          <p className="text-sm text-muted-foreground">{api.error}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Failed Tables */}
              {diagnostics.failed_tables && diagnostics.failed_tables.length > 0 && (
                <Card className="p-6 border-destructive/50 bg-destructive/5">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-destructive" />
                      <h3 className="text-lg font-semibold">Database Table Issues</h3>
                      <Badge variant="destructive">{diagnostics.failed_tables.length}</Badge>
                    </div>
                    <div className="grid gap-2">
                      {diagnostics.failed_tables.map((table) => (
                        <div key={table} className="p-3 rounded bg-destructive/10 text-destructive font-mono text-sm">
                          {table}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* All Healthy */}
              {isHealthy && (
                <Card className="p-6 border-success/50 bg-success/5">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-success" />
                    <div>
                      <p className="font-medium">No issues detected</p>
                      <p className="text-sm text-muted-foreground">
                        All APIs accessible, environment configured, database operational
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}

          {!diagnostics && !loading && (
            <Card className="p-12 text-center bg-card/50 border-primary/20">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg mb-4">No diagnostic data available</p>
              <Button onClick={runDiagnostics}>Run First Diagnostic</Button>
            </Card>
        )}
      </div>
    </AICISLayout>
  );
}
