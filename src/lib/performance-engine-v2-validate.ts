/**
 * AICIS Performance Engine V2 — Validation Utility
 * Compares V1 vs V2 output for test countries.
 * Run via: import and call validateV2() from browser console or component.
 */

import { computeNationalPerformance } from './performance-engine';
import {
  computeNationalPerformanceV2,
  backtestForecast,
  type GlobalBenchmark,
  type BacktestResult,
  type MetricEntryV2,
} from './performance-engine-v2';

// Synthetic test data for 4 countries
function generateTestProfile(seed: number): Record<string, { metrics: MetricEntryV2[]; completeness: number }> {
  const domains = ['governance', 'health', 'energy', 'finance', 'food', 'security'];
  const profile: Record<string, { metrics: MetricEntryV2[]; completeness: number }> = {};
  const sources = ['worldbank', 'who', 'faostat'];

  for (const domain of domains) {
    const metrics: MetricEntryV2[] = [];
    const base = (seed * 7 + domain.length * 13) % 60 + 20; // 20–80

    for (let i = 0; i < 12; i++) {
      const noise = Math.sin(seed * i + domain.length) * 8;
      const trend = (domain === 'governance' ? 0.5 : -0.2) * i;
      metrics.push({
        metric: `${domain}_index`,
        value: Math.max(5, Math.min(95, base + noise + trend)),
        period: `2025-${String(i + 1).padStart(2, '0')}`,
        source: sources[i % sources.length],
      });
    }
    profile[domain] = { metrics, completeness: 0.6 + (seed % 4) * 0.1 };
  }
  return profile;
}

const TEST_BENCHMARKS: Record<string, GlobalBenchmark> = {
  governance: { domain: 'governance', percentile_10: 15, percentile_25: 30, percentile_50: 50, percentile_75: 70, percentile_90: 85, structural_floor: 5, structural_ceiling: 95 },
  health:     { domain: 'health',     percentile_10: 20, percentile_25: 35, percentile_50: 55, percentile_75: 72, percentile_90: 88, structural_floor: 10, structural_ceiling: 95 },
  energy:     { domain: 'energy',     percentile_10: 10, percentile_25: 25, percentile_50: 45, percentile_75: 65, percentile_90: 82, structural_floor: 5, structural_ceiling: 95 },
  finance:    { domain: 'finance',    percentile_10: 15, percentile_25: 30, percentile_50: 50, percentile_75: 68, percentile_90: 85, structural_floor: 5, structural_ceiling: 95 },
  food:       { domain: 'food',       percentile_10: 18, percentile_25: 32, percentile_50: 52, percentile_75: 70, percentile_90: 86, structural_floor: 8, structural_ceiling: 95 },
  security:   { domain: 'security',   percentile_10: 12, percentile_25: 28, percentile_50: 48, percentile_75: 68, percentile_90: 84, structural_floor: 5, structural_ceiling: 95 },
};

const COUNTRIES = [
  { iso3: 'USA', name: 'United States', seed: 1 },
  { iso3: 'DEU', name: 'Germany', seed: 2 },
  { iso3: 'GHA', name: 'Ghana', seed: 3 },
  { iso3: 'CHN', name: 'China', seed: 4 },
];

export function validateV2(): void {
  console.group('🔬 AICIS Performance Engine V2 Validation');

  for (const { iso3, name, seed } of COUNTRIES) {
    const profile = generateTestProfile(seed);

    // V1
    const v1 = computeNationalPerformance(iso3, name, profile);

    // Backtests per domain
    const backtests: Record<string, BacktestResult> = {};
    for (const [domain, data] of Object.entries(profile)) {
      const values = data.metrics.map(m => m.value);
      backtests[domain] = backtestForecast(values);
    }

    // V2
    const v2 = computeNationalPerformanceV2(iso3, name, profile, TEST_BENCHMARKS, backtests);

    console.group(`🌍 ${name} (${iso3})`);
    console.table({
      'V1 NPI': v1.overallIndex,
      'V2 NPI': v2.overallIndex,
      'NPI Δ': v2.overallIndex - v1.overallIndex,
      'V1 Risk': v1.riskPressure,
      'V2 Risk': v2.riskPressure,
      'Risk Δ': v2.riskPressure - v1.riskPressure,
      'V1 Confidence': v1.confidence,
      'V2 Confidence': v2.confidence,
      'Conf Δ': v2.confidence - v1.confidence,
      'Systemic Fragility': v2.systemicFragility,
      'Structural Breaks': v2.structuralBreakCount,
      'Forecast Stability': v2.forecastStability,
    });
    console.groupEnd();
  }

  console.groupEnd();
}
