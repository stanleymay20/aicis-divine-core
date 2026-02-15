import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Network, Globe, Lock, ArrowLeft, Server, Shield,
  CheckCircle, XCircle, RefreshCw, Database, Zap, Users
} from "lucide-react";
import { AICISLayout } from "@/components/aicis/AICISLayout";

const FederationHub = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch federation peers
  const { data: peers, refetch: refetchPeers } = useQuery({
    queryKey: ["federation-peers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("federation_peers")
        .select("*")
        .order("trust_score", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch federation policies
  const { data: policies } = useQuery({
    queryKey: ["federation-policies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("federation_policies")
        .select("*");
      if (error) throw error;
      return data;
    },
  });

  // Fetch inbound signals
  const { data: inboundSignals } = useQuery({
    queryKey: ["federation-inbound"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("federation_inbound_signals")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Fetch outbound queue
  const { data: outboundQueue } = useQuery({
    queryKey: ["federation-outbound"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("federation_outbound_queue")
        .select("*")
        .order("window_start", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  // Fetch accountability nodes
  const { data: nodes } = useQuery({
    queryKey: ["accountability-nodes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accountability_nodes")
        .select("*")
        .order("last_active_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const testPeer = async (peerId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("fed-admin-test-peer", {
        body: { peer_id: peerId },
      });
      if (error) throw error;
      toast({
        title: "Peer Test Complete",
        description: data.success ? "Connection successful" : "Connection failed",
        variant: data.success ? "default" : "destructive",
      });
      refetchPeers();
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AICISLayout>
      <div className="p-6 container mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Network className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-orbitron font-bold">Federation Hub</h1>
              <p className="text-xs text-muted-foreground">Distributed Intelligence Network</p>
            </div>
          </div>
        </div>
        <Tabs defaultValue="peers">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="peers">
              <Server className="w-4 h-4 mr-2" />
              Peers
            </TabsTrigger>
            <TabsTrigger value="nodes">
              <Users className="w-4 h-4 mr-2" />
              Nodes
            </TabsTrigger>
            <TabsTrigger value="inbound">
              <Database className="w-4 h-4 mr-2" />
              Inbound
            </TabsTrigger>
            <TabsTrigger value="outbound">
              <Zap className="w-4 h-4 mr-2" />
              Outbound
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Shield className="w-4 h-4 mr-2" />
              Policies
            </TabsTrigger>
          </TabsList>

          {/* Peers Tab */}
          <TabsContent value="peers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Federation Peers</h2>
              <Button variant="outline" size="sm" onClick={() => refetchPeers()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {peers?.map((peer: any) => (
                <Card key={peer.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Server className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-semibold">{peer.peer_name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{peer.base_url}</p>
                        </div>
                      </div>
                      <Badge variant={peer.trust_score > 0.7 ? "default" : "secondary"}>
                        Trust: {(peer.trust_score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant={peer.send_enabled ? "default" : "outline"}>
                        {peer.send_enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                        Send
                      </Badge>
                      <Badge variant={peer.recv_enabled ? "default" : "outline"}>
                        {peer.recv_enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                        Receive
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        Last seen: {peer.last_seen ? new Date(peer.last_seen).toLocaleString() : "Never"}
                      </span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-3"
                      onClick={() => testPeer(peer.id)}
                    >
                      Test Connection
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Accountability Nodes Tab */}
          <TabsContent value="nodes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Accountability Nodes</CardTitle>
                <CardDescription>Registered nodes in the AICIS network</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {nodes?.map((node: any) => (
                      <div key={node.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${node.verified ? 'bg-green-500/20' : 'bg-yellow-500/20'}`}>
                            {node.verified ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Lock className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{node.org_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {node.country} • {node.org_type}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={node.verified ? "default" : "secondary"}>
                            {node.verified ? "Verified" : "Pending"}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {node.jurisdiction}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inbound Signals */}
          <TabsContent value="inbound" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inbound Signals</CardTitle>
                <CardDescription>Data received from federation peers</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {inboundSignals?.map((signal: any) => (
                      <div key={signal.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={signal.signature_valid ? "default" : "destructive"}>
                            {signal.signature_valid ? "Valid Signature" : "Invalid Signature"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(signal.received_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-sm">
                          <p className="text-muted-foreground">
                            Peer Trust: {((signal.peer_trust || 0) * 100).toFixed(0)}%
                          </p>
                          <p className="text-muted-foreground">
                            Signal Strength: {((signal.summary_strength || 0) * 100).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Outbound Queue */}
          <TabsContent value="outbound" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Outbound Queue</CardTitle>
                <CardDescription>Data queued for federation export</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {outboundQueue?.map((item: any) => (
                      <div key={item.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={item.status === "sent" ? "default" : "secondary"}>
                            {item.status}
                          </Badge>
                          <span className="text-xs font-mono">{item.hash.slice(0, 16)}...</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <p>Attempts: {item.attempts || 0}</p>
                          <p>Window: {new Date(item.window_start).toLocaleDateString()} - {new Date(item.window_end).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Federation Policies</CardTitle>
                <CardDescription>Data sharing and sovereignty rules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {policies?.map((policy: any) => (
                    <div key={policy.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant={policy.enabled ? "default" : "secondary"}>
                          {policy.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {policy.jurisdiction || "Global"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Classification</p>
                          <p className="font-medium">{policy.data_classification || "Standard"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Differential Privacy ε</p>
                          <p className="font-medium">{policy.dp_epsilon || "1.0"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Min Sample</p>
                          <p className="font-medium">{policy.min_sample || "100"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Max Weight Drift</p>
                          <p className="font-medium">{((policy.max_daily_weight_drift || 0.1) * 100).toFixed(0)}%</p>
                        </div>
                      </div>
                      {policy.share_divisions && (
                        <div className="mt-3">
                          <p className="text-sm text-muted-foreground mb-1">Shared Divisions</p>
                          <div className="flex flex-wrap gap-1">
                            {policy.share_divisions.map((div: string) => (
                              <Badge key={div} variant="outline" className="text-xs">{div}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AICISLayout>
  );
};

export default FederationHub;
