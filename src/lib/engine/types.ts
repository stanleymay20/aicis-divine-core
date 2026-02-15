/**
 * AICIS Performance Engine V2 — Shared Types
 */

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
  residualDistributions?: Record<string, ResidualDistribution>;
  frozen?: boolean;
}

export interface PlattCalibration {
  a: number;
  b: number;
  fitted: boolean;
}

export interface VolatilityResult {
  total: number;
  downside: number;
  upside: number;
  ratio: number;
}

export interface ResidualDistribution {
  quantile_10: number;
  quantile_20: number;
  quantile_80: number;
  quantile_90: number;
  quantile_025: number;
  quantile_975: number;
  mean: number;
  stdDev: number;
  n: number;
}

export interface SPCObservation {
  metricName: string;
  observedValue: number;
  ewmaValue: number;
  rollingMean: number;
  rollingStd: number;
  upperControl: number;
  lowerControl: number;
  outOfControl: boolean;
}

export interface KillSwitchConditions {
  rmseOutOfControl: boolean;
  hit80Below60: boolean;
  breakRateAbove60: boolean;
  calibrationDivergenceAbove25: boolean;
}

export interface DriftCheckResult {
  drifted: boolean;
  alertType: string;
  currentValue: number;
  baselineValue: number;
  deviationPct: number;
  severity: 'info' | 'warning' | 'critical';
}

export const DEFAULT_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
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

export const DEFAULT_PARAMS: DomainModelParams = { alpha: 0.55, beta: 0.3 };

export const CURRENT_MODEL_VERSION = "APE-V2.1";
