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
    const { query } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Processing AICIS query:', query);

    // 1. Resolve location
    const location = await resolveLocation(query, supabase);
    
    // 2. Classify domain
    const domain = classifyDomain(query);
    
    // 3. Use embedded provider registry
    const registry = {
      providers: {
        worldbank: {
          domain: 'governance|finance',
          endpoints: {
            governance_effectiveness: {
              url: 'https://api.worldbank.org/v2/country/{iso3}/indicator/GE.EST?format=json&per_page=100',
              method: 'GET'
            }
          }
        },
        who_gho: {
          domain: 'health',
          endpoints: {
            life_expectancy: {
              url: 'https://ghoapi.azureedge.net/api/WHOSIS_000001?$filter=SpatialDim eq \'{iso3}\'',
              method: 'GET'
            }
          }
        }
      }
    };
    
    // 4. Select relevant providers
    const providers = Object.entries(registry.providers)
      .filter(([_, config]: [string, any]) => 
        config.domain.split('|').includes(domain)
      );

    // 5. Fetch data from providers
    const metrics: any[] = [];
    
    for (const [providerName, config] of providers) {
      for (const [endpointName, endpoint] of Object.entries((config as any).endpoints)) {
        try {
          const url = interpolateUrl((endpoint as any).url, location);
          const response = await fetch(url, {
            method: (endpoint as any).method || 'GET',
            headers: interpolateHeaders((config as any).headers || {}, Deno.env.toObject())
          });

          if (response.ok) {
            const data = await response.json();
            const extracted = extractData(data, (endpoint as any).path_map?.data);
            
            // Store in metrics table
            if (Array.isArray(extracted)) {
              for (const item of extracted.slice(0, 10)) { // Limit to 10 per endpoint
                await supabase.from('metrics').insert({
                  domain,
                  metric: endpointName,
                  iso3: location.iso3,
                  period: new Date().getFullYear().toString(),
                  value: extractValue(item),
                  source: providerName,
                  raw: item
                });
              }
              metrics.push(...extracted.slice(0, 10));
            }
          }
        } catch (error) {
          console.error(`Error fetching from ${providerName}:`, error);
        }
      }
    }

    // 6. Log query
    await supabase.from('query_logs').insert({
      query,
      domain,
      target: location,
      sources: providers.map(([name]) => name),
      success: metrics.length > 0
    });

    return new Response(
      JSON.stringify({
        location,
        domain,
        metrics,
        count: metrics.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('AICIS query error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function resolveLocation(query: string, supabase: any) {
  // Simple location extraction
  const words = query.toLowerCase().split(' ');
  const isoCountries = ['usa', 'gbr', 'deu', 'fra', 'chn', 'ind', 'bra', 'nga', 'gha', 'ken'];
  
  for (const word of words) {
    if (isoCountries.includes(word)) {
      return { name: word.toUpperCase(), iso3: word.toUpperCase(), type: 'country' };
    }
  }

  return { name: 'Global', type: 'region' };
}

function classifyDomain(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('governance') || q.includes('government')) return 'governance';
  if (q.includes('health') || q.includes('disease')) return 'health';
  if (q.includes('food') || q.includes('crop')) return 'food';
  if (q.includes('energy') || q.includes('power')) return 'energy';
  if (q.includes('climate') || q.includes('weather')) return 'climate';
  return 'general';
}

function interpolateUrl(template: string, location: any): string {
  return template
    .replace('{iso3}', location.iso3 || '')
    .replace('{lat}', location.lat || '0')
    .replace('{lon}', location.lon || '0');
}

function interpolateHeaders(headers: Record<string, string>, env: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key] = value.replace(/\${([^}]+)}/g, (_, varName) => env[varName] || '');
  }
  return result;
}

function extractData(data: any, path?: string): any {
  if (!path) return data;
  // Simple JSONPath extraction
  if (path.startsWith('$[') && path.endsWith(']')) {
    const index = parseInt(path.slice(2, -1));
    return Array.isArray(data) ? data[index] : data;
  }
  return data;
}

function extractValue(item: any): number {
  if (typeof item === 'number') return item;
  if (item?.value !== undefined) return parseFloat(item.value);
  if (item?.NumericValue !== undefined) return parseFloat(item.NumericValue);
  if (item?.Value !== undefined) return parseFloat(item.Value);
  return 0;
}
