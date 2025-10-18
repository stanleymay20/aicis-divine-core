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

    console.log('Starting food security optimization...');

    // Fetch current food security data
    const { data: foodData, error: fetchError } = await supabaseClient
      .from('food_security')
      .select('*')
      .order('alert_level', { ascending: false });

    if (fetchError) throw fetchError;

    // Use Lovable AI to optimize food distribution
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
            content: 'You are an agricultural AI optimizing global food security. Analyze yield patterns, supply chains, and provide actionable recommendations to prevent shortages.'
          },
          {
            role: 'user',
            content: `Analyze this food security data and provide optimization strategies:\n\n${JSON.stringify(foodData, null, 2)}\n\nProvide: 1) Critical shortage risks, 2) Resource reallocation suggestions, 3) Long-term sustainability recommendations.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI optimization failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const recommendations = aiData.choices[0].message.content;

    // Calculate metrics
    const avgYield = foodData?.reduce((sum, r) => sum + (r.yield_index || 0), 0) / (foodData?.length || 1);
    const criticalRegions = foodData?.filter(r => r.alert_level === 'critical').length || 0;
    const avgSupplyDays = foodData?.reduce((sum, r) => sum + (r.supply_days || 0), 0) / (foodData?.length || 1);

    // Log the optimization
    await supabaseClient.from('system_logs').insert({
      action: 'food_optimization',
      details: `Optimized ${foodData?.length || 0} food security records. Critical: ${criticalRegions}, Avg Yield: ${avgYield.toFixed(1)}`,
      performed_by: user.id
    });

    console.log('Food security optimization completed successfully');

    return new Response(JSON.stringify({
      success: true,
      metrics: {
        average_yield_index: parseFloat(avgYield.toFixed(2)),
        critical_regions: criticalRegions,
        average_supply_days: Math.round(avgSupplyDays),
        total_monitored: foodData?.length || 0
      },
      recommendations,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in optimize-food:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
