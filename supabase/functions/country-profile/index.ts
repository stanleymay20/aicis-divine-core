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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { query } = await req.json();
    
    // 1. Resolve location
    const location = await resolveLocation(query, supabase);
    console.log('Resolved location:', location);

    // 2. Check for recent profile
    const { data: existingProfile } = await supabase
      .from('country_profiles')
      .select('*')
      .eq('iso3', location.iso3)
      .gte('compiled_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (existingProfile) {
      return new Response(JSON.stringify({
        ok: true,
        location,
        profile: existingProfile.kpis,
        completeness_overall: existingProfile.confidence,
        notes: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Fetch data for all divisions
    const divisions = {
      governance: await fetchGovernanceData(location.iso3),
      health: await fetchHealthData(location.iso3),
      education: await fetchEducationData(location.iso3),
      energy: await fetchEnergyData(location.iso3),
      finance: await fetchFinanceData(location.iso3),
      population: await fetchPopulationData(location.iso3),
      climate: await fetchClimateData(location.lat, location.lon),
      food: await fetchFoodData(location.iso3),
      security: await fetchSecurityData(location.iso3)
    };

    // 4. Store metrics in DB
    const allMetrics = [];
    for (const [division, data] of Object.entries(divisions)) {
      for (const metric of data.metrics) {
        allMetrics.push({
          domain: division,
          metric: metric.metric,
          iso3: location.iso3,
          period: metric.period,
          value: metric.value,
          unit: metric.unit,
          source: metric.source,
          raw: metric.raw
        });
      }
    }

    if (allMetrics.length > 0) {
      await supabase.from('metrics').insert(allMetrics);
    }

    // 5. Calculate completeness
    const profile: any = {};
    let totalCompleteness = 0;
    let divisionCount = 0;

    for (const [division, data] of Object.entries(divisions)) {
      const completeness = data.metrics.length > 0 ? Math.min(data.metrics.length / 5, 1) : 0;
      profile[division] = {
        metrics: data.metrics,
        completeness
      };
      totalCompleteness += completeness;
      divisionCount++;
    }

    const completeness_overall = divisionCount > 0 ? totalCompleteness / divisionCount : 0;

    // 6. Store profile
    await supabase.from('country_profiles').upsert({
      iso3: location.iso3,
      compiled_at: new Date().toISOString(),
      kpis: profile,
      confidence: completeness_overall
    });

    return new Response(JSON.stringify({
      ok: true,
      location,
      profile,
      completeness_overall,
      notes: []
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Location resolver
async function resolveLocation(query: string, supabase: any) {
  const isoCountries = [
    { name: "Nauru", iso3: "NRU", lat: -0.5228, lon: 166.9315 },
    { name: "United States", iso3: "USA", lat: 37.0902, lon: -95.7129 },
    { name: "Germany", iso3: "DEU", lat: 51.1657, lon: 10.4515 },
    { name: "Ghana", iso3: "GHA", lat: 7.9465, lon: -1.0232 },
    { name: "Kenya", iso3: "KEN", lat: -0.0236, lon: 37.9062 }
  ];

  const matched = isoCountries.find(c => 
    query.toLowerCase().includes(c.name.toLowerCase()) || 
    query.toUpperCase().includes(c.iso3)
  );

  if (matched) return matched;

  return { name: query, iso3: query.substring(0, 3).toUpperCase(), lat: 0, lon: 0 };
}

// Data fetchers
async function fetchGovernanceData(iso3: string) {
  try {
    const response = await fetch(
      `https://api.worldbank.org/v2/country/${iso3}/indicator/GE.EST?format=json&per_page=100`
    );
    const data = await response.json();
    
    if (Array.isArray(data) && data[1]) {
      return {
        metrics: data[1].slice(0, 10).map((item: any) => ({
          metric: 'government_effectiveness',
          period: item.date,
          value: parseFloat(item.value) || 0,
          unit: 'index',
          source: 'worldbank',
          raw: item
        })).filter((m: any) => m.value !== 0)
      };
    }
  } catch (error) {
    console.error('Governance fetch error:', error);
  }
  return { metrics: [] };
}

async function fetchHealthData(iso3: string) {
  try {
    const response = await fetch(
      `https://ghoapi.azureedge.net/api/WHOSIS_000001?$filter=SpatialDim eq '${iso3}'`
    );
    const data = await response.json();
    
    if (data.value) {
      return {
        metrics: data.value.slice(0, 10).map((item: any) => ({
          metric: 'life_expectancy',
          period: item.TimeDim?.toString() || '2020',
          value: parseFloat(item.NumericValue) || 0,
          unit: 'years',
          source: 'who_gho',
          raw: item
        })).filter((m: any) => m.value !== 0)
      };
    }
  } catch (error) {
    console.error('Health fetch error:', error);
  }
  return { metrics: [] };
}

async function fetchEducationData(iso3: string) {
  try {
    const response = await fetch(
      `https://api.worldbank.org/v2/country/${iso3}/indicator/SE.SEC.ENRR?format=json&per_page=100`
    );
    const data = await response.json();
    
    if (Array.isArray(data) && data[1]) {
      return {
        metrics: data[1].slice(0, 10).map((item: any) => ({
          metric: 'secondary_enrolment',
          period: item.date,
          value: parseFloat(item.value) || 0,
          unit: '%',
          source: 'worldbank',
          raw: item
        })).filter((m: any) => m.value !== 0)
      };
    }
  } catch (error) {
    console.error('Education fetch error:', error);
  }
  return { metrics: [] };
}

async function fetchEnergyData(iso3: string) {
  // Placeholder - would need EIA API key
  return { metrics: [] };
}

async function fetchFinanceData(iso3: string) {
  try {
    const response = await fetch(
      `https://api.worldbank.org/v2/country/${iso3}/indicator/NY.GDP.MKTP.CD?format=json&per_page=100`
    );
    const data = await response.json();
    
    if (Array.isArray(data) && data[1]) {
      return {
        metrics: data[1].slice(0, 10).map((item: any) => ({
          metric: 'gdp_current_usd',
          period: item.date,
          value: parseFloat(item.value) || 0,
          unit: 'USD',
          source: 'worldbank',
          raw: item
        })).filter((m: any) => m.value !== 0)
      };
    }
  } catch (error) {
    console.error('Finance fetch error:', error);
  }
  return { metrics: [] };
}

async function fetchPopulationData(iso3: string) {
  try {
    const response = await fetch(
      `https://api.worldbank.org/v2/country/${iso3}/indicator/SP.POP.TOTL?format=json&per_page=100`
    );
    const data = await response.json();
    
    if (Array.isArray(data) && data[1]) {
      return {
        metrics: data[1].slice(0, 10).map((item: any) => ({
          metric: 'population_total',
          period: item.date,
          value: parseFloat(item.value) || 0,
          unit: 'people',
          source: 'worldbank',
          raw: item
        })).filter((m: any) => m.value !== 0)
      };
    }
  } catch (error) {
    console.error('Population fetch error:', error);
  }
  return { metrics: [] };
}

async function fetchClimateData(lat: number, lon: number) {
  // Placeholder - would need NASA POWER API
  return { metrics: [] };
}

async function fetchFoodData(iso3: string) {
  // Placeholder - would need FAOSTAT API access
  return { metrics: [] };
}

async function fetchSecurityData(iso3: string) {
  // Placeholder - would need GDELT API
  return { metrics: [] };
}
