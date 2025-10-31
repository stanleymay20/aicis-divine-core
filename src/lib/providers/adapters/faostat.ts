import { ProviderAdapter, NormalizedMetric, ProviderContext } from '../types';

export const faostatAdapter: ProviderAdapter = {
  normalize(input: unknown, ctx: ProviderContext): NormalizedMetric[] {
    if (!Array.isArray(input)) return [];

    const metrics: NormalizedMetric[] = [];
    
    for (const item of input) {
      if (!item?.Value || !item?.Year) continue;

      metrics.push({
        domain: 'food',
        metric: 'crop_production',
        iso3: ctx.location.iso3,
        period: item.Year.toString(),
        value: parseFloat(item.Value),
        unit: 'tonnes',
        confidence: 0.85,
        source: 'faostat',
        raw: item
      });
    }

    return metrics;
  }
};
