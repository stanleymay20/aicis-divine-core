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

    const { proposal_id } = await req.json();

    // Get proposal with space
    const { data: proposal, error: proposalError } = await supabase
      .from("dao_proposals")
      .select("*, dao_spaces(*)")
      .eq("id", proposal_id)
      .single();

    if (proposalError) throw proposalError;

    // Check if voting ended
    const now = new Date();
    if (now < new Date(proposal.voting_ends)) {
      throw new Error("Voting window has not ended yet");
    }

    // Get votes
    const { data: votes } = await supabase
      .from("dao_votes")
      .select("choice, weight")
      .eq("proposal_id", proposal_id);

    const yesWeight = votes?.filter(v => v.choice === "yes").reduce((sum, v) => sum + Number(v.weight), 0) || 0;
    const noWeight = votes?.filter(v => v.choice === "no").reduce((sum, v) => sum + Number(v.weight), 0) || 0;
    const abstainWeight = votes?.filter(v => v.choice === "abstain").reduce((sum, v) => sum + Number(v.weight), 0) || 0;
    const totalWeight = yesWeight + noWeight + abstainWeight;

    // Get total eligible weight from snapshots
    const { data: snapshots } = await supabase
      .from("dao_stake_snapshots")
      .select("balance_sc")
      .eq("space_id", proposal.space_id)
      .lte("taken_at", proposal.snapshot_at);

    const totalEligible = snapshots?.reduce((sum, s) => sum + Math.min(Number(s.balance_sc), 10000), 0) || 1;

    // Check quorum
    const turnoutPct = (totalWeight / totalEligible) * 100;
    const quorumMet = turnoutPct >= Number(proposal.dao_spaces.quorum_pct);

    // Check pass threshold
    const yesPct = yesWeight + noWeight > 0 ? (yesWeight / (yesWeight + noWeight)) * 100 : 0;
    const passed = yesPct >= Number(proposal.dao_spaces.pass_pct);

    const finalStatus = quorumMet && passed ? "approved" : "rejected";

    // Update proposal
    await supabase
      .from("dao_proposals")
      .update({ status: finalStatus })
      .eq("id", proposal_id);

    // If approved, create approval request
    if (finalStatus === "approved") {
      await supabase.from("approvals").insert({
        requester: user.id,
        division: "governance",
        action: "Execute DAO proposal",
        payload: { proposal_id, actions: proposal.actions },
        status: "pending",
      });
    }

    await supabase.from("system_logs").insert({
      division: "governance",
      action: "dao_tally",
      user_id: user.id,
      log_level: "info",
      result: `Proposal ${finalStatus}: ${yesPct.toFixed(1)}% yes, quorum ${turnoutPct.toFixed(1)}%`,
      metadata: { proposal_id, finalStatus, yesPct, turnoutPct },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "dao_tally",
      division: "governance",
      user_id: user.id,
      action_description: "Tallied DAO proposal votes",
      compliance_status: "compliant",
      data_accessed: { proposal_id, result: finalStatus },
    });

    return new Response(
      JSON.stringify({ ok: true, status: finalStatus, yesWeight, noWeight, abstainWeight, turnoutPct, yesPct }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in dao-tally:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
