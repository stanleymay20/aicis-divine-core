/**
 * AICIS Performance Engine (APE)
 * Computes performance indices, momentum, volatility, risk pressure, and forecasts.
 * Data completeness becomes a confidence modifier — never a headline metric.
 */

export interface DomainPerformance {
  domain: string;
  performanceIndex: number;    // 0–100
  momentumScore: number;       // -100 to +100
  volatilityIndex: number;     // 0–100
  riskPressureScore: number;   // 0–100
  forecast90d: number;
  forecast1y: number;
  forecastDirection: 'up' | 'down' | 'stable';
  confidenceScore: number;     // max 95
}

export interface NationalPerformanceIndex {
  iso3: string;
  countryName: string;
  overallIndex: number;         // 0–100
  momentum: number;             // -100 to +100
  volatility: number;           // 0–100
  riskPressure: number;         // 0–100
  forecast90d: number;
  forecast1y: number;
  forecastDirection: 'up' | 'down' | 'stable';
  confidence: number;           // max 95
  domains: DomainPerformance[];
}

// --- Normalization ---

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

// --- Domain Performance Score ---

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

interface MetricEntry {
  metric: string;
  value: number;
  period: string;
  source: string;
  unit?: string;
}

function computeDomainPerformance(
  domain: string,
  metrics: MetricEntry[],
  dataCompleteness: number
): DomainPerformance {
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
      confidenceScore: Math.min(dataCompleteness * 30, 95),
    };
  }

  // Sort by period for time-series analysis
  const sorted = [...metrics].sort((a, b) => a.period.localeCompare(b.period));
  const values = sorted.map(m => m.value);

  // Performance Index: normalized composite of latest values
  const latestValues = values.slice(-5);
  const avg = latestValues.reduce((s, v) => s + v, 0) / latestValues.length;
  
  // Normalize based on domain-specific ranges
  const allMin = Math.min(...values);
  const allMax = Math.max(...values);
  const performanceIndex = Math.round(normalize(avg, allMin * 0.8, allMax * 1.2));

  // Momentum: % change over last 3 periods
  let momentumScore = 0;
  if (values.length >= 3) {
    const recent = values.slice(-3);
    const older = values.slice(-6, -3);
    if (older.length > 0) {
      const avgRecent = recent.reduce((s, v) => s + v, 0) / recent.length;
      const avgOlder = older.reduce((s, v) => s + v, 0) / older.length;
      momentumScore = avgOlder !== 0 
        ? Math.max(-100, Math.min(100, ((avgRecent - avgOlder) / Math.abs(avgOlder)) * 100))
        : 0;
    }
  }

  // Volatility: std deviation of recent values
  const recentValues = values.slice(-6);
  const mean = recentValues.reduce((s, v) => s + v, 0) / recentValues.length;
  const variance = recentValues.reduce((s, v) => s + (v - mean) ** 2, 0) / recentValues.length;
  const stdDev = Math.sqrt(variance);
  const volatilityIndex = Math.round(Math.min(100, (stdDev / (Math.abs(mean) || 1)) * 200));

  // Risk Pressure: inverse of stability
  const riskPressureScore = Math.round(
    Math.min(100, volatilityIndex * 0.5 + (100 - performanceIndex) * 0.3 + (momentumScore < 0 ? Math.abs(momentumScore) * 0.2 : 0))
  );

  // Forecast: trend + momentum projection
  const dampingFactor = 0.7;
  const momentumFactor = momentumScore / 100;
  const forecast90d = Math.max(0, Math.min(100, Math.round(
    performanceIndex + (momentumFactor * 15) - (volatilityIndex * 0.05 * dampingFactor)
  )));
  const forecast1y = Math.max(0, Math.min(100, Math.round(
    performanceIndex + (momentumFactor * 30) - (volatilityIndex * 0.1 * dampingFactor)
  )));

  const forecastDirection: 'up' | 'down' | 'stable' = 
    momentumScore > 5 ? 'up' : momentumScore < -5 ? 'down' : 'stable';

  // Confidence: data reliability modifier
  const confidenceScore = Math.min(95, Math.round(
    40 + (dataCompleteness * 40) + (metrics.length > 10 ? 15 : metrics.length * 1.5) - (volatilityIndex * 0.1)
  ));

  return {
    domain,
    performanceIndex,
    momentumScore: Math.round(momentumScore * 10) / 10,
    volatilityIndex,
    riskPressureScore,
    forecast90d,
    forecast1y,
    forecastDirection,
    confidenceScore,
  };
}

// --- National Performance Index ---

export function computeNationalPerformance(
  iso3: string,
  countryName: string,
  profile: Record<string, { metrics: MetricEntry[]; completeness: number }>,
): NationalPerformanceIndex {
  const domains: DomainPerformance[] = Object.entries(profile)
    .filter(([_, data]) => data && data.metrics && data.metrics.length > 0)
    .map(([domain, data]) => computeDomainPerformance(domain, data.metrics, data.completeness));

  if (domains.length === 0) {
    return {
      iso3,
      countryName,
      overallIndex: 0,
      momentum: 0,
      volatility: 0,
      riskPressure: 50,
      forecast90d: 0,
      forecast1y: 0,
      forecastDirection: 'stable',
      confidence: 10,
      domains: [],
    };
  }

  // Weighted aggregate
  let totalWeight = 0;
  let weightedPerf = 0;
  let weightedMomentum = 0;
  let weightedVolatility = 0;
  let weightedRisk = 0;
  let weightedForecast90 = 0;
  let weightedForecast1y = 0;
  let weightedConfidence = 0;

  for (const dp of domains) {
    const w = DOMAIN_WEIGHTS[dp.domain] || 0.05;
    totalWeight += w;
    weightedPerf += dp.performanceIndex * w;
    weightedMomentum += dp.momentumScore * w;
    weightedVolatility += dp.volatilityIndex * w;
    weightedRisk += dp.riskPressureScore * w;
    weightedForecast90 += dp.forecast90d * w;
    weightedForecast1y += dp.forecast1y * w;
    weightedConfidence += dp.confidenceScore * w;
  }

  const norm = totalWeight || 1;
  const overallIndex = Math.round(weightedPerf / norm);
  const momentum = Math.round((weightedMomentum / norm) * 10) / 10;
  const volatility = Math.round(weightedVolatility / norm);
  const riskPressure = Math.round(weightedRisk / norm);
  const forecast90d = Math.round(weightedForecast90 / norm);
  const forecast1y = Math.round(weightedForecast1y / norm);
  const confidence = Math.min(95, Math.round(weightedConfidence / norm));
  const forecastDirection: 'up' | 'down' | 'stable' =
    momentum > 3 ? 'up' : momentum < -3 ? 'down' : 'stable';

  return {
    iso3,
    countryName,
    overallIndex,
    momentum,
    volatility,
    riskPressure,
    forecast90d,
    forecast1y,
    forecastDirection,
    confidence,
    domains,
  };
}

// --- Helpers for UI ---

export function getMomentumArrow(momentum: number): string {
  if (momentum > 10) return '↑↑';
  if (momentum > 3) return '↑';
  if (momentum < -10) return '↓↓';
  if (momentum < -3) return '↓';
  return '→';
}

export function getMomentumColor(momentum: number): string {
  if (momentum > 5) return 'text-success';
  if (momentum < -5) return 'text-destructive';
  return 'text-muted-foreground';
}

export function getRiskLabel(score: number): string {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'Elevated';
  if (score >= 25) return 'Moderate';
  return 'Low';
}

export function getRiskBadgeVariant(score: number): 'destructive' | 'secondary' | 'outline' | 'default' {
  if (score >= 75) return 'destructive';
  if (score >= 50) return 'secondary';
  return 'outline';
}

export function getPerformanceLabel(index: number): string {
  if (index >= 80) return 'Strong';
  if (index >= 60) return 'Moderate';
  if (index >= 40) return 'Weak';
  return 'Critical';
}

export function getVolatilityLabel(vol: number): string {
  if (vol >= 60) return 'High';
  if (vol >= 30) return 'Moderate';
  return 'Low';
}
