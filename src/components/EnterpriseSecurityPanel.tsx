import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Shield, Activity, FileText, AlertTriangle, Download, Trash2, Clock, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const EnterpriseSecurityPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [exportRequests, setExportRequests] = useState<any[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<any[]>([]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load system health
      const { data: healthData } = await supabase
        .from("system_health")
        .select("*")
        .order("checked_at", { ascending: false })
        .limit(10);
      setHealth(healthData || []);

      // Load audit logs for user
      const { data: auditData } = await supabase
        .from("audit_log")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setAuditLogs(auditData || []);

      // Load active sessions
      const { data: sessionsData } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .order("last_active_at", { ascending: false });
      setSessions(sessionsData || []);

      // Load GDPR requests
      const { data: exportsData } = await supabase
        .from("data_export_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false });
      setExportRequests(exportsData || []);

      const { data: deletionsData } = await supabase
        .from("data_deletion_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false });
      setDeletionRequests(deletionsData || []);
    } catch (error) {
      console.error("Error loading security data:", error);
    } finally {
      setLoading(false);
    }
  };

  const requestDataExport = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("gdpr-export-data");
      if (error) throw error;

      toast({
        title: "Export Requested",
        description: "Your data export request has been submitted.",
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request data export",
        variant: "destructive",
      });
    }
  };

  const requestAccountDeletion = async () => {
    if (!confirm("Are you sure you want to request account deletion? This action cannot be undone.")) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("gdpr-delete-data", {
        body: { reason: "User requested account deletion" },
      });
      if (error) throw error;

      toast({
        title: "Deletion Requested",
        description: "Your account deletion request has been submitted for review.",
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request account deletion",
        variant: "destructive",
      });
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      await supabase
        .from("user_sessions")
        .update({ revoked_at: new Date().toISOString(), revoke_reason: "User revoked" })
        .eq("id", sessionId);

      toast({
        title: "Session Revoked",
        description: "The session has been terminated.",
      });
      await loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke session",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "outline"> = {
      healthy: "default",
      degraded: "outline",
      down: "destructive",
      pending: "outline",
      completed: "default",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Enterprise Security</h2>
          <p className="text-sm text-muted-foreground">
            Monitor security, audit logs, and manage data privacy
          </p>
        </div>
        <Button onClick={loadData} variant="outline">
          <Activity className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health">
            <Shield className="w-4 h-4 mr-2" />
            System Health
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="w-4 h-4 mr-2" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Clock className="w-4 h-4 mr-2" />
            Active Sessions
          </TabsTrigger>
          <TabsTrigger value="gdpr">
            <Download className="w-4 h-4 mr-2" />
            GDPR & Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4">
          <Card className="bg-card/50 border-primary/20">
            <CardHeader>
              <CardTitle>System Health Status</CardTitle>
              <CardDescription>Real-time monitoring of system components</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {health.slice(0, 5).map((check) => (
                  <div
                    key={check.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-3">
                      {check.status === "healthy" ? (
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                      )}
                      <div>
                        <p className="font-medium capitalize">{check.component}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(check.checked_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {check.response_time_ms && (
                        <span className="text-sm text-muted-foreground">
                          {check.response_time_ms}ms
                        </span>
                      )}
                      {getStatusBadge(check.status)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card className="bg-card/50 border-primary/20">
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>Your recent activity log</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-border text-sm"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </p>
                      {log.ip_address && (
                        <p className="text-xs text-muted-foreground">IP: {log.ip_address}</p>
                      )}
                    </div>
                    <Badge variant={log.severity === "error" ? "destructive" : "outline"}>
                      {log.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card className="bg-card/50 border-primary/20">
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Manage your login sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {session.user_agent || "Unknown device"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last active: {new Date(session.last_active_at).toLocaleString()}
                      </p>
                      {session.ip_address && (
                        <p className="text-xs text-muted-foreground">IP: {session.ip_address}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => revokeSession(session.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gdpr" className="space-y-4">
          <Alert>
            <AlertDescription>
              Under GDPR, you have the right to export your data and request account deletion.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-card/50 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Data Export
                </CardTitle>
                <CardDescription>Download all your data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={requestDataExport} className="w-full">
                  Request Data Export
                </Button>
                <div className="space-y-2">
                  {exportRequests.map((req) => (
                    <div key={req.id} className="p-2 rounded border border-border text-xs">
                      <div className="flex justify-between">
                        <span>{new Date(req.requested_at).toLocaleString()}</span>
                        {getStatusBadge(req.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  Account Deletion
                </CardTitle>
                <CardDescription>Permanently delete your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={requestAccountDeletion}
                  variant="destructive"
                  className="w-full"
                >
                  Request Account Deletion
                </Button>
                <div className="space-y-2">
                  {deletionRequests.map((req) => (
                    <div key={req.id} className="p-2 rounded border border-border text-xs">
                      <div className="flex justify-between">
                        <span>{new Date(req.requested_at).toLocaleString()}</span>
                        {getStatusBadge(req.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
