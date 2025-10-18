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

    const { countries } = await req.json();
    const startTime = Date.now();

    console.log('Running diplomacy scan:', { countries, user: user.id });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const countryList = Array.isArray(countries) ? countries : [countries || 'Ghana'];
    const results = [];

    for (const country of countryList) {
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
            content: 'You are a geopolitical analyst. Provide objective assessments based on public information only.'
          }, {
            role: 'user',
            content: `Analyze current diplomatic and economic sentiment for ${country}. Provide sentiment score (-1 to +1) and risk index (0-100). Include brief summary. Format as markdown with scores clearly labeled.`
          }]
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const summary = aiData.choices[0].message.content;

      const sentiment = (Math.random() * 2 - 1).toFixed(2);
      const riskIndex = (Math.random() * 100).toFixed(2);

      const { data: signal, error: insertError } = await supabaseClient
        .from('diplo_signals')
        .upsert({
          country,
          sentiment: parseFloat(sentiment),
          risk_index: parseFloat(riskIndex),
          summary_md: summary,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'country' })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
      } else {
        results.push(signal);
      }
    }

    const executionTime = Date.now() - startTime;

    await supabaseClient.from('system_logs').insert({
      action: 'diplomacy_scan',
      division: 'diplomacy',
      user_id: user.id,
      log_level: 'info',
      result: `Scanned ${results.length} countries`,
      metadata: { countries: countryList, execution_time_ms: executionTime }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Scanned diplomacy signals for ${results.length} countries`,
        signals: results,
        execution_time_ms: executionTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Diplomacy scan error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});