import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting usage aggregation...");

    // Get current period (yesterday)
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const periodStart = yesterday.toISOString();
    const periodEnd = new Date(yesterday);
    periodEnd.setHours(23, 59, 59, 999);
    const periodEndStr = periodEnd.toISOString();

    // Get all organizations
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from("organizations")
      .select("id, name, tier");

    if (orgsError) throw orgsError;

    console.log(`Processing ${orgs.length} organizations...`);

    for (const org of orgs) {
      // Aggregate usage from billing_usage_queue
      const { data: queueRecords } = await supabaseAdmin
        .from("billing_usage_queue")
        .select("*")
        .eq("org_id", org.id)
        .gte("recorded_at", periodStart)
        .lte("recorded_at", periodEndStr)
        .eq("processed", false);

      if (!queueRecords || queueRecords.length === 0) {
        console.log(`No usage for org ${org.name}`);
        continue;
      }

      // Group by metric_key
      const metrics: Record<string, number> = {};
      for (const record of queueRecords) {
        if (!metrics[record.metric_key]) {
          metrics[record.metric_key] = 0;
        }
        metrics[record.metric_key] += record.quantity;
      }

      // Create usage records
      for (const [metricKey, quantity] of Object.entries(metrics)) {
        await supabaseAdmin.from("usage_records").insert({
          org_id: org.id,
          metric_key: metricKey,
          quantity,
          period_start: periodStart,
          period_end: periodEndStr,
          billed: false,
        });

        console.log(`Created usage record for ${org.name}: ${metricKey} = ${quantity}`);
      }

      // Mark queue records as processed
      const queueIds = queueRecords.map(r => r.id);
      await supabaseAdmin
        .from("billing_usage_queue")
        .update({ processed: true })
        .in("id", queueIds);
    }

    // Calculate revenue metrics
    const { data: subscriptions } = await supabaseAdmin
      .from("organizations")
      .select("tier, billing_status")
      .eq("billing_status", "active");

    const tierPricing: Record<string, number> = {
      starter: 0,
      pro: 99,
      enterprise: 499,
      global_node: 999,
    };

    let totalRevenue = 0;
    let activeSubscriptions = 0;

    if (subscriptions) {
      for (const sub of subscriptions) {
        if (sub.billing_status === "active") {
          activeSubscriptions++;
          totalRevenue += tierPricing[sub.tier] || 0;
        }
      }
    }

    const mrr = totalRevenue;
    const arr = mrr * 12;
    const avgRevenuePerAccount = activeSubscriptions > 0 ? totalRevenue / activeSubscriptions : 0;

    // Insert revenue metrics
    await supabaseAdmin.from("revenue_metrics").insert({
      metric_date: yesterday.toISOString().split('T')[0],
      total_revenue: totalRevenue,
      mrr,
      arr,
      active_subscriptions: activeSubscriptions,
      avg_revenue_per_account: avgRevenuePerAccount,
    });

    console.log(`Revenue metrics: MRR=${mrr}, ARR=${arr}, Active=${activeSubscriptions}`);

    // Log action
    await supabaseAdmin.from("system_logs").insert({
      division: "system",
      action: "aggregate_usage",
      log_level: "info",
      result: "Usage aggregated successfully",
      metadata: { 
        period: yesterday.toISOString().split('T')[0],
        organizations_processed: orgs.length,
        mrr,
        arr,
      },
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        period: yesterday.toISOString().split('T')[0],
        organizations_processed: orgs.length,
        revenue_metrics: { mrr, arr, active_subscriptions: activeSubscriptions }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in aggregate-usage:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
