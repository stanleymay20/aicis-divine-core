import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity, AlertTriangle, CheckCircle, RefreshCw, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DiagnosticResult {
  status: string;
  missing_env: string[];
  failed_apis: any[];
  failed_tables: string[];
  latency_ms: number;
  timestamp?: string;
}

export default function SystemHealth() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [healing, setHealing] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) {
      navigate('/auth');
    }
  }, [session, authLoading, navigate]);

  useEffect(() => {
    loadLatestDiagnostics();
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
        setDiagnostics({
          ...data,
          failed_apis: Array.isArray(data.failed_apis) ? data.failed_apis : [],
        });
      }
    } catch (error) {
      console.error('Failed to load diagnostics:', error);
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

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AICIS System Health</h1>
            <p className="text-muted-foreground">Real-time diagnostic & self-healing monitoring</p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={runDiagnostics} disabled={loading} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Run Diagnostics
            </Button>
            <Button onClick={runSelfHeal} disabled={healing} variant="default">
              <Wrench className={`h-4 w-4 mr-2 ${healing ? 'animate-spin' : ''}`} />
              Auto Heal
            </Button>
          </div>
        </div>

        {/* Status Overview */}
        <Card className={`p-6 ${isHealthy ? 'border-green-500/50' : 'border-destructive/50'}`}>
          <div className="flex items-center gap-4">
            {isHealthy ? (
              <CheckCircle className="h-12 w-12 text-green-500" />
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
                {diagnostics.latency_ms}ms
              </Badge>
            )}
          </div>
        </Card>

        {diagnostics && (
          <>
            {/* Missing Environment Variables */}
            {diagnostics.missing_env && diagnostics.missing_env.length > 0 && (
              <Card className="p-6 border-destructive/50">
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
              <Card className="p-6 border-yellow-500/50">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-yellow-500" />
                    <h3 className="text-lg font-semibold">API Issues</h3>
                    <Badge variant="secondary">{diagnostics.failed_apis.length}</Badge>
                  </div>
                  <div className="grid gap-2">
                    {diagnostics.failed_apis.map((api: any, idx: number) => (
                      <div key={idx} className="p-3 rounded bg-yellow-500/10">
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
              <Card className="p-6 border-destructive/50">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
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
              <Card className="p-6 border-green-500/50 bg-green-500/5">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-500" />
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
          <Card className="p-12 text-center">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg mb-4">No diagnostic data available</p>
            <Button onClick={runDiagnostics}>Run First Diagnostic</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
