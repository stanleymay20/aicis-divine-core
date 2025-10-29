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

    const NEWSAPI_KEY = Deno.env.get("NEWSAPI_KEY");
    const results = { governance: 0, errors: [] };
    const currentYear = new Date().getFullYear();

    // Transparency International - CPI
    try {
      const cpiResponse = await fetch(
        `https://api.transparency.org/v1/cpi?year=${currentYear - 1}`
      );
      
      if (cpiResponse.ok) {
        const cpiData = await cpiResponse.json();
        
        if (Array.isArray(cpiData) && cpiData.length > 0) {
          const cpiRecords = cpiData.slice(0, 50).map((item: any) => ({
            country: item.country,
            iso_code: item.iso3,
            source: 'transparency',
            indicator_name: 'corruption_perception_index',
            value: parseFloat(item.cpi_score),
            category: 'corruption',
            year: currentYear - 1,
            metadata: {
              rank: item.rank,
              sources: item.number_of_sources
            }
          }));
          
          const { error } = await supabase.from('governance_global').insert(cpiRecords);
          if (!error) results.governance += cpiRecords.length;
        }
      }
    } catch (e) {
      results.errors.push(`Transparency.org: ${e.message}`);
    }

    // World Bank - Governance indicators
    try {
      const wbResponse = await fetch(
        'https://api.worldbank.org/v2/en/indicator/GE.EST?format=json&per_page=100'
      );
      const wbData = await wbResponse.json();
      
      if (Array.isArray(wbData) && wbData[1]) {
        const govRecords = wbData[1]
          .filter((item: any) => item.value && item.date >= (currentYear - 2))
          .slice(0, 50)
          .map((item: any) => ({
            country: item.country.value,
            iso_code: item.countryiso3code,
            source: 'worldbank',
            indicator_name: 'government_effectiveness',
            value: parseFloat(item.value),
            category: 'governance',
            year: parseInt(item.date),
            metadata: {
              indicator_code: 'GE.EST',
              decimal: item.decimal
            }
          }));
        
        if (govRecords.length > 0) {
          const { error } = await supabase.from('governance_global').insert(govRecords);
          if (!error) results.governance += govRecords.length;
        }
      }
    } catch (e) {
      results.errors.push(`World Bank: ${e.message}`);
    }

    // GDELT - Global events
    try {
      const gdeltResponse = await fetch(
        'https://api.gdeltproject.org/api/v2/events/query?query=governance&mode=artlist&format=json&maxrecords=20'
      );
      const gdeltData = await gdeltResponse.json();
      
      if (gdeltData.articles) {
        const eventRecords = gdeltData.articles.slice(0, 20).map((article: any) => ({
          country: article.sourcecountry || 'Unknown',
          iso_code: article.sourcecountry || 'UNK',
          source: 'gdelt',
          indicator_name: 'governance_events',
          value: parseFloat(article.tone) || 0,
          category: 'events',
          year: currentYear,
          metadata: {
            title: article.title,
            url: article.url,
            domain: article.domain,
            language: article.language
          }
        }));
        
        const { error } = await supabase.from('governance_global').insert(eventRecords);
        if (!error) results.governance += eventRecords.length;
      }
    } catch (e) {
      results.errors.push(`GDELT: ${e.message}`);
    }

    // CIA Factbook - Country profiles (sample countries)
    try {
      const countries = ['gm', 'fr', 'br']; // Germany, France, Brazil
      
      for (const code of countries) {
        const factbookResponse = await fetch(
          `https://raw.githubusercontent.com/factbook/factbook.json/master/europe/${code}.json`
        );
        
        if (factbookResponse.ok) {
          const fbData = await factbookResponse.json();
          
          if (fbData.Economy?.GDP) {
            const { error } = await supabase.from('governance_global').insert({
              country: fbData.Government?.['Country name']?.conventional_short_form || 'Unknown',
              iso_code: code.toUpperCase(),
              source: 'factbook',
              indicator_name: 'gdp_ppp',
              value: parseFloat(fbData.Economy.GDP['purchasing power parity']?.$numberLong || 0),
              category: 'stability',
              year: currentYear,
              metadata: {
                government_type: fbData.Government?.['Government type'],
                capital: fbData.Government?.Capital?.name
              }
            });
            if (!error) results.governance++;
          }
        }
      }
    } catch (e) {
      results.errors.push(`CIA Factbook: ${e.message}`);
    }

    // Log completion
    await supabase.from('automation_logs').insert({
      job_name: 'fetch-governance-global',
      status: results.errors.length === 0 ? 'success' : 'partial',
      message: `Fetched ${results.governance} governance records. Errors: ${results.errors.length}`
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: `Fetched ${results.governance} governance records`,
        data: results
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-governance-global error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
