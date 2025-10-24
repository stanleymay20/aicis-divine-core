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

    const { org_id, plan } = await req.json();
    if (!org_id || !plan) throw new Error("Organization ID and plan are required");

    // Verify user is org owner
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", org_id)
      .eq("owner_id", user.id)
      .single();

    if (!org) throw new Error("Not authorized");

    // Call billing-create-checkout
    const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
      'billing-create-checkout',
      {
        body: {
          org_id,
          price_key: plan,
        }
      }
    );

    if (checkoutError) throw checkoutError;

    // Update onboarding
    await supabase
      .from("tenant_onboarding")
      .update({ plan_complete: true })
      .eq("org_id", org_id);

    // Log action
    await supabase.from("tenant_action_log").insert({
      org_id,
      user_id: user.id,
      action: "checkout_started",
      details: { plan },
    });

    await supabase.from("system_logs").insert({
      division: "system",
      action: "tenant_start_checkout",
      user_id: user.id,
      log_level: "info",
      result: "Checkout started",
      metadata: { org_id, plan },
    });

    return new Response(
      JSON.stringify({ ok: true, checkout_url: checkoutData.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in tenant-start-checkout:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
