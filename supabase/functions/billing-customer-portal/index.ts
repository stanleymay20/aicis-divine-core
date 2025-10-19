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

    const { org_id } = await req.json();
    if (!org_id) throw new Error("Organization ID is required");

    // Verify user is org owner
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", org_id)
      .eq("owner_id", user.id)
      .single();

    if (!org) throw new Error("Not authorized");
    if (!org.stripe_customer_id) throw new Error("No Stripe customer found");

    const appUrl = Deno.env.get("APP_PUBLIC_URL") || "http://localhost:8080";

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appUrl}/?view=billing`,
    });

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "billing_customer_portal",
      user_id: user.id,
      log_level: "info",
      result: "Customer portal session created",
      metadata: { org_id },
    });

    return new Response(
      JSON.stringify({ ok: true, url: portalSession.url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in billing-customer-portal:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
