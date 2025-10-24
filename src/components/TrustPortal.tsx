import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle, Lock, Globe, TrendingUp, FileCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const TrustPortal = () => {
  // Fetch latest trust metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['trust-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trust_metrics')
        .select('*')
        .order('computed_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      
      // Group by metric type and get latest
      const latestMetrics: Record<string, any> = {};
      data?.forEach(m => {
        if (!latestMetrics[m.metric_type]) {
          latestMetrics[m.metric_type] = m;
        }
      });
      
      return latestMetrics;
    }
  });

  // Fetch latest transparency report
  const { data: latestReport } = useQuery({
    queryKey: ['transparency-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transparency_reports')
        .select('*')
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const getMetricIcon = (type: string) => {
    switch (type) {
      case 'ai_trust_score': return Shield;
      case 'ledger_integrity_score': return CheckCircle;
      case 'gdpr_compliance_score': return Lock;
      case 'sdg_progress_index': return Globe;
      case 'data_protection_uptime': return TrendingUp;
      default: return FileCheck;
    }
  };

  const getMetricLabel = (type: string) => {
    const labels: Record<string, string> = {
      ai_trust_score: 'AI Trust Score',
      ledger_integrity_score: 'Ledger Integrity',
      gdpr_compliance_score: 'GDPR Compliance',
      sdg_progress_index: 'SDG Progress Index',
      data_protection_uptime: 'Data Protection Uptime (24h)'
    };
    return labels[type] || type;
  };

  const getMetricColor = (value: number) => {
    if (value >= 95) return 'text-green-500';
    if (value >= 85) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Public Trust Portal
        </h2>
        <p className="text-muted-foreground mt-1">
          Transparency By Design – AICIS Global Data Ethics Charter
        </p>
      </div>

      {/* Trust Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center py-8">Loading trust metrics...</div>
        ) : (
          Object.entries(metrics || {}).map(([type, metric]: [string, any]) => {
            const Icon = getMetricIcon(type);
            const value = Number(metric.metric_value);
            
            return (
              <Card key={type} className="relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 ${value >= 95 ? 'bg-green-500/10' : value >= 85 ? 'bg-yellow-500/10' : 'bg-red-500/10'} rounded-full blur-3xl -mr-16 -mt-16`} />
                
                <CardHeader className="relative">
                  <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>{getMetricLabel(type)}</span>
                    <Icon className={`h-4 w-4 ${getMetricColor(value)}`} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-2">
                    <div className={`text-3xl font-bold ${getMetricColor(value)}`}>
                      {value.toFixed(1)}%
                    </div>
                    <Progress value={value} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Last updated: {new Date(metric.computed_at).toLocaleDateString()}</span>
                      {metric.signature && (
                        <Badge variant="outline" className="text-[10px]">
                          <Lock className="h-2 w-2 mr-1" />
                          Signed
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Charter Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            AICIS Data Ethics Charter
          </CardTitle>
          <CardDescription>
            Our commitment to lawful, transparent, and privacy-preserving global intelligence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Data Access Tiers</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Public:</strong> Aggregated, anonymized, 72h delayed</li>
                <li>• <strong>Institutional:</strong> Live, region-level, verified nodes</li>
                <li>• <strong>Administrative:</strong> Full audit access, encrypted</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Compliance Framework</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>GDPR:</strong> Full Article 13-35 compliance</li>
                <li>• <strong>AI Act:</strong> Transparency & explainability</li>
                <li>• <strong>UN SDG:</strong> All 17 goals tracked</li>
                <li>• <strong>OECD AI:</strong> Ethical principles aligned</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Security Measures</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Encryption:</strong> AES-256-GCM at rest</li>
                <li>• <strong>Transport:</strong> TLS 1.3 + HMAC auth</li>
                <li>• <strong>Audit:</strong> Immutable ledger records</li>
                <li>• <strong>Anonymization:</strong> PII redacted pre-training</li>
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Accountability</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>Oversight:</strong> Ethics Council + GDPR Auditor</li>
                <li>• <strong>Appeals:</strong> 7-day review process</li>
                <li>• <strong>Reports:</strong> Annual transparency report</li>
                <li>• <strong>Certification:</strong> ISO 27701 + 27001 ready</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Latest Transparency Report */}
      {latestReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Latest Transparency Report
            </CardTitle>
            <CardDescription>
              Published: {new Date(latestReport.published_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 mb-4">
              <div>
                <div className="text-sm text-muted-foreground">Total Users</div>
                <div className="text-2xl font-bold">{latestReport.total_users || 0}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">AI Decisions</div>
                <div className="text-2xl font-bold">{latestReport.total_decisions || 0}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">GDPR Requests</div>
                <div className="text-2xl font-bold">{latestReport.gdpr_requests_count || 0}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Data Breaches</div>
                <div className={`text-2xl font-bold ${latestReport.data_breaches_count === 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {latestReport.data_breaches_count || 0}
                </div>
              </div>
            </div>
            
            {latestReport.signed_hash && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>Report signed with hash: {latestReport.signed_hash.substring(0, 32)}...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground border-t pt-6">
        <p className="font-semibold">Protected Data Empowers People</p>
        <p>AICIS 2025 Global Data Ethics Charter – Transparency By Design</p>
      </div>
    </div>
  );
};
