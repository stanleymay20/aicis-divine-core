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

    const { org_id, plan_key } = await req.json();
    if (!org_id || !plan_key) throw new Error("Organization ID and plan key are required");

    // Verify user is org owner
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", org_id)
      .eq("owner_id", user.id)
      .single();

    if (!org) throw new Error("Not authorized to update this organization");

    // Get new plan
    const { data: newPlan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("key", plan_key)
      .single();

    if (!newPlan) throw new Error("Plan not found");

    // Update organization
    const { data: updatedOrg, error: updateError } = await supabase
      .from("organizations")
      .update({
        tier: plan_key,
        feature_flags: newPlan.features,
      })
      .eq("id", org_id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Update subscription record
    const { error: subError } = await supabase
      .from("organization_subscriptions")
      .update({
        plan_id: newPlan.id,
        status: "active",
      })
      .eq("org_id", org_id);

    if (subError) throw subError;

    // Send notification
    await supabase.from("notifications").insert({
      user_id: user.id,
      title: "Subscription Updated",
      message: `Your plan has been updated to ${newPlan.name}`,
      type: "success",
    });

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "update_subscription",
      user_id: user.id,
      log_level: "info",
      result: "Subscription updated",
      metadata: { org_id, old_tier: org.tier, new_tier: plan_key },
    });

    return new Response(
      JSON.stringify({ ok: true, organization: updatedOrg, plan: newPlan }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in update-subscription:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
