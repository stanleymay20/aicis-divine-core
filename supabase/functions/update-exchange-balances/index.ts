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

    // Fetch current exchange accounts
    const { data: exchanges } = await supabaseClient
      .from('exchange_accounts')
      .select('*');

    if (!exchanges) throw new Error('No exchange accounts found');

    // Simulate balance updates with realistic fluctuations
    const updates = exchanges.map(exchange => {
      const currentBalance = Number(exchange.balance_usd);
      const fluctuation = (Math.random() - 0.5) * currentBalance * 0.02; // ±2% change
      const newBalance = currentBalance + fluctuation;
      
      return {
        id: exchange.id,
        balance_usd: newBalance,
        status: newBalance > 10000 ? 'active' : 'low_balance'
      };
    });

    // Update balances
    for (const update of updates) {
      await supabaseClient
        .from('exchange_accounts')
        .update({ 
          balance_usd: update.balance_usd,
          status: update.status 
        })
        .eq('id', update.id);
    }

    // Log activity
    await supabaseClient.from('system_logs').insert({
      user_id: user.id,
      division: 'finance',
      action: 'exchange_balance_update',
      result: 'success',
      log_level: 'info',
      metadata: { exchanges_updated: updates.length }
    });

    return new Response(JSON.stringify({ 
      updated: updates.length,
      balances: updates 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in update-exchange-balances:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
