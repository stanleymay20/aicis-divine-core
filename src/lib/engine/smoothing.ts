/**
 * AICIS Engine — Smoothing, Period Detection, Data Preparation
 */
import { type MetricEntryV2, type DomainModelParams, DEFAULT_PARAMS } from './types';

// ─── Holt double exponential smoothing ──────────────────────────────

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

// ─── Period detection ───────────────────────────────────────────────

export type Periodicity = 'monthly' | 'quarterly' | 'annual' | 'unknown';

export function detectPeriodicity(periods: string[]): Periodicity {
  if (periods.length < 2) return 'unknown';
  if (periods.some(p => /Q[1-4]/.test(p))) return 'quarterly';
  if (periods.some(p => /^\d{4}-\d{2}$/.test(p))) return 'monthly';
  if (periods.every(p => /^\d{4}$/.test(p))) return 'annual';
  return 'monthly';
}

export function horizonToPeriods(days: number, periodicity: Periodicity): number {
  switch (periodicity) {
    case 'monthly': return days / 30;
    case 'quarterly': return days / 90;
    case 'annual': return days / 365;
    default: return days / 30;
  }
}

// ─── Outlier detection (IQR-based winsorization) ────────────────────

export function winsorizeOutliers(values: number[]): number[] {
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

// ─── Data gap interpolation ─────────────────────────────────────────

export interface GapFilledResult {
  values: number[];
  gapCount: number;
  staleDays: number;
  outlierCount: number;
}

export function fillDataGaps(sorted: MetricEntryV2[]): GapFilledResult {
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

// ─── OLS regression with t-statistic ────────────────────────────────

export interface RegressionResult {
  slope: number;
  tStat: number;
  significant: boolean;
}

export function regressionWithSignificance(values: number[]): RegressionResult {
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

export function computeMomentumV2(values: number[]): { momentum: number; tStat: number } {
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

// ─── Volatility ─────────────────────────────────────────────────────

export function computeVolatility(values: number[]): number {
  return computeVolatilityDetailed(values).total;
}

export function computeVolatilityDetailed(values: number[]): { total: number; downside: number; upside: number; ratio: number } {
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

// ─── Benchmark normalization ────────────────────────────────────────

import { type GlobalBenchmark } from './types';

export function normalizeWithBenchmark(
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

// ─── CUSUM structural break detection ───────────────────────────────

export interface StructuralBreakResult {
  detected: boolean;
  pValue: number;
  breakIndex: number;
}

export function detectStructuralBreakCUSUM(
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

// ─── Regime Switching ───────────────────────────────────────────────

export function regimeSwitchAdapt(
  values: number[],
  breakIndex: number,
  params: DomainModelParams,
  calibrateParametersFn: (series: number[]) => DomainModelParams,
): { adaptedValues: number[]; adaptedParams: DomainModelParams; horizonCap: number } {
  if (breakIndex < 0 || breakIndex >= values.length) {
    return { adaptedValues: values, adaptedParams: params, horizonCap: 365 };
  }

  const postBreak = values.slice(breakIndex);
  const adaptedValues = postBreak.length >= 4 ? postBreak : values.slice(Math.floor(values.length * 0.5));

  const adaptedParams = adaptedValues.length >= 8
    ? calibrateParametersFn(adaptedValues)
    : { alpha: Math.min(0.8, params.alpha + 0.15), beta: Math.min(0.5, params.beta + 0.1) };

  return { adaptedValues, adaptedParams, horizonCap: 120 };
}
