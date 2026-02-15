import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, structuredLog, jsonResponse, errorResponse } from "../_shared/resilience.ts";

const FN = "monitor-drift";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const start = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    structuredLog("info", FN, "Starting drift monitoring");

    // 1. Fetch latest and previous calibration metrics
    const { data: metrics } = await supabase
      .from("calibration_metrics")
      .select("metric_name, metric_value, computed_at")
      .order("computed_at", { ascending: false })
      .limit(50);

    if (!metrics || metrics.length === 0) {
      return jsonResponse({ success: true, message: "No metrics to monitor" });
    }

    // Group by metric_name, get latest vs previous
    const byMetric: Record<string, { current: number; previous: number | null; computedAt: string }> = {};
    for (const m of metrics) {
      if (!byMetric[m.metric_name]) {
        byMetric[m.metric_name] = { current: m.metric_value, previous: null, computedAt: m.computed_at };
      } else if (byMetric[m.metric_name].previous === null) {
        byMetric[m.metric_name].previous = m.metric_value;
      }
    }

    const alerts: any[] = [];

    // 2. Check RMSE spike (>30% increase = warning, >60% = critical)
    const rmse = byMetric["rmse"];
    if (rmse && rmse.previous !== null && rmse.previous > 0) {
      const devPct = ((rmse.current - rmse.previous) / rmse.previous) * 100;
      if (devPct > 30) {
        alerts.push({
          alert_type: "rmse_spike",
          model_version: "APE-V2.1",
          metric_name: "rmse",
          current_value: rmse.current,
          baseline_value: rmse.previous,
          deviation_pct: Math.round(devPct * 10) / 10,
          severity: devPct > 60 ? "critical" : "warning",
          details: { message: `RMSE increased ${devPct.toFixed(1)}% from ${rmse.previous} to ${rmse.current}` },
        });
      }
    }

    // 3. Check calibration divergence (hit rates dropping below expected)
    const hit80 = byMetric["hit_rate_80"];
    if (hit80 && hit80.current < 0.70) {
      alerts.push({
        alert_type: "calibration_divergence",
        model_version: "APE-V2.1",
        metric_name: "hit_rate_80",
        current_value: hit80.current,
        baseline_value: 0.80,
        deviation_pct: Math.round(((0.80 - hit80.current) / 0.80) * 100 * 10) / 10,
        severity: hit80.current < 0.55 ? "critical" : "warning",
        details: { message: `80% band hit rate at ${(hit80.current * 100).toFixed(1)}%, expected ~80%` },
      });
    }

    // 4. Check confidence inflation (avg bias consistently positive = overconfidence)
    const bias = byMetric["avg_bias"];
    if (bias && Math.abs(bias.current) > 5) {
      alerts.push({
        alert_type: "confidence_inflation",
        model_version: "APE-V2.1",
        metric_name: "avg_bias",
        current_value: bias.current,
        baseline_value: 0,
        deviation_pct: Math.abs(bias.current) * 10,
        severity: Math.abs(bias.current) > 10 ? "critical" : "warning",
        details: { message: `Forecast bias at ${bias.current.toFixed(2)}, indicating ${bias.current > 0 ? 'under-prediction' : 'over-prediction'}` },
      });
    }

    // 5. Check structural break frequency
    const { count: recentBreaks } = await supabase
      .from("forecast_archive")
      .select("id", { count: "exact", head: true })
      .eq("structural_break_flag", true)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

    const { count: totalRecent } = await supabase
      .from("forecast_archive")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

    if (totalRecent && totalRecent > 10 && recentBreaks) {
      const breakRate = recentBreaks / totalRecent;
      if (breakRate > 0.3) {
        alerts.push({
          alert_type: "break_frequency",
          model_version: "APE-V2.1",
          metric_name: "structural_break_rate",
          current_value: Math.round(breakRate * 100),
          baseline_value: 15,
          deviation_pct: Math.round(((breakRate * 100 - 15) / 15) * 100),
          severity: breakRate > 0.5 ? "critical" : "warning",
          details: { message: `${recentBreaks}/${totalRecent} forecasts have structural breaks (${(breakRate * 100).toFixed(0)}%)` },
        });
      }
    }

    // 6. Insert alerts (dedup by type within 24h)
    let inserted = 0;
    for (const alert of alerts) {
      const { data: existing } = await supabase
        .from("drift_alerts")
        .select("id")
        .eq("alert_type", alert.alert_type)
        .eq("acknowledged", false)
        .gte("created_at", new Date(Date.now() - 86400000).toISOString())
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("drift_alerts").insert(alert);
        inserted++;
      }
    }

    // 7. Log telemetry
    await supabase.from("operational_telemetry").insert({
      function_name: FN,
      execution_time_ms: Date.now() - start,
      status: "success",
      items_processed: alerts.length,
      metadata: { alerts_found: alerts.length, alerts_inserted: inserted },
    });

    structuredLog("info", FN, `Drift check complete: ${alerts.length} alerts, ${inserted} new`, undefined, start);
    return jsonResponse({ success: true, alerts_found: alerts.length, alerts_inserted: inserted });
  } catch (error) {
    structuredLog("error", FN, (error as Error).message, undefined, start);
    return errorResponse(error);
  }
});
