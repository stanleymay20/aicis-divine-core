import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey || !webhookSecret) {
      throw new Error("Stripe not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const signature = req.headers.get("stripe-signature");
    if (!signature) throw new Error("Missing stripe-signature header");

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log("Processing Stripe webhook:", event.type);

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const customerId = session.customer as string;
        const clientReferenceId = session.client_reference_id;

        // Find org by customer ID or client reference ID
        let org;
        if (clientReferenceId) {
          const { data } = await supabase
            .from("organizations")
            .select("id, stripe_customer_id")
            .eq("id", clientReferenceId)
            .single();
          org = data;
        }
        
        if (!org && customerId) {
          const { data } = await supabase
            .from("organizations")
            .select("id, stripe_customer_id")
            .eq("stripe_customer_id", customerId)
            .single();
          org = data;
        }

        if (!org) {
          console.error("Organization not found for checkout session");
          break;
        }

        // Update customer ID if needed
        if (customerId && !org.stripe_customer_id) {
          await supabase
            .from("organizations")
            .update({ stripe_customer_id: customerId })
            .eq("id", org.id);
        }

        await supabase.from("billing_events").insert({
          org_id: org.id,
          event_type: event.type,
          payload: event.data.object,
        });

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find org by customer ID
        const { data: org } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!org) {
          console.error("Organization not found for customer:", customerId);
          break;
        }

        // Update organization
        await supabase
          .from("organizations")
          .update({
            stripe_subscription_id: subscription.id,
            billing_status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("id", org.id);

        // Log event
        await supabase.from("billing_events").insert({
          org_id: org.id,
          event_type: event.type,
          payload: event.data.object,
        });

        // Update tier based on subscription items if metadata available
        if (subscription.metadata?.price_key) {
          await supabase.functions.invoke("update-subscription", {
            body: { org_id: org.id, plan_key: subscription.metadata.price_key },
          });
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: org } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!org) break;

        // Downgrade to starter
        await supabase.functions.invoke("update-subscription", {
          body: { org_id: org.id, plan_key: "starter" },
        });

        await supabase
          .from("organizations")
          .update({
            billing_status: "canceled",
            stripe_subscription_id: null,
          })
          .eq("id", org.id);

        await supabase.from("billing_events").insert({
          org_id: org.id,
          event_type: event.type,
          payload: event.data.object,
        });

        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: org } = await supabase
          .from("organizations")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!org) break;

        await supabase
          .from("organizations")
          .update({ billing_status: "active" })
          .eq("id", org.id);

        await supabase.from("billing_events").insert({
          org_id: org.id,
          event_type: event.type,
          payload: event.data.object,
        });

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: org } = await supabase
          .from("organizations")
          .select("id, owner_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (!org) break;

        await supabase
          .from("organizations")
          .update({ billing_status: "past_due" })
          .eq("id", org.id);

        await supabase.from("billing_events").insert({
          org_id: org.id,
          event_type: event.type,
          payload: event.data.object,
        });

        // Send notification
        await supabase.from("notifications").insert({
          user_id: org.owner_id,
          title: "Payment Failed",
          message: "Your payment failed. Please update your payment method to avoid service interruption.",
          type: "error",
        });

        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in billing-webhook:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
