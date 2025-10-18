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

    console.log('Generating comprehensive health & food security report...');

    // Fetch both health and food security data
    const [healthResult, foodResult] = await Promise.all([
      supabaseClient.from('health_data').select('*').order('risk_level', { ascending: false }),
      supabaseClient.from('food_security').select('*').order('alert_level', { ascending: false })
    ]);

    if (healthResult.error) throw healthResult.error;
    if (foodResult.error) throw foodResult.error;

    // Use Lovable AI to generate comprehensive report
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
            content: 'You are J.A.R.V.I.S., an executive AI generating comprehensive daily reports on global health and food security. Format in clean markdown with clear sections and actionable insights.'
          },
          {
            role: 'user',
            content: `Generate a comprehensive executive report covering:\n\n**HEALTH DATA:**\n${JSON.stringify(healthResult.data, null, 2)}\n\n**FOOD SECURITY DATA:**\n${JSON.stringify(foodResult.data, null, 2)}\n\nInclude:\n# Executive Summary\n# Critical Health Alerts\n# Food Security Status\n# Cross-Impact Analysis\n# Priority Recommendations\n# 24-Hour Outlook`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`Report generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reportContent = aiData.choices[0].message.content;

    // Store the report
    const { error: insertError } = await supabaseClient.from('ai_reports').insert({
      report_type: 'health_food_security',
      content: reportContent,
      generated_by: user.id
    });

    if (insertError) throw insertError;

    // Log report generation
    await supabaseClient.from('system_logs').insert({
      action: 'health_food_report_generated',
      details: `Generated comprehensive health & food security report`,
      performed_by: user.id
    });

    console.log('Health & food security report generated successfully');

    return new Response(JSON.stringify({
      success: true,
      report: reportContent,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-health-report:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
