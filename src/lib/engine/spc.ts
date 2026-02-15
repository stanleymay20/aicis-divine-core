/**
 * AICIS Engine — Statistical Process Control, Kill-Switch, Drift Detection
 */
import type { SPCObservation, KillSwitchConditions, DriftCheckResult } from './types';

// ─── EWMA ───────────────────────────────────────────────────────────

export function computeEWMA(
  currentValue: number,
  previousEWMA: number,
  lambda: number = 0.2,
): number {
  return lambda * currentValue + (1 - lambda) * previousEWMA;
}

// ─── SPC Evaluation ─────────────────────────────────────────────────

export function evaluateSPC(
  metricName: string,
  currentValue: number,
  history: number[],
  lambda: number = 0.2,
): SPCObservation {
  const n = history.length;
  if (n < 5) {
    return {
      metricName, observedValue: currentValue, ewmaValue: currentValue,
      rollingMean: currentValue, rollingStd: 0, upperControl: currentValue,
      lowerControl: currentValue, outOfControl: false,
    };
  }

  const rollingMean = history.reduce((s, v) => s + v, 0) / n;
  const variance = history.reduce((s, v) => s + (v - rollingMean) ** 2, 0) / n;
  const rollingStd = Math.sqrt(variance);

  const prevEWMA = history.length > 0 ? history[history.length - 1] : currentValue;
  const ewmaValue = computeEWMA(currentValue, prevEWMA, lambda);

  const upperControl = rollingMean + 3 * rollingStd;
  const lowerControl = rollingMean - 3 * rollingStd;

  const outOfControl = currentValue > upperControl || currentValue < lowerControl;

  return {
    metricName, observedValue: currentValue, ewmaValue,
    rollingMean: Math.round(rollingMean * 1000) / 1000,
    rollingStd: Math.round(rollingStd * 1000) / 1000,
    upperControl: Math.round(upperControl * 1000) / 1000,
    lowerControl: Math.round(lowerControl * 1000) / 1000,
    outOfControl,
  };
}

// ─── Kill-Switch ────────────────────────────────────────────────────

export function evaluateKillSwitch(conditions: KillSwitchConditions): {
  shouldFreeze: boolean;
  reasons: string[];
  forcedConfidence: number;
} {
  const reasons: string[] = [];
  if (conditions.rmseOutOfControl) reasons.push("RMSE beyond 3σ control band");
  if (conditions.hit80Below60) reasons.push("Hit80 below 60%");
  if (conditions.breakRateAbove60) reasons.push("Structural break rate >60%");
  if (conditions.calibrationDivergenceAbove25) reasons.push("Calibration divergence >25%");

  return {
    shouldFreeze: reasons.length > 0,
    reasons,
    forcedConfidence: reasons.length > 0 ? 10 : -1,
  };
}

// ─── Legacy Drift Detection ─────────────────────────────────────────

export function checkMetricDrift(
  metricName: string,
  currentValue: number,
  baselineValue: number,
  warningThresholdPct: number = 20,
  criticalThresholdPct: number = 50,
): DriftCheckResult {
  if (baselineValue === 0) {
    return { drifted: false, alertType: metricName, currentValue, baselineValue, deviationPct: 0, severity: 'info' };
  }
  const deviationPct = Math.abs((currentValue - baselineValue) / baselineValue) * 100;
  const severity = deviationPct >= criticalThresholdPct ? 'critical' : deviationPct >= warningThresholdPct ? 'warning' : 'info';
  return {
    drifted: deviationPct >= warningThresholdPct,
    alertType: metricName,
    currentValue, baselineValue,
    deviationPct: Math.round(deviationPct * 10) / 10,
    severity,
  };
}

// ─── Diebold-Mariano Test ───────────────────────────────────────────

export function dieboldMarianoTest(
  errorsA: number[],
  errorsB: number[],
): { testStatistic: number; pValue: number; aIsBetter: boolean } {
  const n = Math.min(errorsA.length, errorsB.length);
  if (n < 10) return { testStatistic: 0, pValue: 1, aIsBetter: false };

  const d: number[] = [];
  for (let i = 0; i < n; i++) {
    d.push(errorsA[i] ** 2 - errorsB[i] ** 2);
  }

  const dMean = d.reduce((s, v) => s + v, 0) / n;
  const dVar = d.reduce((s, v) => s + (v - dMean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(dVar / n);

  if (se === 0) return { testStatistic: 0, pValue: 1, aIsBetter: false };

  const testStatistic = dMean / se;

  const absT = Math.abs(testStatistic);
  const pValue = 2 * (1 - normalCDF(absT));

  return {
    testStatistic: Math.round(testStatistic * 100) / 100,
    pValue: Math.round(pValue * 10000) / 10000,
    aIsBetter: dMean < 0,
  };
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}
