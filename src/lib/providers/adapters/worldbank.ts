import { ProviderAdapter, NormalizedMetric, ProviderContext } from '../types';

export const worldbankAdapter: ProviderAdapter = {
  normalize(input: unknown, ctx: ProviderContext): NormalizedMetric[] {
    if (!Array.isArray(input)) return [];

    const metrics: NormalizedMetric[] = [];
    
    for (const item of input) {
      if (!item?.value || !item?.date) continue;

      const metricName = ctx.endpoint.includes('GE.EST') 
        ? 'government_effectiveness'
        : ctx.endpoint.includes('NY.GDP.PCAP')
        ? 'gdp_per_capita'
        : 'unknown';

      metrics.push({
        domain: 'governance',
        metric: metricName,
        iso3: ctx.location.iso3,
        period: item.date,
        value: parseFloat(item.value),
        unit: metricName === 'gdp_per_capita' ? 'USD' : 'index',
        confidence: 0.9,
        source: 'worldbank',
        raw: item
      });
    }

    return metrics;
  }
};
