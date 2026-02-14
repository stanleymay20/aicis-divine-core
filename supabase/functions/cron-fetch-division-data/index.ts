import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Circuit Breaker State ──────────────────────────────────────────
interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}
const circuits = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60_000;

function isCircuitOpen(key: string): boolean {
  const s = circuits.get(key);
  if (!s || !s.open) return false;
  if (Date.now() - s.lastFailure > CIRCUIT_RESET_MS) {
    s.open = false;
    s.failures = 0;
    return false;
  }
  return true;
}

function recordResult(key: string, success: boolean): void {
  if (success) {
    circuits.set(key, { failures: 0, lastFailure: 0, open: false });
    return;
  }
  const s = circuits.get(key) || { failures: 0, lastFailure: 0, open: false };
  s.failures += 1;
  s.lastFailure = Date.now();
  if (s.failures >= CIRCUIT_THRESHOLD) s.open = true;
  circuits.set(key, s);
}

async function retryCall<T>(fn: () => Promise<T>, retries = 2, baseMs = 400): Promise<T> {
  let last: Error | undefined;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (i < retries) await new Promise(r => setTimeout(r, baseMs * Math.pow(2, i)));
    }
  }
  throw last;
}

// ─── Main Handler ───────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    console.log("Starting hourly division data fetch with resilience...");

    const results: { successes: any[]; failures: any[]; skipped: string[] } = {
      successes: [], failures: [], skipped: []
    };

    const pullFunctions = [
      'pull-coingecko',
      'pull-owid-energy',
      'pull-faostat-food',
      'pull-owid-health',
    ];

    for (const funcName of pullFunctions) {
      if (isCircuitOpen(funcName)) {
        results.skipped.push(funcName);
        console.warn(`⊘ ${funcName} skipped — circuit open`);
        continue;
      }
      try {
        const data = await retryCall(async () => {
          const { data, error } = await supabase.functions.invoke(funcName);
          if (error) throw error;
          return data;
        });
        recordResult(funcName, true);
        results.successes.push({ function: funcName, data });
        console.log(`✓ ${funcName} completed`);
      } catch (error) {
        recordResult(funcName, false);
        results.failures.push({
          function: funcName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`✗ ${funcName} failed:`, error);
      }
    }

    // Update division status (non-critical — fire & forget with retry)
    try {
      await retryCall(() => supabase.functions.invoke('update-division-status'), 1);
    } catch (e) {
      console.warn('Division status update failed:', e);
    }

    // Log execution
    await supabase.from('automation_logs').insert({
      job_name: 'cron-fetch-division-data',
      status: results.failures.length === 0 ? 'success' : 'partial',
      message: `Fetched ${results.successes.length}/${pullFunctions.length}, skipped ${results.skipped.length}`
    });

    return new Response(
      JSON.stringify({ ok: true, message: "Hourly fetch completed", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("cron-fetch-division-data error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
