import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function retryCall<T>(fn: () => Promise<T>, retries = 2, baseMs = 300): Promise<T> {
  let last: Error | undefined;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); } catch (e) {
      last = e instanceof Error ? e : new Error(String(e));
      if (i < retries) await new Promise(r => setTimeout(r, baseMs * Math.pow(2, i)));
    }
  }
  throw last;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const healthChecks: any[] = [];
    const startTime = Date.now();

    // 1. Database health (with retry)
    try {
      const dbStart = Date.now();
      await retryCall(async () => {
        const { error } = await supabase.from("organizations").select("count").limit(1).single();
        if (error) throw error;
      });
      healthChecks.push({ component: "database", status: "healthy", response_time_ms: Date.now() - dbStart });
    } catch (error: unknown) {
      healthChecks.push({ component: "database", status: "down", error_message: error instanceof Error ? error.message : 'Unknown error' });
    }

    // 2. Storage health (with retry)
    try {
      const storageStart = Date.now();
      await retryCall(async () => {
        const { error } = await supabase.storage.listBuckets();
        if (error) throw error;
      });
      healthChecks.push({ component: "storage", status: "healthy", response_time_ms: Date.now() - storageStart });
    } catch (error: unknown) {
      healthChecks.push({ component: "storage", status: "degraded", error_message: error instanceof Error ? error.message : 'Unknown error' });
    }

    // 3. Edge functions health (self-check)
    healthChecks.push({ component: "edge_functions", status: "healthy", response_time_ms: Date.now() - startTime });

    // Log health checks (best-effort, don't fail if logging fails)
    try {
      for (const check of healthChecks) {
        await supabase.from("system_health").insert(check);
      }
    } catch (logErr) {
      console.warn("Failed to log health checks:", logErr);
    }

    const overallStatus = healthChecks.every((c) => c.status === "healthy")
      ? "healthy"
      : healthChecks.some((c) => c.status === "down")
      ? "down"
      : "degraded";

    return new Response(
      JSON.stringify({ ok: true, status: overallStatus, checks: healthChecks, timestamp: new Date().toISOString() }),
      { status: overallStatus === "down" ? 503 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Health check error:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
