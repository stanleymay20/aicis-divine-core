import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { 
  "Access-Control-Allow-Origin": "*", 
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" 
};

function csvToObjects(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift()!.split(",");
  return lines.map(l => {
    const cols = l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
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

    console.log("Fetching OWID health data...");

    // Public CSV (no key)
    const url = "https://covid.ourworldindata.org/data/owid-covid-data.csv";
    const r = await fetch(url);
    if (!r.ok) throw new Error(`OWID health fetch error: ${r.status}`);
    const csv = await r.text();
    const rows = csvToObjects(csv);

    console.log("Parsed", rows.length, "health rows");

    const watch = new Set(["GHA","NGA","KEN","ZAF","USA","OWID_EUR","OWID_AFR","OWID_WRL"]);
    const latestByCode: Record<string, any> = {};
    
    for (const row of rows) {
      if (!watch.has(row.iso_code)) continue;
      latestByCode[row.iso_code] = row;
    }

    let inserted = 0;
    const now = new Date().toISOString();
    
    for (const code of Object.keys(latestByCode)) {
      const row = latestByCode[code];
      const region = row.location;
      const newCases = Number(row.new_cases ?? 0);
      const hosp = Number(row.hosp_patients ?? 0);
      const sev = Math.max(0, Math.min(100, (newCases / 1000) * 10 + (hosp / 100) * 5));

      const { error: insertError } = await supabase.from('health_data').insert({
        region,
        disease: 'COVID-19',
        affected_count: Math.max(0, Math.round(newCases + hosp)),
        severity_index: Number(sev.toFixed(2)),
        risk_level: sev >= 75 ? 'critical' : (sev >= 50 ? 'high' : (sev >= 25 ? 'medium' : 'low')),
        updated_at: now,
        metadata: { 
          iso_code: code, 
          new_cases: newCases, 
          hosp_patients: hosp, 
          date: row.date 
        }
      });
      
      if (!insertError) inserted++;
    }

    await supabase.from('compliance_audit').insert({
      action_type: 'data_pull', 
      division: 'health', 
      user_id: user.id,
      action_description: 'Pulled OWID health snapshot', 
      compliance_status: 'compliant',
      data_accessed: { provider: 'OWID', resource: 'owid-covid-data.csv' }
    });
    
    await supabase.from('system_logs').insert({
      division: 'health', 
      action: 'pull_owid_health', 
      user_id: user.id,
      result: 'success', 
      log_level: 'info', 
      metadata: { inserted }
    });

    console.log("OWID health data pull complete:", inserted, "records");

    return new Response(
      JSON.stringify({ ok: true, inserted, message: `Inserted ${inserted} health records` }), 
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pull-owid-health error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
