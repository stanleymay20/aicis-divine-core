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

    console.log("Invoking pull-owid-energy and pull-eia-energy for live energy data...");
    
    const { data: owidData, error: owidError } = await supabase.functions.invoke('pull-owid-energy', {
      body: {}
    });

    const { data: eiaData, error: eiaError } = await supabase.functions.invoke('pull-eia-energy', {
      body: {}
    });

    if (owidError) console.error("OWID error:", owidError);
    if (eiaError) console.error("EIA error:", eiaError);

    // Trigger impact evaluation and learning
    await supabase.functions.invoke('evaluate-impact');
    await supabase.functions.invoke('learn-policy-weights');

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: "Energy data refreshed successfully from multiple sources",
        data: { owid: owidData, eia: eiaData }
      }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("fetch-energy-live error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
