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
    const authHeader = req.headers.get('Authorization')!;
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // Fetch all relevant data
    const { data: revenues } = await supabaseClient
      .from('revenue_streams')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: divisions } = await supabaseClient
      .from('ai_divisions')
      .select('*');

    const { data: threats } = await supabaseClient
      .from('threat_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Use AI to generate executive report
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
            content: 'You are AICIS Executive AI Report Generator. Create comprehensive daily executive reports covering all divisions, revenue, threats, and strategic recommendations. Format as professional markdown.'
          },
          { 
            role: 'user', 
            content: `Generate today's executive report:\n\nRevenue: ${JSON.stringify(revenues)}\n\nDivisions: ${JSON.stringify(divisions)}\n\nThreats: ${JSON.stringify(threats)}` 
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('AI report generation failed');
    }

    const aiData = await aiResponse.json();
    const reportContent = aiData.choices[0].message.content;

    // Store the report
    const { data: report } = await supabaseClient
      .from('ai_reports')
      .insert({
        title: `AICIS Executive Report - ${new Date().toLocaleDateString()}`,
        content: reportContent,
        division: 'executive'
      })
      .select()
      .single();

    // Log activity
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'executive',
      action: 'report_generation',
      result: 'success',
      log_level: 'info',
      metadata: { report_id: report?.id }
    });

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-financial-report:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
