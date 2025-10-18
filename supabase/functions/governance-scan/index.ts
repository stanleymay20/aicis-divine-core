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

    const { jurisdiction, topics } = await req.json();
    const startTime = Date.now();

    console.log('Running governance scan:', { jurisdiction, topics, user: user.id });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const topicsArray = Array.isArray(topics) ? topics : [topics || 'AI'];
    const results = [];

    for (const topic of topicsArray) {
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
            content: 'You are a legal compliance analyst. Provide concise, factual policy summaries.'
          }, {
            role: 'user',
            content: `Summarize current ${jurisdiction} regulations on ${topic}. Include compliance recommendations and key requirements. Format as markdown.`
          }]
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const summary = aiData.choices[0].message.content;

      const complianceLevel = summary.toLowerCase().includes('compliant') ? 'compliant' :
                             summary.toLowerCase().includes('review') ? 'review' : 
                             'non-compliant';

      const { data: policy, error: insertError } = await supabaseClient
        .from('gov_policies')
        .upsert({
          jurisdiction,
          topic,
          summary_md: summary,
          compliance_level: complianceLevel,
          last_reviewed: new Date().toISOString(),
        }, { onConflict: 'jurisdiction,topic' })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
      } else {
        results.push(policy);
      }
    }

    const executionTime = Date.now() - startTime;

    await supabaseClient.from('system_logs').insert({
      action: 'governance_scan',
      division: 'governance',
      user_id: user.id,
      log_level: 'info',
      result: `Scanned ${results.length} policies for ${jurisdiction}`,
      metadata: { jurisdiction, topics: topicsArray, execution_time_ms: executionTime }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Scanned ${results.length} ${jurisdiction} policies`,
        policies: results,
        execution_time_ms: executionTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Governance scan error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});