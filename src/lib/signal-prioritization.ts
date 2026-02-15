/**
 * AICIS Signal Prioritization Engine
 * Ranks alerts by: RiskPressure × Fragility × BreakProbability
 * Suppresses low-materiality signals to prevent alert fatigue.
 */

export interface PrioritizedSignal {
  id: string;
  title: string;
  message: string;
  severity: string;
  division: string;
  country?: string;
  created_at: string;
  acknowledged: boolean;

  // Computed fields
  materialityScore: number;     // 0–100
  priorityRank: number;         // 1 = highest
  suppressed: boolean;          // true if below materiality threshold
  suppressionReason?: string;
}

interface SignalContext {
  riskPressure?: number;        // 0–100
  systemicFragility?: number;   // 0–100
  breakProbability?: number;    // 0–1 (1 - pValue)
  volatilitySkew?: number;      // downside/upside ratio
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 1.0,
  high: 0.75,
  medium: 0.45,
  low: 0.2,
};

const MATERIALITY_THRESHOLD = 15; // Suppress signals below this score

/**
 * Compute materiality score for a single alert.
 * Formula: severity_weight × (riskPressure × 0.4 + fragility × 0.3 + breakProb × 0.3)
 */
export function computeMateriality(
  severity: string,
  context: SignalContext,
): number {
  const severityWeight = SEVERITY_WEIGHTS[severity] ?? 0.3;
  const risk = context.riskPressure ?? 50;
  const fragility = context.systemicFragility ?? 50;
  const breakProb = (context.breakProbability ?? 0) * 100;

  // Volatility skew amplifier: if downside > upside, signal is more material
  const skewAmplifier = context.volatilitySkew && context.volatilitySkew > 1.5
    ? 1 + (context.volatilitySkew - 1) * 0.1
    : 1;

  const raw = severityWeight * (
    risk * 0.4 +
    fragility * 0.3 +
    breakProb * 0.3
  ) * skewAmplifier;

  return Math.round(Math.min(100, Math.max(0, raw)));
}

/**
 * Prioritize and rank a set of alerts given domain context.
 */
export function prioritizeSignals(
  alerts: Array<{
    id: string;
    title: string;
    message: string;
    severity: string;
    division: string;
    country?: string;
    created_at: string;
    acknowledged: boolean;
  }>,
  contextByCountry: Record<string, SignalContext> = {},
  globalContext: SignalContext = {},
): PrioritizedSignal[] {
  const scored = alerts.map(alert => {
    const context = alert.country
      ? (contextByCountry[alert.country] ?? globalContext)
      : globalContext;

    const materialityScore = computeMateriality(alert.severity, context);
    const suppressed = materialityScore < MATERIALITY_THRESHOLD && !alert.acknowledged;

    return {
      ...alert,
      materialityScore,
      priorityRank: 0, // Set after sorting
      suppressed,
      suppressionReason: suppressed
        ? `Materiality ${materialityScore} below threshold ${MATERIALITY_THRESHOLD}`
        : undefined,
    };
  });

  // Sort: unacknowledged first, then by materiality descending
  scored.sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    return b.materialityScore - a.materialityScore;
  });

  // Assign ranks
  scored.forEach((s, i) => { s.priorityRank = i + 1; });

  return scored;
}

/**
 * Get summary stats for prioritized signals.
 */
export function getSignalSummary(signals: PrioritizedSignal[]) {
  const active = signals.filter(s => !s.suppressed && !s.acknowledged);
  const suppressed = signals.filter(s => s.suppressed);
  const critical = active.filter(s => s.materialityScore >= 70);
  const elevated = active.filter(s => s.materialityScore >= 40 && s.materialityScore < 70);

  return {
    total: signals.length,
    active: active.length,
    suppressed: suppressed.length,
    critical: critical.length,
    elevated: elevated.length,
    avgMateriality: active.length > 0
      ? Math.round(active.reduce((s, a) => s + a.materialityScore, 0) / active.length)
      : 0,
  };
}
