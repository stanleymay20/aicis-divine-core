import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const querySchema = z.object({
      query: z.string().min(1).max(1000),
      options: z.object({}).optional()
    });
    
    const rawBody = await req.json();
    const { query, options } = querySchema.parse(rawBody);
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Intent detection
    const intent = detectIntent(query);
    console.log('Query:', query, 'Intent:', intent);

    let response: any = { ok: true, intent, query };

    // Route based on intent
    if (intent === 'critical_incidents') {
      const { data: alerts } = await supabase
        .from('critical_alerts')
        .select('*, security_incidents(*)')
        .gte('triggered_at', new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString())
        .order('triggered_at', { ascending: false })
        .limit(50);
      
      response.results = alerts || [];
      response.message = `Found ${alerts?.length || 0} critical incidents in the last 72 hours`;
      
    } else if (intent === 'country_dashboard') {
      const country = extractCountry(query);
      const iso3 = await resolveISO3(country, supabase);
      
      if (!iso3) {
        response.ok = false;
        response.error = `Could not resolve country: ${country}`;
      } else {
        const dashboard = await fetchCountryDashboard(iso3, supabase);
        response.results = dashboard;
        response.country = country;
        response.iso3 = iso3;
        response.message = `Country dashboard for ${country} (${iso3})`;
      }
      
    } else if (intent === 'map_query') {
      response.message = 'Map query detected - please specify layers to view';
      response.facets = ['vulnerability', 'incidents', 'energy', 'food'];
      
    } else {
      // General query
      const domains = detectDomain(query);
      const dataContext = await fetchRelevantData(domains, supabase);
      
      response.domains = domains;
      response.results = dataContext;
      response.message = `Analysis across ${domains.length} domains`;
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in aicis-query:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ 
        ok: false,
        error: 'Invalid input',
        details: error.errors 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function detectIntent(query: string): string {
  const q = query.toLowerCase();
  
  if (q.match(/kill|attack|violence|conflict|incident|crisis|shooting|bombing/)) {
    return 'critical_incidents';
  }
  
  if (q.match(/country|governance|nation|profile|dashboard/) || q.match(/for\s+\w+/)) {
    return 'country_dashboard';
  }
  
  if (q.match(/map|show|display|overlay|layer/)) {
    return 'map_query';
  }
  
  return 'general';
}

function extractCountry(query: string): string {
  const forMatch = query.match(/for\s+([a-z]+)/i);
  if (forMatch) return forMatch[1];
  
  const ofMatch = query.match(/of\s+([a-z]+)/i);
  if (ofMatch) return ofMatch[1];
  
  return query.split(' ').pop() || query;
}

async function resolveISO3(country: string, supabase: any): Promise<string | null> {
  const isoMap: Record<string, string> = {
    'nauru': 'NRU', 'usa': 'USA', 'us': 'USA', 'united states': 'USA',
    'germany': 'DEU', 'ghana': 'GHA', 'kenya': 'KEN', 'uk': 'GBR',
    'france': 'FRA', 'japan': 'JPN', 'china': 'CHN', 'india': 'IND'
  };
  
  const normalized = country.toLowerCase().trim();
  if (isoMap[normalized]) return isoMap[normalized];
  if (country.length === 3) return country.toUpperCase();
  
  return null;
}

async function fetchCountryDashboard(iso3: string, supabase: any) {
  const dashboard: any = { iso3 };
  
  const { data: governance } = await supabase
    .from('governance_global')
    .select('*')
    .eq('iso3', iso3)
    .order('year', { ascending: false })
    .limit(10);
  
  const { data: health } = await supabase
    .from('health_metrics')
    .select('*')
    .eq('iso3', iso3)
    .order('year', { ascending: false })
    .limit(10);
  
  const { data: food } = await supabase
    .from('food_data')
    .select('*')
    .eq('iso3', iso3)
    .order('date', { ascending: false })
    .limit(10);
  
  const { data: finance } = await supabase
    .from('finance_data')
    .select('*')
    .eq('iso3', iso3)
    .order('date', { ascending: false })
    .limit(10);
  
  const { data: energy } = await supabase
    .from('metrics')
    .select('*')
    .eq('iso3', iso3)
    .eq('domain', 'energy')
    .order('created_at', { ascending: false })
    .limit(10);
  
  const { data: vulnerability } = await supabase
    .from('vulnerability_scores')
    .select('*')
    .eq('iso3', iso3)
    .order('computed_at', { ascending: false })
    .limit(1);
  
  dashboard.governance = governance || [];
  dashboard.health = health || [];
  dashboard.food = food || [];
  dashboard.finance = finance || [];
  dashboard.energy = energy || [];
  dashboard.vulnerability = vulnerability?.[0] || null;
  
  return dashboard;
}

async function fetchRelevantData(domains: string[], supabase: any) {
  const data: any = {};
  
  for (const domain of domains) {
    const { data: records } = await supabase
      .from('metrics')
      .select('*')
      .eq('domain', domain)
      .order('created_at', { ascending: false })
      .limit(20);
    
    data[domain] = records || [];
  }
  
  return data;
}

function detectDomain(query: string): string[] {
  const domains: string[] = [];
  const q = query.toLowerCase();
  
  if (q.match(/governance|government|policy|corruption/)) domains.push('governance');
  if (q.match(/health|medical|disease|hospital/)) domains.push('health');
  if (q.match(/education|school|literacy|student/)) domains.push('education');
  if (q.match(/energy|power|electricity|grid/)) domains.push('energy');
  if (q.match(/finance|economic|gdp|debt|trade/)) domains.push('finance');
  if (q.match(/food|agriculture|hunger|crop/)) domains.push('food');
  if (q.match(/climate|weather|temperature|rain/)) domains.push('climate');
  if (q.match(/security|military|defense|threat/)) domains.push('security');
  
  return domains.length > 0 ? domains : ['general'];
}
