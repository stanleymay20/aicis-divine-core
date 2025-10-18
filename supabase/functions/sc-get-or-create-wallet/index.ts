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

    const { division } = await req.json().catch(() => ({}));

    // Check if wallet exists
    let query = supabase.from("sc_wallets").select("*").eq("user_id", user.id);
    if (division) {
      query = query.eq("division", division);
    } else {
      query = query.is("division", null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ ok: true, wallet: existing, created: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new wallet
    const { data: wallet, error } = await supabase
      .from("sc_wallets")
      .insert({
        user_id: user.id,
        division: division || null,
        balance: 0,
        locked: 0,
      })
      .select()
      .single();

    if (error) throw error;

    // Log
    await supabase.from("system_logs").insert({
      division: division || "system",
      action: "sc_create_wallet",
      user_id: user.id,
      log_level: "info",
      result: "Wallet created",
      metadata: { wallet_id: wallet.id, division },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "sc_create_wallet",
      division: division || "system",
      user_id: user.id,
      action_description: `Created SC wallet for ${division || "user"}`,
      compliance_status: "compliant",
      data_accessed: { wallet_id: wallet.id },
    });

    return new Response(
      JSON.stringify({ ok: true, wallet, created: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in sc-get-or-create-wallet:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
