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

    const { org_id, email, role } = await req.json();
    if (!org_id || !email) throw new Error("Organization ID and email are required");

    // Verify user is org owner
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", org_id)
      .eq("owner_id", user.id)
      .single();

    if (!org) throw new Error("Not authorized");

    // Check if user exists with this email
    const { data: invitedUser } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (invitedUser) {
      // Add directly as member
      await supabase.from("organization_members").insert({
        org_id,
        user_id: invitedUser.id,
        role: role || 'member',
      });
    }

    // Create notification
    if (invitedUser) {
      await supabase.from("notifications").insert({
        user_id: invitedUser.id,
        type: "organization_invite",
        title: "Organization Invitation",
        message: `You've been invited to join ${org.name}`,
        division: "system",
        link: `/organizations/${org_id}`,
      });
    }

    // Log action
    await supabase.from("tenant_action_log").insert({
      org_id,
      user_id: user.id,
      action: "member_invited",
      details: { email, role },
    });

    await supabase.from("system_logs").insert({
      division: "system",
      action: "tenant_invite",
      user_id: user.id,
      log_level: "info",
      result: "Invitation sent",
      metadata: { org_id, email, role },
    });

    return new Response(
      JSON.stringify({ ok: true, message: "Invitation sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in tenant-invite:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
