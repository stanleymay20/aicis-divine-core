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

    // Fetch recent trades for revenue analysis
    const { data: trades } = await supabaseClient
      .from('trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    // Fetch energy grid data
    const { data: energyData } = await supabaseClient
      .from('energy_grid')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(10);

    // Use AI to analyze revenue
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
            content: 'You are AICIS financial intelligence AI. Analyze revenue data and provide executive summaries with key metrics, trends, and growth rates.'
          },
          { 
            role: 'user', 
            content: `Analyze this financial data and calculate total revenue, growth rate, and key insights:\n\nTrades: ${JSON.stringify(trades)}\n\nEnergy Data: ${JSON.stringify(energyData)}` 
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('AI analysis failed');
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices[0].message.content;

    // Calculate actual totals
    const totalTradeRevenue = trades?.reduce((sum, trade) => sum + (Number(trade.profit) || 0), 0) || 0;
    const energySavings = 15000; // Mock energy optimization savings

    // Store revenue streams
    await supabaseClient.from('revenue_streams').insert([
      {
        division: 'finance',
        source: 'trading',
        amount_usd: totalTradeRevenue
      },
      {
        division: 'energy',
        source: 'optimization',
        amount_usd: energySavings
      }
    ]);

    // Log activity
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'finance',
      action: 'revenue_analysis',
      result: 'success',
      log_level: 'info',
      metadata: { total_revenue: totalTradeRevenue + energySavings }
    });

    return new Response(JSON.stringify({ 
      analysis,
      metrics: {
        total_revenue: totalTradeRevenue + energySavings,
        trading_revenue: totalTradeRevenue,
        energy_savings: energySavings
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-revenue:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
