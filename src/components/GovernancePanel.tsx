import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Shield, RefreshCw } from "lucide-react";

export const GovernancePanel = () => {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);

  const { data: policies, refetch } = useQuery({
    queryKey: ['gov-policies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gov_policies')
        .select('*')
        .order('last_reviewed', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('governance-scan', {
        body: { jurisdiction: 'EU', topics: ['AI', 'Data Protection', 'Finance'] }
      });

      if (error) throw error;

      toast({
        title: "Governance Scan Complete",
        description: data.message,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const getComplianceBadge = (level: string) => {
    const variants = {
      compliant: "default",
      review: "secondary",
      "non-compliant": "destructive",
    };
    return <Badge variant={variants[level as keyof typeof variants] as any}>{level}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Governance & Policy</CardTitle>
          </div>
          <Button 
            onClick={handleScan} 
            disabled={isScanning}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            Run Scan
          </Button>
        </div>
        <CardDescription>
          Policy compliance monitoring across jurisdictions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {policies && policies.length > 0 ? (
            policies.map((policy) => (
              <div key={policy.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold">{policy.jurisdiction} - {policy.topic}</h4>
                    <p className="text-sm text-muted-foreground">
                      Last reviewed: {new Date(policy.last_reviewed).toLocaleString()}
                    </p>
                  </div>
                  {getComplianceBadge(policy.compliance_level)}
                </div>
                {policy.summary_md && (
                  <div className="text-sm prose prose-sm dark:prose-invert mt-2">
                    {policy.summary_md.substring(0, 200)}...
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No policies scanned yet. Click "Run Scan" to begin.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};