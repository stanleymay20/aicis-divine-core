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

    const results = { health: 0, errors: [] };

    // WHO - Global health indicators
    try {
      const whoResponse = await fetch(
        'https://ghoapi.azureedge.net/api/WHOSIS_000001?$top=100'
      );
      const whoData = await whoResponse.json();
      
      if (whoData.value) {
        const healthRecords = whoData.value
          .filter((item: any) => item.Value && item.SpatialDim)
          .slice(0, 50)
          .map((item: any) => ({
            country: item.SpatialDim,
            iso_code: item.SpatialDim,
            source: 'who',
            metric_name: 'life_expectancy',
            value: parseFloat(item.Value),
            unit: 'years',
            sex: item.Dim1 || 'all',
            date: `${item.TimeDim || new Date().getFullYear()}-01-01`,
            metadata: {
              indicator_code: item.IndicatorCode,
              display_value: item.DisplayValue
            }
          }));
        
        const { error } = await supabase.from('health_metrics').insert(healthRecords);
        if (!error) results.health += healthRecords.length;
      }
    } catch (e) {
      results.errors.push(`WHO: ${e.message}`);
    }

    // CDC - COVID data (sample)
    try {
      const cdcResponse = await fetch(
        'https://data.cdc.gov/resource/9mfq-cb36.json?$limit=50'
      );
      const cdcData = await cdcResponse.json();
      
      if (Array.isArray(cdcData) && cdcData.length > 0) {
        const cdcRecords = cdcData
          .filter((item: any) => item.state && item.tot_cases)
          .map((item: any) => ({
            country: 'United States',
            iso_code: 'USA',
            source: 'cdc',
            metric_name: 'covid_cases',
            value: parseFloat(item.tot_cases),
            unit: 'cases',
            date: item.submission_date || new Date().toISOString().split('T')[0],
            metadata: {
              state: item.state,
              deaths: item.tot_death,
              new_cases: item.new_case
            }
          }));
        
        if (cdcRecords.length > 0) {
          const { error } = await supabase.from('health_metrics').insert(cdcRecords);
          if (!error) results.health += cdcRecords.length;
        }
      }
    } catch (e) {
      results.errors.push(`CDC: ${e.message}`);
    }

    // OWID COVID - Global summary
    try {
      const owidResponse = await fetch(
        'https://covid.ourworldindata.org/data/owid-covid-data.json'
      );
      const owidData = await owidResponse.json();
      
      const countries = ['USA', 'CHN', 'IND', 'BRA', 'DEU', 'GBR'];
      const owidRecords: any[] = [];
      
      for (const iso of countries) {
        const countryData = owidData[iso];
        if (countryData?.data) {
          const latest = countryData.data[countryData.data.length - 1];
          if (latest?.total_cases) {
            owidRecords.push({
              country: countryData.location,
              iso_code: iso,
              source: 'owid',
              metric_name: 'covid_total_cases',
              value: parseFloat(latest.total_cases),
              unit: 'cases',
              date: latest.date,
              metadata: {
                total_deaths: latest.total_deaths,
                total_vaccinations: latest.total_vaccinations,
                population: latest.population
              }
            });
          }
        }
      }
      
      if (owidRecords.length > 0) {
        const { error } = await supabase.from('health_metrics').insert(owidRecords);
        if (!error) results.health += owidRecords.length;
      }
    } catch (e) {
      results.errors.push(`OWID: ${e.message}`);
    }

    // Log completion
    await supabase.from('automation_logs').insert({
      job_name: 'fetch-health-global',
      status: results.errors.length === 0 ? 'success' : 'partial',
      message: `Fetched ${results.health} health records. Errors: ${results.errors.length}`
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: `Fetched ${results.health} health metrics`,
        data: results
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-health-global error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
