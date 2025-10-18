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

    const { space_slug } = await req.json();

    // Get space
    const { data: space, error: spaceError } = await supabase
      .from("dao_spaces")
      .select("*")
      .eq("slug", space_slug || "aicis-core")
      .single();

    if (spaceError) throw spaceError;

    // Get all user wallets (personal only, not division wallets)
    const { data: wallets } = await supabase
      .from("sc_wallets")
      .select("user_id, balance")
      .not("user_id", "is", null);

    let snapshotCount = 0;

    for (const wallet of wallets || []) {
      await supabase.from("dao_stake_snapshots").insert({
        space_id: space.id,
        user_id: wallet.user_id,
        balance_sc: wallet.balance,
        taken_at: new Date().toISOString(),
      });
      snapshotCount++;
    }

    await supabase.from("system_logs").insert({
      division: "governance",
      action: "dao_snapshot",
      user_id: user.id,
      log_level: "info",
      result: `Snapshot created: ${snapshotCount} users`,
      metadata: { space_id: space.id, count: snapshotCount },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "dao_snapshot",
      division: "governance",
      user_id: user.id,
      action_description: "Created DAO stake snapshot",
      compliance_status: "compliant",
      data_accessed: { space_slug, count: snapshotCount },
    });

    return new Response(
      JSON.stringify({ ok: true, snapshotCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in dao-snapshot:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
