import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const InputSchema = z.object({
  region: z.string().min(1).max(100).optional(),
  regions: z.array(z.string().min(1).max(100)).min(1).max(20).optional(),
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

    const { region, regions, country } = validation.data;
    const startTime = Date.now();

    // Build regions list dynamically
    let regionList: string[] = [];
    
    if (regions && regions.length > 0) {
      regionList = regions;
    } else if (region) {
      regionList = [region];
    } else if (country) {
      // Use country as a region
      regionList = [country];
    } else {
      // Fetch existing defense posture regions or use comprehensive defaults
      const { data: existingPostures } = await supabaseClient
        .from('defense_posture')
        .select('region')
        .order('updated_at', { ascending: false })
        .limit(10);
      
      if (existingPostures && existingPostures.length > 0) {
        regionList = existingPostures.map(p => p.region);
      } else {
        // Global coverage regions
        regionList = ['North America', 'Europe', 'Asia-Pacific', 'Middle East', 'Africa', 'South America', 'Global'];
      }
    }

    console.log('Refreshing defense posture:', { regions: regionList, user: user.id });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const results = [];

    for (const reg of regionList) {
      // Fetch existing threat data from security_incidents for context
      const { data: recentIncidents } = await supabaseClient
        .from('security_incidents')
        .select('threat_type, severity, event_type')
        .or(`country.ilike.%${reg}%,region.ilike.%${reg}%`)
        .order('created_at', { ascending: false })
        .limit(5);

      const incidentContext = recentIncidents && recentIncidents.length > 0
        ? `Recent incidents: ${recentIncidents.map(i => `${i.event_type || i.threat_type} (severity: ${i.severity})`).join(', ')}`
        : 'No recent incidents recorded.';

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
            content: 'You are a defensive cybersecurity analyst. Only provide defensive recommendations (patching, hardening, monitoring). Never suggest offensive actions. Return JSON with format: {"threat_level": number 1-10, "advisories": "markdown formatted defensive recommendations"}'
          }, {
            role: 'user',
            content: `Analyze current cyber threat landscape for ${reg}. ${incidentContext} Provide defensive recommendations only. Return valid JSON.`
          }]
        }),
      });

      if (!aiResponse.ok) {
        console.error(`AI API error for ${reg}: ${aiResponse.status}`);
        continue;
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices[0].message.content;

      // Parse AI response
      let threatLevel = 5;
      let advisories = content;
      
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          threatLevel = parseInt(parsed.threat_level) || 5;
          advisories = parsed.advisories || content;
        }
      } catch (e) {
        console.error('JSON parse error, using raw content:', e);
      }

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
      metadata: { regions: regionList, execution_time_ms: executionTime }
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
