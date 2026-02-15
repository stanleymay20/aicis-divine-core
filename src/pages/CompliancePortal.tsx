import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AICISLayout } from "@/components/aicis/AICISLayout";
import {
  Shield, Download, Trash2, ArrowLeft, FileText,
  Lock, CheckCircle, Clock, AlertTriangle, Eye,
  Database, Settings, User
} from "lucide-react";

const CompliancePortal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deletionReason, setDeletionReason] = useState("");

  // Fetch user's data export requests
  const { data: exportRequests, refetch: refetchExports } = useQuery({
    queryKey: ["data-exports", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("data_export_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user's deletion requests
  const { data: deletionRequests, refetch: refetchDeletions } = useQuery({
    queryKey: ["data-deletions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("data_deletion_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch user consent records
  const { data: consents } = useQuery({
    queryKey: ["user-consents", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_consent")
        .select("*")
        .eq("user_id", user.id)
        .order("given_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Request data export
  const requestExport = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gdpr-export-data");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Export Requested",
        description: "Your data export is being prepared. You'll receive a download link soon.",
      });
      refetchExports();
    },
    onError: (error: any) => {
      toast({
        title: "Export Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Request data deletion
  const requestDeletion = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("gdpr-delete-data", {
        body: { reason: deletionReason },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Deletion Requested",
        description: "Your data deletion request has been submitted for review.",
      });
      setDeletionReason("");
      refetchDeletions();
    },
    onError: (error: any) => {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AICISLayout>
      <div className="p-6 container mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-orbitron font-bold">Compliance Portal</h1>
              <p className="text-xs text-muted-foreground">GDPR & Data Rights Management</p>
            </div>
          </div>
        </div>
        <Tabs defaultValue="rights">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="rights">
              <User className="w-4 h-4 mr-2" />
              My Rights
            </TabsTrigger>
            <TabsTrigger value="exports">
              <Download className="w-4 h-4 mr-2" />
              Data Exports
            </TabsTrigger>
            <TabsTrigger value="consent">
              <CheckCircle className="w-4 h-4 mr-2" />
              Consent
            </TabsTrigger>
            <TabsTrigger value="deletion">
              <Trash2 className="w-4 h-4 mr-2" />
              Deletion
            </TabsTrigger>
          </TabsList>

          {/* Rights Overview */}
          <TabsContent value="rights" className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                AICIS is committed to protecting your data rights under GDPR and other privacy regulations.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-primary" />
                    Right to Access
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    You have the right to request a copy of all personal data we hold about you.
                  </p>
                  <Button onClick={() => requestExport.mutate()} disabled={requestExport.isPending}>
                    <Download className="w-4 h-4 mr-2" />
                    Request Data Export
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-primary" />
                    Right to Erasure
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    You can request the deletion of your personal data, subject to legal retention requirements.
                  </p>
                  <Button variant="destructive" onClick={() => navigate("?tab=deletion")}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Request Deletion
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    Right to Rectification
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    You can update or correct any inaccurate personal data we hold about you.
                  </p>
                  <Button variant="outline" onClick={() => navigate("/citizen-portal")}>
                    <Settings className="w-4 h-4 mr-2" />
                    Update Profile
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    Right to Portability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Receive your data in a structured, commonly used, machine-readable format.
                  </p>
                  <Button variant="outline" onClick={() => requestExport.mutate()}>
                    <FileText className="w-4 h-4 mr-2" />
                    Export as JSON
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Data Exports */}
          <TabsContent value="exports" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Data Export Requests</CardTitle>
                    <CardDescription>History of your data export requests</CardDescription>
                  </div>
                  <Button onClick={() => requestExport.mutate()} disabled={requestExport.isPending}>
                    <Download className="w-4 h-4 mr-2" />
                    New Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {exportRequests?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No export requests yet
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {exportRequests?.map((request: any) => (
                        <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {request.status === "completed" ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : request.status === "failed" ? (
                              <AlertTriangle className="h-5 w-5 text-destructive" />
                            ) : (
                              <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />
                            )}
                            <div>
                              <p className="font-medium">Data Export</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(request.requested_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              request.status === "completed" ? "default" :
                              request.status === "failed" ? "destructive" : "secondary"
                            }>
                              {request.status}
                            </Badge>
                            {request.export_url && (
                              <Button size="sm" variant="outline" asChild>
                                <a href={request.export_url} download>
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Consent Management */}
          <TabsContent value="consent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Consent Records</CardTitle>
                <CardDescription>Your data processing consent history</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {consents?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No consent records found
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {consents?.map((consent: any) => (
                        <div key={consent.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{consent.consent_type}</p>
                            <p className="text-sm text-muted-foreground">
                              {consent.purpose || "General data processing"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Given: {new Date(consent.given_at).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant={consent.withdrawn ? "destructive" : "default"}>
                            {consent.withdrawn ? "Withdrawn" : "Active"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Deletion */}
          <TabsContent value="deletion" className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Data deletion is irreversible. Some data may be retained for legal compliance purposes.
              </AlertDescription>
            </Alert>

            <Card>
              <CardHeader>
                <CardTitle>Request Data Deletion</CardTitle>
                <CardDescription>
                  Submit a request to delete your personal data from AICIS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Deletion (Optional)</Label>
                  <Textarea
                    id="reason"
                    placeholder="Please tell us why you want your data deleted..."
                    value={deletionReason}
                    onChange={(e) => setDeletionReason(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={() => requestDeletion.mutate()}
                  disabled={requestDeletion.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Submit Deletion Request
                </Button>
              </CardContent>
            </Card>

            {/* Deletion History */}
            <Card>
              <CardHeader>
                <CardTitle>Deletion Request History</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {deletionRequests?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No deletion requests
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {deletionRequests?.map((request: any) => (
                        <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">Deletion Request</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(request.requested_at).toLocaleString()}
                            </p>
                            {request.reason && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Reason: {request.reason}
                              </p>
                            )}
                          </div>
                          <Badge variant={
                            request.status === "completed" ? "default" :
                            request.status === "rejected" ? "destructive" : "secondary"
                          }>
                            {request.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AICISLayout>
  );
};

export default CompliancePortal;
