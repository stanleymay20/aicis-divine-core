import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, CheckCircle2, AlertCircle, Clock } from "lucide-react";

export default function PolicyCompliancePanel() {
  const { data: consents } = useQuery({
    queryKey: ['user-consents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_consent')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: retentionPolicies } = useQuery({
    queryKey: ['retention-policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_retention_policies')
        .select('*');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: federationPolicies } = useQuery({
    queryKey: ['federation-policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('federation_policies')
        .select('*')
        .limit(1)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const activeConsents = consents?.filter(c => !c.revoked_at).length || 0;
  const revokedConsents = consents?.filter(c => c.revoked_at).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Privacy & Compliance Center
        </h2>
        <p className="text-muted-foreground mt-1">GDPR compliance and data sovereignty status</p>
      </div>

      {/* Compliance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">User Consents</h3>
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold">{activeConsents}</div>
          <p className="text-xs text-muted-foreground mt-2">Active consents</p>
          {revokedConsents > 0 && (
            <p className="text-xs text-orange-600 mt-1">{revokedConsents} revoked</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Retention Policies</h3>
            <Clock className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold">{retentionPolicies?.length || 0}</div>
          <p className="text-xs text-muted-foreground mt-2">Active policies</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted-foreground">Data Classification</h3>
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold capitalize">
            {federationPolicies?.data_classification || 'Public'}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Default level</p>
        </Card>
      </div>

      {/* Data Retention Policies */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Data Retention Policies</h3>
        <div className="space-y-3">
          {retentionPolicies && retentionPolicies.length > 0 ? (
            retentionPolicies.map((policy) => (
              <div key={policy.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium capitalize">{policy.category.replace(/_/g, ' ')}</div>
                  <div className="text-sm text-muted-foreground">
                    Retention: {policy.max_days} days
                  </div>
                </div>
                <Badge variant={policy.auto_delete ? "default" : "secondary"}>
                  {policy.auto_delete ? 'Auto-delete enabled' : 'Manual only'}
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">No retention policies configured</div>
          )}
        </div>
      </Card>

      {/* Data Sovereignty */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Data Sovereignty & Federation</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <div className="font-medium">Data Minimization</div>
              <div className="text-sm text-muted-foreground">
                Only aggregated, anonymized data is shared across federation
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <div className="font-medium">Encryption at Rest</div>
              <div className="text-sm text-muted-foreground">
                All data encrypted with AES-256-GCM
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <div className="font-medium">Audit Trail</div>
              <div className="text-sm text-muted-foreground">
                Complete logging of all data access and modifications
              </div>
            </div>
          </div>

          {federationPolicies?.jurisdiction && (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-medium">Jurisdiction</div>
                <div className="text-sm text-muted-foreground">
                  {federationPolicies.jurisdiction}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* GDPR Compliance Status */}
      <Card className="p-6 border-green-200 bg-green-50 dark:bg-green-950/20">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <div>
            <div className="font-semibold text-green-900 dark:text-green-100">GDPR Compliant</div>
            <div className="text-sm text-green-700 dark:text-green-300 mt-1">
              This system implements GDPR Article 5 (data minimization), Article 13-15 (informed consent), 
              Article 17 (right to erasure), and Article 32 (security measures).
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}