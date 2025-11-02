import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const start = performance.now();
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    const envVars = [
      "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY",
      "ALPHAVANTAGE_API_KEY", "EIA_API_KEY", "ABUSEIPDB_API_KEY",
      "NEWSAPI_KEY", "OPENWEATHER_API_KEY"
    ];

    const missingEnv = envVars.filter(v => !Deno.env.get(v));
    const failedAPIs: any[] = [];
    const failedTables: string[] = [];

    // Test API helper
    async function testAPI(name: string, url: string, headers?: Record<string, string>) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const r = await fetch(url, { 
          headers: headers || {},
          signal: controller.signal 
        });
        clearTimeout(timeout);
        
        if (!r.ok && r.status !== 401) throw new Error(`Status ${r.status}`);
        return { name, ok: true, status: r.status };
      } catch (e) {
        failedAPIs.push({ name, error: e.message });
        return { name, ok: false, error: e.message };
      }
    }

    // Test critical APIs
    const apiTests = await Promise.all([
      testAPI("WHO", "https://ghoapi.azureedge.net/api/WHOSIS_000001?$top=1"),
      testAPI("WorldBank", "https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.MKTP.CD?format=json&per_page=1"),
      testAPI("GDELT", "https://api.gdeltproject.org/api/v2/doc/doc?query=test&mode=artlist&maxrecords=1&format=json")
    ]);

    console.log('API test results:', apiTests);

    // Check table access
    const tables = [
      "security_incidents", "critical_alerts", "satellite_observations",
      "governance_global", "vulnerability_scores", "system_errors"
    ];

    for (const tbl of tables) {
      try {
        const { error } = await supabase.from(tbl).select("id").limit(1);
        if (error) {
          console.error(`Table ${tbl} error:`, error);
          failedTables.push(tbl);
        }
      } catch (e) {
        console.error(`Table ${tbl} exception:`, e);
        failedTables.push(tbl);
      }
    }

    const diagnostics = {
      status: missingEnv.length === 0 && failedAPIs.length === 0 && failedTables.length === 0 ? 'healthy' : 'degraded',
      missing_env: missingEnv,
      failed_apis: failedAPIs,
      failed_tables: failedTables,
      latency_ms: Math.round(performance.now() - start)
    };

    // Log diagnostics
    await supabase.from("diagnostics_log").insert(diagnostics);

    // Log errors if system is degraded
    if (diagnostics.status === 'degraded') {
      await supabase.from("system_errors").insert({
        component: "diagnostic",
        message: "System issues detected",
        details: diagnostics,
        severity: failedTables.length > 0 ? 'high' : 'medium'
      });
    }

    console.log('Diagnostics complete:', diagnostics);

    return new Response(JSON.stringify({
      ok: diagnostics.status === 'healthy',
      ...diagnostics,
      timestamp: new Date().toISOString()
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error('Error in log-system-health:', error);
    
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
