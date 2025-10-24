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

    const { org_id, logo_url, primary_color, secondary_color, accent_color, favicon_url, custom_css } = await req.json();
    if (!org_id) throw new Error("Organization ID is required");

    // Verify user is org owner
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", org_id)
      .eq("owner_id", user.id)
      .single();

    if (!org) throw new Error("Not authorized");

    // Update brand assets
    const updateData: any = {};
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (primary_color) updateData.primary_color = primary_color;
    if (secondary_color) updateData.secondary_color = secondary_color;
    if (accent_color) updateData.accent_color = accent_color;
    if (favicon_url !== undefined) updateData.favicon_url = favicon_url;
    if (custom_css !== undefined) updateData.custom_css = custom_css;

    const { data: brandAssets, error } = await supabase
      .from("brand_assets")
      .update(updateData)
      .eq("org_id", org_id)
      .select()
      .single();

    if (error) throw error;

    // Update onboarding
    await supabase
      .from("tenant_onboarding")
      .update({ branding_complete: true })
      .eq("org_id", org_id);

    // Log action
    await supabase.from("tenant_action_log").insert({
      org_id,
      user_id: user.id,
      action: "branding_updated",
      details: updateData,
    });

    await supabase.from("system_logs").insert({
      division: "system",
      action: "tenant_update_branding",
      user_id: user.id,
      log_level: "info",
      result: "Branding updated",
      metadata: { org_id },
    });

    return new Response(
      JSON.stringify({ ok: true, brand_assets: brandAssets }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in tenant-update-branding:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
