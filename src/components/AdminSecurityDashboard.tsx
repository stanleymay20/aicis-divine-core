import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, Ban, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const AdminSecurityDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rateLimits, setRateLimits] = useState<any[]>([]);
  const [ipControls, setIpControls] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [newIp, setNewIp] = useState("");
  const [accessType, setAccessType] = useState<"whitelist" | "blacklist">("blacklist");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load rate limits (blocked users)
      const { data: limitsData } = await supabase
        .from("rate_limits")
        .select("*")
        .not("blocked_until", "is", null)
        .order("window_start", { ascending: false })
        .limit(50);
      setRateLimits(limitsData || []);

      // Load IP access controls
      const { data: ipData } = await supabase
        .from("ip_access_control")
        .select("*")
        .order("created_at", { ascending: false });
      setIpControls(ipData || []);

      // Load security events from audit log
      const { data: eventsData } = await supabase
        .from("audit_log")
        .select("*")
        .in("action", ["security.breach_attempt", "security.policy_violation"])
        .order("created_at", { ascending: false })
        .limit(50);
      setSecurityEvents(eventsData || []);
    } catch (error) {
      console.error("Error loading security data:", error);
    } finally {
      setLoading(false);
    }
  };

  const addIpControl = async () => {
    if (!newIp.trim()) return;

    try {
      const { error } = await supabase.from("ip_access_control").insert({
        ip_address: newIp,
        access_type: accessType,
        reason: `Manually added by admin`,
      });

      if (error) throw error;

      toast({
        title: "IP Added",
        description: `IP ${newIp} added to ${accessType}`,
      });

      setNewIp("");
      await loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add IP",
        variant: "destructive",
      });
    }
  };

  const removeIpControl = async (id: string) => {
    try {
      await supabase.from("ip_access_control").delete().eq("id", id);

      toast({
        title: "IP Removed",
        description: "IP control rule removed",
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove IP",
        variant: "destructive",
      });
    }
  };

  const unblockUser = async (limitId: string) => {
    try {
      await supabase
        .from("rate_limits")
        .update({ blocked_until: null })
        .eq("id", limitId);

      toast({
        title: "User Unblocked",
        description: "Rate limit removed",
      });

      await loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to unblock",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Security Administration</h2>
          <p className="text-sm text-muted-foreground">
            Manage security policies, rate limits, and access controls
          </p>
        </div>
        <Button onClick={loadData} variant="outline" disabled={loading}>
          <Activity className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Security Events
          </TabsTrigger>
          <TabsTrigger value="rate-limits">
            <Shield className="w-4 h-4 mr-2" />
            Rate Limits
          </TabsTrigger>
          <TabsTrigger value="ip-control">
            <Ban className="w-4 h-4 mr-2" />
            IP Control
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card className="bg-card/50 border-primary/20">
            <CardHeader>
              <CardTitle>Security Events</CardTitle>
              <CardDescription>Recent security incidents and violations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {securityEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg border border-destructive/30 bg-destructive/5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{event.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </p>
                        {event.ip_address && (
                          <p className="text-xs text-muted-foreground">IP: {event.ip_address}</p>
                        )}
                      </div>
                      <Badge variant="destructive">{event.severity}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-limits" className="space-y-4">
          <Card className="bg-card/50 border-primary/20">
            <CardHeader>
              <CardTitle>Blocked Users/IPs</CardTitle>
              <CardDescription>Users currently blocked by rate limiting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rateLimits.map((limit) => (
                  <div
                    key={limit.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {limit.ip_address || `User ID: ${limit.user_id?.substring(0, 8)}...`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Endpoint: {limit.endpoint}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Blocked until: {new Date(limit.blocked_until).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unblockUser(limit.id)}
                    >
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ip-control" className="space-y-4">
          <Card className="bg-card/50 border-primary/20">
            <CardHeader>
              <CardTitle>IP Access Control</CardTitle>
              <CardDescription>Manage IP whitelist and blacklist</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter IP address (e.g., 192.168.1.1)"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                />
                <select
                  className="px-3 py-2 rounded border border-input bg-background"
                  value={accessType}
                  onChange={(e) => setAccessType(e.target.value as any)}
                >
                  <option value="blacklist">Blacklist</option>
                  <option value="whitelist">Whitelist</option>
                </select>
                <Button onClick={addIpControl}>Add</Button>
              </div>

              <div className="space-y-2">
                {ipControls.map((control) => (
                  <div
                    key={control.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{control.ip_address}</p>
                      <p className="text-xs text-muted-foreground">
                        {control.reason || "No reason provided"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={control.access_type === "blacklist" ? "destructive" : "default"}
                      >
                        {control.access_type}
                      </Badge>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => removeIpControl(control.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
