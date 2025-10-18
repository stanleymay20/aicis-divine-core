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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { policy_key = "default_v1" } = await req.json().catch(() => ({}));

    console.log("Simulating rebalance with policy:", policy_key);

    // Get policy
    const { data: policy } = await supabase
      .from("sc_allocation_policies")
      .select("*")
      .eq("policy_key", policy_key)
      .eq("enabled", true)
      .single();

    if (!policy) throw new Error("Policy not found or disabled");

    const weights = policy.weights as any;
    const constraints = policy.constraints as any;

    // Get latest KPIs per division
    const { data: kpis } = await supabase
      .from("division_kpis")
      .select("*")
      .order("captured_at", { ascending: false });

    const latestKpis = new Map();
    kpis?.forEach(kpi => {
      if (!latestKpis.has(kpi.division)) {
        latestKpis.set(kpi.division, kpi);
      }
    });

    // Get division wallets
    const { data: wallets } = await supabase
      .from("sc_wallets")
      .select("*")
      .is("user_id", null)
      .not("division", "is", null);

    if (!wallets || wallets.length === 0) {
      throw new Error("No division wallets found");
    }

    // Calculate scores and targets
    const divisions = Array.from(latestKpis.keys());
    const scores = new Map();
    let totalScore = 0;

    divisions.forEach(div => {
      const kpi = latestKpis.get(div);
      const need = 100 - (kpi.composite_score || 50);
      const risk = kpi.risk_score || 50;
      const impact = 50; // Default, can be learned

      const score = (weights.need * need) + (weights.risk * risk) + (weights.impact * impact);
      scores.set(div, score);
      totalScore += score;
    });

    // Normalize to percentages and apply constraints
    const targets = new Map();
    divisions.forEach(div => {
      let pct = (scores.get(div) / totalScore) * 100;
      pct = Math.max(constraints.min_pct_per_division * 100, Math.min(constraints.max_pct_per_division * 100, pct));
      targets.set(div, pct);
    });

    // Renormalize
    const totalTarget = Array.from(targets.values()).reduce((a, b) => a + b, 0);
    targets.forEach((pct, div) => targets.set(div, (pct / totalTarget) * 100));

    // Calculate available SC
    const totalAvailable = wallets.reduce((sum, w) => sum + (Number(w.balance) - Number(w.locked || 0)), 0);

    // Determine moves
    const moves = [];
    const current = new Map();
    wallets.forEach(w => current.set(w.division, Number(w.balance) - Number(w.locked || 0)));

    const currentTotal = Array.from(current.values()).reduce((a, b) => a + b, 0);
    const currentPct = new Map();
    current.forEach((amt, div) => currentPct.set(div, (amt / currentTotal) * 100));

    // Identify over/under weight divisions
    const overweight: Array<{division: string, excess: number}> = [];
    const underweight: Array<{division: string, needed: number}> = [];

    divisions.forEach(div => {
      const targetPct = targets.get(div) || 0;
      const currentP = currentPct.get(div) || 0;
      const delta = targetPct - currentP;
      const deltaAmt = (delta / 100) * currentTotal;

      if (deltaAmt > 100) { // Threshold to avoid tiny moves
        underweight.push({ division: div, needed: deltaAmt });
      } else if (deltaAmt < -100) {
        overweight.push({ division: div, excess: -deltaAmt });
      }
    });

    // Create moves (simplified greedy approach)
    let totalMoved = 0;
    for (const uw of underweight) {
      for (const ow of overweight) {
        if (totalMoved >= constraints.max_move_per_epoch_sc) break;
        
        const moveAmt = Math.min(uw.needed, ow.excess, constraints.max_move_per_epoch_sc - totalMoved);
        if (moveAmt > 100) {
          moves.push({
            from_division: ow.division,
            to_division: uw.division,
            amount_sc: moveAmt,
            reason: `Rebalance: ${ow.division} overweight, ${uw.division} underweight`,
            requires_approval: moveAmt > constraints.require_approval_over_sc
          });
          totalMoved += moveAmt;
          ow.excess -= moveAmt;
          uw.needed -= moveAmt;
        }
      }
    }

    // Create run record
    const { data: run, error: runError } = await supabase
      .from("sc_rebalance_runs")
      .insert({
        policy_key,
        mode: "simulate",
        status: "success",
        total_available_sc: totalAvailable,
        total_moved_sc: totalMoved,
        notes: `Simulated ${moves.length} moves`,
        finished_at: new Date().toISOString()
      })
      .select()
      .single();

    if (runError) throw runError;

    // Insert moves
    const moveRecords = moves.map(m => ({ ...m, run_id: run.id }));
    const { error: movesError } = await supabase
      .from("sc_rebalance_moves")
      .insert(moveRecords);

    if (movesError) throw movesError;

    await supabase.from("system_logs").insert({
      action: "simulate_rebalance",
      result: `Simulated ${moves.length} moves, ${totalMoved} SC`,
      log_level: "info",
      division: "system"
    });

    console.log(`Simulation complete: ${moves.length} moves, ${totalMoved} SC`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        run_id: run.id,
        moves: moves.length,
        total_moved_sc: totalMoved,
        plan: moves
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error simulating rebalance:", error);
    
    await supabase.from("system_logs").insert({
      action: "simulate_rebalance",
      result: `Error: ${errorMessage}`,
      log_level: "error",
      division: "system"
    });

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
