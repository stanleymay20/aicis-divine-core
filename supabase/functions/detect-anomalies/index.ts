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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const startTime = Date.now();
    console.log('Detecting anomalies across divisions:', { user: user.id });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Gather current metrics from all divisions
    const [
      revenueData,
      energyData,
      healthData,
      foodData,
      defenseData,
      diplomacyData,
      crisisData
    ] = await Promise.all([
      supabaseClient.from('revenue_streams').select('*').order('timestamp', { ascending: false }).limit(20),
      supabaseClient.from('energy_grid').select('*').order('updated_at', { ascending: false }),
      supabaseClient.from('health_data').select('*').order('updated_at', { ascending: false }),
      supabaseClient.from('food_security').select('*').order('updated_at', { ascending: false }),
      supabaseClient.from('defense_posture').select('*').order('updated_at', { ascending: false }),
      supabaseClient.from('diplo_signals').select('*').order('updated_at', { ascending: false }),
      supabaseClient.from('crisis_events').select('*').order('opened_at', { ascending: false }).limit(20)
    ]);

    const divisionsToCheck = [
      { name: 'finance', data: revenueData.data, key: 'amount_usd' },
      { name: 'energy', data: energyData.data, key: 'grid_load' },
      { name: 'health', data: healthData.data, key: 'affected_count' },
      { name: 'food', data: foodData.data, key: 'yield_index' },
      { name: 'defense', data: defenseData.data, key: 'threat_level' },
      { name: 'diplomacy', data: diplomacyData.data, key: 'risk_index' },
      { name: 'crisis', data: crisisData.data, key: 'severity' }
    ];

    const detectedAnomalies = [];

    for (const division of divisionsToCheck) {
      if (!division.data || division.data.length < 5) continue;

      // Calculate baseline (average of last records)
      const values = division.data
        .slice(0, 10)
        .map((d: any) => parseFloat(d[division.key]) || 0)
        .filter(v => !isNaN(v));

      if (values.length < 3) continue;

      const baseline = values.reduce((a, b) => a + b, 0) / values.length;
      const current = values[0];
      const deviation = ((current - baseline) / baseline) * 100;

      // Detect anomaly if deviation > 30%
      if (Math.abs(deviation) > 30) {
        const severity = Math.abs(deviation) > 70 ? 'critical' :
                        Math.abs(deviation) > 50 ? 'high' :
                        Math.abs(deviation) > 30 ? 'medium' : 'low';

        // Use AI to analyze
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'system',
              content: 'You are AICIS Anomaly Analyzer. Provide brief anomaly assessments.'
            }, {
              role: 'user',
              content: `Anomaly detected in ${division.name} division:\n\nMetric: ${division.key}\nBaseline: ${baseline.toFixed(2)}\nCurrent: ${current.toFixed(2)}\nDeviation: ${deviation.toFixed(1)}%\n\nAnalyze cause and recommend action. Keep brief.`
            }]
          }),
        });

        let analysis = 'Anomaly detected - manual review recommended';
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          analysis = aiData.choices[0].message.content;
        }

        const { data: anomaly } = await supabaseClient
          .from('anomaly_detections')
          .insert({
            division: division.name,
            anomaly_type: `${division.key}_deviation`,
            severity,
            description: analysis,
            metrics: { current, baseline, [division.key]: current },
            baseline_metrics: { [division.key]: baseline },
            deviation_percentage: deviation,
            status: 'active'
          })
          .select()
          .single();

        if (anomaly) {
          detectedAnomalies.push(anomaly);

          // Publish to intel bus
          await supabaseClient.from('intel_events').insert({
            division: division.name,
            event_type: 'anomaly_detected',
            severity: severity === 'critical' ? 'emergency' : 'warning',
            title: `Anomaly: ${division.key} ${deviation > 0 ? 'spike' : 'drop'}`,
            description: analysis,
            payload: { anomaly_id: anomaly.id, deviation_percentage: deviation },
            source_system: 'anomaly_detector',
            published_by: user.id
          });
        }
      }
    }

    const executionTime = Date.now() - startTime;

    // Compliance audit
    await supabaseClient.from('compliance_audit').insert({
      action_type: 'anomaly_detection',
      user_id: user.id,
      action_description: `Detected ${detectedAnomalies.length} anomalies across divisions`,
      compliance_status: 'compliant',
      data_accessed: { divisions: divisionsToCheck.map(d => d.name) }
    });

    await supabaseClient.from('system_logs').insert({
      action: 'anomaly_detection',
      division: 'system',
      user_id: user.id,
      log_level: detectedAnomalies.length > 0 ? 'warning' : 'info',
      result: `Detected ${detectedAnomalies.length} anomalies`,
      metadata: { anomalies: detectedAnomalies.length, execution_time_ms: executionTime }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Anomaly scan complete: ${detectedAnomalies.length} detected`,
        anomalies: detectedAnomalies,
        execution_time_ms: executionTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Anomaly detection error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});