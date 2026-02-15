import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, structuredLog, jsonResponse, errorResponse } from "../_shared/resilience.ts";

const FN = "monitor-drift";
const EWMA_LAMBDA = 0.2;
const SPC_WINDOW = 30;

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const start = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    structuredLog("info", FN, "Starting SPC-based drift monitoring");

    // 1. Fetch calibration metrics history (rolling window)
    const { data: metrics } = await supabase
      .from("calibration_metrics")
      .select("metric_name, metric_value, computed_at")
      .order("computed_at", { ascending: false })
      .limit(200);

    if (!metrics || metrics.length === 0) {
      return jsonResponse({ success: true, message: "No metrics to monitor" });
    }

    // Group by metric_name with history
    const byMetric: Record<string, number[]> = {};
    const latestValues: Record<string, number> = {};
    for (const m of metrics) {
      if (!byMetric[m.metric_name]) {
        byMetric[m.metric_name] = [];
        latestValues[m.metric_name] = m.metric_value;
      }
      byMetric[m.metric_name].push(m.metric_value);
    }

    const alerts: any[] = [];
    const spcObservations: any[] = [];
    const killSwitchReasons: string[] = [];

    // 2. SPC + EWMA evaluation for each key metric
    const keyMetrics = ["rmse", "mape", "hit_rate_80", "hit_rate_95", "avg_bias"];

    for (const metricName of keyMetrics) {
      const history = byMetric[metricName];
      if (!history || history.length < 5) continue;

      const currentValue = latestValues[metricName];
      const window = history.slice(0, SPC_WINDOW);
      const n = window.length;
      const rollingMean = window.reduce((s, v) => s + v, 0) / n;
      const variance = window.reduce((s, v) => s + (v - rollingMean) ** 2, 0) / n;
      const rollingStd = Math.sqrt(variance);

      // EWMA
      let ewma = window[window.length - 1];
      for (let i = window.length - 2; i >= 0; i--) {
        ewma = EWMA_LAMBDA * window[i] + (1 - EWMA_LAMBDA) * ewma;
      }

      const upperControl = rollingMean + 3 * rollingStd;
      const lowerControl = rollingMean - 3 * rollingStd;
      const outOfControl = rollingStd > 0 && (currentValue > upperControl || currentValue < lowerControl);

      spcObservations.push({
        metric_name: metricName,
        model_version: "APE-V2.1",
        observed_value: currentValue,
        ewma_value: Math.round(ewma * 10000) / 10000,
        rolling_mean: Math.round(rollingMean * 10000) / 10000,
        rolling_std: Math.round(rollingStd * 10000) / 10000,
        upper_control: Math.round(upperControl * 10000) / 10000,
        lower_control: Math.round(lowerControl * 10000) / 10000,
        out_of_control: outOfControl,
      });

      if (outOfControl) {
        const severity = metricName === "rmse" || metricName === "hit_rate_80" ? "critical" : "warning";
        alerts.push({
          alert_type: `spc_${metricName}`,
          model_version: "APE-V2.1",
          metric_name: metricName,
          current_value: currentValue,
          baseline_value: rollingMean,
          deviation_pct: rollingStd > 0 ? Math.round(Math.abs(currentValue - rollingMean) / rollingStd * 100) / 100 : 0,
          severity,
          details: {
            message: `${metricName} is statistically out of control (value=${currentValue}, μ=${rollingMean.toFixed(4)}, 3σ=[${lowerControl.toFixed(4)}, ${upperControl.toFixed(4)}])`,
            ewma: ewma,
            control_type: "EWMA_3sigma",
          },
        });

        // Kill-switch conditions
        if (metricName === "rmse") killSwitchReasons.push("RMSE beyond 3σ control band");
      }

      // Specific kill-switch: hit80 < 60%
      if (metricName === "hit_rate_80" && currentValue < 0.60) {
        killSwitchReasons.push(`Hit80 at ${(currentValue * 100).toFixed(1)}%, below 60% threshold`);
      }

      // Calibration divergence check (EWMA drift from mean > 25%)
      if (metricName === "hit_rate_80" && rollingMean > 0) {
        const divergence = Math.abs(ewma - rollingMean) / rollingMean;
        if (divergence > 0.25) {
          killSwitchReasons.push(`Calibration divergence ${(divergence * 100).toFixed(1)}% > 25%`);
        }
      }
    }

    // 3. Structural break frequency check
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
      if (breakRate > 0.60) {
        killSwitchReasons.push(`Break rate ${(breakRate * 100).toFixed(0)}% > 60%`);
      }
      if (breakRate > 0.30) {
        alerts.push({
          alert_type: "break_frequency",
          model_version: "APE-V2.1",
          metric_name: "structural_break_rate",
          current_value: Math.round(breakRate * 100),
          baseline_value: 15,
          deviation_pct: Math.round(((breakRate * 100 - 15) / 15) * 100),
          severity: breakRate > 0.50 ? "critical" : "warning",
          details: { message: `${recentBreaks}/${totalRecent} forecasts have structural breaks` },
        });
      }
    }

    // 4. Insert SPC observations
    if (spcObservations.length > 0) {
      await supabase.from("spc_control_observations").insert(spcObservations);
    }

    // 5. Kill-switch activation
    if (killSwitchReasons.length > 0) {
      structuredLog("error", FN, `KILL-SWITCH triggered: ${killSwitchReasons.join("; ")}`);
      // Set freeze_forecasts flag
      await supabase.from("system_flags")
        .update({ enabled: true })
        .eq("flag_key", "freeze_forecasts");

      alerts.push({
        alert_type: "kill_switch_activated",
        model_version: "APE-V2.1",
        metric_name: "system_freeze",
        current_value: killSwitchReasons.length,
        baseline_value: 0,
        deviation_pct: 100,
        severity: "critical",
        details: { message: "Automatic kill-switch activated", reasons: killSwitchReasons },
      });
    }

    // 6. Dedup and insert alerts
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
      items_processed: spcObservations.length,
      metadata: {
        alerts_found: alerts.length,
        alerts_inserted: inserted,
        spc_observations: spcObservations.length,
        kill_switch: killSwitchReasons.length > 0,
        kill_reasons: killSwitchReasons,
      },
    });

    structuredLog("info", FN, `SPC check complete: ${spcObservations.length} observations, ${alerts.length} alerts, kill=${killSwitchReasons.length > 0}`, undefined, start);
    return jsonResponse({
      success: true,
      spc_observations: spcObservations.length,
      alerts_found: alerts.length,
      alerts_inserted: inserted,
      kill_switch_activated: killSwitchReasons.length > 0,
      kill_reasons: killSwitchReasons,
    });
  } catch (error) {
    structuredLog("error", FN, (error as Error).message, undefined, start);
    return errorResponse(error);
  }
});
