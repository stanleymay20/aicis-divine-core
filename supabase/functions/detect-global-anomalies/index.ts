import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    console.log("Detecting global anomalies across all divisions...");

    const anomalies = [];

    // Finance: Detect unusual price movements
    const { data: recentRevenue } = await supabase
      .from('revenue_streams')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(50);

    if (recentRevenue && recentRevenue.length > 10) {
      const avgRevenue = recentRevenue.slice(0, 10).reduce((sum, r) => sum + Number(r.amount), 0) / 10;
      const stdDev = Math.sqrt(
        recentRevenue.slice(0, 10).reduce((sum, r) => sum + Math.pow(Number(r.amount) - avgRevenue, 2), 0) / 10
      );
      
      const latestRevenue = Number(recentRevenue[0].amount);
      if (Math.abs(latestRevenue - avgRevenue) > 2 * stdDev) {
        anomalies.push({
          anomaly_type: 'revenue_spike',
          division: 'finance',
          severity: latestRevenue > avgRevenue ? 'medium' : 'high',
          description: `Unusual revenue ${latestRevenue > avgRevenue ? 'increase' : 'decrease'} detected: ${latestRevenue.toFixed(2)} vs avg ${avgRevenue.toFixed(2)}`,
          metrics: { current: latestRevenue, average: avgRevenue, std_dev: stdDev },
          baseline_metrics: { average: avgRevenue },
          deviation_percentage: ((latestRevenue - avgRevenue) / avgRevenue * 100).toFixed(2)
        });
      }
    }

    // Energy: Detect grid instability
    const { data: recentEnergy } = await supabase
      .from('energy_grid')
      .select('*')
      .lt('stability_index', 75)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (recentEnergy && recentEnergy.length > 3) {
      anomalies.push({
        anomaly_type: 'grid_instability',
        division: 'energy',
        severity: 'high',
        description: `${recentEnergy.length} regions experiencing grid instability`,
        metrics: { affected_regions: recentEnergy.length, regions: recentEnergy.map(e => e.region) },
        baseline_metrics: { expected_stability: 95 },
        deviation_percentage: null
      });
    }

    // Health: Detect disease outbreak acceleration
    const { data: recentHealth } = await supabase
      .from('health_data')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (recentHealth && recentHealth.length > 5) {
      const diseaseGroups: any = {};
      recentHealth.forEach(h => {
        if (!diseaseGroups[h.disease]) diseaseGroups[h.disease] = [];
        diseaseGroups[h.disease].push(h.affected_count);
      });

      for (const [disease, counts] of Object.entries<number[]>(diseaseGroups)) {
        if (counts.length >= 2) {
          const recent = counts[0];
          const previous = counts[1];
          const growthRate = ((recent - previous) / previous) * 100;

          if (growthRate > 50) {
            anomalies.push({
              anomaly_type: 'outbreak_acceleration',
              division: 'health',
              severity: 'critical',
              description: `Rapid ${disease} outbreak growth detected: ${growthRate.toFixed(1)}% increase`,
              metrics: { disease, current_cases: recent, previous_cases: previous, growth_rate: growthRate },
              baseline_metrics: { previous_cases: previous },
              deviation_percentage: growthRate.toFixed(2)
            });
          }
        }
      }
    }

    // Food: Detect supply chain disruption
    const { data: recentFood } = await supabase
      .from('food_security')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(20);

    if (recentFood && recentFood.length > 5) {
      const criticalSupply = recentFood.filter(f => f.supply_days && f.supply_days < 30);
      if (criticalSupply.length > 3) {
        anomalies.push({
          anomaly_type: 'supply_shortage',
          division: 'food',
          severity: 'high',
          description: `${criticalSupply.length} regions with critical food supply (<30 days)`,
          metrics: { affected_regions: criticalSupply.length, regions: criticalSupply.map(f => f.region) },
          baseline_metrics: { expected_supply_days: 90 },
          deviation_percentage: null
        });
      }
    }

    // Crisis: Detect surge in active events
    const { count: activeCrises } = await supabase
      .from('crisis_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    if (activeCrises && activeCrises > 5) {
      anomalies.push({
        anomaly_type: 'crisis_surge',
        division: 'crisis',
        severity: 'critical',
        description: `Unusual number of active crisis events: ${activeCrises}`,
        metrics: { active_count: activeCrises },
        baseline_metrics: { expected_active: 2 },
        deviation_percentage: ((activeCrises - 2) / 2 * 100).toFixed(2)
      });
    }

    // Insert anomalies
    if (anomalies.length > 0) {
      for (const anomaly of anomalies) {
        await supabase.from('anomaly_detections').insert(anomaly);
      }

      // Notify about critical anomalies
      const criticalAnomalies = anomalies.filter(a => a.severity === 'critical');
      for (const anomaly of criticalAnomalies) {
        await supabase.from('notifications').insert({
          type: 'alert',
          title: `Critical Anomaly: ${anomaly.anomaly_type}`,
          message: anomaly.description,
          division: anomaly.division,
          user_id: user.id
        });
      }
    }

    await supabase.from('system_logs').insert({
      level: anomalies.some(a => a.severity === 'critical') ? 'error' : 'warning',
      category: 'anomaly_detection',
      message: `Detected ${anomalies.length} anomalies`,
      metadata: { anomaly_count: anomalies.length }
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: "Anomaly detection complete",
        anomalies_count: anomalies.length,
        anomalies 
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("detect-global-anomalies error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
