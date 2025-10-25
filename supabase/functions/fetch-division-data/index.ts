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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { division } = await req.json();

    console.log(`Fetching data for division: ${division || 'all'}`);

    // Invoke the appropriate data fetching functions based on division
    const results: any = {};

    if (!division || division === 'finance') {
      const { data: coingeckoData } = await supabase.functions.invoke('pull-coingecko');
      const { data: alphaVantageData } = await supabase.functions.invoke('pull-alpha-vantage');
      results.finance = { coingecko: coingeckoData, alphaVantage: alphaVantageData };
    }

    if (!division || division === 'energy') {
      const { data: owidData } = await supabase.functions.invoke('pull-owid-energy');
      const { data: eiaData } = await supabase.functions.invoke('pull-eia-energy');
      results.energy = { owid: owidData, eia: eiaData };
    }

    if (!division || division === 'food') {
      const { data: foodData } = await supabase.functions.invoke('pull-faostat-food');
      results.food = foodData;
    }

    if (!division || division === 'health') {
      const { data: healthData } = await supabase.functions.invoke('pull-owid-health');
      results.health = healthData;
    }

    if (!division || division === 'defense') {
      const { data: nvdData } = await supabase.functions.invoke('pull-nvd-security');
      results.defense = { nvd: nvdData };
    }

    // Update last_synced_at for the division(s)
    const divisions = division ? [division] : ['finance', 'energy', 'food', 'health', 'defense', 'governance', 'diplomacy', 'crisis', 'logistics', 'education'];
    
    await supabase
      .from('ai_divisions')
      .update({ last_synced_at: new Date().toISOString() })
      .in('division_key', divisions);

    // Log to system
    await supabase.from('system_logs').insert({
      level: 'info',
      category: 'data_sync',
      message: `Data fetched for divisions: ${divisions.join(', ')}`,
      metadata: { results }
    });

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: "Division data fetched successfully",
        divisions: divisions,
        results 
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-division-data error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
