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

    // Use AI to analyze and fetch market data
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
            content: 'You are a financial AI analyzing cryptocurrency markets. Generate realistic market data including exchange rates, volumes, and trends for major cryptocurrencies (BTC, ETH, USDT) across major exchanges (Binance, Coinbase, OKX).'
          },
          { role: 'user', content: 'Provide current market overview with price analysis' }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('AI processing failed');
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices[0].message.content;

    // Generate sample trade data
    const mockTrades = [
      {
        exchange: 'Binance',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 0.5,
        price: 67500.00,
        profit: 1250.50,
        status: 'executed',
        executed_at: new Date().toISOString()
      },
      {
        exchange: 'Coinbase',
        pair: 'ETH/USDT',
        side: 'sell',
        amount: 10.0,
        price: 3850.00,
        profit: 450.25,
        status: 'executed',
        executed_at: new Date().toISOString()
      }
    ];

    // Store trades in database
    for (const trade of mockTrades) {
      await supabaseClient.from('trades').insert(trade);
    }

    // Log activity
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'finance',
      action: 'market_data_fetch',
      result: 'success',
      log_level: 'info',
      metadata: { trades: mockTrades.length }
    });

    return new Response(JSON.stringify({ analysis, trades: mockTrades }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-market-data:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
