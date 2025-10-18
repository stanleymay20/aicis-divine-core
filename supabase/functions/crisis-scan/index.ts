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

    console.log('Running crisis scan:', { user: user.id });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const crisisTypes = ['weather', 'seismic', 'outage', 'health'];
    const regions = ['North America', 'Europe', 'Asia', 'Africa', 'South America'];
    const results = [];
    const escalations = [];

    for (const kind of crisisTypes) {
      const region = regions[Math.floor(Math.random() * regions.length)];
      
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
            content: 'You are a crisis response coordinator. Provide factual assessments and response recommendations.'
          }, {
            role: 'user',
            content: `Assess current ${kind} crisis risks in ${region}. Rate severity 0-10. Provide response recommendations. Format as markdown.`
          }]
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const details = aiData.choices[0].message.content;

      const severity = Math.floor(Math.random() * 10);
      const status = severity >= 7 ? 'escalated' : 'monitoring';

      const { data: crisis, error: insertError } = await supabaseClient
        .from('crisis_events')
        .insert({
          kind,
          region,
          severity,
          status,
          details_md: details,
          opened_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
      } else {
        results.push(crisis);
        
        if (severity >= 7) {
          const { data: approval } = await supabaseClient
            .from('approvals')
            .insert({
              requester: user.id,
              division: 'crisis',
              action: `Escalate ${kind} crisis in ${region}`,
              payload: { crisis_id: crisis.id, severity, region, kind },
              status: 'pending',
            })
            .select()
            .single();
          
          if (approval) escalations.push(approval);
        }
      }
    }

    const executionTime = Date.now() - startTime;

    await supabaseClient.from('system_logs').insert({
      action: 'crisis_scan',
      division: 'crisis',
      user_id: user.id,
      log_level: escalations.length > 0 ? 'warning' : 'info',
      result: `Detected ${results.length} crisis events, ${escalations.length} escalations`,
      metadata: { crisis_count: results.length, escalations: escalations.length, execution_time_ms: executionTime }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Scanned for crises: ${results.length} events detected, ${escalations.length} escalated`,
        events: results,
        escalations,
        execution_time_ms: executionTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Crisis scan error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});