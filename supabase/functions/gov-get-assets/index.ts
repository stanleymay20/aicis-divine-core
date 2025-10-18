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

    // Get governance assets
    const { data: assets, error: assetsError } = await supabase
      .from("governance_assets")
      .select("*")
      .order("asset_symbol");

    if (assetsError) throw assetsError;

    // Get partner oracles
    const { data: partners, error: partnersError } = await supabase
      .from("partner_oracles")
      .select("*")
      .eq("enabled", true)
      .order("trust_score", { ascending: false });

    if (partnersError) throw partnersError;

    // Get latest SC oracle price
    const { data: scPrice } = await supabase
      .from("sc_oracle_prices")
      .select("*")
      .eq("symbol", "SC")
      .order("captured_at", { ascending: false })
      .limit(1)
      .single();

    await supabase.from("system_logs").insert({
      division: "governance",
      action: "gov_get_assets",
      user_id: user.id,
      log_level: "info",
      result: `Retrieved ${assets?.length || 0} assets and ${partners?.length || 0} partners`,
    });

    return new Response(
      JSON.stringify({ ok: true, assets, partners, scPrice }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in gov-get-assets:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
