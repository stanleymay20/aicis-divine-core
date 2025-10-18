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

    // Get average trust score from partners
    const { data: partners } = await supabase
      .from("partner_oracles")
      .select("trust_score")
      .eq("enabled", true);

    const avgTrust = partners && partners.length > 0
      ? partners.reduce((sum, p) => sum + Number(p.trust_score), 0) / partners.length
      : 80;

    // Governance index = average trust / 100
    const govIndex = avgTrust / 100;

    // Store in oracle
    await supabase.from("sc_oracle_prices").insert({
      source: "partner_aggregate",
      symbol: "GOVINDEX",
      value: govIndex,
    });

    await supabase.from("system_logs").insert({
      division: "governance",
      action: "gov_oracle_update",
      user_id: user.id,
      log_level: "info",
      result: `Governance index updated: ${govIndex.toFixed(4)}`,
      metadata: { govIndex, avgTrust },
    });

    return new Response(
      JSON.stringify({ ok: true, govIndex, avgTrust }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in gov-oracle-update:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
