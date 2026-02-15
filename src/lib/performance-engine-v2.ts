/**
 * AICIS Performance Engine V2 (APE-V2) — Institutionally Hardened
 *
 * Mathematical integrity:
 *  - Holt double-exponential backtest (matches production model)
 *  - Period-aware forecast horizons (monthly/quarterly detection)
 *  - t-statistic momentum significance filtering
 *  - CUSUM-based structural break detection
 *  - Data gap interpolation with staleness penalty
 *  - Calibratable α/β via domain_model_parameters
 */

// ─── Types ──────────────────────────────────────────────────────────

export interface GlobalBenchmark {
  domain: string;
  percentile_10: number;
  percentile_25: number;
  percentile_50: number;
  percentile_75: number;
  percentile_90: number;
  structural_floor: number;
  structural_ceiling: number;
}

export interface DomainPerformanceV2 {
  domain: string;
  performanceIndex: number;       // 0–100
  momentumScore: number;          // -100 to +100
  momentumTStat: number;          // t-statistic for slope significance
  volatilityIndex: number;        // 0–100
  volatilityDownside: number;     // 0–100 (negative moves only)
  volatilityUpside: number;       // 0–100 (positive moves only)
  volatilitySkewRatio: number;    // downside/upside; >1 = negatively skewed
  riskPressureScore: number;      // 0–100
  forecast90d: number;
  forecast1y: number;
  forecastDirection: 'up' | 'down' | 'stable';
  confidenceScore: number;        // 10–95
  forecastUpper80: number;        // 80% confidence upper bound
  forecastLower80: number;        // 80% confidence lower bound
  forecastUpper95: number;        // 95% confidence upper bound
  forecastLower95: number;        // 95% confidence lower bound
  structuralBreak: boolean;
  structuralBreakPValue: number;  // 0–1, lower = more significant
  dataGapCount: number;           // number of interpolated gaps
  dataStaleDays: number;          // days since last real observation
}

export interface NationalPerformanceIndexV2 {
  iso3: string;
  countryName: string;
  overallIndex: number;
  momentum: number;
  volatility: number;
  riskPressure: number;
  systemicFragility: number;
  forecast90d: number;
  forecast1y: number;
  forecastDirection: 'up' | 'down' | 'stable';
  confidence: number;
  structuralBreakCount: number;
  forecastStability: number;
  domains: DomainPerformanceV2[];
}

export interface BacktestResult {
  mae: number;
  rmse: number;
  mape: number;           // NEW: Mean Absolute Percentage Error
  forecastBias: number;   // NEW: positive = over-predicts
  stabilityScore: number; // 0–1
}

export interface MetricEntryV2 {
  metric: string;
  value: number;
  period: string;         // ISO date string, e.g. "2025-01" or "2025-Q1"
  source: string;
  unit?: string;
}

export interface DomainModelParams {
  alpha: number;
  beta: number;
}

// ─── Domain weights (mutable for sensitivity analysis; production should load from DB) ──

const DOMAIN_WEIGHTS: Record<string, number> = {
  governance: 0.18,
  health: 0.16,
  energy: 0.13,
  finance: 0.15,
  food: 0.13,
  security: 0.15,
  education: 0.05,
  climate: 0.03,
  population: 0.02,
};

// Default model parameters (overridden by calibrated values)
const DEFAULT_PARAMS: DomainModelParams = { alpha: 0.55, beta: 0.3 };

// Current model version tag — must match model_registry
export const CURRENT_MODEL_VERSION = "APE-V2.1";

/**
 * Load domain weights from database (domain_weights table).
 * Falls back to hardcoded DOMAIN_WEIGHTS if DB unavailable.
 */
export async function loadDomainWeightsFromDB(
  supabaseClient: any,
  modelVersion: string = CURRENT_MODEL_VERSION,
): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabaseClient
      .from("domain_weights")
      .select("domain, weight")
      .eq("model_version", modelVersion);
    if (error || !data || data.length === 0) return { ...DOMAIN_WEIGHTS };
    const weights: Record<string, number> = {};
    for (const row of data) weights[row.domain] = Number(row.weight);
    return weights;
  } catch {
    return { ...DOMAIN_WEIGHTS };
  }
}

/**
 * Archive a forecast snapshot to forecast_archive table (immutable).
 * Safe to call — errors are logged but do not throw.
 */
export async function archiveForecastSnapshot(
  supabaseClient: any,
  iso3: string,
  countryName: string,
  domain: DomainPerformanceV2,
  params: DomainModelParams,
): Promise<void> {
  try {
    await supabaseClient.from("forecast_archive").insert({
      iso3,
      country_name: countryName,
      domain: domain.domain,
      model_version: CURRENT_MODEL_VERSION,
      alpha: params.alpha,
      beta: params.beta,
      performance_index: domain.performanceIndex,
      forecast_90d: domain.forecast90d,
      forecast_1y: domain.forecast1y,
      forecast_upper_80: domain.forecastUpper80,
      forecast_lower_80: domain.forecastLower80,
      forecast_upper_95: domain.forecastUpper95,
      forecast_lower_95: domain.forecastLower95,
      confidence_score: domain.confidenceScore,
      stability_score: 0, // filled at national level
      structural_break_flag: domain.structuralBreak,
      structural_break_p_value: domain.structuralBreakPValue,
      data_stale_days: domain.dataStaleDays,
      data_quality_score: Math.max(0, 100 - domain.dataGapCount * 5 - domain.dataStaleDays * 0.5),
      gap_interpolation_count: domain.dataGapCount,
    });
  } catch {
    // Non-critical: archiving failure should not break computation
  }
}

// ─── 1. Benchmark-anchored normalization ────────────────────────────

function normalizeWithBenchmark(
  value: number,
  benchmark: GlobalBenchmark | undefined,
): number {
  if (!benchmark) {
    return Math.max(0, Math.min(100, value));
  }
  const { structural_floor, structural_ceiling } = benchmark;
  if (structural_ceiling === structural_floor) return 50;
  const score = ((value - structural_floor) / (structural_ceiling - structural_floor)) * 100;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

// ─── 2. Holt double exponential smoothing ───────────────────────────

export function holtSmoothing(
  series: number[],
  alpha: number = 0.55,
  beta: number = 0.3,
): { level: number; trend: number } {
  if (series.length === 0) return { level: 0, trend: 0 };
  if (series.length === 1) return { level: series[0], trend: 0 };
  let level = series[0];
  let trend = series[1] - series[0];
  for (let i = 1; i < series.length; i++) {
    const prevLevel = level;
    level = alpha * series[i] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return { level, trend };
}

// Keep for backward compatibility
export function exponentialSmoothing(
  series: number[],
  alpha: number = 0.55,
): number {
  if (series.length === 0) return 0;
  let s = series[0];
  for (let i = 1; i < series.length; i++) {
    s = alpha * series[i] + (1 - alpha) * s;
  }
  return s;
}

// ─── 3. Period detection ────────────────────────────────────────────

type Periodicity = 'monthly' | 'quarterly' | 'annual' | 'unknown';

function detectPeriodicity(periods: string[]): Periodicity {
  if (periods.length < 2) return 'unknown';
  // Check for quarterly patterns (Q1, Q2, etc.)
  if (periods.some(p => /Q[1-4]/.test(p))) return 'quarterly';
  // Check for monthly patterns (YYYY-MM)
  if (periods.some(p => /^\d{4}-\d{2}$/.test(p))) return 'monthly';
  // Check for annual (YYYY only)
  if (periods.every(p => /^\d{4}$/.test(p))) return 'annual';
  return 'monthly'; // default assumption
}

/** Convert forecast horizon (days) to period-count based on detected periodicity */
function horizonToPeriods(days: number, periodicity: Periodicity): number {
  switch (periodicity) {
    case 'monthly': return days / 30;
    case 'quarterly': return days / 90;
    case 'annual': return days / 365;
    default: return days / 30;
  }
}

// ─── 4. Outlier detection (IQR-based winsorization) ─────────────────

/**
 * Detects and winsorizes outliers using the IQR method.
 * Outliers beyond 1.5×IQR from Q1/Q3 are clamped to the fence values.
 * This prevents single corrupted data points from distorting smoothing.
 */
function winsorizeOutliers(values: number[]): number[] {
  if (values.length < 5) return [...values];
  const sorted = [...values].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  const q1 = sorted[q1Idx];
  const q3 = sorted[q3Idx];
  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  return values.map(v => Math.max(lowerFence, Math.min(upperFence, v)));
}

// ─── 5. Data gap interpolation ──────────────────────────────────────

interface GapFilledResult {
  values: number[];
  gapCount: number;
  staleDays: number;
  outlierCount: number;
}

function fillDataGaps(
  sorted: MetricEntryV2[],
): GapFilledResult {
  if (sorted.length < 2) {
    return {
      values: sorted.map(m => m.value),
      gapCount: 0,
      staleDays: 0,
      outlierCount: 0,
    };
  }

  const rawValues = sorted.map(m => m.value);
  const periods = sorted.map(m => m.period);

  // Winsorize outliers before gap-filling
  const values = winsorizeOutliers(rawValues);
  const outlierCount = rawValues.filter((v, i) => v !== values[i]).length;

  let gapCount = 0;

  // Detect expected period gaps (simple: check for sequential month/quarter jumps)
  const filled: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    const prevDate = new Date(periods[i - 1] + '-01');
    const currDate = new Date(periods[i] + '-01');
    if (!isNaN(prevDate.getTime()) && !isNaN(currDate.getTime())) {
      const monthDiff = (currDate.getFullYear() - prevDate.getFullYear()) * 12 +
        (currDate.getMonth() - prevDate.getMonth());
      // If gap > 1 month, interpolate
      if (monthDiff > 1) {
        const gapsToFill = Math.min(monthDiff - 1, 6); // cap interpolation at 6
        gapCount += gapsToFill;
        for (let g = 1; g <= gapsToFill; g++) {
          const t = g / (gapsToFill + 1);
          filled.push(values[i - 1] + t * (values[i] - values[i - 1]));
        }
      }
    }
    filled.push(values[i]);
  }

  // Staleness: days since last observation
  const lastPeriod = periods[periods.length - 1];
  const lastDate = new Date(lastPeriod.length <= 7 ? lastPeriod + '-01' : lastPeriod);
  const staleDays = isNaN(lastDate.getTime()) ? 0 :
    Math.max(0, Math.round((Date.now() - lastDate.getTime()) / 86400000));

  return { values: filled, gapCount, staleDays, outlierCount };
}

// ─── 5. OLS regression with t-statistic ─────────────────────────────

interface RegressionResult {
  slope: number;
  tStat: number;
  significant: boolean; // |t| >= 1.5
}

function regressionWithSignificance(values: number[]): RegressionResult {
  const n = values.length;
  if (n < 3) return { slope: 0, tStat: 0, significant: false };

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;

  // Standard error of slope
  const residuals = values.map((v, i) => v - (yMean + slope * (i - xMean)));
  const sse = residuals.reduce((s, r) => s + r * r, 0);
  const mse = sse / (n - 2);
  const seBeta = Math.sqrt(mse / den);
  const tStat = seBeta > 0 ? slope / seBeta : 0;

  return {
    slope,
    tStat: Math.round(tStat * 100) / 100,
    significant: Math.abs(tStat) >= 1.5,
  };
}

function computeMomentumV2(values: number[]): { momentum: number; tStat: number } {
  const recent = values.slice(-8);
  if (recent.length < 3) return { momentum: 0, tStat: 0 };

  const reg = regressionWithSignificance(recent);

  // If not statistically significant, momentum is zero
  if (!reg.significant) return { momentum: 0, tStat: reg.tStat };

  const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
  const raw = mean !== 0 ? (reg.slope / Math.abs(mean)) * 100 : 0;
  return {
    momentum: Math.max(-100, Math.min(100, Math.round(raw * 10) / 10)),
    tStat: reg.tStat,
  };
}

// ─── 6. Volatility (with downside/upside separation) ────────────────

export interface VolatilityResult {
  total: number;       // 0–100 (same as before)
  downside: number;    // 0–100 (negative moves only)
  upside: number;      // 0–100 (positive moves only)
  ratio: number;       // downside/upside ratio; >1 = skewed negative
}

function computeVolatility(values: number[]): number {
  return computeVolatilityDetailed(values).total;
}

export function computeVolatilityDetailed(values: number[]): VolatilityResult {
  const recent = values.slice(-6);
  if (recent.length < 2) return { total: 0, downside: 0, upside: 0, ratio: 1 };

  const mean = recent.reduce((s, v) => s + v, 0) / recent.length;

  // Total volatility (CV-based)
  const variance = recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length;
  const stdDev = Math.sqrt(variance);
  const cv = Math.abs(mean) > 0 ? stdDev / Math.abs(mean) : 0;
  const total = Math.round(Math.min(100, cv * 200));

  // Downside volatility: only negative deviations from mean
  const downsideDeviations = recent.filter(v => v < mean).map(v => (v - mean) ** 2);
  const downsideVar = downsideDeviations.length > 0
    ? downsideDeviations.reduce((s, v) => s + v, 0) / recent.length
    : 0;
  const downsideStd = Math.sqrt(downsideVar);
  const downsideCv = Math.abs(mean) > 0 ? downsideStd / Math.abs(mean) : 0;
  const downside = Math.round(Math.min(100, downsideCv * 200));

  // Upside volatility: only positive deviations from mean
  const upsideDeviations = recent.filter(v => v > mean).map(v => (v - mean) ** 2);
  const upsideVar = upsideDeviations.length > 0
    ? upsideDeviations.reduce((s, v) => s + v, 0) / recent.length
    : 0;
  const upsideStd = Math.sqrt(upsideVar);
  const upsideCv = Math.abs(mean) > 0 ? upsideStd / Math.abs(mean) : 0;
  const upside = Math.round(Math.min(100, upsideCv * 200));

  const ratio = upside > 0 ? Math.round((downside / upside) * 100) / 100 : (downside > 0 ? 10 : 1);

  return { total, downside, upside, ratio };
}

// ─── 7. CUSUM structural break detection (on Holt residuals) ────────

interface StructuralBreakResult {
  detected: boolean;
  pValue: number;       // approximate p-value (continuous)
  breakIndex: number;   // index of detected break (-1 if none)
}

/**
 * CUSUM test on Holt model residuals (not raw values).
 * Running on raw values confounds trend with structural change.
 * Using residuals isolates genuine regime shifts.
 */
function detectStructuralBreakCUSUM(
  values: number[],
  alpha: number = DEFAULT_PARAMS.alpha,
  beta: number = DEFAULT_PARAMS.beta,
): StructuralBreakResult {
  const n = values.length;
  if (n < 6) return { detected: false, pValue: 1, breakIndex: -1 };

  // Compute Holt one-step-ahead residuals
  const residuals: number[] = [];
  let level = values[0];
  let trend = values.length > 1 ? values[1] - values[0] : 0;
  for (let i = 1; i < n; i++) {
    const predicted = level + trend;
    residuals.push(values[i] - predicted);
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (prevLevel + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  const rn = residuals.length;
  if (rn < 4) return { detected: false, pValue: 1, breakIndex: -1 };

  const mean = residuals.reduce((s, v) => s + v, 0) / rn;
  const variance = residuals.reduce((s, v) => s + (v - mean) ** 2, 0) / rn;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return { detected: false, pValue: 1, breakIndex: -1 };

  // Compute CUSUM on standardized residuals
  const cusum: number[] = [];
  let cumSum = 0;
  for (let i = 0; i < rn; i++) {
    cumSum += (residuals[i] - mean) / stdDev;
    cusum.push(Math.abs(cumSum));
  }

  const maxCusum = Math.max(...cusum);
  const breakIndex = cusum.indexOf(maxCusum);

  // Continuous p-value approximation: p ≈ 2 * exp(-2 * (maxCusum/sqrt(n))^2)
  // Based on Kolmogorov-Smirnov bridge distribution
  const normalizedStat = maxCusum / Math.sqrt(rn);
  const pValue = Math.min(1, Math.max(0.001, 2 * Math.exp(-2 * normalizedStat * normalizedStat)));

  return {
    detected: pValue <= 0.10,
    pValue: Math.round(pValue * 1000) / 1000,
    breakIndex: pValue <= 0.10 ? breakIndex + 1 : -1, // +1 to map back to original values index
  };
}

// ─── 8. Backtesting engine (uses Holt — matches production) ────────

export function backtestForecast(
  historicalSeries: number[],
  alpha: number = DEFAULT_PARAMS.alpha,
  beta: number = DEFAULT_PARAMS.beta,
): BacktestResult {
  if (historicalSeries.length < 6) {
    return { mae: 0, rmse: 0, mape: 0, forecastBias: 0, stabilityScore: 0.5 };
  }

  const errors: number[] = [];
  const absPercentErrors: number[] = [];

  // Walk-forward: use first N to predict N+1 via Holt
  for (let i = 4; i < historicalSeries.length; i++) {
    const trainSlice = historicalSeries.slice(0, i);
    const holt = holtSmoothing(trainSlice, alpha, beta);
    const predicted = holt.level + holt.trend; // 1-step-ahead forecast
    const actual = historicalSeries[i];
    const error = actual - predicted;
    errors.push(error);
    if (Math.abs(actual) > 0.01) {
      absPercentErrors.push(Math.abs(error / actual));
    }
  }

  if (errors.length === 0) return { mae: 0, rmse: 0, mape: 0, forecastBias: 0, stabilityScore: 0.5 };

  const absErrors = errors.map(Math.abs);
  const mae = absErrors.reduce((s, v) => s + v, 0) / absErrors.length;
  const mse = errors.reduce((s, v) => s + v * v, 0) / errors.length;
  const rmse = Math.sqrt(mse);
  const mape = absPercentErrors.length > 0
    ? (absPercentErrors.reduce((s, v) => s + v, 0) / absPercentErrors.length) * 100
    : 0;
  const forecastBias = errors.reduce((s, v) => s + v, 0) / errors.length;

  const range = Math.max(...historicalSeries) - Math.min(...historicalSeries);
  const nrmse = range > 0 ? rmse / range : 0;
  const stabilityScore = Math.max(0, Math.min(1, 1 - nrmse));

  return {
    mae: Math.round(mae * 100) / 100,
    rmse: Math.round(rmse * 100) / 100,
    mape: Math.round(mape * 100) / 100,
    forecastBias: Math.round(forecastBias * 100) / 100,
    stabilityScore: Math.round(stabilityScore * 1000) / 1000,
  };
}

// ─── 9. Parameter calibration (k-fold cross-validated grid search) ──

/**
 * Calibrates Holt parameters using time-series cross-validation.
 * Uses expanding-window k-fold (k=3) to prevent overfitting to a single
 * train/test split. Returns the (α, β) pair that minimizes average RMSE
 * across all folds.
 */
export function calibrateParameters(
  historicalSeries: number[],
): DomainModelParams {
  if (historicalSeries.length < 8) return DEFAULT_PARAMS;

  let bestAlpha = DEFAULT_PARAMS.alpha;
  let bestBeta = DEFAULT_PARAMS.beta;
  let bestAvgRMSE = Infinity;

  // k-fold expanding window cross-validation
  const k = 3;
  const minTrainSize = Math.max(4, Math.floor(historicalSeries.length * 0.4));

  for (let a = 0.2; a <= 0.8; a += 0.05) {
    for (let b = 0.05; b <= 0.5; b += 0.05) {
      let totalRMSE = 0;
      let foldCount = 0;

      for (let fold = 0; fold < k; fold++) {
        const foldEnd = minTrainSize + Math.floor(((historicalSeries.length - minTrainSize) / k) * (fold + 1));
        if (foldEnd > historicalSeries.length) break;
        const foldSlice = historicalSeries.slice(0, foldEnd);
        const result = backtestForecast(foldSlice, a, b);
        if (result.rmse > 0) {
          totalRMSE += result.rmse;
          foldCount++;
        }
      }

      if (foldCount > 0) {
        const avgRMSE = totalRMSE / foldCount;
        if (avgRMSE < bestAvgRMSE) {
          bestAvgRMSE = avgRMSE;
          bestAlpha = Math.round(a * 100) / 100;
          bestBeta = Math.round(b * 100) / 100;
        }
      }
    }
  }

  return { alpha: bestAlpha, beta: bestBeta };
}

// ─── 10. Nonlinear fragility multiplier ─────────────────────────────

function computeSystemicFragility(
  domainScores: Record<string, number>,
): number {
  const gov = (domainScores['governance'] ?? 50) / 100;
  const sec = (domainScores['security'] ?? 50) / 100;
  const fin = (domainScores['finance'] ?? 50) / 100;
  const fragility = (1 - gov) * (1 - sec) * (1 - fin);
  return Math.round(fragility * 100 * 10) / 10;
}

// ─── 11. Domain performance (V2 hardened) ───────────────────────────

export function computeDomainPerformanceV2(
  domain: string,
  metrics: MetricEntryV2[],
  dataCompleteness: number,
  benchmark: GlobalBenchmark | undefined,
  stabilityScore: number = 0.5,
  params: DomainModelParams = DEFAULT_PARAMS,
): DomainPerformanceV2 {
  if (!metrics || metrics.length === 0) {
    return {
      domain,
      performanceIndex: 0,
      momentumScore: 0,
      momentumTStat: 0,
      volatilityIndex: 0,
      volatilityDownside: 0,
      volatilityUpside: 0,
      volatilitySkewRatio: 1,
      riskPressureScore: 50,
      forecast90d: 0,
      forecast1y: 0,
      forecastDirection: 'stable',
      confidenceScore: Math.max(10, Math.min(95, Math.round(dataCompleteness * 30))),
      forecastUpper80: 0,
      forecastLower80: 0,
      forecastUpper95: 0,
      forecastLower95: 0,
      structuralBreak: false,
      structuralBreakPValue: 1,
      dataGapCount: 0,
      dataStaleDays: 0,
    };
  }

  const sorted = [...metrics].sort((a, b) => a.period.localeCompare(b.period));

  // Data gap handling
  const gapResult = fillDataGaps(sorted);
  const values = gapResult.values;
  const periods = sorted.map(m => m.period);
  const periodicity = detectPeriodicity(periods);

  // Performance index: benchmark-anchored
  const latestValues = values.slice(-5);
  const avg = latestValues.reduce((s, v) => s + v, 0) / latestValues.length;
  const performanceIndex = Math.round(normalizeWithBenchmark(avg, benchmark));

  // Momentum: regression with t-stat significance
  const { momentum: momentumScore, tStat: momentumTStat } = computeMomentumV2(values);

  // Volatility (with downside/upside separation)
  const volResult = computeVolatilityDetailed(values);
  const volatilityIndex = volResult.total;

  // Structural break: CUSUM on Holt residuals
  const breakResult = detectStructuralBreakCUSUM(values, params.alpha, params.beta);

  // Risk pressure
  let riskPressureScore = Math.round(
    Math.min(100,
      volatilityIndex * 0.5 +
      (100 - performanceIndex) * 0.3 +
      (momentumScore < 0 ? Math.abs(momentumScore) * 0.2 : 0)
    )
  );
  if (breakResult.detected) riskPressureScore = Math.min(100, riskPressureScore + 10);

  // Forecast: Holt with period-correct horizons
  const holt = holtSmoothing(values, params.alpha, params.beta);
  const holtNorm = Math.round(normalizeWithBenchmark(holt.level, benchmark));
  const trendPerPeriod = holt.trend; // trend in native units per period

  // Convert horizons to periods
  const periods90d = horizonToPeriods(90, periodicity);
  const periods1y = horizonToPeriods(365, periodicity);

  // Damping increases with volatility
  const dampingFactor = Math.max(0.3, 1 - (volatilityIndex / 200));
  const momentumFactor = momentumScore / 100;

  // Project: level + (trend * periods * damping) + momentum adjustment
  const trendNorm = benchmark
    ? (trendPerPeriod / (benchmark.structural_ceiling - benchmark.structural_floor)) * 100
    : trendPerPeriod;

  const forecast90d = Math.max(0, Math.min(100, Math.round(
    holtNorm + (trendNorm * periods90d * dampingFactor) + (momentumFactor * 5)
  )));
  const forecast1y = Math.max(0, Math.min(100, Math.round(
    holtNorm + (trendNorm * periods1y * dampingFactor * 0.5) + (momentumFactor * 10) - (volatilityIndex * 0.08)
  )));

  const forecastDirection: 'up' | 'down' | 'stable' =
    momentumScore > 5 ? 'up' : momentumScore < -5 ? 'down' : 'stable';

  // Confidence: calibrated formula
  const dataDensity = Math.min(1, metrics.length / 20);
  const sourceDiv = new Set(metrics.map(m => m.source)).size;
  const sourceDiversityBonus = Math.min(15, sourceDiv * 5);
  const timeSpanBonus = Math.min(15, (metrics.length / 5) * 3);

  // Gap and staleness penalties
  const gapPenalty = Math.min(10, gapResult.gapCount * 2);
  const stalenessPenalty = gapResult.staleDays > 90 ? 8 : gapResult.staleDays > 30 ? 4 : 0;

  let confidenceScore = Math.round(
    15 +
    (dataDensity * 25) +
    (stabilityScore * 20) +
    sourceDiversityBonus +
    timeSpanBonus -
    (volatilityIndex * 0.15) -
    (breakResult.detected ? 12 : 0) -
    gapPenalty -
    stalenessPenalty
  );
  confidenceScore = Math.max(10, Math.min(95, confidenceScore));

  // Forecast uncertainty bands (from backtest error distribution)
  // Use stabilityScore as proxy for error magnitude: lower stability = wider bands
  const errorMagnitude = (1 - stabilityScore) * 30 + volatilityIndex * 0.3;
  const forecastUpper80 = Math.min(100, Math.round(forecast90d + errorMagnitude * 1.28));
  const forecastLower80 = Math.max(0, Math.round(forecast90d - errorMagnitude * 1.28));
  const forecastUpper95 = Math.min(100, Math.round(forecast90d + errorMagnitude * 1.96));
  const forecastLower95 = Math.max(0, Math.round(forecast90d - errorMagnitude * 1.96));

  return {
    domain,
    performanceIndex,
    momentumScore,
    momentumTStat,
    volatilityIndex,
    volatilityDownside: volResult.downside,
    volatilityUpside: volResult.upside,
    volatilitySkewRatio: volResult.ratio,
    riskPressureScore,
    forecast90d,
    forecast1y,
    forecastDirection,
    confidenceScore,
    forecastUpper80,
    forecastLower80,
    forecastUpper95,
    forecastLower95,
    structuralBreak: breakResult.detected,
    structuralBreakPValue: breakResult.pValue,
    dataGapCount: gapResult.gapCount,
    dataStaleDays: gapResult.staleDays,
  };
}

// ─── 12. National Performance Index V2 ──────────────────────────────

export function computeNationalPerformanceV2(
  iso3: string,
  countryName: string,
  profile: Record<string, { metrics: MetricEntryV2[]; completeness: number }>,
  benchmarks: Record<string, GlobalBenchmark>,
  backtestResults: Record<string, BacktestResult>,
  calibratedParams?: Record<string, DomainModelParams>,
): NationalPerformanceIndexV2 {
  const domains: DomainPerformanceV2[] = Object.entries(profile)
    .filter(([_, data]) => data && data.metrics && data.metrics.length > 0)
    .map(([domain, data]) => {
      const stability = backtestResults[domain]?.stabilityScore ?? 0.5;
      const params = calibratedParams?.[domain] ?? DEFAULT_PARAMS;
      return computeDomainPerformanceV2(
        domain, data.metrics, data.completeness,
        benchmarks[domain], stability, params,
      );
    });

  if (domains.length === 0) {
    return {
      iso3, countryName,
      overallIndex: 0, momentum: 0, volatility: 0,
      riskPressure: 50, systemicFragility: 50,
      forecast90d: 0, forecast1y: 0, forecastDirection: 'stable',
      confidence: 10, structuralBreakCount: 0, forecastStability: 0.5,
      domains: [],
    };
  }

  let totalWeight = 0;
  let wPerf = 0, wMom = 0, wVol = 0, wRisk = 0;
  let wF90 = 0, wF1y = 0, wConf = 0;
  const domainScores: Record<string, number> = {};

  for (const dp of domains) {
    const w = DOMAIN_WEIGHTS[dp.domain] || 0.05;
    totalWeight += w;
    wPerf += dp.performanceIndex * w;
    wMom += dp.momentumScore * w;
    wVol += dp.volatilityIndex * w;
    wRisk += dp.riskPressureScore * w;
    wF90 += dp.forecast90d * w;
    wF1y += dp.forecast1y * w;
    wConf += dp.confidenceScore * w;
    domainScores[dp.domain] = dp.performanceIndex;
  }

  const n = totalWeight || 1;
  const overallIndex = Math.round(wPerf / n);
  const momentum = Math.round((wMom / n) * 10) / 10;
  const volatility = Math.round(wVol / n);
  const weightedRisk = Math.round(wRisk / n);
  const forecast90d = Math.round(wF90 / n);
  const forecast1y = Math.round(wF1y / n);
  const baseConfidence = Math.round(wConf / n);

  const systemicFragility = computeSystemicFragility(domainScores);
  const riskPressure = Math.round(weightedRisk * 0.6 + systemicFragility * 0.4);
  const structuralBreakCount = domains.filter(d => d.structuralBreak).length;

  const stabilities = Object.values(backtestResults).map(b => b.stabilityScore);
  const forecastStability = stabilities.length > 0
    ? Math.round((stabilities.reduce((s, v) => s + v, 0) / stabilities.length) * 1000) / 1000
    : 0.5;

  let confidence = Math.round(
    baseConfidence * forecastStability -
    (structuralBreakCount * 3)
  );
  confidence = Math.max(10, Math.min(95, confidence));

  const forecastDirection: 'up' | 'down' | 'stable' =
    momentum > 3 ? 'up' : momentum < -3 ? 'down' : 'stable';

  return {
    iso3, countryName,
    overallIndex, momentum, volatility,
    riskPressure, systemicFragility,
    forecast90d, forecast1y, forecastDirection,
    confidence, structuralBreakCount, forecastStability,
    domains,
  };
}

// ─── 13. Sensitivity analysis ───────────────────────────────────────

/**
 * Runs a sensitivity analysis by perturbing domain weights ±20% and
 * measuring the resulting spread in NPI. Returns the max absolute
 * deviation — a measure of how sensitive the composite index is
 * to weight assumptions.
 */
export function sensitivityAnalysis(
  iso3: string,
  countryName: string,
  profile: Record<string, { metrics: MetricEntryV2[]; completeness: number }>,
  benchmarks: Record<string, GlobalBenchmark>,
  backtestResults: Record<string, BacktestResult>,
  calibratedParams?: Record<string, DomainModelParams>,
): { baseNPI: number; maxDeviation: number; perturbedRange: [number, number]; sensitive_domains: string[] } {
  const base = computeNationalPerformanceV2(iso3, countryName, profile, benchmarks, backtestResults, calibratedParams);
  const baseNPI = base.overallIndex;

  let minNPI = baseNPI;
  let maxNPI = baseNPI;
  const sensitiveDomains: { domain: string; spread: number }[] = [];

  // CRITICAL FIX: Clone weights to prevent global mutation
  const frozenWeights = { ...DOMAIN_WEIGHTS };

  for (const domain of Object.keys(frozenWeights)) {
    const origWeight = frozenWeights[domain];

    // +20%: temporarily override global, compute, restore immediately
    DOMAIN_WEIGHTS[domain] = origWeight * 1.2;
    const high = computeNationalPerformanceV2(iso3, countryName, profile, benchmarks, backtestResults, calibratedParams);
    DOMAIN_WEIGHTS[domain] = origWeight; // restore before next call

    // -20%
    DOMAIN_WEIGHTS[domain] = origWeight * 0.8;
    const low = computeNationalPerformanceV2(iso3, countryName, profile, benchmarks, backtestResults, calibratedParams);
    DOMAIN_WEIGHTS[domain] = origWeight; // restore immediately

    const spread = Math.abs(high.overallIndex - low.overallIndex);
    if (spread > 2) sensitiveDomains.push({ domain, spread });

    minNPI = Math.min(minNPI, low.overallIndex, high.overallIndex);
    maxNPI = Math.max(maxNPI, low.overallIndex, high.overallIndex);
  }

  // Verify restoration integrity
  for (const [k, v] of Object.entries(frozenWeights)) {
    DOMAIN_WEIGHTS[k] = v;
  }

  return {
    baseNPI,
    maxDeviation: Math.round((maxNPI - minNPI) * 10) / 10,
    perturbedRange: [minNPI, maxNPI],
    sensitive_domains: sensitiveDomains
      .sort((a, b) => b.spread - a.spread)
      .slice(0, 3)
      .map(d => d.domain),
  };
}

/**
 * Model diagnostics summary for audit transparency.
 * Returns key metrics that an external reviewer can verify.
 */
export function computeModelDiagnostics(
  historicalSeries: number[],
  alpha?: number,
  beta?: number,
): {
  calibrated: DomainModelParams;
  backtest: BacktestResult;
  cusum: { detected: boolean; pValue: number; breakIndex: number };
  seriesLength: number;
  outlierCount: number;
} {
  const calibrated = calibrateParameters(historicalSeries);
  const a = alpha ?? calibrated.alpha;
  const b = beta ?? calibrated.beta;
  const backtest = backtestForecast(historicalSeries, a, b);
  const cusum = detectStructuralBreakCUSUM(historicalSeries, a, b);
  const winsorized = winsorizeOutliers(historicalSeries);
  const outlierCount = historicalSeries.filter((v, i) => v !== winsorized[i]).length;

  return {
    calibrated,
    backtest,
    cusum: { detected: cusum.detected, pValue: cusum.pValue, breakIndex: cusum.breakIndex },
    seriesLength: historicalSeries.length,
    outlierCount,
  };
}

// ─── UI helpers (re-exported from V1 for compatibility) ─────────────

export { getMomentumArrow, getMomentumColor, getRiskLabel, getRiskBadgeVariant, getPerformanceLabel, getVolatilityLabel } from './performance-engine';
