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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const ALPHA_KEY = Deno.env.get("ALPHAVANTAGE_API_KEY");
    const EIA_KEY = Deno.env.get("EIA_API_KEY");
    const results = { finance: 0, errors: [] };

    // Alpha Vantage - Global GDP
    try {
      const gdpResponse = await fetch(
        `https://www.alphavantage.co/query?function=REAL_GDP&interval=annual&apikey=${ALPHA_KEY}`
      );
      const gdpData = await gdpResponse.json();
      
      if (gdpData.data) {
        const records = gdpData.data.slice(0, 5).map((item: any) => ({
          country: 'United States',
          iso_code: 'USA',
          source: 'alphavantage',
          indicator_name: 'real_gdp',
          value: parseFloat(item.value),
          date: `${item.date}-01-01`,
          metadata: { unit: 'billions_usd' }
        }));
        
        const { error } = await supabase.from('finance_data').insert(records);
        if (!error) results.finance += records.length;
      }
    } catch (e) {
      results.errors.push(`Alpha Vantage: ${e.message}`);
    }

    // Binance - Crypto prices
    try {
      const binanceResponse = await fetch('https://api.binance.com/api/v3/ticker/price');
      const prices = await binanceResponse.json();
      
      const cryptoRecords = prices
        .filter((p: any) => ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'].includes(p.symbol))
        .map((p: any) => ({
          country: 'Global',
          iso_code: 'WORLD',
          source: 'binance',
          indicator_name: `crypto_${p.symbol}`,
          value: parseFloat(p.price),
          currency: 'USD',
          date: new Date().toISOString().split('T')[0]
        }));
      
      const { error } = await supabase.from('finance_data').insert(cryptoRecords);
      if (!error) results.finance += cryptoRecords.length;
    } catch (e) {
      results.errors.push(`Binance: ${e.message}`);
    }

    // EIA - Oil prices
    try {
      const oilResponse = await fetch(
        `https://api.eia.gov/series/?api_key=${EIA_KEY}&series_id=PET.RWTC.D`
      );
      const oilData = await oilResponse.json();
      
      if (oilData.series?.[0]?.data) {
        const latestOil = oilData.series[0].data.slice(0, 30).map((item: any) => ({
          country: 'Global',
          iso_code: 'WORLD',
          source: 'eia',
          indicator_name: 'crude_oil_wti',
          value: parseFloat(item[1]),
          currency: 'USD',
          date: item[0],
          metadata: { unit: 'dollars_per_barrel' }
        }));
        
        const { error } = await supabase.from('finance_data').insert(latestOil);
        if (!error) results.finance += latestOil.length;
      }
    } catch (e) {
      results.errors.push(`EIA: ${e.message}`);
    }

    // World Bank - GDP for multiple countries
    try {
      const countries = ['USA', 'CHN', 'DEU', 'GBR', 'FRA', 'JPN'];
      for (const iso of countries) {
        const wbResponse = await fetch(
          `https://api.worldbank.org/v2/country/${iso}/indicator/NY.GDP.MKTP.CD?format=json&per_page=5`
        );
        const wbData = await wbResponse.json();
        
        if (Array.isArray(wbData) && wbData[1]) {
          const records = wbData[1]
            .filter((d: any) => d.value)
            .map((d: any) => ({
              country: d.country.value,
              iso_code: d.countryiso3code,
              source: 'worldbank',
              indicator_name: 'gdp_current_usd',
              value: parseFloat(d.value),
              currency: 'USD',
              date: `${d.date}-01-01`,
              metadata: { indicator_code: d.indicator.id }
            }));
          
          if (records.length > 0) {
            const { error } = await supabase.from('finance_data').insert(records);
            if (!error) results.finance += records.length;
          }
        }
      }
    } catch (e) {
      results.errors.push(`World Bank: ${e.message}`);
    }

    // Log completion
    await supabase.from('automation_logs').insert({
      job_name: 'fetch-finance-global',
      status: results.errors.length === 0 ? 'success' : 'partial',
      message: `Fetched ${results.finance} finance records. Errors: ${results.errors.length}`
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: `Fetched ${results.finance} finance records`,
        data: results
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-finance-global error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
