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
    console.log("Collecting division KPIs...");
    const kpis = [];

    // Finance division
    const { data: revenueData } = await supabase
      .from("revenue_streams")
      .select("amount_usd")
      .gte("timestamp", new Date(Date.now() - 24*60*60*1000).toISOString());
    const revenue24h = revenueData?.reduce((sum, r) => sum + Number(r.amount_usd), 0) || 0;
    kpis.push({
      division: "finance",
      metric: { revenue_24h: revenue24h },
      composite_score: Math.min(100, revenue24h / 100),
      risk_score: revenue24h < 1000 ? 60 : 20
    });

    // Energy division
    const { data: energyData } = await supabase
      .from("energy_grid")
      .select("stability_index, renewable_percentage")
      .order("updated_at", { ascending: false })
      .limit(10);
    const avgStability = (energyData?.reduce((s, e) => s + Number(e.stability_index || 0), 0) ?? 0) / (energyData?.length || 1);
    const avgRenewable = (energyData?.reduce((s, e) => s + Number(e.renewable_percentage || 0), 0) ?? 0) / (energyData?.length || 1);
    kpis.push({
      division: "energy",
      metric: { avg_stability: avgStability, avg_renewable: avgRenewable },
      composite_score: avgStability,
      risk_score: 100 - avgStability
    });

    // Health division
    const { data: healthData } = await supabase
      .from("health_data")
      .select("severity_index")
      .order("updated_at", { ascending: false })
      .limit(10);
    const avgSeverity = (healthData?.reduce((s, h) => s + Number(h.severity_index || 0), 0) ?? 0) / (healthData?.length || 1);
    kpis.push({
      division: "health",
      metric: { avg_severity: avgSeverity },
      composite_score: Math.max(0, 100 - avgSeverity),
      risk_score: avgSeverity
    });

    // Food division
    const { data: foodData } = await supabase
      .from("food_security")
      .select("yield_index")
      .order("updated_at", { ascending: false })
      .limit(10);
    const avgYield = (foodData?.reduce((s, f) => s + Number(f.yield_index || 0), 0) ?? 0) / (foodData?.length || 1) || 50;
    kpis.push({
      division: "food",
      metric: { avg_yield: avgYield },
      composite_score: avgYield,
      risk_score: 100 - avgYield
    });

    // Crisis division
    const { data: crisisData } = await supabase
      .from("crisis_events")
      .select("*")
      .neq("status", "resolved");
    const activeCrises = crisisData?.length || 0;
    kpis.push({
      division: "crisis",
      metric: { active_crises: activeCrises },
      composite_score: Math.max(0, 100 - activeCrises * 10),
      risk_score: Math.min(100, activeCrises * 10)
    });

    // Defense, diplomacy, governance - placeholder metrics
    ["defense", "diplomacy", "governance", "system"].forEach(div => {
      kpis.push({
        division: div,
        metric: { status: "nominal" },
        composite_score: 80,
        risk_score: 20
      });
    });

    // Insert all KPIs
    const { data: inserted, error: insertError } = await supabase
      .from("division_kpis")
      .insert(kpis)
      .select();

    if (insertError) throw insertError;

    await supabase.from("system_logs").insert({
      action: "collect_division_kpis",
      result: `Collected KPIs for ${kpis.length} divisions`,
      log_level: "info",
      division: "system"
    });

    console.log(`KPIs collected for ${kpis.length} divisions`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        divisions: kpis.length,
        kpis: inserted 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error collecting KPIs:", error);
    
    await supabase.from("system_logs").insert({
      action: "collect_division_kpis",
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
