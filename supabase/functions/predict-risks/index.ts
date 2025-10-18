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

    const { divisions } = await req.json();
    const startTime = Date.now();

    console.log('Predicting risks:', { divisions, user: user.id });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const targetDivisions = divisions || ['finance', 'energy', 'health', 'food', 'governance', 'defense', 'diplomacy', 'crisis'];

    // Gather historical data for trend analysis
    const [
      recentEvents,
      anomalies,
      crises,
      threats,
      defensePosture
    ] = await Promise.all([
      supabaseClient.from('intel_events').select('*').in('division', targetDivisions).order('published_at', { ascending: false }).limit(20),
      supabaseClient.from('anomaly_detections').select('*').in('division', targetDivisions).eq('status', 'active'),
      supabaseClient.from('crisis_events').select('*').in('status', ['monitoring', 'escalated']),
      supabaseClient.from('threat_logs').select('*').eq('neutralized', false),
      supabaseClient.from('defense_posture').select('*').order('threat_level', { ascending: false })
    ]);

    const historicalData = {
      recent_events: recentEvents.data?.length || 0,
      active_anomalies: anomalies.data?.length || 0,
      active_crises: crises.data?.length || 0,
      active_threats: threats.data?.length || 0,
      max_threat_level: defensePosture.data?.[0]?.threat_level || 0,
    };

    // Use AI to predict risks
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
          content: 'You are AICIS Predictive Risk Analyzer. Generate data-driven risk forecasts with probabilities and mitigation strategies.'
        }, {
          role: 'user',
          content: `Predict risks for AICIS divisions: ${targetDivisions.join(', ')}\n\nHistorical Data:\n${JSON.stringify(historicalData, null, 2)}\n\nGenerate 3-5 risk predictions with:\n1. Risk title\n2. Affected divisions\n3. Probability (0-100%)\n4. Impact score (0-100)\n5. Risk level (low/medium/high/critical)\n6. Timeframe\n7. Indicators\n8. Mitigation strategies\n\nFormat as JSON array.`
        }]
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const predictionsText = aiData.choices[0].message.content;
    
    // Parse AI response
    let predictions;
    try {
      const jsonMatch = predictionsText.match(/\[[\s\S]*\]/);
      predictions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      predictions = [{
        title: 'Risk Analysis Generated',
        affected_divisions: targetDivisions,
        probability: 50,
        impact_score: 50,
        risk_level: 'medium',
        description: predictionsText,
        predicted_timeframe: 'Next 30 days',
        confidence_level: 70
      }];
    }

    const results = [];

    // Store predictions
    for (const pred of predictions) {
      const { data: risk, error: insertError } = await supabaseClient
        .from('risk_predictions')
        .insert({
          prediction_type: 'ai_forecast',
          affected_divisions: pred.affected_divisions || targetDivisions,
          risk_level: pred.risk_level || 'medium',
          probability: pred.probability || 50,
          impact_score: pred.impact_score || 50,
          title: pred.title || 'Predicted Risk',
          description_md: pred.description || predictionsText,
          indicators: pred.indicators || {},
          mitigation_strategies_md: pred.mitigation_strategies || 'Review and monitor indicators',
          predicted_timeframe: pred.predicted_timeframe || 'Next 30 days',
          confidence_level: pred.confidence_level || 70,
          model_version: 'gemini-2.5-flash'
        })
        .select()
        .single();

      if (!insertError && risk) {
        results.push(risk);
      }
    }

    const executionTime = Date.now() - startTime;

    // Compliance audit
    await supabaseClient.from('compliance_audit').insert({
      action_type: 'risk_prediction',
      user_id: user.id,
      action_description: `Predicted ${results.length} risks for ${targetDivisions.length} divisions`,
      compliance_status: 'compliant',
      data_accessed: { divisions: targetDivisions }
    });

    await supabaseClient.from('system_logs').insert({
      action: 'risk_prediction',
      division: 'system',
      user_id: user.id,
      log_level: 'info',
      result: `Predicted ${results.length} risks`,
      metadata: { divisions: targetDivisions, execution_time_ms: executionTime }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Generated ${results.length} risk predictions`,
        predictions: results,
        execution_time_ms: executionTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Risk prediction error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});