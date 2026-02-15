import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resilientCall, structuredLog, handleCors, errorResponse, jsonResponse } from "../_shared/resilience.ts";

const FN = "detect-anomalies";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const start = Date.now();

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    structuredLog('info', FN, 'Starting anomaly detection', { user_id: user.id });

    const [revenueData, energyData, healthData, foodData, defenseData, diplomacyData, crisisData] = await Promise.all([
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

      const values = division.data.slice(0, 10)
        .map((d: any) => parseFloat(d[division.key]) || 0)
        .filter((v: number) => !isNaN(v));
      if (values.length < 3) continue;

      const baseline = values.reduce((a: number, b: number) => a + b, 0) / values.length;
      const current = values[0];
      const deviation = ((current - baseline) / baseline) * 100;

      if (Math.abs(deviation) > 30) {
        const severity = Math.abs(deviation) > 70 ? 'critical' :
                        Math.abs(deviation) > 50 ? 'high' : 'medium';

        const analysis = await resilientCall(`${FN}:ai:${division.name}`, async () => {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [{
                role: 'system', content: 'You are AICIS Anomaly Analyzer. Provide brief anomaly assessments.'
              }, {
                role: 'user',
                content: `Anomaly detected in ${division.name} division:\n\nMetric: ${division.key}\nBaseline: ${baseline.toFixed(2)}\nCurrent: ${current.toFixed(2)}\nDeviation: ${deviation.toFixed(1)}%\n\nAnalyze cause and recommend action. Keep brief.`
              }]
            }),
          });
          if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);
          const aiData = await aiResponse.json();
          return aiData.choices[0].message.content;
        }, { maxRetries: 1, timeoutMs: 15000 }).catch(() => 'Anomaly detected - manual review recommended');

        const { data: anomaly } = await supabaseClient
          .from('anomaly_detections')
          .insert({
            division: division.name, anomaly_type: `${division.key}_deviation`,
            severity, description: analysis,
            metrics: { current, baseline, [division.key]: current },
            baseline_metrics: { [division.key]: baseline },
            deviation_percentage: deviation, status: 'active'
          })
          .select().single();

        if (anomaly) {
          detectedAnomalies.push(anomaly);
          await supabaseClient.from('intel_events').insert({
            division: division.name, event_type: 'anomaly_detected',
            severity: severity === 'critical' ? 'emergency' : 'warning',
            title: `Anomaly: ${division.key} ${deviation > 0 ? 'spike' : 'drop'}`,
            description: analysis,
            payload: { anomaly_id: anomaly.id, deviation_percentage: deviation },
            source_system: 'anomaly_detector', published_by: user.id
          });
        }
      }
    }

    await supabaseClient.from('compliance_audit').insert({
      action_type: 'anomaly_detection', user_id: user.id,
      action_description: `Detected ${detectedAnomalies.length} anomalies across divisions`,
      compliance_status: 'compliant',
      data_accessed: { divisions: divisionsToCheck.map(d => d.name) }
    });

    await supabaseClient.from('system_logs').insert({
      action: 'anomaly_detection', division: 'system', user_id: user.id,
      log_level: detectedAnomalies.length > 0 ? 'warning' : 'info',
      result: `Detected ${detectedAnomalies.length} anomalies`,
      metadata: { anomalies: detectedAnomalies.length, execution_time_ms: Date.now() - start }
    });

    structuredLog('info', FN, `Complete: ${detectedAnomalies.length} anomalies`, undefined, start);
    return jsonResponse({
      success: true, message: `Anomaly scan complete: ${detectedAnomalies.length} detected`,
      anomalies: detectedAnomalies, execution_time_ms: Date.now() - start
    });
  } catch (error) {
    structuredLog('error', FN, (error as Error).message, undefined, start);
    return errorResponse(error);
  }
});
