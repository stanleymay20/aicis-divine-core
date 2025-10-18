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

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);

    // Get rules
    const { data: rules } = await supabase
      .from("sc_incentive_rules")
      .select("*")
      .eq("enabled", true);

    let totalEmitted = 0;
    const rewards: any[] = [];

    // Risk Reduction
    const riskRule = rules?.find((r) => r.rule_key === "risk_reduction");
    if (riskRule) {
      const { data: risks } = await supabase
        .from("risk_predictions")
        .select("*")
        .gte("created_at", yesterday.toISOString());

      const highCriticalCount = risks?.filter((r) =>
        ["high", "critical"].includes(r.risk_level)
      ).length || 0;

      const rewardAmount = Math.min(
        riskRule.cap_sc_per_day,
        Math.max(0, (10 - highCriticalCount) * 100 * riskRule.weight)
      );

      if (rewardAmount > 0) {
        rewards.push({
          division: "defense",
          rule: "risk_reduction",
          amount: rewardAmount,
        });
        totalEmitted += rewardAmount;
      }
    }

    // Grid Stability
    const gridRule = rules?.find((r) => r.rule_key === "grid_stability");
    if (gridRule) {
      const { data: energy } = await supabase
        .from("energy_grid")
        .select("stability_index, renewable_percentage")
        .gte("updated_at", yesterday.toISOString());

      const avgStability =
        (energy || []).reduce((a, b) => a + Number(b.stability_index), 0) /
          Math.max(1, (energy || []).length) || 0;
      const avgRenewable =
        (energy || []).reduce((a, b) => a + Number(b.renewable_percentage || 0), 0) /
          Math.max(1, (energy || []).length) || 0;

      const rewardAmount = Math.min(
        gridRule.cap_sc_per_day,
        Math.max(0, ((avgStability - 70) * 20 + avgRenewable * 10) * gridRule.weight)
      );

      if (rewardAmount > 0) {
        rewards.push({
          division: "energy",
          rule: "grid_stability",
          amount: rewardAmount,
        });
        totalEmitted += rewardAmount;
      }
    }

    // Anomaly Resolution
    const anomalyRule = rules?.find((r) => r.rule_key === "anomaly_resolution");
    if (anomalyRule) {
      const { data: anomalies } = await supabase
        .from("anomaly_detections")
        .select("*")
        .eq("status", "resolved")
        .gte("resolved_at", yesterday.toISOString());

      const resolvedCount = anomalies?.length || 0;
      const rewardAmount = Math.min(
        anomalyRule.cap_sc_per_day,
        resolvedCount * 150 * anomalyRule.weight
      );

      if (rewardAmount > 0) {
        rewards.push({
          division: "system",
          rule: "anomaly_resolution",
          amount: rewardAmount,
        });
        totalEmitted += rewardAmount;
      }
    }

    // Objective Complete
    const objRule = rules?.find((r) => r.rule_key === "objective_complete");
    if (objRule) {
      const { data: objectives } = await supabase
        .from("objectives")
        .select("*")
        .eq("status", "completed")
        .gte("completed_at", yesterday.toISOString());

      const completedCount = objectives?.length || 0;
      const rewardAmount = Math.min(
        objRule.cap_sc_per_day,
        completedCount * 500 * objRule.weight
      );

      if (rewardAmount > 0) {
        rewards.push({
          division: "system",
          rule: "objective_complete",
          amount: rewardAmount,
        });
        totalEmitted += rewardAmount;
      }
    }

    // Data Pull Quality
    const dataRule = rules?.find((r) => r.rule_key === "data_pull_quality");
    if (dataRule) {
      const { data: logs } = await supabase
        .from("system_logs")
        .select("*")
        .in("action", [
          "pull_coingecko",
          "pull_owid_energy",
          "pull_faostat_food",
          "pull_owid_health",
        ])
        .eq("result", "success")
        .gte("created_at", yesterday.toISOString());

      const pullCount = logs?.length || 0;
      const rewardAmount = Math.min(
        dataRule.cap_sc_per_day,
        pullCount * 50 * dataRule.weight
      );

      if (rewardAmount > 0) {
        rewards.push({
          division: "finance",
          rule: "data_pull_quality",
          amount: rewardAmount,
        });
        totalEmitted += rewardAmount;
      }
    }

    // Distribute rewards
    for (const reward of rewards) {
      // Get or create division wallet
      const { data: wallet } = await supabase
        .from("sc_wallets")
        .select("*")
        .eq("division", reward.division)
        .is("user_id", null)
        .maybeSingle();

      let walletId = wallet?.id;

      if (!wallet) {
        const { data: created } = await supabase
          .from("sc_wallets")
          .insert({ division: reward.division, balance: 0, locked: 0 })
          .select()
          .single();
        walletId = created?.id;
      }

      if (walletId) {
        // Update balance
        await supabase
          .from("sc_wallets")
          .update({
            balance: Number(wallet?.balance || 0) + reward.amount,
          })
          .eq("id", walletId);

        // Record ledger
        await supabase.from("sc_ledger").insert({
          wallet_id: walletId,
          tx_type: "reward",
          amount: reward.amount,
          memo: `Reward: ${reward.rule}`,
        });
      }
    }

    // Record emission
    await supabase.from("sc_emissions").insert({
      epoch_date: now.toISOString().split("T")[0],
      total_emitted_sc: totalEmitted,
      schedule_version: "v1",
    });

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "sc_award_rewards",
      user_id: user.id,
      log_level: "info",
      result: `Awarded ${totalEmitted.toFixed(2)} SC across ${rewards.length} rules`,
      metadata: { totalEmitted, rewards },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "sc_award_rewards",
      division: "system",
      user_id: user.id,
      action_description: `Awarded ${totalEmitted.toFixed(2)} SC`,
      compliance_status: "compliant",
      data_accessed: { rewards },
    });

    return new Response(
      JSON.stringify({ ok: true, totalEmitted, rewards }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in sc-award-rewards:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
