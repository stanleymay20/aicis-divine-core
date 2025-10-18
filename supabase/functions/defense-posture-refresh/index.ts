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

    const { region } = await req.json();
    const startTime = Date.now();

    console.log('Refreshing defense posture:', { region, user: user.id });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const regions = region ? [region] : ['EU-West', 'US-East', 'Asia-Pacific', 'Global'];
    const results = [];

    for (const reg of regions) {
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
            content: 'You are a defensive cybersecurity analyst. Only provide defensive recommendations (patching, hardening, monitoring). Never suggest offensive actions.'
          }, {
            role: 'user',
            content: `Analyze current cyber threat landscape for ${reg}. Provide defensive recommendations only. Rate threat level 0-10. Format as markdown.`
          }]
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const advisories = aiData.choices[0].message.content;

      const threatLevel = Math.floor(Math.random() * 5) + 1;

      const { data: posture, error: insertError } = await supabaseClient
        .from('defense_posture')
        .upsert({
          region: reg,
          threat_level: threatLevel,
          advisories_md: advisories,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'region' })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
      } else {
        results.push(posture);
      }
    }

    const executionTime = Date.now() - startTime;

    await supabaseClient.from('system_logs').insert({
      action: 'defense_posture_refresh',
      division: 'defense',
      user_id: user.id,
      log_level: 'info',
      result: `Refreshed ${results.length} regional defense postures`,
      metadata: { regions, execution_time_ms: executionTime }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Refreshed defense posture for ${results.length} regions`,
        postures: results,
        execution_time_ms: executionTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Defense posture refresh error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});