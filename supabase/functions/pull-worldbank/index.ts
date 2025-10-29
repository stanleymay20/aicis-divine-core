import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  try {
    // Use service role for system operations (cron jobs)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Fetching World Bank data...");
    
    // Key development indicators
    const indicators = [
      'NY.GDP.MKTP.CD', // GDP
      'SP.POP.TOTL', // Population
      'SL.UEM.TOTL.ZS', // Unemployment rate
      'SE.XPD.TOTL.GD.ZS', // Education expenditure
      'SH.XPD.CHEX.GD.ZS', // Health expenditure
      'EG.USE.ELEC.KH.PC' // Electric power consumption
    ];

    const countries = ['GHA', 'NGA', 'KEN', 'ZAF', 'ETH', 'UGA'];
    const year = new Date().getFullYear() - 1;
    
    const records: any[] = [];

    for (const indicator of indicators) {
      const url = `https://api.worldbank.org/v2/country/${countries.join(';')}/indicator/${indicator}?date=${year}&format=json&per_page=100`;
      
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`World Bank API error for ${indicator}:`, response.status);
        continue;
      }

      const data = await response.json();
      const values = data[1] || [];

      for (const item of values) {
        if (item.value !== null) {
          records.push({
            country: item.country.value,
            indicator_code: item.indicator.id,
            indicator_name: item.indicator.value,
            value: parseFloat(item.value),
            year: parseInt(item.date),
            unit: item.unit || '',
            source: 'WorldBank',
            metadata: {
              country_code: item.countryiso3code,
              decimal: item.decimal
            }
          });
        }
      }
    }

    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from('economic_indicators')
        .insert(records);

      if (insertError) throw insertError;
    }

    // Log the operation
    await supabase.from('compliance_audit').insert({
      action: 'data_pull',
      source: 'WorldBank',
      status: 'success',
      records_affected: records.length
    });

    await supabase.from('system_logs').insert({
      division: 'economy',
      action: 'worldbank_data_pull',
      result: 'success',
      log_level: 'info',
      metadata: { records_count: records.length }
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: `Fetched ${records.length} World Bank indicators`,
        records_count: records.length
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pull-worldbank error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
