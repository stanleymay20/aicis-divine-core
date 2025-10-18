import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_EMISSION = 1000;
const DECAY_RATE = 0.999;

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

    // Check admin
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin only");

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Check if already minted today
    const { data: existing } = await supabase
      .from("sc_emissions")
      .select("*")
      .eq("epoch_date", today)
      .eq("schedule_version", "v1")
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ ok: true, message: "Already minted today" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate emission with decay
    const { data: emissions } = await supabase
      .from("sc_emissions")
      .select("*")
      .order("epoch_date", { ascending: false })
      .limit(1);

    const daysSinceLaunch = emissions?.length || 0;
    const todayEmission = BASE_EMISSION * Math.pow(DECAY_RATE, daysSinceLaunch);

    // Get or create system wallet
    const { data: systemWallet } = await supabase
      .from("sc_wallets")
      .select("*")
      .eq("division", "system")
      .is("user_id", null)
      .maybeSingle();

    let walletId = systemWallet?.id;

    if (!systemWallet) {
      const { data: created } = await supabase
        .from("sc_wallets")
        .insert({ division: "system", balance: 0, locked: 0 })
        .select()
        .single();
      walletId = created?.id;
    }

    // Mint to system wallet
    await supabase
      .from("sc_wallets")
      .update({
        balance: Number(systemWallet?.balance || 0) + todayEmission,
      })
      .eq("id", walletId);

    await supabase.from("sc_ledger").insert({
      wallet_id: walletId,
      tx_type: "mint",
      amount: todayEmission,
      memo: `Epoch emission for ${today}`,
    });

    // Distribute base stipend to each division (10% of emission)
    const divisions = [
      "finance",
      "energy",
      "health",
      "food",
      "governance",
      "defense",
      "diplomacy",
      "crisis",
    ];
    const stipend = (todayEmission * 0.1) / divisions.length;

    for (const division of divisions) {
      const { data: divWallet } = await supabase
        .from("sc_wallets")
        .select("*")
        .eq("division", division)
        .is("user_id", null)
        .maybeSingle();

      let divWalletId = divWallet?.id;

      if (!divWallet) {
        const { data: created } = await supabase
          .from("sc_wallets")
          .insert({ division, balance: 0, locked: 0 })
          .select()
          .single();
        divWalletId = created?.id;
      }

      if (divWalletId) {
        await supabase
          .from("sc_wallets")
          .update({
            balance: Number(divWallet?.balance || 0) + stipend,
          })
          .eq("id", divWalletId);

        await supabase.from("sc_ledger").insert({
          wallet_id: divWalletId,
          tx_type: "mint",
          amount: stipend,
          memo: `Base stipend for ${today}`,
        });
      }
    }

    // Record emission
    await supabase.from("sc_emissions").insert({
      epoch_date: today,
      total_emitted_sc: todayEmission,
      schedule_version: "v1",
    });

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "sc_mint_epoch",
      user_id: user.id,
      log_level: "info",
      result: `Minted ${todayEmission.toFixed(2)} SC for ${today}`,
      metadata: { todayEmission, daysSinceLaunch },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "sc_mint_epoch",
      division: "system",
      user_id: user.id,
      action_description: `Minted ${todayEmission.toFixed(2)} SC`,
      compliance_status: "compliant",
      data_accessed: { todayEmission },
    });

    return new Response(
      JSON.stringify({ ok: true, todayEmission, daysSinceLaunch }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in sc-mint-epoch:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
