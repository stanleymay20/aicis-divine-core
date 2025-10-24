import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function verifyDNS(domain: string, verificationToken: string): Promise<{ verified: boolean; error?: string }> {
  try {
    const txtRecord = `_aicis-verification.${domain}`;
    
    // Simple DNS verification via DNS over HTTPS
    const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(txtRecord)}&type=TXT`;
    const response = await fetch(dohUrl, {
      headers: { 'Accept': 'application/dns-json' }
    });

    if (!response.ok) {
      return { verified: false, error: "DNS lookup failed" };
    }

    const dnsData = await response.json();
    
    if (dnsData.Answer) {
      for (const answer of dnsData.Answer) {
        if (answer.data && answer.data.includes(verificationToken)) {
          return { verified: true };
        }
      }
    }

    return { verified: false, error: "Verification token not found in TXT record" };
  } catch (error) {
    console.error("DNS verification error:", error);
    return { verified: false, error: "DNS verification failed" };
  }
}

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

    const { org_id, domain_id } = await req.json();
    if (!org_id || !domain_id) throw new Error("Organization ID and domain ID are required");

    // Verify user is org owner
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", org_id)
      .eq("owner_id", user.id)
      .single();

    if (!org) throw new Error("Not authorized");

    // Get domain record
    const { data: customDomain } = await supabase
      .from("custom_domains")
      .select("*")
      .eq("id", domain_id)
      .eq("org_id", org_id)
      .single();

    if (!customDomain) throw new Error("Domain not found");

    // Verify DNS
    const verificationResult = await verifyDNS(customDomain.domain, customDomain.verification_token);

    // Update domain record
    const updateData: any = {
      last_check_at: new Date().toISOString(),
    };

    if (verificationResult.verified) {
      updateData.verified = true;
      updateData.verified_at = new Date().toISOString();
      updateData.status = 'verified';
      updateData.dns_configured = true;
    } else {
      updateData.error_message = verificationResult.error;
      updateData.status = 'pending';
    }

    await supabase
      .from("custom_domains")
      .update(updateData)
      .eq("id", domain_id);

    // Log action
    await supabase.from("tenant_action_log").insert({
      org_id,
      user_id: user.id,
      action: "domain_verification_attempted",
      details: { domain: customDomain.domain, verified: verificationResult.verified },
    });

    await supabase.from("system_logs").insert({
      division: "system",
      action: "tenant_verify_domain",
      user_id: user.id,
      log_level: verificationResult.verified ? "info" : "warn",
      result: verificationResult.verified ? "Domain verified" : "Verification failed",
      metadata: { org_id, domain: customDomain.domain, error: verificationResult.error },
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        verified: verificationResult.verified,
        error: verificationResult.error
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in tenant-verify-domain:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
