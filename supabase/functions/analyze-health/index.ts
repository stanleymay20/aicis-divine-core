import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    console.log('Starting health data analysis...');

    // Fetch current health data
    const { data: healthData, error: fetchError } = await supabaseClient
      .from('health_data')
      .select('*')
      .order('risk_level', { ascending: false });

    if (fetchError) throw fetchError;

    // Use Lovable AI to analyze health risks
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an advanced healthcare AI analyzing disease patterns and outbreak risks. Provide concise risk assessments and recommendations.'
          },
          {
            role: 'user',
            content: `Analyze this health data and identify critical risks:\n\n${JSON.stringify(healthData, null, 2)}\n\nProvide: 1) Most critical threats, 2) Risk trends, 3) Intervention recommendations.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices[0].message.content;

    // Calculate metrics
    const totalCases = healthData?.reduce((sum, record) => sum + (record.affected_count || 0), 0) || 0;
    const criticalRegions = healthData?.filter(r => r.risk_level === 'critical').length || 0;
    const highRiskRegions = healthData?.filter(r => r.risk_level === 'high').length || 0;

    // Log the analysis
    await supabaseClient.from('system_logs').insert({
      action: 'health_analysis',
      details: `Analyzed ${healthData?.length || 0} health records. Critical: ${criticalRegions}, High Risk: ${highRiskRegions}`,
      performed_by: user.id
    });

    console.log('Health analysis completed successfully');

    return new Response(JSON.stringify({
      success: true,
      metrics: {
        total_cases: totalCases,
        critical_regions: criticalRegions,
        high_risk_regions: highRiskRegions,
        total_tracked: healthData?.length || 0
      },
      analysis,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-health:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
