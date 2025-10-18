import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, CheckCircle } from "lucide-react";

export const CrisisPanel = () => {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);

  const { data: events, refetch: refetchEvents } = useQuery({
    queryKey: ['crisis-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crisis_events')
        .select('*')
        .order('opened_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: approvals, refetch: refetchApprovals } = useQuery({
    queryKey: ['approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approvals')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleScan = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('crisis-scan', {
        body: {}
      });

      if (error) throw error;

      toast({
        title: "Crisis Scan Complete",
        description: data.message,
      });

      refetchEvents();
      refetchApprovals();
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

  const handleApprovalDecision = async (approvalId: string, decision: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-approval', {
        body: { action: 'decide', approval_id: approvalId, decision }
      });

      if (error) throw error;

      toast({
        title: "Decision Recorded",
        description: data.message,
      });

      refetchApprovals();
    } catch (error: any) {
      toast({
        title: "Decision Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getSeverityBadge = (severity: number) => {
    if (severity >= 7) return <Badge variant="destructive">Critical</Badge>;
    if (severity >= 4) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      monitoring: "outline",
      escalated: "destructive",
      resolved: "default",
    };
    return <Badge variant={variants[status as keyof typeof variants] as any}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <CardTitle>Crisis Response</CardTitle>
          </div>
          <Button 
            onClick={handleScan} 
            disabled={isScanning}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            Scan
          </Button>
        </div>
        <CardDescription>
          Real-time crisis monitoring and response coordination
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="events">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="events">Crisis Events</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
          </TabsList>
          
          <TabsContent value="events" className="space-y-4 mt-4">
            {events && events.length > 0 ? (
              events.map((event) => (
                <div key={event.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold capitalize">{event.kind} - {event.region}</h4>
                      <p className="text-sm text-muted-foreground">
                        Opened: {new Date(event.opened_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {getSeverityBadge(event.severity)}
                      {getStatusBadge(event.status)}
                    </div>
                  </div>
                  {event.details_md && (
                    <div className="text-sm prose prose-sm dark:prose-invert mt-2">
                      {event.details_md.substring(0, 150)}...
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No crisis events detected. Click "Scan" to check.
              </p>
            )}
          </TabsContent>
          
          <TabsContent value="approvals" className="space-y-4 mt-4">
            {approvals && approvals.length > 0 ? (
              approvals.map((approval) => (
                <div key={approval.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">{approval.action}</h4>
                      <p className="text-sm text-muted-foreground">
                        Division: {approval.division} | Requested: {new Date(approval.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Badge 
                      variant={
                        approval.status === 'approved' ? 'default' :
                        approval.status === 'rejected' ? 'destructive' :
                        'secondary'
                      }
                    >
                      {approval.status}
                    </Badge>
                  </div>
                  {approval.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        onClick={() => handleApprovalDecision(approval.id, 'approved')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleApprovalDecision(approval.id, 'rejected')}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No approval requests. Crisis responses will appear here.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};