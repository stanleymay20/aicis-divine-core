import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    console.log("Fetching CoinGecko market data...");
    
    // Real, public data (no key): CoinGecko spot/tickers
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true";
    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!r.ok) throw new Error(`CoinGecko error: ${r.status}`);
    const j = await r.json();

    console.log("CoinGecko data:", j);

    const startTime = Date.now();
    // Normalize into revenue_streams (finance division)
    const now = new Date().toISOString();
    const rows = [
      { 
        division: 'finance', 
        source: 'coingecko', 
        amount_usd: Number(j.bitcoin?.usd ?? 0),  
        meta: { 
          asset: 'BTC', 
          vol_24h: j.bitcoin?.usd_24h_vol, 
          change_24h: j.bitcoin?.usd_24h_change 
        }, 
        timestamp: now 
      },
      { 
        division: 'finance', 
        source: 'coingecko', 
        amount_usd: Number(j.ethereum?.usd ?? 0), 
        meta: { 
          asset: 'ETH', 
          vol_24h: j.ethereum?.usd_24h_vol, 
          change_24h: j.ethereum?.usd_24h_change 
        }, 
        timestamp: now 
      },
      { 
        division: 'finance', 
        source: 'coingecko', 
        amount_usd: Number(j.tether?.usd ?? 0),   
        meta: { 
          asset: 'USDT', 
          vol_24h: j.tether?.usd_24h_vol, 
          change_24h: j.tether?.usd_24h_change 
        }, 
        timestamp: now 
      },
    ];

    for (const row of rows) {
      const { error: insertError } = await supabase.from('revenue_streams').insert(row);
      if (insertError) {
        console.error("Insert error:", insertError);
        throw insertError;
      }
    }

    // Audit + logs
    await supabase.from('compliance_audit').insert({
      action_type: 'data_pull', 
      division: 'finance',
      user_id: user.id, 
      action_description: 'Pulled CoinGecko market data',
      compliance_status: 'compliant', 
      data_accessed: { provider: 'coingecko', assets: ['BTC','ETH','USDT'] }
    });
    
    const latencyMs = Date.now() - startTime;

    // Log to data_source_log
    await supabase.from('data_source_log').insert({
      division: 'finance',
      source: 'coingecko',
      records_ingested: rows.length,
      latency_ms: latencyMs,
      status: 'success',
      last_success: now
    });

    await supabase.from('system_logs').insert({
      division: 'finance', 
      action: 'pull_coingecko', 
      user_id: user.id,
      result: 'success', 
      log_level: 'info', 
      metadata: { rows: rows.length, latency_ms: latencyMs }
    });

    console.log("CoinGecko data pull complete:", rows.length, "rows");

    return new Response(
      JSON.stringify({ ok: true, rows, message: `Pulled ${rows.length} crypto assets from CoinGecko` }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pull-coingecko error:", e);
    
    // Log failure
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    await supabase.from('data_source_log').insert({
      division: 'finance',
      source: 'coingecko',
      records_ingested: 0,
      status: 'failure',
      error_message: e instanceof Error ? e.message : 'Unknown error'
    });

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
