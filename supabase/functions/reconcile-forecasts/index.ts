import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resilientCall, structuredLog, handleCors, corsHeaders, errorResponse, jsonResponse } from "../_shared/resilience.ts";

const FN = "reconcile-forecasts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const start = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    structuredLog("info", FN, "Starting forecast reconciliation");

    // 1. Find archived forecasts older than 90 days that haven't been reconciled
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const { data: expiredForecasts, error: fetchErr } = await resilientCall(
      `${FN}:fetch-expired`,
      async () => {
        const { data, error } = await supabase
          .from("forecast_archive")
          .select("id, iso3, domain, performance_index, forecast_90d, forecast_upper_80, forecast_lower_80, forecast_upper_95, forecast_lower_95, confidence_score, created_at")
          .lt("created_at", cutoff.toISOString())
          .limit(200);
        if (error) throw error;
        return { data, error };
      },
      { maxRetries: 2, timeoutMs: 15000 }
    );

    if (fetchErr || !expiredForecasts) {
      throw new Error(`Failed to fetch expired forecasts: ${fetchErr}`);
    }

    // Filter out already-reconciled
    const forecastIds = expiredForecasts.map((f: any) => f.id);
    const { data: existing } = await supabase
      .from("forecast_outcomes")
      .select("forecast_archive_id")
      .in("forecast_archive_id", forecastIds.length > 0 ? forecastIds : ["__none__"]);

    const reconciledSet = new Set((existing || []).map((e: any) => e.forecast_archive_id));
    const unreconciled = expiredForecasts.filter((f: any) => !reconciledSet.has(f.id));

    structuredLog("info", FN, `Found ${unreconciled.length} unreconciled forecasts`);

    let reconciled = 0;
    const errors: string[] = [];

    for (const forecast of unreconciled) {
      try {
        // 2. Get the most recent snapshot for same iso3+domain as "realized" value
        const { data: latestSnap } = await supabase
          .from("country_performance_snapshots")
          .select("performance_index, snapshot_date")
          .eq("iso3", forecast.iso3)
          .eq("domain", forecast.domain)
          .order("snapshot_date", { ascending: false })
          .limit(1);

        if (!latestSnap || latestSnap.length === 0) continue;

        const realized = latestSnap[0].performance_index;
        const predicted = forecast.forecast_90d;

        if (predicted === null || predicted === undefined) continue;

        const absoluteError = Math.abs(realized - predicted);
        const squaredError = (realized - predicted) ** 2;
        const bias = realized - predicted; // positive = under-predicted
        const inside80 = realized >= (forecast.forecast_lower_80 ?? -Infinity) &&
                         realized <= (forecast.forecast_upper_80 ?? Infinity);
        const inside95 = realized >= (forecast.forecast_lower_95 ?? -Infinity) &&
                         realized <= (forecast.forecast_upper_95 ?? Infinity);

        const { error: insertErr } = await supabase
          .from("forecast_outcomes")
          .insert({
            forecast_archive_id: forecast.id,
            realized_value: realized,
            realized_date: latestSnap[0].snapshot_date,
            absolute_error: Math.round(absoluteError * 100) / 100,
            squared_error: Math.round(squaredError * 100) / 100,
            inside_80_band: inside80,
            inside_95_band: inside95,
            bias: Math.round(bias * 100) / 100,
          });

        if (insertErr) {
          // Skip duplicates gracefully
          if (insertErr.code === "23505") continue;
          errors.push(`${forecast.iso3}/${forecast.domain}: ${insertErr.message}`);
        } else {
          reconciled++;
        }
      } catch (err) {
        errors.push(`${forecast.iso3}/${forecast.domain}: ${(err as Error).message}`);
      }
    }

    // 3. Compute aggregate calibration metrics
    const { data: allOutcomes } = await supabase
      .from("forecast_outcomes")
      .select("absolute_error, squared_error, inside_80_band, inside_95_band, bias, realized_value");

    if (allOutcomes && allOutcomes.length > 0) {
      const n = allOutcomes.length;
      const mae = allOutcomes.reduce((s: number, o: any) => s + (o.absolute_error || 0), 0) / n;
      const mse = allOutcomes.reduce((s: number, o: any) => s + (o.squared_error || 0), 0) / n;
      const rmse = Math.sqrt(mse);
      const avgBias = allOutcomes.reduce((s: number, o: any) => s + (o.bias || 0), 0) / n;
      const hit80 = allOutcomes.filter((o: any) => o.inside_80_band).length / n;
      const hit95 = allOutcomes.filter((o: any) => o.inside_95_band).length / n;

      // MAPE: need realized values > 0 to avoid division by zero
      const mapeOutcomes = allOutcomes.filter((o: any) => o.realized_value && Math.abs(o.realized_value) > 0.01);
      const mape = mapeOutcomes.length > 0
        ? mapeOutcomes.reduce((s: number, o: any) => s + Math.abs(o.absolute_error / o.realized_value), 0) / mapeOutcomes.length * 100
        : 0;

      // Normalized RMSE (scale-independent)
      const realizedValues = allOutcomes.map((o: any) => o.realized_value).filter((v: any) => v != null);
      const realizedRange = realizedValues.length > 1
        ? Math.max(...realizedValues) - Math.min(...realizedValues)
        : 1;
      const nrmse = realizedRange > 0 ? rmse / realizedRange : 0;

      const metrics = [
        { metric_name: "mae", metric_value: Math.round(mae * 100) / 100 },
        { metric_name: "rmse", metric_value: Math.round(rmse * 100) / 100 },
        { metric_name: "nrmse", metric_value: Math.round(nrmse * 1000) / 1000 },
        { metric_name: "mape", metric_value: Math.round(mape * 100) / 100 },
        { metric_name: "avg_bias", metric_value: Math.round(avgBias * 100) / 100 },
        { metric_name: "hit_rate_80", metric_value: Math.round(hit80 * 1000) / 1000 },
        { metric_name: "hit_rate_95", metric_value: Math.round(hit95 * 1000) / 1000 },
      ];

      for (const m of metrics) {
        await supabase.from("calibration_metrics").upsert({
          model_version: "APE-V2.1",
          metric_name: m.metric_name,
          metric_value: m.metric_value,
          sample_size: n,
          computed_at: new Date().toISOString(),
        }, { onConflict: "model_version,metric_name" }).select();
      }
    }

    await supabase.from("system_logs").insert({
      division: "intelligence",
      action: "reconcile_forecasts",
      result: "success",
      log_level: "info",
      metadata: { reconciled, total_checked: unreconciled.length, errors: errors.length },
    });

    structuredLog("info", FN, `Reconciled ${reconciled} forecasts`, undefined, start);
    return jsonResponse({ success: true, reconciled, checked: unreconciled.length, errors: errors.length });
  } catch (error) {
    structuredLog("error", FN, (error as Error).message, undefined, start);
    return errorResponse(error);
  }
});
