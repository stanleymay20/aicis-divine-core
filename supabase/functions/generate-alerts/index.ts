import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Scanning for critical conditions...');

    const alerts = [];

    // Check food security
    const { data: foodData } = await supabase
      .from('food_security')
      .select('*')
      .eq('alert_level', 'critical')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (foodData && foodData.length > 0) {
      for (const food of foodData) {
        alerts.push({
          severity: 'critical',
          title: `Critical Food Shortage: ${food.region}`,
          message: `${food.crop} supply critically low with ${food.supply_days} days remaining. Immediate intervention required.`,
          division: 'food',
          country: food.region,
          metadata: { source: 'food_security', record_id: food.id }
        });
      }
    }

    // Check health crises
    const { data: healthData } = await supabase
      .from('health_data')
      .select('*')
      .eq('risk_level', 'critical')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (healthData && healthData.length > 0) {
      for (const health of healthData) {
        alerts.push({
          severity: 'critical',
          title: `Health Crisis: ${health.region}`,
          message: `${health.disease} outbreak with severity index ${health.severity_index}. Affected: ${health.affected_count} individuals.`,
          division: 'health',
          country: health.region,
          metadata: { source: 'health_data', record_id: health.id }
        });
      }
    }

    // Check energy grid instability
    const { data: energyData } = await supabase
      .from('energy_grid')
      .select('*')
      .eq('outage_risk', 'risk')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (energyData && energyData.length > 0) {
      for (const energy of energyData) {
        alerts.push({
          severity: 'high',
          title: `Grid Instability: ${energy.region}`,
          message: `Power grid at ${energy.grid_load}% capacity with ${energy.stability_index}% stability. Outage risk elevated.`,
          division: 'energy',
          country: energy.region,
          metadata: { source: 'energy_grid', record_id: energy.id }
        });
      }
    }

    // Check crisis events
    const { data: crisisData } = await supabase
      .from('crisis_events')
      .select('*')
      .eq('status', 'monitoring')
      .gte('severity', 7)
      .order('opened_at', { ascending: false })
      .limit(10);

    if (crisisData && crisisData.length > 0) {
      for (const crisis of crisisData) {
        alerts.push({
          severity: crisis.severity >= 9 ? 'critical' : 'high',
          title: `${crisis.kind}: ${crisis.region}`,
          message: crisis.details_md || `Severity ${crisis.severity} event requiring immediate attention.`,
          division: 'crisis',
          country: crisis.region,
          metadata: { source: 'crisis_events', record_id: crisis.id }
        });
      }
    }

    // Check vulnerability scores
    const { data: vulnData } = await supabase
      .from('vulnerability_scores')
      .select('*')
      .gte('overall_score', 75)
      .order('overall_score', { ascending: false })
      .limit(10);

    if (vulnData && vulnData.length > 0) {
      for (const vuln of vulnData) {
        alerts.push({
          severity: vuln.overall_score >= 85 ? 'high' : 'medium',
          title: `High Vulnerability: ${vuln.country}`,
          message: `Vulnerability index ${vuln.overall_score} detected. Health: ${vuln.health_risk}, Food: ${vuln.food_risk}, Energy: ${vuln.energy_risk}.`,
          division: 'intelligence',
          country: vuln.country,
          metadata: { source: 'vulnerability_scores', record_id: vuln.id }
        });
      }
    }

    // Insert alerts
    let inserted = 0;
    for (const alert of alerts) {
      // Check if similar alert exists recently
      const { data: existing } = await supabase
        .from('alerts')
        .select('id')
        .eq('title', alert.title)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!existing || existing.length === 0) {
        const { error } = await supabase.from('alerts').insert(alert);
        if (!error) inserted++;
      }
    }

    console.log(`Generated ${inserted} new alerts`);

    await supabase.from('system_logs').insert({
      division: 'intelligence',
      action: 'generate_alerts',
      result: 'success',
      log_level: 'info',
      metadata: { alerts_generated: inserted, conditions_scanned: alerts.length }
    });

    return new Response(
      JSON.stringify({ success: true, alerts_generated: inserted, total_conditions: alerts.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating alerts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
