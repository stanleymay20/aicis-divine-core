import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle, AlertTriangle, Globe, Link as LinkIcon, Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const AccountabilityDashboard = () => {
  // Fetch accountability nodes
  const { data: nodes, isLoading: nodesLoading } = useQuery({
    queryKey: ['accountability-nodes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accountability_nodes')
        .select('*')
        .eq('verified', true)
        .order('joined_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch recent ledger entries
  const { data: ledgerEntries, isLoading: ledgerLoading } = useQuery({
    queryKey: ['ledger-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*')
        .eq('verified', true)
        .order('block_number', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch latest root hash
  const { data: rootHash } = useQuery({
    queryKey: ['ledger-root-hash'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ledger_root_hashes')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const exportSnapshot = async () => {
    const { data, error } = await supabase.functions.invoke('ledger-export-snapshot', {
      body: { format: 'json' }
    });
    
    if (error) {
      console.error('Export error:', error);
      return;
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-snapshot-${Date.now()}.json`;
    a.click();
  };

  const getOrgTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      government: 'bg-blue-500',
      ngo: 'bg-green-500',
      agency: 'bg-purple-500',
      academic: 'bg-orange-500',
      private: 'bg-gray-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getEntryTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ethics: 'bg-purple-500',
      sdg: 'bg-green-500',
      finance: 'bg-blue-500',
      policy: 'bg-yellow-500',
      crisis: 'bg-red-500',
      compliance: 'bg-indigo-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  // Calculate integrity score from verified ledger entries
  const integrityScore = (() => {
    if (!ledgerEntries || ledgerEntries.length === 0) return 0;
    const verifiedCount = ledgerEntries.filter(e => e.verified).length;
    return Number(((verifiedCount / ledgerEntries.length) * 100).toFixed(1));
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Global Accountability Network
          </h2>
          <p className="text-muted-foreground mt-1">
            Federated Integrity Network - Trust is Verifiable
          </p>
        </div>
        <Button onClick={exportSnapshot} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export Ledger
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Nodes</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nodes?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {new Set(nodes?.map(n => n.jurisdiction)).size || 0} jurisdictions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ledger Entries</CardTitle>
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rootHash?.block_count || 0}</div>
            <p className="text-xs text-muted-foreground">
              {ledgerEntries?.length || 0} recent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Integrity Score</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrityScore}%</div>
            <Progress value={integrityScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Root Hash</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xs font-mono truncate">
              {rootHash?.root_hash?.substring(0, 16)}...
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Updated {rootHash?.timestamp ? new Date(rootHash.timestamp).toLocaleDateString() : 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Council Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Council Members
          </CardTitle>
          <CardDescription>
            Verified institutional nodes in the accountability network
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nodesLoading ? (
            <div className="text-center py-8">Loading nodes...</div>
          ) : (
            <div className="space-y-3">
              {nodes?.map((node) => (
                <div key={node.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${getOrgTypeColor(node.org_type)}`} />
                    <div>
                      <div className="font-medium">{node.org_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {node.country} • {node.jurisdiction}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {node.org_type}
                    </Badge>
                    {node.verified && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Ledger Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Recent Ledger Entries
          </CardTitle>
          <CardDescription>
            Immutable accountability records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ledgerLoading ? (
            <div className="text-center py-8">Loading ledger...</div>
          ) : (
            <div className="space-y-2">
              {ledgerEntries?.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-2 border-l-2 border-primary/30 pl-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3 flex-1">
                    <Badge className={getEntryTypeColor(entry.entry_type)}>
                      {entry.entry_type}
                    </Badge>
                    <div className="flex-1">
                      <div className="text-sm font-mono text-muted-foreground">
                        Block #{entry.block_number}
                      </div>
                      <div className="text-xs font-mono truncate max-w-md">
                        {entry.hash.substring(0, 32)}...
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                    {entry.verified ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
