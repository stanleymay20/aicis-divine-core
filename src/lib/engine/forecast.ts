/**
 * AICIS Engine — Domain & National Performance Compute (stateless)
 */
import type {
  GlobalBenchmark, DomainPerformanceV2, NationalPerformanceIndexV2,
  BacktestResult, MetricEntryV2, DomainModelParams, ComputeContext,
  ResidualDistribution,
} from './types';
import { DEFAULT_WEIGHTS, DEFAULT_PARAMS, CURRENT_MODEL_VERSION } from './types';
import {
  holtSmoothing, fillDataGaps, detectPeriodicity, horizonToPeriods,
  normalizeWithBenchmark, computeMomentumV2, computeVolatilityDetailed,
  detectStructuralBreakCUSUM, regimeSwitchAdapt, winsorizeOutliers,
} from './smoothing';
import { applyPlattCalibration, calibrateParameters, backtestForecast, empiricalForecastBands } from './calibration';
import { computeSystemicFragilityV2 } from './fragility';

// ─── Domain Performance (V2 hardened) ───────────────────────────────

export function computeDomainPerformanceV2(
  domain: string,
  metrics: MetricEntryV2[],
  dataCompleteness: number,
  benchmark: GlobalBenchmark | undefined,
  stabilityScore: number = 0.5,
  params: DomainModelParams = DEFAULT_PARAMS,
  calibration?: { a: number; b: number; fitted: boolean },
  residualDist?: ResidualDistribution,
  frozen?: boolean,
): DomainPerformanceV2 {
  // If system is frozen, return minimal-confidence result
  if (frozen) {
    return {
      domain, performanceIndex: 0, momentumScore: 0, momentumTStat: 0,
      volatilityIndex: 0, volatilityDownside: 0, volatilityUpside: 0, volatilitySkewRatio: 1,
      riskPressureScore: 50, forecast90d: 0, forecast1y: 0, forecastDirection: 'stable',
      confidenceScore: 10,
      forecastUpper80: 0, forecastLower80: 0, forecastUpper95: 0, forecastLower95: 0,
      structuralBreak: false, structuralBreakPValue: 1, dataGapCount: 0, dataStaleDays: 0,
    };
  }

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

  // Regime switching
  let activeParams = params;
  let forecastValues = values;
  let horizonCapDays = 365;

  if (breakResult.detected && breakResult.breakIndex > 0) {
    const adapted = regimeSwitchAdapt(values, breakResult.breakIndex, params, calibrateParameters);
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

  // Forecast
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

  const confidenceScore = calibration?.fitted
    ? applyPlattCalibration(rawConfidence, calibration)
    : rawConfidence;

  // Forecast uncertainty bands — USE EMPIRICAL WHEN AVAILABLE
  let forecastUpper80: number, forecastLower80: number;
  let forecastUpper95: number, forecastLower95: number;

  if (residualDist && residualDist.n >= 15) {
    // True empirical bands from stored residual distribution
    const bands = empiricalForecastBands(forecast90d, residualDist);
    forecastUpper80 = bands.upper80;
    forecastLower80 = bands.lower80;
    forecastUpper95 = bands.upper95;
    forecastLower95 = bands.lower95;
  } else {
    // Fallback: heuristic scaling (documented as fallback)
    const errorMagnitude = (1 - stabilityScore) * 30 + volatilityIndex * 0.3;
    forecastUpper80 = Math.min(100, Math.round(forecast90d + errorMagnitude * 1.28));
    forecastLower80 = Math.max(0, Math.round(forecast90d - errorMagnitude * 1.28));
    forecastUpper95 = Math.min(100, Math.round(forecast90d + errorMagnitude * 1.96));
    forecastLower95 = Math.max(0, Math.round(forecast90d - errorMagnitude * 1.96));
  }

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

// ─── National Performance Index V2 (stateless) ─────────────────────

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
  const residualDists = context?.residualDistributions;
  const frozen = context?.frozen;

  const domains: DomainPerformanceV2[] = Object.entries(profile)
    .filter(([_, data]) => data && data.metrics && data.metrics.length > 0)
    .map(([domain, data]) => {
      const stability = backtestResults[domain]?.stabilityScore ?? 0.5;
      const params = calibratedParams?.[domain] ?? DEFAULT_PARAMS;
      const domainResiduals = residualDists?.[domain];
      return computeDomainPerformanceV2(
        domain, data.metrics, data.completeness,
        benchmarks[domain], stability, params, calibration,
        domainResiduals, frozen,
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

// ─── Sensitivity analysis (fully stateless) ─────────────────────────

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

    const highWeights = { ...weights, [domain]: origWeight * 1.2 };
    const high = computeNationalPerformanceV2(iso3, countryName, profile, benchmarks, backtestResults, calibratedParams, { weights: highWeights, modelVersion: CURRENT_MODEL_VERSION });

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

// ─── Model diagnostics ─────────────────────────────────────────────

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
  const outlierCount = historicalSeries.filter((v: number, i: number) => v !== winsorized[i]).length;

  return {
    calibrated, backtest,
    cusum: { detected: cusum.detected, pValue: cusum.pValue, breakIndex: cusum.breakIndex },
    seriesLength: historicalSeries.length, outlierCount,
  };
}
