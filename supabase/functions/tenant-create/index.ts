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

    const { name, tier } = await req.json();
    if (!name) throw new Error("Organization name is required");

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name,
        owner_id: user.id,
        tier: tier || 'starter',
        status: 'active',
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // Create onboarding record
    await supabase.from("tenant_onboarding").insert({
      org_id: org.id,
      step: 'profile',
    });

    // Add owner as member
    await supabase.from("organization_members").insert({
      org_id: org.id,
      user_id: user.id,
      role: 'admin',
    });

    // Initialize brand assets
    await supabase.from("brand_assets").insert({
      org_id: org.id,
    });

    // Log action
    await supabase.from("tenant_action_log").insert({
      org_id: org.id,
      user_id: user.id,
      action: "tenant_created",
      details: { name, tier },
    });

    await supabase.from("system_logs").insert({
      division: "system",
      action: "tenant_create",
      user_id: user.id,
      log_level: "info",
      result: "Organization created successfully",
      metadata: { org_id: org.id, name },
    });

    return new Response(
      JSON.stringify({ ok: true, organization: org }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in tenant-create:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
