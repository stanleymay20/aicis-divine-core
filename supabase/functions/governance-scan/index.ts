import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const InputSchema = z.object({
  jurisdiction: z.string().min(1).max(100).optional(),
  topics: z.array(z.string().min(1).max(100)).min(1).max(20).optional(),
  topic: z.string().min(1).max(100).optional(),
  country: z.string().min(1).max(100).optional(),
});

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

    const body = await req.json().catch(() => ({}));
    
    // Validate input
    const validation = InputSchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ 
        error: 'Invalid input', 
        details: validation.error.issues 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { jurisdiction, topics, topic, country } = validation.data;
    const startTime = Date.now();

    // Resolve jurisdiction dynamically
    const resolvedJurisdiction = jurisdiction || country || 'Global';
    
    // Build topics array dynamically
    let topicsArray: string[] = [];
    if (topics && topics.length > 0) {
      topicsArray = topics;
    } else if (topic) {
      topicsArray = [topic];
    } else {
      // Default comprehensive topic list for global governance scan
      topicsArray = ['AI Regulation', 'Data Protection', 'Cybersecurity', 'Trade Policy', 'Environmental'];
    }

    console.log('Running governance scan:', { jurisdiction: resolvedJurisdiction, topics: topicsArray, user: user.id });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const results = [];

    for (const topicName of topicsArray) {
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
            content: 'You are a legal compliance analyst. Provide concise, factual policy summaries. Include compliance level as one of: compliant, review, non-compliant.'
          }, {
            role: 'user',
            content: `Summarize current ${resolvedJurisdiction} regulations on ${topicName}. Include compliance recommendations and key requirements. Format as markdown.`
          }]
        }),
      });

      if (!aiResponse.ok) {
        console.error(`AI API error for ${topicName}: ${aiResponse.status}`);
        continue;
      }

      const aiData = await aiResponse.json();
      const summary = aiData.choices[0].message.content;

      const complianceLevel = summary.toLowerCase().includes('non-compliant') ? 'non-compliant' :
                             summary.toLowerCase().includes('review') ? 'review' : 
                             'compliant';

      const { data: policy, error: insertError } = await supabaseClient
        .from('gov_policies')
        .upsert({
          jurisdiction: resolvedJurisdiction,
          topic: topicName,
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
      result: `Scanned ${results.length} policies for ${resolvedJurisdiction}`,
      metadata: { jurisdiction: resolvedJurisdiction, topics: topicsArray, execution_time_ms: executionTime }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Scanned ${results.length} ${resolvedJurisdiction} policies`,
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
