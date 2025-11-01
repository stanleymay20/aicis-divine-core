import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHash } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const incidents: any[] = [];

    // Fetch from GDELT
    try {
      const gdeltResponse = await fetch(
        'https://api.gdeltproject.org/api/v2/doc/doc?query=sourcecountry:* (kill OR attack OR violence OR bombing OR shooting)&mode=artlist&maxrecords=250&format=json',
        { headers: { 'User-Agent': 'AICIS/1.0' } }
      );
      
      if (gdeltResponse.ok) {
        const gdeltData = await gdeltResponse.json();
        const articles = gdeltData.articles || [];
        
        for (const article of articles.slice(0, 100)) {
          const title = article.title || '';
          const url = article.url || '';
          const date = article.seendate || new Date().toISOString();
          const country = article.sourcecountry || 'UNKNOWN';
          
          const dedupeKey = await generateDedupeKey(`${title}|${date}|${country}`);
          
          incidents.push({
            source: 'gdelt',
            source_id: article.url,
            title,
            summary: article.socialimage || null,
            event_type: 'conflict',
            start_time: new Date(date).toISOString(),
            country,
            iso3: country.length === 3 ? country : null,
            url,
            raw: article,
            dedupe_key: dedupeKey
          });
        }
      }
    } catch (error) {
      console.error('GDELT fetch error:', error);
    }

    // Fetch from ReliefWeb
    try {
      const reliefWebResponse = await fetch(
        'https://api.reliefweb.int/v1/reports?appname=aicis&filter[field]=primary_country.iso3&limit=100&sort[]=date:desc'
      );
      
      if (reliefWebResponse.ok) {
        const reliefData = await reliefWebResponse.json();
        const reports = reliefData.data || [];
        
        for (const report of reports.slice(0, 50)) {
          const fields = report.fields || {};
          const title = fields.title || '';
          const date = fields.date?.created || new Date().toISOString();
          const countries = fields.primary_country || [];
          const country = countries[0]?.name || 'UNKNOWN';
          const iso3 = countries[0]?.iso3 || null;
          
          const dedupeKey = await generateDedupeKey(`${title}|${date}|${iso3}`);
          
          incidents.push({
            source: 'reliefweb',
            source_id: report.id?.toString(),
            title,
            summary: fields.body || null,
            event_type: 'humanitarian',
            start_time: new Date(date).toISOString(),
            country,
            iso3,
            url: fields.url || null,
            raw: report,
            dedupe_key: dedupeKey
          });
        }
      }
    } catch (error) {
      console.error('ReliefWeb fetch error:', error);
    }

    // Insert incidents with conflict resolution
    let inserted = 0;
    for (const incident of incidents) {
      try {
        const { error } = await supabase
          .from('security_incidents')
          .upsert(incident, { onConflict: 'dedupe_key', ignoreDuplicates: true });
        
        if (!error) inserted++;
      } catch (error) {
        console.error('Insert error:', error);
      }
    }

    console.log(`Fetched ${incidents.length} incidents, inserted ${inserted} new`);

    return new Response(JSON.stringify({ 
      ok: true, 
      fetched: incidents.length,
      inserted 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in fetch-security-incidents:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function generateDedupeKey(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
