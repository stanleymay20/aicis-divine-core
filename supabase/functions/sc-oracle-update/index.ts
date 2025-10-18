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

    // Calculate synthetic SC value from Intelligence Score
    // Get recent data for composite calculation
    const [
      { data: revenue },
      { data: energy },
      { data: health },
      { data: food },
      { data: crisis },
    ] = await Promise.all([
      supabase
        .from("revenue_streams")
        .select("amount_usd")
        .gte("timestamp", new Date(Date.now() - 24 * 3600e3).toISOString()),
      supabase
        .from("energy_grid")
        .select("stability_index")
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("health_data")
        .select("severity_index")
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("food_security")
        .select("yield_index")
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase.from("crisis_events").select("id").in("status", ["monitoring", "escalated"]),
    ]);

    const totalRev =
      (revenue ?? []).reduce((a: number, b: any) => a + Number(b.amount_usd || 0), 0);
    const avgStability =
      (energy ?? []).reduce((a: number, b: any) => a + Number(b.stability_index || 0), 0) /
      Math.max(1, (energy ?? []).length);
    const avgHealth =
      (health ?? []).reduce((a: number, b: any) => a + Number(b.severity_index || 0), 0) /
      Math.max(1, (health ?? []).length);
    const avgFoodIdx =
      (food ?? []).reduce((a: number, b: any) => a + Number(b.yield_index || 0), 0) /
      Math.max(1, (food ?? []).length);
    const activeCrises = (crisis ?? []).length;

    // Calculate Intelligence Score (same as ExecutivePanel)
    const financeScore = Math.min(100, Math.log10(1 + Math.max(0, totalRev)) * 20);
    const energyScore = avgStability;
    const healthScore = Math.max(0, 100 - avgHealth);
    const foodScore = Math.max(0, 100 - (100 - avgFoodIdx));
    const crisisScore = Math.max(0, 100 - activeCrises * 10);

    const intelligenceScore =
      0.3 * financeScore +
      0.25 * energyScore +
      0.2 * healthScore +
      0.15 * foodScore +
      0.1 * crisisScore;

    // Synthetic SC reference value (for display only, not trading)
    const scValue = Number((intelligenceScore / 100).toFixed(6));

    // Store in oracle
    await supabase.from("sc_oracle_prices").insert({
      source: "aicis_intelligence",
      symbol: "SC",
      value: scValue,
    });

    // Log
    await supabase.from("system_logs").insert({
      division: "system",
      action: "sc_oracle_update",
      user_id: user.id,
      log_level: "info",
      result: `SC reference updated: ${scValue}`,
      metadata: { scValue, intelligenceScore },
    });

    await supabase.from("compliance_audit").insert({
      action_type: "sc_oracle_update",
      division: "system",
      user_id: user.id,
      action_description: "Updated SC oracle price",
      compliance_status: "compliant",
      data_accessed: { scValue },
    });

    return new Response(
      JSON.stringify({ ok: true, scValue, intelligenceScore }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error in sc-oracle-update:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
