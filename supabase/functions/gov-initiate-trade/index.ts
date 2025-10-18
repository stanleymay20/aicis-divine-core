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

    const { asset_symbol, asset_amount } = await req.json();

    // Get asset details
    const { data: asset, error: assetError } = await supabase
      .from("governance_assets")
      .select("*")
      .eq("asset_symbol", asset_symbol)
      .single();

    if (assetError) throw assetError;

    // Get latest SC price (simplified: use 1 SC = 1 USD equivalent for demo)
    const price = 100; // SC per asset unit
    const scCost = asset_amount * price;

    // Get or create user wallet
    const { data: wallet } = await supabase
      .from("sc_wallets")
      .select("*")
      .eq("user_id", user.id)
      .is("division", null)
      .single();

    if (!wallet) throw new Error("Wallet not found. Create wallet first.");

    const available = Number(wallet.balance) - Number(wallet.locked);
    if (available < scCost) {
      throw new Error(`Insufficient balance. Need ${scCost} SC, have ${available} SC available`);
    }

    // Lock funds
    await supabase
      .from("sc_wallets")
      .update({ locked: Number(wallet.locked) + scCost })
      .eq("id", wallet.id);

    // Create trade record
    const { data: trade, error: tradeError } = await supabase
      .from("governance_trades")
      .insert({
        from_wallet: wallet.id,
        asset_symbol,
        sc_amount: scCost,
        asset_amount,
        price,
        status: "pending",
      })
      .select()
      .single();

    if (tradeError) throw tradeError;

    await supabase.from("system_logs").insert({
      division: "governance",
      action: "gov_initiate_trade",
      user_id: user.id,
      log_level: "info",
      result: `Trade initiated: ${asset_amount} ${asset_symbol} for ${scCost} SC`,
      metadata: { trade_id: trade.id },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "gov_initiate_trade",
      division: "governance",
      user_id: user.id,
      action_description: `Initiated trade for ${asset_symbol}`,
      compliance_status: "compliant",
      data_accessed: { trade_id: trade.id, asset_symbol, amount: asset_amount },
    });

    return new Response(
      JSON.stringify({ ok: true, trade }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in gov-initiate-trade:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
