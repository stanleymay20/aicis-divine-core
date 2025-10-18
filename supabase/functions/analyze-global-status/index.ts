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
    console.log('Analyzing global AICIS status:', { user: user.id });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Gather data from all divisions
    const [
      divisionsData,
      revenueData,
      energyData,
      healthData,
      foodData,
      governanceData,
      defenseData,
      diplomacyData,
      crisisData,
      threatsData,
      anomaliesData
    ] = await Promise.all([
      supabaseClient.from('ai_divisions').select('*'),
      supabaseClient.from('revenue_streams').select('*').order('timestamp', { ascending: false }).limit(10),
      supabaseClient.from('energy_grid').select('*').order('updated_at', { ascending: false }).limit(5),
      supabaseClient.from('health_data').select('*').order('updated_at', { ascending: false }).limit(5),
      supabaseClient.from('food_security').select('*').order('updated_at', { ascending: false }).limit(5),
      supabaseClient.from('gov_policies').select('*').order('last_reviewed', { ascending: false }).limit(5),
      supabaseClient.from('defense_posture').select('*').order('updated_at', { ascending: false }),
      supabaseClient.from('diplo_signals').select('*').order('updated_at', { ascending: false }).limit(5),
      supabaseClient.from('crisis_events').select('*').eq('status', 'escalated'),
      supabaseClient.from('threat_logs').select('*').eq('neutralized', false).order('created_at', { ascending: false }).limit(5),
      supabaseClient.from('anomaly_detections').select('*').eq('status', 'active')
    ]);

    // Compile comprehensive status
    const statusSummary = {
      divisions: divisionsData.data?.length || 0,
      revenue_streams: revenueData.data?.length || 0,
      energy_regions: energyData.data?.length || 0,
      health_regions: healthData.data?.length || 0,
      food_regions: foodData.data?.length || 0,
      governance_policies: governanceData.data?.length || 0,
      defense_regions: defenseData.data?.length || 0,
      diplomacy_countries: diplomacyData.data?.length || 0,
      active_crises: crisisData.data?.length || 0,
      active_threats: threatsData.data?.length || 0,
      active_anomalies: anomaliesData.data?.length || 0,
    };

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
          content: 'You are AICIS Global Intelligence Analyzer. Provide concise, actionable cross-division status reports.'
        }, {
          role: 'user',
          content: `Analyze AICIS global status:\n\nDivisions: ${JSON.stringify(statusSummary, null, 2)}\n\nProvide:\n1. Overall system health (0-100)\n2. Top 3 priorities\n3. Cross-division correlations\n4. Recommended actions\n\nFormat as markdown.`
        }]
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices[0].message.content;

    // Store in intelligence index
    const { data: intelligence, error: insertError } = await supabaseClient
      .from('intelligence_index')
      .insert({
        index_type: 'global_status',
        priority: 10,
        title: 'AICIS Global Status Report',
        summary_md: analysis,
        affected_divisions: ['finance', 'energy', 'health', 'food', 'governance', 'defense', 'diplomacy', 'crisis'],
        metrics: statusSummary,
        confidence_score: 95,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
    }

    const executionTime = Date.now() - startTime;

    // Compliance audit
    await supabaseClient.from('compliance_audit').insert({
      action_type: 'global_status_analysis',
      user_id: user.id,
      action_description: 'Analyzed global AICIS status across all divisions',
      compliance_status: 'compliant',
      data_accessed: { divisions: Object.keys(statusSummary) }
    });

    await supabaseClient.from('system_logs').insert({
      action: 'global_status_analysis',
      division: 'system',
      user_id: user.id,
      log_level: 'info',
      result: 'Global status analyzed',
      metadata: { execution_time_ms: executionTime, metrics: statusSummary }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: '✅ Global status analysis complete',
        analysis,
        metrics: statusSummary,
        intelligence,
        execution_time_ms: executionTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Global status analysis error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});