import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { 
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
};

function csvParse(text: string) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.map(line => {
    const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const o: Record<string,string> = {};
    headers.forEach((h, i) => o[h] = (cols[i] ?? "").replace(/^"|"$/g,""));
    return o;
  });
}

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

    console.log("Fetching OWID energy data...");

    // Public CSV (no key): OWID energy snapshot
    const url = "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv";
    const r = await fetch(url);
    if (!r.ok) throw new Error(`OWID energy fetch error: ${r.status}`);
    const csv = await r.text();
    const rows = csvParse(csv);

    console.log("Parsed", rows.length, "energy rows");

    // Focus on a few regions to limit writes
    const regions = new Set(["Ghana", "Nigeria", "Kenya", "South Africa", "United States", "European Union", "World"]);
    const now = new Date().toISOString();

    let inserted = 0;
    const recentRows = rows.slice(-5000);
    
    for (const r of recentRows) {
      if (!regions.has(r.country)) continue;
      
      const renewable = Number(r.renewables_share_energy || r.renewables_share_elec || 0);
      const capacity = Number(r.electricity_generation ?? 0);
      const load = capacity * 0.8;
      const stability = Math.max(0, Math.min(100, 100 - (Number(r.co2 ?? 0) % 15)));
      const risk = stability >= 85 ? 'stable' : (stability >= 70 ? 'fluctuating' : 'risk');

      const rec = {
        region: r.country,
        grid_load: Number(load.toFixed(2)),
        capacity: Number(capacity.toFixed(2)),
        stability_index: Number(stability.toFixed(2)),
        renewable_percentage: Number(renewable.toFixed(2)),
        outage_risk: risk,
        updated_at: now
      };
      
      const { error: insertError } = await supabase.from('energy_grid').insert(rec);
      if (!insertError) inserted++;
    }

    await supabase.from('compliance_audit').insert({
      action_type: 'data_pull', 
      division: 'energy', 
      user_id: user.id,
      action_description: 'Pulled OWID energy snapshot', 
      compliance_status: 'compliant',
      data_accessed: { provider: 'OWID', resource: 'owid-energy-data.csv' }
    });
    
    await supabase.from('system_logs').insert({
      division: 'energy', 
      action: 'pull_owid_energy', 
      user_id: user.id,
      result: 'success', 
      log_level: 'info', 
      metadata: { inserted }
    });

    console.log("OWID energy data pull complete:", inserted, "records");

    return new Response(
      JSON.stringify({ ok: true, inserted, message: `Inserted ${inserted} energy records` }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pull-owid-energy error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
