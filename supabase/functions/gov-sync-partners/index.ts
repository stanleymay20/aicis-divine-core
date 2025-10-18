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

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some(r => r.role === "admin" || r.role === "operator");
    if (!isAdmin) throw new Error("Admin access required");

    // Get enabled partners
    const { data: partners } = await supabase
      .from("partner_oracles")
      .select("*")
      .eq("enabled", true);

    let synced = 0;

    for (const partner of partners || []) {
      try {
        // Simulate oracle sync (in production, fetch from partner.api_endpoint)
        const trustDelta = (Math.random() - 0.5) * 5; // -2.5 to +2.5
        const newTrust = Math.max(0, Math.min(100, Number(partner.trust_score) + trustDelta));

        await supabase
          .from("partner_oracles")
          .update({
            trust_score: newTrust,
            last_checked: new Date().toISOString(),
          })
          .eq("id", partner.id);

        synced++;
      } catch (err) {
        console.error(`Failed to sync ${partner.partner_name}:`, err);
      }
    }

    await supabase.from("system_logs").insert({
      division: "governance",
      action: "gov_sync_partners",
      user_id: user.id,
      log_level: "info",
      result: `Synced ${synced} partner oracles`,
    });

    return new Response(
      JSON.stringify({ ok: true, synced }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in gov-sync-partners:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
