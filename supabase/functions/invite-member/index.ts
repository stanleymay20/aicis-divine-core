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

    const { org_id, email, role = "member" } = await req.json();
    if (!org_id || !email) throw new Error("Organization ID and email are required");

    // Verify user is org owner
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", org_id)
      .eq("owner_id", user.id)
      .single();

    if (!org) throw new Error("Not authorized to invite members to this organization");

    // Find user by email
    const { data: inviteeProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!inviteeProfile) {
      throw new Error("User not found. They need to sign up first.");
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from("organization_members")
      .select("id")
      .eq("org_id", org_id)
      .eq("user_id", inviteeProfile.id)
      .maybeSingle();

    if (existingMember) {
      throw new Error("User is already a member of this organization");
    }

    // Add member
    const { data: newMember, error } = await supabase
      .from("organization_members")
      .insert({
        org_id,
        user_id: inviteeProfile.id,
        role,
      })
      .select()
      .single();

    if (error) throw error;

    // Send notification
    await supabase.from("notifications").insert({
      user_id: inviteeProfile.id,
      title: "Organization Invitation",
      message: `You've been invited to join ${org.name}`,
      type: "info",
    });

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "invite_member",
      user_id: user.id,
      log_level: "info",
      result: "Member invited",
      metadata: { org_id, invitee_email: email },
    });

    return new Response(
      JSON.stringify({ ok: true, member: newMember }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in invite-member:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
