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

    // Get user wallets
    const { data: wallets } = await supabase
      .from("sc_wallets")
      .select("*")
      .eq("user_id", user.id);

    // Get recent transactions
    const walletIds = (wallets ?? []).map((w) => w.id);
    const { data: transactions } = await supabase
      .from("sc_ledger")
      .select("*")
      .in("wallet_id", walletIds)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get SC reference price
    const { data: scPrice } = await supabase
      .from("sc_oracle_prices")
      .select("*")
      .eq("symbol", "SC")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "sc_get_balance",
      user_id: user.id,
      log_level: "info",
      result: "Balance checked",
    });

    return new Response(
      JSON.stringify({
        ok: true,
        wallets: wallets ?? [],
        transactions: transactions ?? [],
        scPrice: scPrice?.value || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in sc-get-balance:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
