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
    const { rebalance_run_id } = await req.json().catch(() => ({}));
    
    console.log("Evaluating division impact...");

    // Get the run details
    const { data: run } = rebalance_run_id ? await supabase
      .from("sc_rebalance_runs")
      .select("*")
      .eq("id", rebalance_run_id)
      .single() : { data: null };

    // Get KPIs from 48h ago (before) and current (after)
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48*60*60*1000);

    const { data: beforeKpis } = await supabase
      .from("division_kpis")
      .select("*")
      .gte("captured_at", twoDaysAgo.toISOString())
      .lte("captured_at", run?.created_at || new Date(now.getTime() - 24*60*60*1000).toISOString());

    const { data: afterKpis } = await supabase
      .from("division_kpis")
      .select("*")
      .gte("captured_at", run?.finished_at || new Date(now.getTime() - 12*60*60*1000).toISOString());

    // Group by division and calculate deltas
    const beforeMap = new Map();
    beforeKpis?.forEach(kpi => {
      if (!beforeMap.has(kpi.division) || kpi.captured_at > beforeMap.get(kpi.division).captured_at) {
        beforeMap.set(kpi.division, kpi);
      }
    });

    const afterMap = new Map();
    afterKpis?.forEach(kpi => {
      if (!afterMap.has(kpi.division) || kpi.captured_at > afterMap.get(kpi.division).captured_at) {
        afterMap.set(kpi.division, kpi);
      }
    });

    // Get moves to determine SC spent per division
    const { data: moves } = rebalance_run_id ? await supabase
      .from("sc_rebalance_moves")
      .select("*")
      .eq("run_id", rebalance_run_id)
      .eq("executed", true) : { data: [] };

    const scSpent = new Map();
    moves?.forEach(move => {
      const current = scSpent.get(move.to_division) || 0;
      scSpent.set(move.to_division, current + Number(move.amount_sc));
    });

    // Calculate impact metrics
    const impacts = [];
    const divisions = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()]));

    for (const div of divisions) {
      const before = beforeMap.get(div);
      const after = afterMap.get(div);

      if (!before || !after) continue;

      const deltaStability = (after.composite_score || 0) - (before.composite_score || 0);
      const deltaRisk = (before.risk_score || 0) - (after.risk_score || 0); // Reduction is positive
      
      const metric = {
        delta_stability: deltaStability,
        delta_risk: deltaRisk,
        before_score: before.composite_score,
        after_score: after.composite_score
      };

      // Weighted aggregate (stability worth 60%, risk reduction 40%)
      const impactScore = (0.6 * deltaStability) + (0.4 * deltaRisk);
      const spent = scSpent.get(div) || 1; // Avoid division by zero
      const impactPerSc = impactScore / spent;

      impacts.push({
        division: div,
        rebalance_run_id: rebalance_run_id || null,
        metric,
        impact_score: impactScore,
        sc_spent: spent,
        impact_per_sc: impactPerSc
      });
    }

    // Insert impact metrics
    const { data: inserted, error: insertError } = await supabase
      .from("division_impact_metrics")
      .insert(impacts)
      .select();

    if (insertError) throw insertError;

    await supabase.from("system_logs").insert({
      action: "evaluate_impact",
      result: `Evaluated impact for ${impacts.length} divisions`,
      log_level: "info",
      division: "system",
      metadata: { avg_impact_per_sc: impacts.reduce((s, i) => s + i.impact_per_sc, 0) / impacts.length }
    });

    console.log(`Impact evaluation complete: ${impacts.length} divisions`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        divisions: impacts.length,
        impacts: inserted 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error evaluating impact:", error);
    
    await supabase.from("system_logs").insert({
      action: "evaluate_impact",
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
