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

    const { proposal_id, choice } = await req.json();

    if (!["yes", "no", "abstain"].includes(choice)) {
      throw new Error("Invalid choice. Must be yes, no, or abstain");
    }

    // Get proposal
    const { data: proposal, error: proposalError } = await supabase
      .from("dao_proposals")
      .select("*, dao_spaces(*)")
      .eq("id", proposal_id)
      .single();

    if (proposalError) throw proposalError;

    // Check voting window
    const now = new Date();
    if (now < new Date(proposal.voting_starts) || now > new Date(proposal.voting_ends)) {
      throw new Error("Voting window has closed or not yet started");
    }

    // Get user's snapshot balance
    const { data: snapshot } = await supabase
      .from("dao_stake_snapshots")
      .select("balance_sc")
      .eq("space_id", proposal.space_id)
      .eq("user_id", user.id)
      .lte("taken_at", proposal.snapshot_at)
      .order("taken_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const snapshotBalance = snapshot ? Number(snapshot.balance_sc) : 0;

    // Calculate weight based on voting mode
    let weight = 0;
    const votingMode = proposal.dao_spaces.voting_mode;

    if (votingMode === "stake") {
      weight = Math.min(snapshotBalance, 10000); // Cap at 10k SC
    } else if (votingMode === "one_person") {
      weight = 1;
    } else if (votingMode === "hybrid") {
      weight = 0.5 * Math.min(snapshotBalance, 10000) + 0.5;
    }

    // Insert or update vote
    const { error: voteError } = await supabase
      .from("dao_votes")
      .upsert({
        proposal_id,
        user_id: user.id,
        choice,
        weight,
      }, { onConflict: "proposal_id,user_id" });

    if (voteError) throw voteError;

    await supabase.from("system_logs").insert({
      division: "governance",
      action: "dao_vote",
      user_id: user.id,
      log_level: "info",
      result: `Vote cast: ${choice} (weight: ${weight})`,
      metadata: { proposal_id, choice, weight },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "dao_vote",
      division: "governance",
      user_id: user.id,
      action_description: `Voted ${choice} on proposal`,
      compliance_status: "compliant",
      data_accessed: { proposal_id, choice },
    });

    return new Response(
      JSON.stringify({ ok: true, weight }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in dao-vote:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
