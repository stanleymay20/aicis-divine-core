import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TRANSFER = 25000;

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

    const { to_user_id, to_division, amount, memo } = await req.json();

    if (!amount || amount <= 0) throw new Error("Invalid amount");
    if (amount > MAX_TRANSFER) {
      const isAdmin = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) throw new Error(`Transfer limit is ${MAX_TRANSFER} SC`);
    }

    // Get sender wallet
    const { data: fromWallet } = await supabase
      .from("sc_wallets")
      .select("*")
      .eq("user_id", user.id)
      .is("division", null)
      .single();

    if (!fromWallet) throw new Error("Sender wallet not found");

    const available = Number(fromWallet.balance) - Number(fromWallet.locked);
    if (available < amount) throw new Error("Insufficient balance");

    // Get/create recipient wallet
    let toWallet;
    if (to_division) {
      const { data } = await supabase
        .from("sc_wallets")
        .select("*")
        .eq("division", to_division)
        .is("user_id", null)
        .maybeSingle();

      if (!data) {
        const { data: created } = await supabase
          .from("sc_wallets")
          .insert({ division: to_division, balance: 0, locked: 0 })
          .select()
          .single();
        toWallet = created;
      } else {
        toWallet = data;
      }
    } else if (to_user_id) {
      const { data } = await supabase
        .from("sc_wallets")
        .select("*")
        .eq("user_id", to_user_id)
        .is("division", null)
        .maybeSingle();

      if (!data) throw new Error("Recipient wallet not found");
      toWallet = data;
    } else {
      throw new Error("Must specify to_user_id or to_division");
    }

    // Update balances
    await supabase
      .from("sc_wallets")
      .update({ balance: Number(fromWallet.balance) - amount })
      .eq("id", fromWallet.id);

    await supabase
      .from("sc_wallets")
      .update({ balance: Number(toWallet.balance) + amount })
      .eq("id", toWallet.id);

    // Record ledger entries
    await supabase.from("sc_ledger").insert({
      wallet_id: fromWallet.id,
      tx_type: "transfer_out",
      amount,
      ref_id: toWallet.id,
      memo: memo || "Transfer",
    });

    await supabase.from("sc_ledger").insert({
      wallet_id: toWallet.id,
      tx_type: "transfer_in",
      amount,
      ref_id: fromWallet.id,
      memo: memo || "Transfer",
    });

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "sc_transfer",
      user_id: user.id,
      log_level: "info",
      result: "Transfer completed",
      metadata: { from: fromWallet.id, to: toWallet.id, amount },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "sc_transfer",
      division: to_division || "system",
      user_id: user.id,
      action_description: `Transferred ${amount} SC`,
      compliance_status: "compliant",
      data_accessed: { from: fromWallet.id, to: toWallet.id, amount },
    });

    return new Response(
      JSON.stringify({ ok: true, amount, from: fromWallet.id, to: toWallet.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in sc-transfer:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
