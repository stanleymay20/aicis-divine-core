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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { org_id } = await req.json();
    if (!org_id) throw new Error("Organization ID is required");

    // Verify user has access
    const { data: member } = await supabase
      .from("organization_members")
      .select("id")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!member) throw new Error("Not authorized to view this organization's usage");

    // Get organization with plan details
    const { data: org } = await supabase
      .from("organizations")
      .select(`
        *,
        organization_subscriptions(
          plan_id,
          subscription_plans(*)
        )
      `)
      .eq("id", org_id)
      .single();

    if (!org) throw new Error("Organization not found");

    // Get current period usage (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // API calls usage
    const { data: apiCallsData } = await supabase
      .from("billing_usage_queue")
      .select("quantity")
      .eq("org_id", org_id)
      .eq("metric_key", "api_calls")
      .gte("recorded_at", thirtyDaysAgo.toISOString());

    const apiCallsUsed = apiCallsData?.reduce((sum, row) => sum + Number(row.quantity), 0) || 0;

    // ScrollCoin transactions usage
    const { data: scrollCoinData } = await supabase
      .from("billing_usage_queue")
      .select("quantity")
      .eq("org_id", org_id)
      .eq("metric_key", "scrollcoin_tx")
      .gte("recorded_at", thirtyDaysAgo.toISOString());

    const scrollCoinTxUsed = scrollCoinData?.reduce((sum, row) => sum + Number(row.quantity), 0) || 0;

    // Get plan limits
    const plan = org.organization_subscriptions?.[0]?.subscription_plans;
    const limits = {
      api_calls: plan?.features?.api_calls_limit || 1000,
      scrollcoin_tx: plan?.features?.scrollcoin_tx_limit || 100,
    };

    // Calculate next billing reset
    const nextReset = new Date();
    nextReset.setDate(nextReset.getDate() + (30 - ((Date.now() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24))));

    return new Response(
      JSON.stringify({
        ok: true,
        usage: {
          api_calls: {
            used: apiCallsUsed,
            limit: limits.api_calls,
            percentage: limits.api_calls > 0 ? (apiCallsUsed / limits.api_calls) * 100 : 0,
          },
          scrollcoin_tx: {
            used: scrollCoinTxUsed,
            limit: limits.scrollcoin_tx,
            percentage: limits.scrollcoin_tx > 0 ? (scrollCoinTxUsed / limits.scrollcoin_tx) * 100 : 0,
          },
        },
        next_reset: nextReset.toISOString(),
        plan: plan,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in get-usage-metrics:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
