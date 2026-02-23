import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { structuredLog, handleCors, errorResponse, jsonResponse } from "../_shared/resilience.ts";

const FN = "cron-global-intelligence";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    structuredLog('info', FN, 'Starting global data collection cycle');
    await supabase.from("automation_logs").insert({
      job_name: FN, status: "running", message: "Starting global data collection cycle",
    });

    const results: { finance: any; security: any; health: any; food: any; governance: any; errors: string[] } = {
      finance: null, security: null, health: null, food: null, governance: null, errors: []
    };

    const [financeRes, securityRes, healthRes, foodRes, governanceRes] = await Promise.allSettled([
      supabase.functions.invoke("fetch-finance-global"),
      supabase.functions.invoke("fetch-security-global"),
      supabase.functions.invoke("fetch-health-global"),
      supabase.functions.invoke("fetch-food-global"),
      supabase.functions.invoke("fetch-governance-global")
    ]);

    if (financeRes.status === 'fulfilled') results.finance = financeRes.value.data;
    else results.errors.push(`Finance: ${financeRes.reason}`);
    if (securityRes.status === 'fulfilled') results.security = securityRes.value.data;
    else results.errors.push(`Security: ${securityRes.reason}`);
    if (healthRes.status === 'fulfilled') results.health = healthRes.value.data;
    else results.errors.push(`Health: ${healthRes.reason}`);
    if (foodRes.status === 'fulfilled') results.food = foodRes.value.data;
    else results.errors.push(`Food: ${foodRes.reason}`);
    if (governanceRes.status === 'fulfilled') results.governance = governanceRes.value.data;
    else results.errors.push(`Governance: ${governanceRes.reason}`);

    // Trigger vulnerability calculation (now uses service_role_key internally)
    await supabase.functions.invoke("calculate-vulnerability").catch(e =>
      structuredLog('warn', FN, `Vulnerability calc failed: ${(e as Error).message}`)
    );

    // ─── PHASE 3: Freshness Guardrails ──────────────────────────────
    try {
      const freshnessChecks = [
        { table: 'finance_data', label: 'Finance' },
        { table: 'health_metrics', label: 'Health' },
        { table: 'food_data', label: 'Food' },
        { table: 'security_events', label: 'Security' },
        { table: 'crisis_events', label: 'Crisis' },
        { table: 'intelligence_signals', label: 'Intelligence' },
      ];

      for (const check of freshnessChecks) {
        const { data } = await supabase
          .from(check.table)
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const lastInsert = data?.created_at ? new Date(data.created_at) : null;
        const hoursAgo = lastInsert ? (Date.now() - lastInsert.getTime()) / 3600000 : Infinity;

        if (hoursAgo > 48) {
          const msg = `STALE: ${check.label} (${check.table}) — no data in ${hoursAgo === Infinity ? '∞' : Math.round(hoursAgo)}h`;
          structuredLog('warn', FN, msg);

          await supabase.from('automation_logs').insert({
            job_name: `freshness-${check.table}`,
            status: 'warning',
            message: msg,
          });

          await supabase.from('alerts').insert({
            title: `Data Freshness Alert: ${check.label}`,
            message: msg,
            severity: hoursAgo > 168 ? 'critical' : 'high',
            division: 'system',
            metadata: { type: 'freshness_guardrail', table: check.table, hours_stale: Math.round(hoursAgo) },
          });
        }
      }
    } catch (e) {
      structuredLog('warn', FN, `Freshness check failed: ${(e as Error).message}`);
    }

    await supabase.from("automation_logs").insert({
      job_name: FN,
      status: results.errors.length === 0 ? "success" : "partial",
      message: `Global data collection complete. Errors: ${results.errors.length}`,
    });

    structuredLog('info', FN, `Complete. Errors: ${results.errors.length}`);
    return jsonResponse({ ok: true, results });
  } catch (e) {
    structuredLog('error', FN, (e as Error).message);
    await supabase.from("automation_logs").insert({
      job_name: FN, status: "error", message: (e as Error).message,
    });
    return errorResponse(e);
  }
});
