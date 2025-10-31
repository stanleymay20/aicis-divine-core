import { ProviderAdapter, NormalizedMetric, ProviderContext } from '../types';

export const whoAdapter: ProviderAdapter = {
  normalize(input: unknown, ctx: ProviderContext): NormalizedMetric[] {
    if (!Array.isArray(input)) return [];

    const metrics: NormalizedMetric[] = [];
    
    for (const item of input) {
      if (!item?.NumericValue || !item?.TimeDim) continue;

      metrics.push({
        domain: 'health',
        metric: 'life_expectancy',
        iso3: ctx.location.iso3,
        period: item.TimeDim.toString(),
        value: parseFloat(item.NumericValue),
        unit: 'years',
        confidence: 0.95,
        source: 'who_gho',
        raw: item
      });
    }

    return metrics;
  }
};
