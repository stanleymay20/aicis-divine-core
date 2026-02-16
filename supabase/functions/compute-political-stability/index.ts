import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Constants ──────────────────────────────────────────────────────
const MODEL_VERSION = "PSM-V1.0";
const MOMENTUM_WINDOW = 30;   // days for OLS protest momentum
const VOLATILITY_WINDOW = 90; // days for volatility computation
const T_STAT_THRESHOLD = 1.5; // significance filter

// ─── Math Utilities ─────────────────────────────────────────────────

/** OLS regression: returns { slope, tstat } */
function olsRegression(values: number[]): { slope: number; tstat: number } {
  const n = values.length;
  if (n < 3) return { slope: 0, tstat: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, tstat: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // Residual standard error
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    sse += (values[i] - predicted) ** 2;
  }
  const rse = Math.sqrt(sse / (n - 2));
  const seSlope = rse / Math.sqrt(sumXX - sumX * sumX / n);

  const tstat = seSlope > 0 ? slope / seSlope : 0;
  return { slope, tstat };
}

/** CUSUM structural break detection on residuals */
function detectCUSUMBreak(values: number[]): { breakDetected: boolean; pValue: number } {
  const n = values.length;
  if (n < 10) return { breakDetected: false, pValue: 1 };

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) || 1;

  let cusum = 0;
  let maxCusum = 0;
  for (const v of values) {
    cusum += (v - mean) / std;
    maxCusum = Math.max(maxCusum, Math.abs(cusum));
  }

  const normalizedMax = maxCusum / Math.sqrt(n);
  // Approximate p-value using Brownian bridge critical values
  const pValue = normalizedMax > 1.36 ? 0.01 : normalizedMax > 1.22 ? 0.05 : normalizedMax > 1.07 ? 0.10 : 0.50;

  return { breakDetected: pValue < 0.05, pValue };
}

/** Downside volatility */
function computeVolatility(values: number[]): number {
  if (values.length < 5) return 0;
  const diffs: number[] = [];
  for (let i = 1; i < values.length; i++) {
    diffs.push(values[i] - values[i - 1]);
  }
  const negDiffs = diffs.filter(d => d > 0); // Increases in event count = bad
  if (negDiffs.length === 0) return 0;
  const mean = negDiffs.reduce((a, b) => a + b, 0) / negDiffs.length;
  return Math.sqrt(negDiffs.reduce((a, v) => a + (v - mean) ** 2, 0) / negDiffs.length);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const lookbackDate = new Date(today.getTime() - VOLATILITY_WINDOW * 86400000)
    .toISOString().split("T")[0];

  try {
    // 1. Fetch all political events in the volatility window
    const { data: events, error: evErr } = await sb
      .from("political_events")
      .select("iso3, event_date, event_type, event_count, avg_tone, goldstein_scale")
      .gte("event_date", lookbackDate)
      .order("event_date", { ascending: true });

    if (evErr) throw new Error(`Events query failed: ${evErr.message}`);
    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No events to process", scores: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch upcoming elections (next 180 days)
    const futureDate = new Date(today.getTime() + 180 * 86400000).toISOString().split("T")[0];
    const { data: elections } = await sb
      .from("election_calendar")
      .select("iso3, election_date, election_type")
      .gte("election_date", todayStr)
      .lte("election_date", futureDate);

    // Build election proximity map
    const electionMap = new Map<string, number>();
    for (const el of elections || []) {
      const daysTo = Math.max(1, Math.round(
        (new Date(el.election_date).getTime() - today.getTime()) / 86400000
      ));
      const existing = electionMap.get(el.iso3);
      if (!existing || daysTo < existing) {
        electionMap.set(el.iso3, daysTo);
      }
    }

    // 3. Group events by country
    const countryEvents = new Map<string, typeof events>();
    for (const ev of events) {
      const list = countryEvents.get(ev.iso3) || [];
      list.push(ev);
      countryEvents.set(ev.iso3, list);
    }

    // 4. Compute scores per country
    const scores: any[] = [];
    let computed = 0;

    for (const [iso3, evts] of countryEvents) {
      // Aggregate daily total event counts
      const dailyMap = new Map<string, number>();
      for (const ev of evts) {
        dailyMap.set(ev.event_date, (dailyMap.get(ev.event_date) || 0) + ev.event_count);
      }

      // Build time series (sorted by date)
      const sortedDates = [...dailyMap.keys()].sort();
      const dailySeries = sortedDates.map(d => dailyMap.get(d) || 0);

      // Protest momentum (OLS on last 30 days)
      const momentumSlice = dailySeries.slice(-MOMENTUM_WINDOW);
      const { slope, tstat } = olsRegression(momentumSlice);
      const significantMomentum = Math.abs(tstat) >= T_STAT_THRESHOLD;

      // Volatility
      const volatility = computeVolatility(dailySeries);

      // CUSUM break detection
      const { breakDetected, pValue } = detectCUSUMBreak(dailySeries);

      // Conflict density (total events in window)
      const totalEvents = dailySeries.reduce((a, b) => a + b, 0);

      // Average tone (negative = hostile)
      const tones = evts.filter(e => e.avg_tone != null).map(e => Number(e.avg_tone));
      const avgTone = tones.length > 0 ? tones.reduce((a, b) => a + b, 0) / tones.length : 0;

      // Election volatility risk
      const daysToElection = electionMap.get(iso3) || null;
      let electionRisk = 0;
      if (daysToElection !== null) {
        // Exponential decay: risk increases as election approaches
        electionRisk = Math.min(100, Math.round(100 * Math.exp(-daysToElection / 30)));
      }

      // Composite stability score (0 = unstable, 100 = stable)
      // Invert: high events + negative tone + momentum = low stability
      const eventPressure = Math.min(100, totalEvents / 2); // Scale
      const tonePressure = Math.min(100, Math.max(0, (-avgTone) * 10)); // Negative tone = pressure
      const momentumPressure = significantMomentum && slope > 0
        ? Math.min(100, slope * 20)
        : 0;

      const rawInstability = (
        eventPressure * 0.35 +
        tonePressure * 0.15 +
        momentumPressure * 0.25 +
        electionRisk * 0.15 +
        volatility * 0.10
      );

      const stabilityScore = Math.max(0, Math.min(100, Math.round(100 - rawInstability)));

      // Confidence: based on data density
      const dataDensity = sortedDates.length / VOLATILITY_WINDOW;
      const confidence = Math.min(95, Math.round(dataDensity * 80 + 10));

      scores.push({
        iso3,
        score_date: todayStr,
        stability_score: stabilityScore,
        protest_momentum: Math.round(slope * 1000) / 1000,
        protest_momentum_tstat: Math.round(tstat * 100) / 100,
        conflict_density: totalEvents,
        election_volatility_risk: electionRisk,
        volatility_index: Math.round(volatility * 100) / 100,
        structural_break_flag: breakDetected,
        structural_break_pvalue: pValue,
        confidence_score: confidence,
        days_to_next_election: daysToElection,
        mode: "shadow",
        model_version: MODEL_VERSION,
        raw_metrics: {
          event_pressure: Math.round(eventPressure * 10) / 10,
          tone_pressure: Math.round(tonePressure * 10) / 10,
          momentum_pressure: Math.round(momentumPressure * 10) / 10,
          avg_tone: Math.round(avgTone * 100) / 100,
          data_density: Math.round(dataDensity * 100) / 100,
          series_length: dailySeries.length,
        },
      });
      computed++;
    }

    // 5. Upsert scores
    if (scores.length > 0) {
      const { error: upsertErr } = await sb
        .from("political_stability_scores")
        .upsert(scores, { onConflict: "iso3,score_date,model_version" });

      if (upsertErr) throw new Error(`Score upsert failed: ${upsertErr.message}`);
    }

    // Log
    await sb.from("automation_logs").insert({
      job_name: "compute-political-stability",
      status: "success",
      message: `Shadow mode: computed ${computed} countries, ${scores.filter(s => s.structural_break_flag).length} breaks detected`,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        mode: "shadow",
        countries_computed: computed,
        breaks_detected: scores.filter(s => s.structural_break_flag).length,
        avg_stability: scores.length > 0
          ? Math.round(scores.reduce((a, s) => a + s.stability_score, 0) / scores.length)
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("compute-political-stability error:", e);

    await sb.from("automation_logs").insert({
      job_name: "compute-political-stability",
      status: "error",
      message: e instanceof Error ? e.message : "Unknown",
    });

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
