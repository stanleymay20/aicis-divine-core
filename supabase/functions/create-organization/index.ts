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

    const { name } = await req.json();
    if (!name) throw new Error("Organization name is required");

    // Check if user already has an organization
    const { data: existingOrg } = await supabase
      .from("organizations")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (existingOrg) {
      throw new Error("User already has an organization");
    }

    // Get starter plan
    const { data: starterPlan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("key", "starter")
      .single();

    if (!starterPlan) throw new Error("Starter plan not found");

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name,
        owner_id: user.id,
        tier: "starter",
        feature_flags: starterPlan.features,
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // Add owner as member
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        org_id: org.id,
        user_id: user.id,
        role: "owner",
      });

    if (memberError) throw memberError;

    // Create subscription record
    const { error: subError } = await supabase
      .from("organization_subscriptions")
      .insert({
        org_id: org.id,
        plan_id: starterPlan.id,
        status: "active",
      });

    if (subError) throw subError;

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "create_organization",
      user_id: user.id,
      log_level: "info",
      result: "Organization created",
      metadata: { org_id: org.id, org_name: name },
    });

    return new Response(
      JSON.stringify({ ok: true, organization: org }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in create-organization:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
