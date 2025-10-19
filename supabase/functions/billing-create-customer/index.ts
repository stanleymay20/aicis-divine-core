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
      .select("*, profiles!organizations_owner_id_fkey(email, full_name)")
      .eq("id", org_id)
      .eq("owner_id", user.id)
      .single();

    if (!org) throw new Error("Not authorized");

    // Check if customer already exists
    if (org.stripe_customer_id) {
      return new Response(
        JSON.stringify({ ok: true, customer_id: org.stripe_customer_id, created: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: org.profiles?.email || user.email,
      name: org.profiles?.full_name || org.name,
      metadata: {
        org_id: org.id,
        org_name: org.name,
      },
    });

    // Update organization
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ stripe_customer_id: customer.id })
      .eq("id", org_id);

    if (updateError) throw updateError;

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "billing_create_customer",
      user_id: user.id,
      log_level: "info",
      result: "Stripe customer created",
      metadata: { org_id, customer_id: customer.id },
    });

    return new Response(
      JSON.stringify({ ok: true, customer_id: customer.id, created: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in billing-create-customer:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
