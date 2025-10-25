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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const apiKey = Deno.env.get("ALPHA_VANTAGE_API_KEY");
    if (!apiKey) throw new Error("Alpha Vantage API key not configured");

    console.log("Fetching economic data from Alpha Vantage...");

    // Fetch key economic indicators
    const indicators = [
      { function: "REAL_GDP", name: "Real GDP", country: "USA" },
      { function: "UNEMPLOYMENT", name: "Unemployment Rate", country: "USA" },
      { function: "CPI", name: "Consumer Price Index", country: "USA" },
      { function: "FEDERAL_FUNDS_RATE", name: "Federal Funds Rate", country: "USA" },
    ];

    const records = [];
    
    for (const indicator of indicators) {
      try {
        const url = `https://www.alphavantage.co/query?function=${indicator.function}&apikey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();
        
        console.log(`Fetched ${indicator.name}:`, data);

        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
          // Get the most recent data point
          const latest = data.data[0];
          records.push({
            indicator_name: indicator.name,
            country: indicator.country,
            value: parseFloat(latest.value),
            unit: data.unit || "",
            date: latest.date,
            source: "alpha_vantage",
            metadata: { raw: latest }
          });
        }

        // Respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 12000));
      } catch (error) {
        console.error(`Error fetching ${indicator.name}:`, error);
      }
    }

    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from('economic_indicators')
        .upsert(records, {
          onConflict: 'indicator_name,country,date',
          ignoreDuplicates: false
        });

      if (insertError) throw insertError;
    }

    await supabase.from('system_logs').insert({
      source: 'alpha_vantage',
      level: 'info',
      message: `Successfully fetched ${records.length} economic indicators`,
      metadata: { records_count: records.length }
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: `Fetched ${records.length} economic indicators`,
        data: records 
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pull-alpha-vantage error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
