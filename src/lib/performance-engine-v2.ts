/**
 * AICIS Performance Engine V2 (APE-V2) — Institutionally Hardened
 *
 * Mathematical integrity:
 *  - Holt double-exponential backtest (matches production model)
 *  - Period-aware forecast horizons (monthly/quarterly detection)
 *  - t-statistic momentum significance filtering
 *  - CUSUM-based structural break detection with regime switching
 *  - Data gap interpolation with staleness penalty
 *  - Calibratable α/β via domain_model_parameters
 *  - Platt-scaling calibration for empirical confidence
 *  - Graph-based cross-domain fragility propagation
 *  - Stateless compute: all weights/params passed explicitly
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
  performanceIndex: number;
  momentumScore: number;
  momentumTStat: number;
  volatilityIndex: number;
  volatilityDownside: number;
  volatilityUpside: number;
  volatilitySkewRatio: number;
  riskPressureScore: number;
  forecast90d: number;
  forecast1y: number;
  forecastDirection: 'up' | 'down' | 'stable';
  confidenceScore: number;
  forecastUpper80: number;
  forecastLower80: number;
  forecastUpper95: number;
  forecastLower95: number;
  structuralBreak: boolean;
  structuralBreakPValue: number;
  dataGapCount: number;
  dataStaleDays: number;
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
  mape: number;
  forecastBias: number;
  stabilityScore: number;
}

export interface MetricEntryV2 {
  metric: string;
  value: number;
  period: string;
  source: string;
  unit?: string;
}

export interface DomainModelParams {
  alpha: number;
  beta: number;
}

export interface DomainCoupling {
  source_domain: string;
  target_domain: string;
  coupling_weight: number;
  propagation_delay_days: number;
}

export interface ComputeContext {
  weights: Record<string, number>;
  modelVersion: string;
  calibrationProfile?: PlattCalibration;
  couplingMatrix?: DomainCoupling[];
}

export interface PlattCalibration {
  a: number;  // logistic slope
  b: number;  // logistic intercept
  fitted: boolean;
}

// ─── Default weights (FROZEN — only used as fallback) ───────────────

const DEFAULT_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  governance: 0.18,
  health: 0.16,
  energy: 0.13,
  finance: 0.15,
  food: 0.13,
  security: 0.15,
  education: 0.05,
  climate: 0.03,
  population: 0.02,
});

// Legacy alias (read-only)
const DOMAIN_WEIGHTS = DEFAULT_WEIGHTS;

const DEFAULT_PARAMS: DomainModelParams = { alpha: 0.55, beta: 0.3 };

export const CURRENT_MODEL_VERSION = "APE-V2.1";

// ─── Platt Scaling Calibration ──────────────────────────────────────

/**
 * Fits a Platt scaling model: calibrated = 1 / (1 + exp(a * raw + b))
 * Maps raw confidence scores to empirically calibrated probabilities.
 * Requires paired (predicted_confidence, actual_hit) data.
 */
export function fitPlattCalibration(
  predictedConfidences: number[],
  actualHits: boolean[],
): PlattCalibration {
  if (predictedConfidences.length < 20) {
    return { a: -1, b: 0, fitted: false };
  }

  // Newton-Raphson optimization for logistic parameters
  const n = predictedConfidences.length;
  const prior1 = actualHits.filter(h => h).length;
  const prior0 = n - prior1;

  // Target probabilities (Platt's smoothing)
  const hiTarget = (prior1 + 1) / (prior1 + 2);
  const loTarget = 1 / (prior0 + 2);
  const t = actualHits.map(h => h ? hiTarget : loTarget);

  let a = 0;
  let b = Math.log((prior0 + 1) / (prior1 + 1));

  const maxIter = 100;
  const minStep = 1e-10;
  const sigma = 1e-12;

  for (let iter = 0; iter < maxIter; iter++) {
    let h11 = sigma, h22 = sigma, h21 = 0;
    let g1 = 0, g2 = 0;

    for (let i = 0; i < n; i++) {
      const fApB = a * predictedConfidences[i] + b;
      let p: number, q: number;

      if (fApB >= 0) {
        p = Math.exp(-fApB) / (1 + Math.exp(-fApB));
        q = 1 / (1 + Math.exp(-fApB));
      } else {
        p = 1 / (1 + Math.exp(fApB));
        q = Math.exp(fApB) / (1 + Math.exp(fApB));
      }

      const d2 = p * q;
      h11 += predictedConfidences[i] * predictedConfidences[i] * d2;
      h22 += d2;
      h21 += predictedConfidences[i] * d2;
      const d1 = t[i] - p;
      g1 += predictedConfidences[i] * d1;
      g2 += d1;
    }

    if (Math.abs(g1) < 1e-5 && Math.abs(g2) < 1e-5) break;

    const det = h11 * h22 - h21 * h21;
    const dA = -(h22 * g1 - h21 * g2) / det;
    const dB = -(-h21 * g1 + h11 * g2) / det;

    if (Math.abs(dA) < minStep && Math.abs(dB) < minStep) break;

    a += dA;
    b += dB;
  }

  return { a, b, fitted: true };
}

/**
 * Apply Platt calibration to raw confidence score.
 */
export function applyPlattCalibration(
  rawConfidence: number,
  calibration: PlattCalibration,
): number {
  if (!calibration.fitted) return rawConfidence;
  const raw01 = rawConfidence / 100;
  const calibrated = 1 / (1 + Math.exp(calibration.a * raw01 + calibration.b));
  return Math.max(10, Math.min(95, Math.round(calibrated * 100)));
}

// ─── DB Loaders ─────────────────────────────────────────────────────

export async function loadDomainWeightsFromDB(
  supabaseClient: any,
  modelVersion: string = CURRENT_MODEL_VERSION,
): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabaseClient
      .from("domain_weights")
      .select("domain, weight")
      .eq("model_version", modelVersion);
    if (error || !data || data.length === 0) return { ...DEFAULT_WEIGHTS };
    const weights: Record<string, number> = {};
    for (const row of data) weights[row.domain] = Number(row.weight);
    return weights;
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

export async function loadCouplingMatrix(
  supabaseClient: any,
  modelVersion: string = CURRENT_MODEL_VERSION,
): Promise<DomainCoupling[]> {
  try {
    const { data, error } = await supabaseClient
      .from("domain_coupling_matrix")
      .select("source_domain, target_domain, coupling_weight, propagation_delay_days")
      .eq("model_version", modelVersion);
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

/**
 * Archive a forecast snapshot to forecast_archive table (immutable).
 */
export async function archiveForecastSnapshot(
  supabaseClient: any,
  iso3: string,
  countryName: string,
  domain: DomainPerformanceV2,
  params: DomainModelParams,
  trainingWindowEnd?: string,
  calibrationVersion?: string,
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
      stability_score: 0,
      structural_break_flag: domain.structuralBreak,
      structural_break_p_value: domain.structuralBreakPValue,
      data_stale_days: domain.dataStaleDays,
      data_quality_score: Math.max(0, 100 - domain.dataGapCount * 5 - domain.dataStaleDays * 0.5),
      gap_interpolation_count: domain.dataGapCount,
      training_window_end: trainingWindowEnd,
      calibration_version: calibrationVersion,
      parameter_set_id: `${params.alpha}_${params.beta}`,
    });
  } catch {
    // Non-critical
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
  if (periods.some(p => /Q[1-4]/.test(p))) return 'quarterly';
  if (periods.some(p => /^\d{4}-\d{2}$/.test(p))) return 'monthly';
  if (periods.every(p => /^\d{4}$/.test(p))) return 'annual';
  return 'monthly';
}

function horizonToPeriods(days: number, periodicity: Periodicity): number {
  switch (periodicity) {
    case 'monthly': return days / 30;
    case 'quarterly': return days / 90;
    case 'annual': return days / 365;
    default: return days / 30;
  }
}

// ─── 4. Outlier detection (IQR-based winsorization) ─────────────────

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

function fillDataGaps(sorted: MetricEntryV2[]): GapFilledResult {
  if (sorted.length < 2) {
    return { values: sorted.map(m => m.value), gapCount: 0, staleDays: 0, outlierCount: 0 };
  }

  const rawValues = sorted.map(m => m.value);
  const periods = sorted.map(m => m.period);
  const values = winsorizeOutliers(rawValues);
  const outlierCount = rawValues.filter((v, i) => v !== values[i]).length;
  let gapCount = 0;

  const filled: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    const prevDate = new Date(periods[i - 1] + '-01');
    const currDate = new Date(periods[i] + '-01');
    if (!isNaN(prevDate.getTime()) && !isNaN(currDate.getTime())) {
      const monthDiff = (currDate.getFullYear() - prevDate.getFullYear()) * 12 +
        (currDate.getMonth() - prevDate.getMonth());
      if (monthDiff > 1) {
        const gapsToFill = Math.min(monthDiff - 1, 6);
        gapCount += gapsToFill;
        for (let g = 1; g <= gapsToFill; g++) {
          const t = g / (gapsToFill + 1);
          filled.push(values[i - 1] + t * (values[i] - values[i - 1]));
        }
      }
    }
    filled.push(values[i]);
  }

  const lastPeriod = periods[periods.length - 1];
  const lastDate = new Date(lastPeriod.length <= 7 ? lastPeriod + '-01' : lastPeriod);
  const staleDays = isNaN(lastDate.getTime()) ? 0 :
    Math.max(0, Math.round((Date.now() - lastDate.getTime()) / 86400000));

  return { values: filled, gapCount, staleDays, outlierCount };
}

// ─── 6. OLS regression with t-statistic ─────────────────────────────

interface RegressionResult {
  slope: number;
  tStat: number;
  significant: boolean;
}

function regressionWithSignificance(values: number[]): RegressionResult {
  const n = values.length;
  if (n < 3) return { slope: 0, tStat: 0, significant: false };

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;

  const residuals = values.map((v, i) => v - (yMean + slope * (i - xMean)));
  const sse = residuals.reduce((s, r) => s + r * r, 0);
  const mse = sse / (n - 2);
  const seBeta = Math.sqrt(mse / den);
  const tStat = seBeta > 0 ? slope / seBeta : 0;

  return { slope, tStat: Math.round(tStat * 100) / 100, significant: Math.abs(tStat) >= 1.5 };
}

function computeMomentumV2(values: number[]): { momentum: number; tStat: number } {
  const recent = values.slice(-8);
  if (recent.length < 3) return { momentum: 0, tStat: 0 };

  const reg = regressionWithSignificance(recent);
  if (!reg.significant) return { momentum: 0, tStat: reg.tStat };

  const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
  const raw = mean !== 0 ? (reg.slope / Math.abs(mean)) * 100 : 0;
  return {
    momentum: Math.max(-100, Math.min(100, Math.round(raw * 10) / 10)),
    tStat: reg.tStat,
  };
}

// ─── 7. Volatility ──────────────────────────────────────────────────

export interface VolatilityResult {
  total: number;
  downside: number;
  upside: number;
  ratio: number;
}

function computeVolatility(values: number[]): number {
  return computeVolatilityDetailed(values).total;
}

export function computeVolatilityDetailed(values: number[]): VolatilityResult {
  const recent = values.slice(-6);
  if (recent.length < 2) return { total: 0, downside: 0, upside: 0, ratio: 1 };

  const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
  const variance = recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length;
  const stdDev = Math.sqrt(variance);
  const cv = Math.abs(mean) > 0 ? stdDev / Math.abs(mean) : 0;
  const total = Math.round(Math.min(100, cv * 200));

  const downsideDeviations = recent.filter(v => v < mean).map(v => (v - mean) ** 2);
  const downsideVar = downsideDeviations.length > 0
    ? downsideDeviations.reduce((s, v) => s + v, 0) / recent.length : 0;
  const downside = Math.round(Math.min(100, (Math.sqrt(downsideVar) / (Math.abs(mean) || 1)) * 200));

  const upsideDeviations = recent.filter(v => v > mean).map(v => (v - mean) ** 2);
  const upsideVar = upsideDeviations.length > 0
    ? upsideDeviations.reduce((s, v) => s + v, 0) / recent.length : 0;
  const upside = Math.round(Math.min(100, (Math.sqrt(upsideVar) / (Math.abs(mean) || 1)) * 200));

  const ratio = upside > 0 ? Math.round((downside / upside) * 100) / 100 : (downside > 0 ? 10 : 1);
  return { total, downside, upside, ratio };
}

// ─── 8. CUSUM structural break detection ────────────────────────────

interface StructuralBreakResult {
  detected: boolean;
  pValue: number;
  breakIndex: number;
}

function detectStructuralBreakCUSUM(
  values: number[],
  alpha: number = DEFAULT_PARAMS.alpha,
  beta: number = DEFAULT_PARAMS.beta,
): StructuralBreakResult {
  const n = values.length;
  if (n < 6) return { detected: false, pValue: 1, breakIndex: -1 };

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

  const cusum: number[] = [];
  let cumSum = 0;
  for (let i = 0; i < rn; i++) {
    cumSum += (residuals[i] - mean) / stdDev;
    cusum.push(Math.abs(cumSum));
  }

  const maxCusum = Math.max(...cusum);
  const breakIndex = cusum.indexOf(maxCusum);
  const normalizedStat = maxCusum / Math.sqrt(rn);
  const pValue = Math.min(1, Math.max(0.001, 2 * Math.exp(-2 * normalizedStat * normalizedStat)));

  return {
    detected: pValue <= 0.10,
    pValue: Math.round(pValue * 1000) / 1000,
    breakIndex: pValue <= 0.10 ? breakIndex + 1 : -1,
  };
}

// ─── 9. Regime Switching ────────────────────────────────────────────

/**
 * When a structural break is detected, adapt the model:
 * - Reset level/trend from post-break data
 * - Recalibrate α/β on post-break window
 * - Reduce forecast horizon (cap 1y at 90d equivalent)
 */
function regimeSwitchAdapt(
  values: number[],
  breakIndex: number,
  params: DomainModelParams,
): { adaptedValues: number[]; adaptedParams: DomainModelParams; horizonCap: number } {
  if (breakIndex < 0 || breakIndex >= values.length) {
    return { adaptedValues: values, adaptedParams: params, horizonCap: 365 };
  }

  // Use only post-break data
  const postBreak = values.slice(breakIndex);

  // If too little post-break data, use last 50% of original
  const adaptedValues = postBreak.length >= 4 ? postBreak : values.slice(Math.floor(values.length * 0.5));

  // Recalibrate on shorter window with higher alpha (more reactive)
  const adaptedParams = adaptedValues.length >= 8
    ? calibrateParameters(adaptedValues)
    : { alpha: Math.min(0.8, params.alpha + 0.15), beta: Math.min(0.5, params.beta + 0.1) };

  // Reduce forecast horizon: cap 1-year forecast to 90-day equivalent
  const horizonCap = 120; // days

  return { adaptedValues, adaptedParams, horizonCap };
}

// ─── 10. Backtesting engine ─────────────────────────────────────────

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

  for (let i = 4; i < historicalSeries.length; i++) {
    const trainSlice = historicalSeries.slice(0, i);
    const holt = holtSmoothing(trainSlice, alpha, beta);
    const predicted = holt.level + holt.trend;
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
    ? (absPercentErrors.reduce((s, v) => s + v, 0) / absPercentErrors.length) * 100 : 0;
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

// ─── 11. Parameter calibration (k-fold cross-validated) ─────────────

export function calibrateParameters(
  historicalSeries: number[],
): DomainModelParams {
  if (historicalSeries.length < 8) return DEFAULT_PARAMS;

  let bestAlpha = DEFAULT_PARAMS.alpha;
  let bestBeta = DEFAULT_PARAMS.beta;
  let bestAvgRMSE = Infinity;

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

// ─── 12. Nonlinear fragility (graph-based propagation) ──────────────

/**
 * Graph-based cross-domain fragility propagation.
 * Uses coupling matrix to model how shocks in one domain
 * propagate to others, creating compound systemic risk.
 */
function computeSystemicFragilityV2(
  domainScores: Record<string, number>,
  couplingMatrix?: DomainCoupling[],
): number {
  // Base multiplicative fragility
  const gov = (domainScores['governance'] ?? 50) / 100;
  const sec = (domainScores['security'] ?? 50) / 100;
  const fin = (domainScores['finance'] ?? 50) / 100;
  const baseFragility = (1 - gov) * (1 - sec) * (1 - fin);

  if (!couplingMatrix || couplingMatrix.length === 0) {
    return Math.round(baseFragility * 100 * 10) / 10;
  }

  // Propagation: for each weak domain, compute shock transmission
  let propagatedRisk = 0;
  const deficiencies: Record<string, number> = {};

  for (const [domain, score] of Object.entries(domainScores)) {
    const deficiency = Math.max(0, (50 - score) / 50); // 0 = healthy, 1 = critical
    deficiencies[domain] = deficiency;
  }

  for (const coupling of couplingMatrix) {
    const sourceDeficiency = deficiencies[coupling.source_domain] || 0;
    if (sourceDeficiency <= 0.1) continue; // healthy source, no propagation

    const targetScore = (domainScores[coupling.target_domain] ?? 50) / 100;
    const targetVulnerability = 1 - targetScore; // weaker targets absorb more

    // Shock = source_deficiency * coupling_weight * target_vulnerability
    const shock = sourceDeficiency * coupling.coupling_weight * (0.5 + targetVulnerability * 0.5);
    propagatedRisk += shock;
  }

  // Combine base + propagated (capped)
  const totalFragility = Math.min(1, baseFragility + propagatedRisk * 0.3);
  return Math.round(totalFragility * 100 * 10) / 10;
}

// Legacy alias
function computeSystemicFragility(domainScores: Record<string, number>): number {
  return computeSystemicFragilityV2(domainScores);
}

// ─── 13. Domain performance (V2 hardened) ───────────────────────────

export function computeDomainPerformanceV2(
  domain: string,
  metrics: MetricEntryV2[],
  dataCompleteness: number,
  benchmark: GlobalBenchmark | undefined,
  stabilityScore: number = 0.5,
  params: DomainModelParams = DEFAULT_PARAMS,
  calibration?: PlattCalibration,
): DomainPerformanceV2 {
  if (!metrics || metrics.length === 0) {
    return {
      domain, performanceIndex: 0, momentumScore: 0, momentumTStat: 0,
      volatilityIndex: 0, volatilityDownside: 0, volatilityUpside: 0, volatilitySkewRatio: 1,
      riskPressureScore: 50, forecast90d: 0, forecast1y: 0, forecastDirection: 'stable',
      confidenceScore: Math.max(10, Math.min(95, Math.round(dataCompleteness * 30))),
      forecastUpper80: 0, forecastLower80: 0, forecastUpper95: 0, forecastLower95: 0,
      structuralBreak: false, structuralBreakPValue: 1, dataGapCount: 0, dataStaleDays: 0,
    };
  }

  const sorted = [...metrics].sort((a, b) => a.period.localeCompare(b.period));
  const gapResult = fillDataGaps(sorted);
  let values = gapResult.values;
  const periods = sorted.map(m => m.period);
  const periodicity = detectPeriodicity(periods);

  // Performance index
  const latestValues = values.slice(-5);
  const avg = latestValues.reduce((s, v) => s + v, 0) / latestValues.length;
  const performanceIndex = Math.round(normalizeWithBenchmark(avg, benchmark));

  // Momentum
  const { momentum: momentumScore, tStat: momentumTStat } = computeMomentumV2(values);

  // Volatility
  const volResult = computeVolatilityDetailed(values);
  const volatilityIndex = volResult.total;

  // Structural break
  const breakResult = detectStructuralBreakCUSUM(values, params.alpha, params.beta);

  // Regime switching: adapt if break detected
  let activeParams = params;
  let forecastValues = values;
  let horizonCapDays = 365;

  if (breakResult.detected && breakResult.breakIndex > 0) {
    const adapted = regimeSwitchAdapt(values, breakResult.breakIndex, params);
    forecastValues = adapted.adaptedValues;
    activeParams = adapted.adaptedParams;
    horizonCapDays = adapted.horizonCap;
  }

  // Risk pressure
  let riskPressureScore = Math.round(
    Math.min(100,
      volatilityIndex * 0.5 +
      (100 - performanceIndex) * 0.3 +
      (momentumScore < 0 ? Math.abs(momentumScore) * 0.2 : 0)
    )
  );
  if (breakResult.detected) riskPressureScore = Math.min(100, riskPressureScore + 10);

  // Forecast (uses adapted values/params after regime switch)
  const holt = holtSmoothing(forecastValues, activeParams.alpha, activeParams.beta);
  const holtNorm = Math.round(normalizeWithBenchmark(holt.level, benchmark));
  const trendPerPeriod = holt.trend;

  const periods90d = horizonToPeriods(90, periodicity);
  const periods1y = horizonToPeriods(Math.min(horizonCapDays, 365), periodicity);

  const dampingFactor = Math.max(0.3, 1 - (volatilityIndex / 200));
  const momentumFactor = momentumScore / 100;

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

  // Confidence
  const dataDensity = Math.min(1, metrics.length / 20);
  const sourceDiv = new Set(metrics.map(m => m.source)).size;
  const sourceDiversityBonus = Math.min(15, sourceDiv * 5);
  const timeSpanBonus = Math.min(15, (metrics.length / 5) * 3);
  const gapPenalty = Math.min(10, gapResult.gapCount * 2);
  const stalenessPenalty = gapResult.staleDays > 90 ? 8 : gapResult.staleDays > 30 ? 4 : 0;

  let rawConfidence = Math.round(
    15 + (dataDensity * 25) + (stabilityScore * 20) +
    sourceDiversityBonus + timeSpanBonus -
    (volatilityIndex * 0.15) - (breakResult.detected ? 12 : 0) -
    gapPenalty - stalenessPenalty
  );
  rawConfidence = Math.max(10, Math.min(95, rawConfidence));

  // Apply Platt calibration if available
  const confidenceScore = calibration?.fitted
    ? applyPlattCalibration(rawConfidence, calibration)
    : rawConfidence;

  // Forecast uncertainty bands
  const errorMagnitude = (1 - stabilityScore) * 30 + volatilityIndex * 0.3;
  const forecastUpper80 = Math.min(100, Math.round(forecast90d + errorMagnitude * 1.28));
  const forecastLower80 = Math.max(0, Math.round(forecast90d - errorMagnitude * 1.28));
  const forecastUpper95 = Math.min(100, Math.round(forecast90d + errorMagnitude * 1.96));
  const forecastLower95 = Math.max(0, Math.round(forecast90d - errorMagnitude * 1.96));

  return {
    domain, performanceIndex, momentumScore, momentumTStat,
    volatilityIndex, volatilityDownside: volResult.downside,
    volatilityUpside: volResult.upside, volatilitySkewRatio: volResult.ratio,
    riskPressureScore, forecast90d, forecast1y, forecastDirection,
    confidenceScore, forecastUpper80, forecastLower80, forecastUpper95, forecastLower95,
    structuralBreak: breakResult.detected, structuralBreakPValue: breakResult.pValue,
    dataGapCount: gapResult.gapCount, dataStaleDays: gapResult.staleDays,
  };
}

// ─── 14. National Performance Index V2 (stateless) ──────────────────

/**
 * Stateless compute: all weights passed via context, no global mutation.
 */
export function computeNationalPerformanceV2(
  iso3: string,
  countryName: string,
  profile: Record<string, { metrics: MetricEntryV2[]; completeness: number }>,
  benchmarks: Record<string, GlobalBenchmark>,
  backtestResults: Record<string, BacktestResult>,
  calibratedParams?: Record<string, DomainModelParams>,
  context?: ComputeContext,
): NationalPerformanceIndexV2 {
  const weights = context?.weights || { ...DEFAULT_WEIGHTS };
  const calibration = context?.calibrationProfile;
  const couplingMatrix = context?.couplingMatrix;

  const domains: DomainPerformanceV2[] = Object.entries(profile)
    .filter(([_, data]) => data && data.metrics && data.metrics.length > 0)
    .map(([domain, data]) => {
      const stability = backtestResults[domain]?.stabilityScore ?? 0.5;
      const params = calibratedParams?.[domain] ?? DEFAULT_PARAMS;
      return computeDomainPerformanceV2(
        domain, data.metrics, data.completeness,
        benchmarks[domain], stability, params, calibration,
      );
    });

  if (domains.length === 0) {
    return {
      iso3, countryName, overallIndex: 0, momentum: 0, volatility: 0,
      riskPressure: 50, systemicFragility: 50, forecast90d: 0, forecast1y: 0,
      forecastDirection: 'stable', confidence: 10, structuralBreakCount: 0,
      forecastStability: 0.5, domains: [],
    };
  }

  let totalWeight = 0;
  let wPerf = 0, wMom = 0, wVol = 0, wRisk = 0;
  let wF90 = 0, wF1y = 0, wConf = 0;
  const domainScores: Record<string, number> = {};

  for (const dp of domains) {
    const w = weights[dp.domain] || 0.05;
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

  const systemicFragility = computeSystemicFragilityV2(domainScores, couplingMatrix);
  const riskPressure = Math.round(weightedRisk * 0.6 + systemicFragility * 0.4);
  const structuralBreakCount = domains.filter(d => d.structuralBreak).length;

  const stabilities = Object.values(backtestResults).map(b => b.stabilityScore);
  const forecastStability = stabilities.length > 0
    ? Math.round((stabilities.reduce((s, v) => s + v, 0) / stabilities.length) * 1000) / 1000
    : 0.5;

  let confidence = Math.round(baseConfidence * forecastStability - (structuralBreakCount * 3));
  confidence = Math.max(10, Math.min(95, confidence));

  const forecastDirection: 'up' | 'down' | 'stable' =
    momentum > 3 ? 'up' : momentum < -3 ? 'down' : 'stable';

  return {
    iso3, countryName, overallIndex, momentum, volatility,
    riskPressure, systemicFragility, forecast90d, forecast1y, forecastDirection,
    confidence, structuralBreakCount, forecastStability, domains,
  };
}

// ─── 15. Sensitivity analysis (fully stateless) ─────────────────────

export function sensitivityAnalysis(
  iso3: string,
  countryName: string,
  profile: Record<string, { metrics: MetricEntryV2[]; completeness: number }>,
  benchmarks: Record<string, GlobalBenchmark>,
  backtestResults: Record<string, BacktestResult>,
  calibratedParams?: Record<string, DomainModelParams>,
  baseWeights?: Record<string, number>,
): { baseNPI: number; maxDeviation: number; perturbedRange: [number, number]; sensitive_domains: string[] } {
  const weights = baseWeights ? { ...baseWeights } : { ...DEFAULT_WEIGHTS };

  const base = computeNationalPerformanceV2(iso3, countryName, profile, benchmarks, backtestResults, calibratedParams, { weights, modelVersion: CURRENT_MODEL_VERSION });
  const baseNPI = base.overallIndex;

  let minNPI = baseNPI;
  let maxNPI = baseNPI;
  const sensitiveDomains: { domain: string; spread: number }[] = [];

  for (const domain of Object.keys(weights)) {
    const origWeight = weights[domain];

    // +20%
    const highWeights = { ...weights, [domain]: origWeight * 1.2 };
    const high = computeNationalPerformanceV2(iso3, countryName, profile, benchmarks, backtestResults, calibratedParams, { weights: highWeights, modelVersion: CURRENT_MODEL_VERSION });

    // -20%
    const lowWeights = { ...weights, [domain]: origWeight * 0.8 };
    const low = computeNationalPerformanceV2(iso3, countryName, profile, benchmarks, backtestResults, calibratedParams, { weights: lowWeights, modelVersion: CURRENT_MODEL_VERSION });

    const spread = Math.abs(high.overallIndex - low.overallIndex);
    if (spread > 2) sensitiveDomains.push({ domain, spread });

    minNPI = Math.min(minNPI, low.overallIndex, high.overallIndex);
    maxNPI = Math.max(maxNPI, low.overallIndex, high.overallIndex);
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
    calibrated, backtest,
    cusum: { detected: cusum.detected, pValue: cusum.pValue, breakIndex: cusum.breakIndex },
    seriesLength: historicalSeries.length, outlierCount,
  };
}

// ─── UI helpers (re-exported from V1 for compatibility) ─────────────

export { getMomentumArrow, getMomentumColor, getRiskLabel, getRiskBadgeVariant, getPerformanceLabel, getVolatilityLabel } from './performance-engine';
