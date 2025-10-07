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

    // Use AI for energy grid optimization
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
            content: 'You are an energy optimization AI managing global power grids. Analyze grid loads, stability, and renewable energy integration. Provide optimization recommendations.'
          },
          { role: 'user', content: 'Analyze current energy grid status and provide optimization strategies' }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('AI processing failed');
    }

    const aiData = await aiResponse.json();
    const optimization = aiData.choices[0].message.content;

    // Generate sample energy data
    const energyData = [
      {
        region: 'North America',
        grid_load: 75.5,
        capacity: 10000.0,
        stability_index: 92.3,
        renewable_percentage: 35.8,
        outage_risk: 'stable'
      },
      {
        region: 'Europe',
        grid_load: 82.1,
        capacity: 8500.0,
        stability_index: 88.7,
        renewable_percentage: 42.3,
        outage_risk: 'stable'
      },
      {
        region: 'Asia',
        grid_load: 88.9,
        capacity: 15000.0,
        stability_index: 85.2,
        renewable_percentage: 28.5,
        outage_risk: 'fluctuating'
      }
    ];

    // Store energy data
    for (const data of energyData) {
      await supabaseClient.from('energy_grid').insert(data);
    }

    // Log optimization
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'energy',
      action: 'energy_optimization',
      result: 'completed',
      log_level: 'success',
      metadata: { optimization, regions: energyData.length }
    });

    return new Response(JSON.stringify({ optimization, energyData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in energy-optimize:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
