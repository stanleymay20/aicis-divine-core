/**
 * AICIS Performance Engine V2 (APE-V2) — Facade Module
 *
 * This file re-exports from focused sub-modules in src/lib/engine/.
 * All logic is maintained in:
 *  - engine/types.ts      — All type definitions and constants
 *  - engine/smoothing.ts  — Holt, CUSUM, data prep, OLS, volatility
 *  - engine/calibration.ts — Platt scaling, backtesting, residual distributions
 *  - engine/spc.ts        — SPC, EWMA, kill-switch, DM test, drift
 *  - engine/fragility.ts  — Graph-based systemic fragility
 *  - engine/forecast.ts   — Domain & national performance compute
 *  - engine/loaders.ts    — Database loaders & archive
 */

// ─── Types ──────────────────────────────────────────────────────────
export type {
  GlobalBenchmark, DomainPerformanceV2, NationalPerformanceIndexV2,
  BacktestResult, MetricEntryV2, DomainModelParams, DomainCoupling,
  ComputeContext, PlattCalibration, VolatilityResult, ResidualDistribution,
  SPCObservation, KillSwitchConditions, DriftCheckResult,
} from './engine/types';

export { DEFAULT_WEIGHTS, DEFAULT_PARAMS, CURRENT_MODEL_VERSION } from './engine/types';

// ─── Smoothing & Data Prep ──────────────────────────────────────────
export {
  holtSmoothing, exponentialSmoothing,
  computeVolatilityDetailed,
  normalizeWithBenchmark,
  detectStructuralBreakCUSUM,
  winsorizeOutliers,
} from './engine/smoothing';

// ─── Calibration ────────────────────────────────────────────────────
export {
  fitPlattCalibration, applyPlattCalibration,
  backtestForecast, calibrateParameters,
  computeResidualDistribution, empiricalForecastBands,
  computeDecayWeightedDistribution,
} from './engine/calibration';

// ─── SPC & Governance ───────────────────────────────────────────────
export {
  computeEWMA, evaluateSPC,
  evaluateKillSwitch,
  checkMetricDrift,
  dieboldMarianoTest,
} from './engine/spc';

// ─── Fragility ──────────────────────────────────────────────────────
export { computeSystemicFragilityV2, computeSystemicFragility } from './engine/fragility';

// ─── Forecast Compute ───────────────────────────────────────────────
export {
  computeDomainPerformanceV2,
  computeNationalPerformanceV2,
  sensitivityAnalysis,
  computeModelDiagnostics,
} from './engine/forecast';

// ─── DB Loaders ─────────────────────────────────────────────────────
export {
  loadDomainWeightsFromDB,
  loadCouplingMatrix,
  archiveForecastSnapshot,
} from './engine/loaders';

// ─── UI helpers (from V1) ───────────────────────────────────────────
export { getMomentumArrow, getMomentumColor, getRiskLabel, getRiskBadgeVariant, getPerformanceLabel, getVolatilityLabel } from './performance-engine';
