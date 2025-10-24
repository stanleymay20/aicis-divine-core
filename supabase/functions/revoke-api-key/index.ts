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

    const { org_id, key_id } = await req.json();
    if (!org_id || !key_id) throw new Error("Organization ID and key ID are required");

    // Verify user is org owner
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", org_id)
      .eq("owner_id", user.id)
      .single();

    if (!org) throw new Error("Not authorized");

    // Revoke API key
    const { error } = await supabase
      .from("api_keys")
      .update({
        revoked: true,
        revoked_at: new Date().toISOString(),
        revoked_by: user.id,
      })
      .eq("id", key_id)
      .eq("org_id", org_id);

    if (error) throw error;

    // Log action
    await supabase.from("tenant_action_log").insert({
      org_id,
      user_id: user.id,
      action: "api_key_revoked",
      details: { key_id },
    });

    await supabase.from("system_logs").insert({
      division: "system",
      action: "revoke_api_key",
      user_id: user.id,
      log_level: "info",
      result: "API key revoked",
      metadata: { org_id, key_id },
    });

    return new Response(
      JSON.stringify({ ok: true, message: "API key revoked successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in revoke-api-key:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
