import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Globe, Send, Inbox, Settings, TrendingUp, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Peer {
  id: string;
  peer_name: string;
  base_url: string;
  trust_score: number;
  send_enabled: boolean;
  recv_enabled: boolean;
  last_seen: string | null;
}

interface OutboundBundle {
  id: string;
  window_start: string;
  window_end: string;
  hash: string;
  status: string;
  attempts: number;
}

interface InboundSignal {
  id: string;
  peer_id: string;
  received_at: string;
  signals: any;
  signature_valid: boolean;
  peer_trust: number;
  summary_strength: number;
}

interface Policy {
  id: string;
  share_divisions: string[];
  min_sample: number;
  dp_epsilon: number;
  max_daily_weight_drift: number;
  enabled: boolean;
}

export default function FederationPanel() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [outbound, setOutbound] = useState<OutboundBundle[]>([]);
  const [inbound, setInbound] = useState<InboundSignal[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // New peer form
  const [newPeer, setNewPeer] = useState({
    peer_name: "",
    base_url: "",
    pubkey_pem: "",
    trust_score: 80
  });

  const loadData = async () => {
    setLoading(true);

    const [peersRes, outboundRes, inboundRes, policyRes] = await Promise.all([
      supabase.from("federation_peers").select("*").order("created_at", { ascending: false }),
      supabase.from("federation_outbound_queue").select("*").order("window_start", { ascending: false }).limit(20),
      supabase.from("federation_inbound_signals").select("*").order("received_at", { ascending: false }).limit(20),
      supabase.from("federation_policies").select("*").single()
    ]);

    setPeers(peersRes.data || []);
    setOutbound(outboundRes.data || []);
    setInbound(inboundRes.data || []);
    setPolicy(policyRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const addPeer = async () => {
    if (!newPeer.peer_name || !newPeer.base_url) {
      toast({ title: "Error", description: "Name and URL required", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("federation_peers").insert(newPeer);
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Peer added", description: `${newPeer.peer_name} added successfully` });
      setNewPeer({ peer_name: "", base_url: "", pubkey_pem: "", trust_score: 80 });
      loadData();
    }
  };

  const testPeer = async (peerId: string) => {
    toast({ title: "Testing peer...", description: "Checking connectivity" });
    const { data, error } = await supabase.functions.invoke("fed-admin-test-peer", {
      body: { peer_id: peerId }
    });

    if (error || !data?.ok) {
      toast({ title: "Connection failed", description: data?.message || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Peer reachable", description: data.message });
    }
  };

  const updatePeerTrust = async (peerId: string, trustScore: number) => {
    const { error } = await supabase
      .from("federation_peers")
      .update({ trust_score: trustScore })
      .eq("id", peerId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      loadData();
    }
  };

  const togglePeerSend = async (peerId: string, enabled: boolean) => {
    const { error } = await supabase
      .from("federation_peers")
      .update({ send_enabled: enabled })
      .eq("id", peerId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      loadData();
    }
  };

  const exportBundleNow = async () => {
    toast({ title: "Exporting bundle...", description: "Creating and sending federation bundle" });
    
    const { data: makeData, error: makeError } = await supabase.functions.invoke("fed-make-bundle");
    if (makeError) {
      toast({ title: "Export failed", description: makeError.message, variant: "destructive" });
      return;
    }

    const { error: sendError } = await supabase.functions.invoke("fed-send-bundles");
    if (sendError) {
      toast({ title: "Send failed", description: sendError.message, variant: "destructive" });
    } else {
      toast({ title: "Bundle exported", description: "Successfully sent to peers" });
      loadData();
    }
  };

  const mergeNow = async () => {
    toast({ title: "Merging global prior...", description: "Updating weights from federation" });
    const { error } = await supabase.functions.invoke("fed-merge-global-prior");
    
    if (error) {
      toast({ title: "Merge failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Merged successfully", description: "Global prior updated" });
    }
  };

  const updatePolicy = async (updates: Partial<Policy>) => {
    if (!policy) return;

    const { error } = await supabase
      .from("federation_policies")
      .update(updates)
      .eq("id", policy.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Policy updated", description: "Federation policy saved" });
      loadData();
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading federation data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Global Federation</h2>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportBundleNow} variant="outline" size="sm">
            <Send className="mr-2 h-4 w-4" />
            Export Now
          </Button>
          <Button onClick={mergeNow} variant="outline" size="sm">
            <TrendingUp className="mr-2 h-4 w-4" />
            Merge Now
          </Button>
        </div>
      </div>

      <Tabs defaultValue="peers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="peers">Peers</TabsTrigger>
          <TabsTrigger value="outbound">Outbound</TabsTrigger>
          <TabsTrigger value="inbound">Inbound</TabsTrigger>
          <TabsTrigger value="policy">Policy</TabsTrigger>
        </TabsList>

        <TabsContent value="peers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add New Peer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Peer Name</Label>
                  <Input
                    value={newPeer.peer_name}
                    onChange={(e) => setNewPeer({ ...newPeer, peer_name: e.target.value })}
                    placeholder="aicis-node-2"
                  />
                </div>
                <div>
                  <Label>Base URL</Label>
                  <Input
                    value={newPeer.base_url}
                    onChange={(e) => setNewPeer({ ...newPeer, base_url: e.target.value })}
                    placeholder="https://peer.example.com"
                  />
                </div>
              </div>
              <div>
                <Label>Public Key (PEM)</Label>
                <Input
                  value={newPeer.pubkey_pem}
                  onChange={(e) => setNewPeer({ ...newPeer, pubkey_pem: e.target.value })}
                  placeholder="-----BEGIN PUBLIC KEY-----..."
                />
              </div>
              <div>
                <Label>Trust Score: {newPeer.trust_score}</Label>
                <Slider
                  value={[newPeer.trust_score]}
                  onValueChange={([v]) => setNewPeer({ ...newPeer, trust_score: v })}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
              <Button onClick={addPeer}>Add Peer</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Federation Peers ({peers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {peers.map((peer) => (
                  <div key={peer.id} className="flex justify-between items-center p-4 rounded-lg border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{peer.peer_name}</span>
                        <Badge variant={peer.send_enabled ? "default" : "secondary"}>
                          {peer.send_enabled ? "Send ✓" : "Send ✗"}
                        </Badge>
                        <Badge variant={peer.recv_enabled ? "default" : "secondary"}>
                          {peer.recv_enabled ? "Recv ✓" : "Recv ✗"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{peer.base_url}</p>
                      <p className="text-xs text-muted-foreground">
                        Trust: {peer.trust_score}% · Last seen: {peer.last_seen ? new Date(peer.last_seen).toLocaleString() : "Never"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => testPeer(peer.id)} variant="outline" size="sm">
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={peer.send_enabled}
                        onCheckedChange={(checked) => togglePeerSend(peer.id, checked)}
                      />
                    </div>
                  </div>
                ))}
                {peers.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No peers configured</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outbound">
          <Card>
            <CardHeader>
              <CardTitle>Outbound Bundles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {outbound.map((bundle) => (
                  <div key={bundle.id} className="flex justify-between items-center p-3 rounded border">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{bundle.hash.substring(0, 16)}...</span>
                        <Badge variant={bundle.status === "sent" ? "default" : bundle.status === "queued" ? "secondary" : "destructive"}>
                          {bundle.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(bundle.window_start).toLocaleDateString()} - {new Date(bundle.window_end).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{bundle.attempts} attempts</span>
                  </div>
                ))}
                {outbound.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No outbound bundles</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbound">
          <Card>
            <CardHeader>
              <CardTitle>Inbound Signals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inbound.map((signal) => (
                  <div key={signal.id} className="p-4 rounded-lg border">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={signal.signature_valid ? "default" : "destructive"}>
                          {signal.signature_valid ? "✓ Verified" : "✗ Invalid"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Trust: {signal.peer_trust}% · Strength: {(signal.summary_strength * 100).toFixed(1)}%
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(signal.received_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {Array.isArray(signal.signals) && signal.signals.map((s: any, i: number) => (
                        <div key={i} className="p-2 rounded bg-muted">
                          <div className="font-semibold capitalize">{s.division}</div>
                          <div className="text-muted-foreground">
                            {s.impact_per_sc_avg.toFixed(4)} (n={s.sample_size})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {inbound.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No inbound signals</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policy">
          {policy && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Federation Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Federation Enabled</Label>
                    <Switch
                      checked={policy.enabled}
                      onCheckedChange={(checked) => updatePolicy({ enabled: checked })}
                    />
                  </div>
                </div>

                <div>
                  <Label>Minimum Sample Size: {policy.min_sample}</Label>
                  <Slider
                    value={[policy.min_sample]}
                    onValueChange={([v]) => updatePolicy({ min_sample: v })}
                    min={5}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>DP Epsilon: {policy.dp_epsilon}</Label>
                  <Slider
                    value={[policy.dp_epsilon]}
                    onValueChange={([v]) => updatePolicy({ dp_epsilon: v })}
                    min={0.1}
                    max={5}
                    step={0.1}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lower = more privacy, higher = more accuracy
                  </p>
                </div>

                <div>
                  <Label>Max Daily Weight Drift: {(policy.max_daily_weight_drift * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[policy.max_daily_weight_drift * 100]}
                    onValueChange={([v]) => updatePolicy({ max_daily_weight_drift: v / 100 })}
                    min={5}
                    max={50}
                    step={5}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Cap how much global prior can shift weights per day
                  </p>
                </div>

                <div>
                  <Label>Shared Divisions</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {["finance", "energy", "health", "food", "defense", "diplomacy", "crisis", "governance"].map(div => (
                      <div key={div} className="flex items-center gap-2">
                        <Switch
                          checked={policy.share_divisions.includes(div)}
                          onCheckedChange={(checked) => {
                            const updated = checked
                              ? [...policy.share_divisions, div]
                              : policy.share_divisions.filter(d => d !== div);
                            updatePolicy({ share_divisions: updated });
                          }}
                        />
                        <span className="text-sm capitalize">{div}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4" />
              How Federation Works
            </h3>
            <p className="text-sm text-muted-foreground">
              AICIS shares anonymized learning signals (division impact-per-SC summaries) with trusted peers using
              differential privacy (DP) and cryptographic signatures. Each node's allocator benefits from global
              insights while keeping raw data private. Trust scores weight how much each peer's signals influence
              your local weights, with daily drift caps for stability.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
