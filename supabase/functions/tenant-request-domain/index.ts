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

    const { org_id, domain } = await req.json();
    if (!org_id || !domain) throw new Error("Organization ID and domain are required");

    // Verify user is org owner
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", org_id)
      .eq("owner_id", user.id)
      .single();

    if (!org) throw new Error("Not authorized");

    // Check if white label is enabled
    if (!org.white_label_enabled) {
      throw new Error("White label feature is not enabled for this organization");
    }

    // Generate verification token
    const verificationToken = crypto.randomUUID();

    // Create domain record
    const { data: customDomain, error } = await supabase
      .from("custom_domains")
      .insert({
        org_id,
        domain: domain.toLowerCase().trim(),
        verification_token: verificationToken,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // Update onboarding
    await supabase
      .from("tenant_onboarding")
      .update({ domain_complete: true })
      .eq("org_id", org_id);

    // Log action
    await supabase.from("tenant_action_log").insert({
      org_id,
      user_id: user.id,
      action: "domain_requested",
      details: { domain },
    });

    await supabase.from("system_logs").insert({
      division: "system",
      action: "tenant_request_domain",
      user_id: user.id,
      log_level: "info",
      result: "Domain requested",
      metadata: { org_id, domain },
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        domain: customDomain,
        dns_instructions: {
          txt_record: {
            name: `_aicis-verification.${domain}`,
            value: verificationToken,
          },
          cname_record: {
            name: domain,
            value: "aicis.app",
          }
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in tenant-request-domain:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
