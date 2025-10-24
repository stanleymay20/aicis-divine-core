import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get unprocessed usage records
    const { data: usageRecords, error: fetchError } = await supabase
      .from("billing_usage_queue")
      .select("*")
      .eq("processed", false)
      .limit(1000);

    if (fetchError) throw fetchError;

    if (!usageRecords || usageRecords.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: "No usage to report" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map metric keys to Stripe price IDs
    const metricPriceMap: Record<string, string> = {
      api_calls: Deno.env.get("STRIPE_PRICE_API_CALLS") || "",
      scrollcoin_tx: Deno.env.get("STRIPE_PRICE_SCROLLCOIN_TX") || "",
    };

    let processed = 0;
    const errors: any[] = [];

    // Group by org_id and metric_key
    const grouped = usageRecords.reduce((acc, record) => {
      const key = `${record.org_id}:${record.metric_key}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(record);
      return acc;
    }, {} as Record<string, typeof usageRecords>);

    // Process each group
    for (const [key, records] of Object.entries(grouped)) {
      const [org_id, metric_key] = key.split(":");
      
      // Get organization subscription
      const { data: org } = await supabase
        .from("organizations")
        .select("stripe_subscription_id")
        .eq("id", org_id)
        .single();

      if (!org?.stripe_subscription_id) {
        console.log(`No subscription for org ${org_id}, skipping`);
        continue;
      }

      // Get subscription items
      const subscription = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      const priceId = metricPriceMap[metric_key];
      
      if (!priceId) {
        console.log(`No price configured for metric ${metric_key}, skipping`);
        continue;
      }

      // Find subscription item for this metric
      const subscriptionItem = subscription.items.data.find((item: any) => item.price.id === priceId);
      
      if (!subscriptionItem) {
        console.log(`No subscription item for metric ${metric_key} in org ${org_id}, skipping`);
        continue;
      }

      // Sum quantities and report to Stripe
      const totalQuantity = (records as any[]).reduce((sum: number, r: any) => sum + Number(r.quantity), 0);
      const timestamp = Math.floor(new Date((records as any[])[0].recorded_at).getTime() / 1000);

      try {
        await stripe.subscriptionItems.createUsageRecord(subscriptionItem.id, {
          quantity: totalQuantity,
          timestamp,
          action: "increment",
        });

        // Mark as processed
        const recordIds = (records as any[]).map((r: any) => r.id);
        await supabase
          .from("billing_usage_queue")
          .update({ processed: true })
          .in("id", recordIds);

        processed += (records as any[]).length;
      } catch (error) {
        console.error(`Error reporting usage for ${key}:`, error);
        errors.push({ key, error: (error as Error).message });
      }
    }

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "billing_report_usage",
      log_level: "info",
      result: `Processed ${processed} usage records`,
      metadata: { processed, errors },
    });

    return new Response(
      JSON.stringify({ ok: true, processed, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in billing-report-usage:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
