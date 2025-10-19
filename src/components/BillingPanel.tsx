import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, ExternalLink, Activity, Zap, Loader2, AlertTriangle, Calendar } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const BillingPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [billingEvents, setBillingEvents] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
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

      if (!orgData) {
        setLoading(false);
        return;
      }

      setOrg(orgData);

      // Get usage metrics
      const { data: usageData } = await supabase.functions.invoke("get-usage-metrics", {
        body: { org_id: orgData.id },
      });

      if (usageData?.usage) {
        setUsage(usageData);
      }

      // Load recent billing events
      const { data: eventsData } = await supabase
        .from("billing_events")
        .select("*")
        .eq("org_id", orgData.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setBillingEvents(eventsData || []);
    } catch (error) {
      console.error("Error loading billing data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCheckout = async (priceKey: string) => {
    if (!org) return;

    try {
      const { data, error } = await supabase.functions.invoke("billing-create-checkout", {
        body: { org_id: org.id, price_key: priceKey },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    }
  };

  const openPortal = async () => {
    if (!org) return;

    try {
      const { data, error } = await supabase.functions.invoke("billing-customer-portal", {
        body: { org_id: org.id },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      console.error("Error opening portal:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to open billing portal",
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
          <CardTitle>No Organization Found</CardTitle>
          <CardDescription>
            Please create an organization first in the Organization panel
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const currentPlan = org.organization_subscriptions?.[0]?.subscription_plans;
  const hasStripe = !!org.stripe_customer_id;
  const graceDays = 7;
  const isOverdue = org.billing_status === "past_due";

  return (
    <div className="space-y-6">
      {/* Billing Status Alert */}
      {isOverdue && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your payment is past due. You have {graceDays} days of grace period before your account is downgraded to the Starter plan.
            Please update your payment method immediately.
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan */}
      <Card className="bg-card/50 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Current Plan
          </CardTitle>
          <CardDescription>
            Subscription and billing information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Plan</p>
              <p className="text-lg font-semibold">{currentPlan?.name || "Starter"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Price</p>
              <p className="text-lg font-semibold">
                ${currentPlan?.price_usd || 0}/{currentPlan?.billing_cycle || "monthly"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Billing Status</p>
              <Badge variant={org.billing_status === "active" ? "default" : "destructive"}>
                {org.billing_status}
              </Badge>
            </div>
          </div>

          {usage?.next_reset && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              Next billing cycle: {new Date(usage.next_reset).toLocaleDateString()}
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-border">
            {currentPlan?.key !== "global_node" && (
              <Button onClick={() => openCheckout("global_node")} variant="default">
                <ExternalLink className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
            )}
            {hasStripe && (
              <Button onClick={openPortal} variant="outline">
                <CreditCard className="w-4 h-4 mr-2" />
                Manage Billing
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Metrics */}
      {usage && (
        <Card className="bg-card/50 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Usage This Period
            </CardTitle>
            <CardDescription>
              Current usage across metered resources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* API Calls */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="font-medium">API Calls</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.usage.api_calls.used.toLocaleString()} / {" "}
                  {usage.usage.api_calls.limit === -1 ? "Unlimited" : usage.usage.api_calls.limit.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={Math.min(usage.usage.api_calls.percentage, 100)} 
                className="h-2"
              />
              {usage.usage.api_calls.percentage > 80 && (
                <p className="text-sm text-warning">
                  You've used {usage.usage.api_calls.percentage.toFixed(0)}% of your API quota
                </p>
              )}
            </div>

            {/* ScrollCoin Transactions */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span className="font-medium">ScrollCoin Transactions</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {usage.usage.scrollcoin_tx.used.toLocaleString()} / {" "}
                  {usage.usage.scrollcoin_tx.limit === -1 ? "Unlimited" : usage.usage.scrollcoin_tx.limit.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={Math.min(usage.usage.scrollcoin_tx.percentage, 100)} 
                className="h-2"
              />
              {usage.usage.scrollcoin_tx.percentage > 80 && (
                <p className="text-sm text-warning">
                  You've used {usage.usage.scrollcoin_tx.percentage.toFixed(0)}% of your ScrollCoin transaction quota
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Events */}
      {billingEvents.length > 0 && (
        <Card className="bg-card/50 border-primary/20">
          <CardHeader>
            <CardTitle>Recent Billing Events</CardTitle>
            <CardDescription>
              Transaction history and invoice status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {billingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/30"
                >
                  <div>
                    <p className="font-medium text-sm">{event.event_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant={
                    event.event_type.includes("paid") ? "default" :
                    event.event_type.includes("failed") ? "destructive" : "outline"
                  }>
                    {event.event_type.split(".").pop()}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
