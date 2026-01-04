import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const QuerySchema = z.object({
  query: z.string().min(1).max(200).optional(),
  iso3: z.string().length(3).optional(),
  country: z.string().min(1).max(100).optional(),
}).refine(data => data.query || data.iso3 || data.country, {
  message: "At least one of query, iso3, or country must be provided"
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    
    // Validate input
    const validation = QuerySchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ 
        error: 'Invalid input', 
        details: validation.error.issues 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { query, iso3, country } = validation.data;
    const searchTerm = query || country || iso3 || '';
    
    // 1. Resolve location dynamically from geo_catalog or ISO lookup
    const location = await resolveLocation(searchTerm, supabase);
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
      energy: await fetchEnergyData(location.iso3, supabase),
      finance: await fetchFinanceData(location.iso3),
      population: await fetchPopulationData(location.iso3),
      climate: await fetchClimateData(location.lat, location.lon),
      food: await fetchFoodData(location.iso3, supabase),
      security: await fetchSecurityData(location.iso3, supabase)
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
      country_name: location.name,
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

// Dynamic location resolver - no hardcoded countries
async function resolveLocation(query: string, supabase: any) {
  const normalized = query.trim().toLowerCase();
  
  // 1. Check geo_catalog cache first
  const { data: cached } = await supabase
    .from('geo_catalog')
    .select('*')
    .or(`name.ilike.%${normalized}%,iso3.ilike.${normalized}`)
    .limit(1)
    .maybeSingle();
    
  if (cached) {
    return { name: cached.name, iso3: cached.iso3, lat: cached.lat, lon: cached.lon };
  }

  // 2. Try World Bank API for country lookup (covers all countries)
  try {
    const wbResponse = await fetch(`https://api.worldbank.org/v2/country/${normalized.toUpperCase()}?format=json`);
    const wbData = await wbResponse.json();
    if (Array.isArray(wbData) && wbData[1] && wbData[1][0]) {
      const country = wbData[1][0];
      const result = {
        name: country.name,
        iso3: country.id,
        lat: parseFloat(country.latitude) || 0,
        lon: parseFloat(country.longitude) || 0
      };
      
      // Cache the result
      await supabase.from('geo_catalog').upsert({
        name: result.name,
        iso3: result.iso3,
        lat: result.lat,
        lon: result.lon,
        resolved_at: new Date().toISOString()
      });
      
      return result;
    }
  } catch (e) {
    console.error('World Bank lookup failed:', e);
  }

  // 3. Try Nominatim geocoding as fallback
  try {
    const nominatimResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
      { headers: { 'User-Agent': 'AICIS/1.0' } }
    );
    const nominatimData = await nominatimResponse.json();
    if (nominatimData[0]) {
      const place = nominatimData[0];
      const countryCode = place.address?.country_code?.toUpperCase() || query.substring(0, 3).toUpperCase();
      
      // Convert ISO2 to ISO3 via World Bank
      let iso3 = countryCode;
      try {
        const wbLookup = await fetch(`https://api.worldbank.org/v2/country/${countryCode}?format=json`);
        const wbLookupData = await wbLookup.json();
        if (Array.isArray(wbLookupData) && wbLookupData[1] && wbLookupData[1][0]) {
          iso3 = wbLookupData[1][0].id;
        }
      } catch (e) {
        console.error('ISO3 lookup failed:', e);
      }

      const result = {
        name: place.address?.country || place.display_name.split(',').pop()?.trim() || query,
        iso3,
        lat: parseFloat(place.lat),
        lon: parseFloat(place.lon)
      };
      
      // Cache the result
      await supabase.from('geo_catalog').upsert({
        name: result.name,
        iso3: result.iso3,
        lat: result.lat,
        lon: result.lon,
        resolved_at: new Date().toISOString()
      });
      
      return result;
    }
  } catch (e) {
    console.error('Nominatim lookup failed:', e);
  }

  // 4. Final fallback - return with unknown coordinates
  return { name: query, iso3: query.substring(0, 3).toUpperCase(), lat: 0, lon: 0 };
}

// Data fetchers - all work with any ISO3 code dynamically
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

async function fetchEnergyData(iso3: string, supabase: any) {
  // Query from existing energy_grid table
  try {
    const { data } = await supabase
      .from('energy_grid')
      .select('*')
      .ilike('region', `%${iso3}%`)
      .limit(10);
    
    if (data && data.length > 0) {
      return {
        metrics: data.map((item: any) => ({
          metric: 'grid_capacity',
          period: item.created_at?.substring(0, 4) || '2024',
          value: item.capacity || 0,
          unit: 'MW',
          source: 'internal',
          raw: item
        }))
      };
    }
  } catch (error) {
    console.error('Energy fetch error:', error);
  }
  
  // Fallback to World Bank electricity access data
  try {
    const response = await fetch(
      `https://api.worldbank.org/v2/country/${iso3}/indicator/EG.ELC.ACCS.ZS?format=json&per_page=10`
    );
    const data = await response.json();
    
    if (Array.isArray(data) && data[1]) {
      return {
        metrics: data[1].map((item: any) => ({
          metric: 'electricity_access',
          period: item.date,
          value: parseFloat(item.value) || 0,
          unit: '%',
          source: 'worldbank',
          raw: item
        })).filter((m: any) => m.value !== 0)
      };
    }
  } catch (error) {
    console.error('Energy WB fetch error:', error);
  }
  
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
  if (lat === 0 && lon === 0) return { metrics: [] };
  
  // NASA POWER API for climate data
  try {
    const response = await fetch(
      `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&community=RE&longitude=${lon}&latitude=${lat}&start=20230101&end=20231231&format=JSON`
    );
    const data = await response.json();
    
    if (data.properties?.parameter?.T2M) {
      const temps = Object.entries(data.properties.parameter.T2M).slice(-30);
      return {
        metrics: temps.map(([date, value]: [string, any]) => ({
          metric: 'temperature_2m',
          period: date,
          value: parseFloat(value) || 0,
          unit: '°C',
          source: 'nasa_power',
          raw: { date, value }
        })).filter((m: any) => m.value !== -999)
      };
    }
  } catch (error) {
    console.error('Climate fetch error:', error);
  }
  return { metrics: [] };
}

async function fetchFoodData(iso3: string, supabase: any) {
  // Query from existing food_security table
  try {
    const { data } = await supabase
      .from('food_security')
      .select('*')
      .eq('country', iso3)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data && data.length > 0) {
      return {
        metrics: data.map((item: any) => ({
          metric: 'food_security_index',
          period: item.created_at?.substring(0, 4) || '2024',
          value: item.yield_index || item.supply_days || 0,
          unit: 'index',
          source: 'internal',
          raw: item
        }))
      };
    }
  } catch (error) {
    console.error('Food internal fetch error:', error);
  }

  // Fallback to World Bank food production data
  try {
    const response = await fetch(
      `https://api.worldbank.org/v2/country/${iso3}/indicator/AG.PRD.FOOD.XD?format=json&per_page=10`
    );
    const data = await response.json();
    
    if (Array.isArray(data) && data[1]) {
      return {
        metrics: data[1].map((item: any) => ({
          metric: 'food_production_index',
          period: item.date,
          value: parseFloat(item.value) || 0,
          unit: 'index',
          source: 'worldbank',
          raw: item
        })).filter((m: any) => m.value !== 0)
      };
    }
  } catch (error) {
    console.error('Food WB fetch error:', error);
  }
  
  return { metrics: [] };
}

async function fetchSecurityData(iso3: string, supabase: any) {
  // Query from existing security_incidents table
  try {
    const { data } = await supabase
      .from('security_incidents')
      .select('*')
      .eq('country', iso3)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data && data.length > 0) {
      return {
        metrics: data.map((item: any) => ({
          metric: 'security_incident_count',
          period: item.created_at?.substring(0, 10) || '2024',
          value: item.severity || 1,
          unit: 'incidents',
          source: 'internal',
          raw: item
        }))
      };
    }
  } catch (error) {
    console.error('Security internal fetch error:', error);
  }

  // Fallback to World Bank political stability data
  try {
    const response = await fetch(
      `https://api.worldbank.org/v2/country/${iso3}/indicator/PV.EST?format=json&per_page=10`
    );
    const data = await response.json();
    
    if (Array.isArray(data) && data[1]) {
      return {
        metrics: data[1].map((item: any) => ({
          metric: 'political_stability',
          period: item.date,
          value: parseFloat(item.value) || 0,
          unit: 'index',
          source: 'worldbank',
          raw: item
        })).filter((m: any) => m.value !== 0)
      };
    }
  } catch (error) {
    console.error('Security WB fetch error:', error);
  }
  
  return { metrics: [] };
}
