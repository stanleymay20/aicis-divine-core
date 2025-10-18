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

    // Get spaces
    const { data: spaces } = await supabase
      .from("dao_spaces")
      .select("*")
      .order("created_at", { ascending: false });

    // Get recent proposals
    const { data: proposals } = await supabase
      .from("dao_proposals")
      .select("*, dao_spaces(name, slug)")
      .order("created_at", { ascending: false })
      .limit(20);

    // Get user's votes
    const { data: userVotes } = await supabase
      .from("dao_votes")
      .select("*, dao_proposals(title)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Get user's stake snapshot
    const { data: userStake } = await supabase
      .from("dao_stake_snapshots")
      .select("balance_sc, taken_at")
      .eq("user_id", user.id)
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from("system_logs").insert({
      division: "governance",
      action: "dao_get_dashboard",
      user_id: user.id,
      log_level: "info",
      result: "Dashboard data retrieved",
    });

    return new Response(
      JSON.stringify({ ok: true, spaces, proposals, userVotes, userStake }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in dao-get-dashboard:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
