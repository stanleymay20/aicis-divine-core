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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { org_id, price_key } = await req.json();
    if (!org_id || !price_key) throw new Error("Organization ID and price key are required");

    // Verify user is org owner
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", org_id)
      .eq("owner_id", user.id)
      .single();

    if (!org) throw new Error("Not authorized");

    // Ensure customer exists
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const { data: customerData } = await supabase.functions.invoke("billing-create-customer", {
        body: { org_id },
      });
      customerId = customerData?.customer_id;
    }

    if (!customerId) throw new Error("Failed to create customer");

    // Map price keys to Stripe price IDs from environment
    const priceMap: Record<string, string> = {
      starter: Deno.env.get("STRIPE_PRICE_STARTER") || "",
      pro: Deno.env.get("STRIPE_PRICE_PRO") || "",
      enterprise: Deno.env.get("STRIPE_PRICE_ENTERPRISE") || "",
      global_node: Deno.env.get("STRIPE_PRICE_GLOBAL_NODE") || "",
    };

    const priceId = priceMap[price_key];
    if (!priceId) throw new Error("Invalid price key or Stripe price not configured");

    const appUrl = Deno.env.get("APP_PUBLIC_URL") || "http://localhost:8080";

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?billing=success`,
      cancel_url: `${appUrl}/?billing=canceled`,
      metadata: {
        org_id,
        price_key,
      },
    });

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "billing_create_checkout",
      user_id: user.id,
      log_level: "info",
      result: "Checkout session created",
      metadata: { org_id, price_key, session_id: session.id },
    });

    return new Response(
      JSON.stringify({ ok: true, url: session.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in billing-create-checkout:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
