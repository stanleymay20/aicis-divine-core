import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, MapPin, Building2, User, Shield, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Node {
  id: string;
  org_name: string;
  org_type: 'global' | 'national' | 'institutional' | 'individual';
  country: string;
  jurisdiction: string;
  verified: boolean;
  last_active_at: string;
  metadata: any;
}

export const NodeFederationPanel = () => {
  const { data: nodes = [] } = useQuery({
    queryKey: ['federation-nodes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accountability_nodes')
        .select('*')
        .eq('verified', true)
        .order('last_active_at', { ascending: false });
      
      if (error) throw error;
      
      // Map database org_type to display node type
      return (data || []).map(node => ({
        ...node,
        org_type: mapOrgTypeToNodeType(node.org_type)
      })) as Node[];
    }
  });

  const mapOrgTypeToNodeType = (orgType: string): Node['org_type'] => {
    switch (orgType) {
      case 'government': return 'national';
      case 'academic':
      case 'ngo': 
      case 'private': return 'institutional';
      default: return 'individual';
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'global': return <Globe className="h-4 w-4" />;
      case 'national': return <MapPin className="h-4 w-4" />;
      case 'institutional': return <Building2 className="h-4 w-4" />;
      case 'individual': return <User className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'global': return 'bg-accent/10 text-accent border-accent/20';
      case 'national': return 'bg-primary/10 text-primary border-primary/20';
      case 'institutional': return 'bg-success/10 text-success border-success/20';
      case 'individual': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const nodesByType = {
    global: nodes.filter(n => n.org_type === 'global'),
    national: nodes.filter(n => n.org_type === 'national'),
    institutional: nodes.filter(n => n.org_type === 'institutional'),
    individual: nodes.filter(n => n.org_type === 'individual')
  };

  const renderNodeList = (nodeList: Node[]) => (
    <div className="space-y-3">
      {nodeList.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No nodes in this tier</p>
        </div>
      ) : (
        nodeList.map((node) => (
          <div key={node.id} className={`p-4 rounded-lg border ${getNodeColor(node.org_type)}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  {getNodeIcon(node.org_type)}
                  <h4 className="font-semibold">{node.org_name}</h4>
                  {node.verified && (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Badge variant="outline" className="text-xs">
                    {node.country}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {node.jurisdiction}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Last active: {node.last_active_at 
                    ? new Date(node.last_active_at).toLocaleString()
                    : 'Never'}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          Global Node Federation
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          4-tier planetary coordination network
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg border">
            <div className="text-2xl font-bold text-accent">
              {nodesByType.global.length}
            </div>
            <div className="text-xs text-muted-foreground">Global</div>
          </div>
          <div className="text-center p-3 rounded-lg border">
            <div className="text-2xl font-bold text-primary">
              {nodesByType.national.length}
            </div>
            <div className="text-xs text-muted-foreground">National</div>
          </div>
          <div className="text-center p-3 rounded-lg border">
            <div className="text-2xl font-bold text-success">
              {nodesByType.institutional.length}
            </div>
            <div className="text-xs text-muted-foreground">Institutional</div>
          </div>
          <div className="text-center p-3 rounded-lg border">
            <div className="text-2xl font-bold text-warning">
              {nodesByType.individual.length}
            </div>
            <div className="text-xs text-muted-foreground">Individual</div>
          </div>
        </div>

        <Tabs defaultValue="global" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="global">
              <Globe className="h-3 w-3 mr-1" />
              Global
            </TabsTrigger>
            <TabsTrigger value="national">
              <MapPin className="h-3 w-3 mr-1" />
              National
            </TabsTrigger>
            <TabsTrigger value="institutional">
              <Building2 className="h-3 w-3 mr-1" />
              Institutional
            </TabsTrigger>
            <TabsTrigger value="individual">
              <User className="h-3 w-3 mr-1" />
              Individual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="max-h-[400px] overflow-y-auto">
            {renderNodeList(nodesByType.global)}
          </TabsContent>

          <TabsContent value="national" className="max-h-[400px] overflow-y-auto">
            {renderNodeList(nodesByType.national)}
          </TabsContent>

          <TabsContent value="institutional" className="max-h-[400px] overflow-y-auto">
            {renderNodeList(nodesByType.institutional)}
          </TabsContent>

          <TabsContent value="individual" className="max-h-[400px] overflow-y-auto">
            {renderNodeList(nodesByType.individual)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
