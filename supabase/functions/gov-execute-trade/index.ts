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

    const { trade_id } = await req.json();

    // Get trade
    const { data: trade, error: tradeError } = await supabase
      .from("governance_trades")
      .select("*")
      .eq("id", trade_id)
      .eq("status", "pending")
      .single();

    if (tradeError) throw tradeError;

    // Execute: unlock funds and deduct balance
    const { data: wallet } = await supabase
      .from("sc_wallets")
      .select("*")
      .eq("id", trade.from_wallet)
      .single();

    if (!wallet) throw new Error("Wallet not found");

    await supabase
      .from("sc_wallets")
      .update({
        balance: Number(wallet.balance) - Number(trade.sc_amount),
        locked: Number(wallet.locked) - Number(trade.sc_amount),
      })
      .eq("id", wallet.id);

    // Record ledger entry
    await supabase.from("sc_ledger").insert({
      wallet_id: wallet.id,
      tx_type: "burn",
      amount: trade.sc_amount,
      ref_table: "governance_trades",
      ref_id: trade.id,
      memo: `Governance trade: ${trade.asset_amount} ${trade.asset_symbol}`,
    });

    // Mark trade executed
    await supabase
      .from("governance_trades")
      .update({ status: "executed", executed_at: new Date().toISOString() })
      .eq("id", trade_id);

    await supabase.from("system_logs").insert({
      division: "governance",
      action: "gov_execute_trade",
      user_id: user.id,
      log_level: "info",
      result: `Trade executed: ${trade.asset_symbol}`,
      metadata: { trade_id },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "gov_execute_trade",
      division: "governance",
      user_id: user.id,
      action_description: "Executed governance trade",
      compliance_status: "compliant",
      data_accessed: { trade_id },
    });

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in gov-execute-trade:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
