/**
 * AICIS Engine — Calibration, Platt Scaling, Residual Distributions
 */
import type { PlattCalibration, ResidualDistribution, BacktestResult, DomainModelParams } from './types';
import { DEFAULT_PARAMS } from './types';
import { holtSmoothing } from './smoothing';

// ─── Platt Scaling ──────────────────────────────────────────────────

export function fitPlattCalibration(
  predictedConfidences: number[],
  actualHits: boolean[],
): PlattCalibration {
  if (predictedConfidences.length < 20) {
    return { a: -1, b: 0, fitted: false };
  }

  const n = predictedConfidences.length;
  const prior1 = actualHits.filter(h => h).length;
  const prior0 = n - prior1;

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

export function applyPlattCalibration(
  rawConfidence: number,
  calibration: PlattCalibration,
): number {
  if (!calibration.fitted) return rawConfidence;
  const raw01 = rawConfidence / 100;
  const calibrated = 1 / (1 + Math.exp(calibration.a * raw01 + calibration.b));
  return Math.max(10, Math.min(95, Math.round(calibrated * 100)));
}

// ─── Backtesting ────────────────────────────────────────────────────

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

// ─── Parameter calibration (k-fold cross-validated) ─────────────────

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

// ─── Empirical Residual Distributions ───────────────────────────────

export function computeResidualDistribution(residuals: number[]): ResidualDistribution | null {
  if (residuals.length < 15) return null;
  const sorted = [...residuals].sort((a, b) => a - b);
  const n = sorted.length;
  const quantile = (p: number) => {
    const idx = p * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
  };
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return {
    quantile_10: quantile(0.10),
    quantile_20: quantile(0.20),
    quantile_80: quantile(0.80),
    quantile_90: quantile(0.90),
    quantile_025: quantile(0.025),
    quantile_975: quantile(0.975),
    mean,
    stdDev: Math.sqrt(variance),
    n,
  };
}

export function empiricalForecastBands(
  pointForecast: number,
  distribution: ResidualDistribution,
): { upper80: number; lower80: number; upper95: number; lower95: number } {
  return {
    lower80: Math.max(0, Math.min(100, Math.round(pointForecast + distribution.quantile_10))),
    upper80: Math.min(100, Math.max(0, Math.round(pointForecast + distribution.quantile_90))),
    lower95: Math.max(0, Math.min(100, Math.round(pointForecast + distribution.quantile_025))),
    upper95: Math.min(100, Math.max(0, Math.round(pointForecast + distribution.quantile_975))),
  };
}

// ─── Decay-Weighted Residual Distribution ───────────────────────────

export function computeDecayWeightedDistribution(
  residuals: { value: number; ageDays: number }[],
  lambda: number = 0.01,
): ResidualDistribution | null {
  if (residuals.length < 15) return null;

  const weighted = residuals.map(r => ({
    value: r.value,
    weight: Math.exp(-lambda * r.ageDays),
  }));

  weighted.sort((a, b) => a.value - b.value);

  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
  const weightedMean = weighted.reduce((s, w) => s + w.value * w.weight, 0) / totalWeight;
  const weightedVariance = weighted.reduce((s, w) => s + w.weight * (w.value - weightedMean) ** 2, 0) / totalWeight;

  const weightedQuantile = (p: number): number => {
    let cumWeight = 0;
    const target = p * totalWeight;
    for (const w of weighted) {
      cumWeight += w.weight;
      if (cumWeight >= target) return w.value;
    }
    return weighted[weighted.length - 1].value;
  };

  return {
    quantile_10: weightedQuantile(0.10),
    quantile_20: weightedQuantile(0.20),
    quantile_80: weightedQuantile(0.80),
    quantile_90: weightedQuantile(0.90),
    quantile_025: weightedQuantile(0.025),
    quantile_975: weightedQuantile(0.975),
    mean: weightedMean,
    stdDev: Math.sqrt(weightedVariance),
    n: residuals.length,
  };
}
