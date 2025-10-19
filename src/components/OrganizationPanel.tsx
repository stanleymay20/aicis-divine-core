import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Building, Users, Crown, Mail, ArrowUpCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const OrganizationPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load organization
      const { data: orgData } = await supabase
        .from("organizations")
        .select(`
          *,
          organization_subscriptions(
            *,
            subscription_plans(*)
          )
        `)
        .eq("owner_id", user.id)
        .maybeSingle();

      setOrg(orgData);

      if (orgData) {
        // Load members
        const { data: membersData } = await supabase
          .from("organization_members")
          .select(`
            *,
            profiles(email, full_name)
          `)
          .eq("org_id", orgData.id);

        setMembers(membersData || []);
      }

      // Load available plans
      const { data: plansData } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_usd");

      setPlans(plansData || []);
    } catch (error) {
      console.error("Error loading organization:", error);
      toast({
        title: "Error",
        description: "Failed to load organization data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async () => {
    if (!orgName.trim()) {
      toast({
        title: "Error",
        description: "Please enter an organization name",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const { data, error } = await supabase.functions.invoke("create-organization", {
        body: { name: orgName },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Organization created successfully",
      });

      setOrgName("");
      await loadData();
    } catch (error: any) {
      console.error("Error creating organization:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create organization",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !org) return;

    try {
      setInviting(true);
      const { data, error } = await supabase.functions.invoke("invite-member", {
        body: { org_id: org.id, email: inviteEmail },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Invitation sent to ${inviteEmail}`,
      });

      setInviteEmail("");
      await loadData();
    } catch (error: any) {
      console.error("Error inviting member:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to invite member",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const changePlan = async (planKey: string) => {
    if (!org) return;

    // For now, just update locally - will integrate Stripe checkout in BillingPanel
    try {
      const { data, error } = await supabase.functions.invoke("update-subscription", {
        body: { org_id: org.id, plan_key: planKey },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Plan updated successfully",
      });

      await loadData();
    } catch (error: any) {
      console.error("Error updating plan:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update plan",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!org) {
    return (
      <Card className="bg-card/50 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Create Your Organization
          </CardTitle>
          <CardDescription>
            Set up your organization to start using AICIS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              placeholder="Acme Corp"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createOrganization()}
            />
          </div>
          <Button onClick={createOrganization} disabled={creating} className="w-full">
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Create Organization
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentPlan = org.organization_subscriptions?.[0]?.subscription_plans;
  const features = org.feature_flags || {};

  return (
    <div className="space-y-6">
      {/* Organization Info */}
      <Card className="bg-card/50 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            {org.name}
          </CardTitle>
          <CardDescription>
            Organization ID: {org.id.substring(0, 8)}...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <Badge variant="default" className="text-sm">
                {currentPlan?.name || "Starter"}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={org.status === "active" ? "default" : "destructive"}>
                {org.status}
              </Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Billing Status</p>
              <Badge variant={org.billing_status === "active" ? "default" : "destructive"}>
                {org.billing_status}
              </Badge>
            </div>
          </div>

          {org.billing_status === "past_due" && (
            <Alert variant="destructive">
              <AlertDescription>
                Your payment is past due. Please update your payment method to avoid service interruption.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Features */}
      <Card className="bg-card/50 border-primary/20">
        <CardHeader>
          <CardTitle>Active Features</CardTitle>
          <CardDescription>
            Features included in your current plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(features).map(([key, enabled]) => (
              <div key={key} className="flex items-center gap-2">
                {enabled ? (
                  <CheckCircle2 className="w-4 h-4 text-success" />
                ) : (
                  <XCircle className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm capitalize">{key.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card className="bg-card/50 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5" />
            Available Plans
          </CardTitle>
          <CardDescription>
            Upgrade or downgrade your subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`${
                  currentPlan?.key === plan.key
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription>
                    ${plan.price_usd}/{plan.billing_cycle}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {plan.features.analytics && <div>✓ Analytics</div>}
                    {plan.features.automation && <div>✓ Automation</div>}
                    {plan.features.federation && <div>✓ Federation</div>}
                    {plan.features.api_access && <div>✓ API Access</div>}
                    {plan.features.white_label && <div>✓ White Label</div>}
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    variant={currentPlan?.key === plan.key ? "outline" : "default"}
                    onClick={() => changePlan(plan.key)}
                    disabled={currentPlan?.key === plan.key}
                  >
                    {currentPlan?.key === plan.key ? "Current Plan" : "Select Plan"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card className="bg-card/50 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members ({members.length})
          </CardTitle>
          <CardDescription>
            Manage your organization's team
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Invite Member */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Enter email to invite"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && inviteMember()}
              />
            </div>
            <Button onClick={inviteMember} disabled={inviting}>
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Invite
            </Button>
          </div>

          {/* Members List */}
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/30"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium">{member.profiles?.full_name || member.profiles?.email}</p>
                    <p className="text-sm text-muted-foreground">{member.profiles?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === "owner" && <Crown className="w-4 h-4 text-warning" />}
                  <Badge variant="outline">{member.role}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
