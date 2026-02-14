/**
 * AICIS Performance Engine V2 (APE-V2)
 * Statistically defensible sovereign performance forecasting.
 *
 * Upgrades over V1:
 *  - Cross-country anchored normalization via global benchmarks
 *  - Exponential smoothing forecasts
 *  - Regression-based momentum
 *  - Structural break detection
 *  - Nonlinear fragility multiplier
 *  - Backtest-validated confidence
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
  volatilityIndex: number;        // 0–100
  riskPressureScore: number;      // 0–100
  forecast90d: number;
  forecast1y: number;
  forecastDirection: 'up' | 'down' | 'stable';
  confidenceScore: number;        // 10–95
  structuralBreak: boolean;
}

export interface NationalPerformanceIndexV2 {
  iso3: string;
  countryName: string;
  overallIndex: number;
  momentum: number;
  volatility: number;
  riskPressure: number;
  systemicFragility: number;      // 0–100  NEW
  forecast90d: number;
  forecast1y: number;
  forecastDirection: 'up' | 'down' | 'stable';
  confidence: number;
  structuralBreakCount: number;   // NEW
  forecastStability: number;      // 0–1    NEW
  domains: DomainPerformanceV2[];
}

export interface BacktestResult {
  mae: number;
  rmse: number;
  stabilityScore: number; // 0–1
}

export interface MetricEntryV2 {
  metric: string;
  value: number;
  period: string;
  source: string;
  unit?: string;
}

// ─── Domain weights (unchanged from V1) ─────────────────────────────

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

// ─── 1. Benchmark-anchored normalization ────────────────────────────

function normalizeWithBenchmark(
  value: number,
  benchmark: GlobalBenchmark | undefined,
): number {
  if (!benchmark) {
    // Fallback: percentile-50 anchored scaling (value assumed 0–100)
    return Math.max(0, Math.min(100, value));
  }
  const { structural_floor, structural_ceiling } = benchmark;
  if (structural_ceiling === structural_floor) return 50;
  const score = ((value - structural_floor) / (structural_ceiling - structural_floor)) * 100;
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

// ─── 2. Exponential smoothing ───────────────────────────────────────

export function exponentialSmoothing(
  series: number[],
  alpha: number = 0.6,
): number {
  if (series.length === 0) return 0;
  let s = series[0];
  for (let i = 1; i < series.length; i++) {
    s = alpha * series[i] + (1 - alpha) * s;
  }
  return s;
}

// ─── 3. Regression-based momentum (OLS slope over last N) ──────────

function regressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function computeMomentumV2(values: number[]): number {
  const recent = values.slice(-5);
  const slope = regressionSlope(recent);
  const mean = recent.reduce((s, v) => s + v, 0) / (recent.length || 1);
  // Normalize slope relative to mean → percentage momentum
  const raw = mean !== 0 ? (slope / Math.abs(mean)) * 100 : 0;
  return Math.max(-100, Math.min(100, Math.round(raw * 10) / 10));
}

// ─── 4. Volatility (coefficient of variation, scaled) ───────────────

function computeVolatility(values: number[]): number {
  const recent = values.slice(-6);
  if (recent.length < 2) return 0;
  const mean = recent.reduce((s, v) => s + v, 0) / recent.length;
  const variance = recent.reduce((s, v) => s + (v - mean) ** 2, 0) / recent.length;
  const stdDev = Math.sqrt(variance);
  const cv = Math.abs(mean) > 0 ? stdDev / Math.abs(mean) : 0;
  return Math.round(Math.min(100, cv * 200));
}

// ─── 5. Structural break detection ─────────────────────────────────

interface StructuralBreakResult {
  detected: boolean;
  momentumShift: number;
  volatilitySpike: boolean;
}

function detectStructuralBreak(
  values: number[],
  previousMomentum: number,
  currentMomentum: number,
): StructuralBreakResult {
  const momentumShift = Math.abs(currentMomentum - previousMomentum);

  // Volatility spike: compare recent vol to rolling average vol
  let volatilitySpike = false;
  if (values.length >= 9) {
    const olderVol = computeVolatility(values.slice(-9, -3));
    const recentVol = computeVolatility(values.slice(-6));
    if (olderVol > 0 && (recentVol - olderVol) / olderVol > 0.3) {
      volatilitySpike = true;
    }
  }

  const detected = momentumShift > 15 || volatilitySpike;
  return { detected, momentumShift, volatilitySpike };
}

// ─── 6. Backtesting engine ─────────────────────────────────────────

export function backtestForecast(
  historicalSeries: number[],
): BacktestResult {
  if (historicalSeries.length < 6) {
    return { mae: 0, rmse: 0, stabilityScore: 0.5 };
  }

  const errors: number[] = [];
  // Walk-forward: use first N to predict N+1, compare
  for (let i = 4; i < historicalSeries.length; i++) {
    const trainSlice = historicalSeries.slice(0, i);
    const predicted = exponentialSmoothing(trainSlice, 0.6);
    const actual = historicalSeries[i];
    errors.push(actual - predicted);
  }

  if (errors.length === 0) return { mae: 0, rmse: 0, stabilityScore: 0.5 };

  const absErrors = errors.map(Math.abs);
  const mae = absErrors.reduce((s, v) => s + v, 0) / absErrors.length;
  const mse = errors.reduce((s, v) => s + v * v, 0) / errors.length;
  const rmse = Math.sqrt(mse);

  // Stability = 1 - normalized RMSE (relative to data range)
  const range = Math.max(...historicalSeries) - Math.min(...historicalSeries);
  const nrmse = range > 0 ? rmse / range : 0;
  const stabilityScore = Math.max(0, Math.min(1, 1 - nrmse));

  return {
    mae: Math.round(mae * 100) / 100,
    rmse: Math.round(rmse * 100) / 100,
    stabilityScore: Math.round(stabilityScore * 1000) / 1000,
  };
}

// ─── 7. Nonlinear fragility multiplier ─────────────────────────────

function computeSystemicFragility(
  domainScores: Record<string, number>,
): number {
  const gov = (domainScores['governance'] ?? 50) / 100;
  const sec = (domainScores['security'] ?? 50) / 100;
  const fin = (domainScores['finance'] ?? 50) / 100;

  // fragility = product of deficiencies
  const fragility = (1 - gov) * (1 - sec) * (1 - fin);
  // systemic risk = 0–100
  return Math.round(fragility * 100 * 10) / 10;
}

// ─── 8. Domain performance (V2) ────────────────────────────────────

export function computeDomainPerformanceV2(
  domain: string,
  metrics: MetricEntryV2[],
  dataCompleteness: number,
  benchmark: GlobalBenchmark | undefined,
  stabilityScore: number = 0.5,
): DomainPerformanceV2 {
  if (!metrics || metrics.length === 0) {
    return {
      domain,
      performanceIndex: 0,
      momentumScore: 0,
      volatilityIndex: 0,
      riskPressureScore: 50,
      forecast90d: 0,
      forecast1y: 0,
      forecastDirection: 'stable',
      confidenceScore: Math.max(10, Math.min(95, Math.round(dataCompleteness * 30))),
      structuralBreak: false,
    };
  }

  const sorted = [...metrics].sort((a, b) => a.period.localeCompare(b.period));
  const values = sorted.map(m => m.value);

  // Performance index: benchmark-anchored
  const latestValues = values.slice(-5);
  const avg = latestValues.reduce((s, v) => s + v, 0) / latestValues.length;
  const performanceIndex = Math.round(normalizeWithBenchmark(avg, benchmark));

  // Momentum: regression-based
  const momentumScore = computeMomentumV2(values);

  // Previous momentum (for structural break detection)
  const olderValues = values.slice(0, -3);
  const previousMomentum = olderValues.length >= 2 ? computeMomentumV2(olderValues) : 0;

  // Volatility
  const volatilityIndex = computeVolatility(values);

  // Structural break
  const breakResult = detectStructuralBreak(values, previousMomentum, momentumScore);

  // Risk pressure
  let riskPressureScore = Math.round(
    Math.min(100,
      volatilityIndex * 0.5 +
      (100 - performanceIndex) * 0.3 +
      (momentumScore < 0 ? Math.abs(momentumScore) * 0.2 : 0)
    )
  );
  if (breakResult.detected) riskPressureScore = Math.min(100, riskPressureScore + 10);

  // Forecast: exponential smoothing based
  const smoothed = exponentialSmoothing(values, 0.6);
  const smoothedNorm = Math.round(normalizeWithBenchmark(smoothed, benchmark));
  const dampingFactor = 0.7;
  const momentumFactor = momentumScore / 100;

  const forecast90d = Math.max(0, Math.min(100, Math.round(
    smoothedNorm + (momentumFactor * 15) - (volatilityIndex * 0.05 * dampingFactor)
  )));
  const forecast1y = Math.max(0, Math.min(100, Math.round(
    smoothedNorm + (momentumFactor * 30) - (volatilityIndex * 0.1 * dampingFactor)
  )));

  const forecastDirection: 'up' | 'down' | 'stable' =
    momentumScore > 5 ? 'up' : momentumScore < -5 ? 'down' : 'stable';

  // Confidence: V2 formula
  const dataDensity = Math.min(1, metrics.length / 20);
  let confidenceScore = Math.round(
    40 +
    (dataDensity * 20) +
    (stabilityScore * 20) -
    (volatilityIndex * 0.1) -
    (breakResult.detected ? 10 : 0)
  );
  confidenceScore = Math.max(10, Math.min(95, confidenceScore));

  return {
    domain,
    performanceIndex,
    momentumScore,
    volatilityIndex,
    riskPressureScore,
    forecast90d,
    forecast1y,
    forecastDirection,
    confidenceScore,
    structuralBreak: breakResult.detected,
  };
}

// ─── 9. National Performance Index V2 ──────────────────────────────

export function computeNationalPerformanceV2(
  iso3: string,
  countryName: string,
  profile: Record<string, { metrics: MetricEntryV2[]; completeness: number }>,
  benchmarks: Record<string, GlobalBenchmark>,
  backtestResults: Record<string, BacktestResult>,
): NationalPerformanceIndexV2 {
  const domains: DomainPerformanceV2[] = Object.entries(profile)
    .filter(([_, data]) => data && data.metrics && data.metrics.length > 0)
    .map(([domain, data]) => {
      const stability = backtestResults[domain]?.stabilityScore ?? 0.5;
      return computeDomainPerformanceV2(
        domain, data.metrics, data.completeness,
        benchmarks[domain], stability,
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

  // Weighted aggregate
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

  // Nonlinear fragility
  const systemicFragility = computeSystemicFragility(domainScores);

  // Blend risk: 60% weighted + 40% systemic
  const riskPressure = Math.round(weightedRisk * 0.6 + systemicFragility * 0.4);

  const structuralBreakCount = domains.filter(d => d.structuralBreak).length;

  // Forecast stability: average of domain backtests
  const stabilities = Object.values(backtestResults).map(b => b.stabilityScore);
  const forecastStability = stabilities.length > 0
    ? Math.round((stabilities.reduce((s, v) => s + v, 0) / stabilities.length) * 1000) / 1000
    : 0.5;

  // Final confidence adjusted by stability & breaks
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

// ─── UI helpers (re-exported from V1 for compatibility) ─────────────

export { getMomentumArrow, getMomentumColor, getRiskLabel, getRiskBadgeVariant, getPerformanceLabel, getVolatilityLabel } from './performance-engine';
