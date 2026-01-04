import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const InputSchema = z.object({
  countries: z.array(z.string().min(1).max(100)).min(1).max(50).optional(),
  country: z.string().min(1).max(100).optional(),
  region: z.string().min(1).max(100).optional(),
}).refine(data => data.countries || data.country || data.region || true, {
  message: "At least one filter should be provided, or all countries will be scanned"
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

    const { countries, country, region } = validation.data;
    const startTime = Date.now();

    // Build country list dynamically
    let countryList: string[] = [];
    
    if (countries && countries.length > 0) {
      countryList = countries;
    } else if (country) {
      countryList = [country];
    } else if (region) {
      // Fetch countries from region via World Bank API
      try {
        const regionResponse = await fetch(`https://api.worldbank.org/v2/country?region=${region}&format=json&per_page=50`);
        const regionData = await regionResponse.json();
        if (Array.isArray(regionData) && regionData[1]) {
          countryList = regionData[1].map((c: any) => c.name);
        }
      } catch (e) {
        console.error('Region lookup failed:', e);
      }
    }

    // If still empty, fetch from existing profiles or use top priority countries
    if (countryList.length === 0) {
      const { data: existingProfiles } = await supabaseClient
        .from('country_profiles')
        .select('country_name')
        .order('compiled_at', { ascending: false })
        .limit(10);
      
      countryList = existingProfiles?.map(p => p.country_name).filter(Boolean) || ['Global'];
    }

    console.log('Running diplomacy scan:', { countries: countryList, user: user.id });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const results = [];

    for (const countryName of countryList) {
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
            content: 'You are a geopolitical analyst. Provide objective assessments based on public information only. Return JSON with format: {"sentiment": number between -1 and 1, "risk_index": number between 0 and 100, "summary": "brief analysis"}'
          }, {
            role: 'user',
            content: `Analyze current diplomatic and economic sentiment for ${countryName}. Return only valid JSON.`
          }]
        }),
      });

      if (!aiResponse.ok) {
        console.error(`AI API error for ${countryName}: ${aiResponse.status}`);
        continue;
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices[0].message.content;
      
      // Parse AI response for structured data
      let sentiment = 0;
      let riskIndex = 50;
      let summary = content;
      
      try {
        // Try to extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          sentiment = parseFloat(parsed.sentiment) || 0;
          riskIndex = parseFloat(parsed.risk_index) || 50;
          summary = parsed.summary || content;
        }
      } catch (e) {
        // Use content as summary if JSON parsing fails
        console.error('JSON parse error, using raw content:', e);
      }

      const { data: signal, error: insertError } = await supabaseClient
        .from('diplo_signals')
        .upsert({
          country: countryName,
          sentiment,
          risk_index: riskIndex,
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
