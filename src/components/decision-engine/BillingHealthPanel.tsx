import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, CheckCircle, XCircle } from "lucide-react";

export default function BillingHealthPanel() {
  const { data } = useQuery({
    queryKey: ["billing-health"],
    queryFn: async () => {
      const [orgs, events, usage] = await Promise.all([
        supabase.from("organizations").select("id", { count: "exact", head: true }),
        supabase.from("billing_events").select("id", { count: "exact", head: true }),
        supabase.from("billing_usage_queue").select("id", { count: "exact", head: true }),
      ]);

      return {
        orgCount: orgs.count ?? 0,
        billingEvents: events.count ?? 0,
        usageQueue: usage.count ?? 0,
        revenueActivated: (events.count ?? 0) > 0,
      };
    },
    staleTime: 60_000,
  });

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5 text-primary" /> Billing Health
          <Badge variant={data.revenueActivated ? "default" : "outline"} className="text-[9px] h-4 ml-1">
            {data.revenueActivated ? "Revenue Active" : "Pre-Revenue"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-bold">{data.orgCount}</p>
            <p className="text-[9px] text-muted-foreground">Organizations</p>
          </div>
          <div className={`p-2 rounded ${data.billingEvents > 0 ? "bg-muted/30" : "bg-destructive/10 border border-destructive/20"}`}>
            <p className={`text-sm font-bold ${data.billingEvents === 0 ? "text-destructive" : ""}`}>{data.billingEvents}</p>
            <p className="text-[9px] text-muted-foreground">Billing Events</p>
          </div>
          <div className="p-2 rounded bg-muted/30">
            <p className="text-sm font-bold">{data.usageQueue}</p>
            <p className="text-[9px] text-muted-foreground">Usage Queue</p>
          </div>
          <div className={`p-2 rounded flex items-center justify-center gap-1 ${data.revenueActivated ? "bg-primary/10" : "bg-destructive/10 border border-destructive/20"}`}>
            {data.revenueActivated ? (
              <CheckCircle className="h-3.5 w-3.5 text-primary" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            <p className={`text-[10px] font-medium ${data.revenueActivated ? "text-primary" : "text-destructive"}`}>
              {data.revenueActivated ? "Active" : "Not Active"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
