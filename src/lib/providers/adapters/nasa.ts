import { ProviderAdapter, NormalizedMetric, ProviderContext } from '../types';

export const nasaAdapter: ProviderAdapter = {
  normalize(input: unknown, ctx: ProviderContext): NormalizedMetric[] {
    if (typeof input !== 'object' || !input) return [];

    const metrics: NormalizedMetric[] = [];
    const data = input as Record<string, any>;
    
    // NASA POWER returns data like { T2M: { "20230101": 25.5, ... }, PRECTOT: { ... } }
    for (const [param, values] of Object.entries(data)) {
      if (typeof values !== 'object' || !values) continue;
      
      const metricName = param === 'T2M' ? 'temperature_celsius' : 
                         param === 'PRECTOT' ? 'precipitation_mm' : 
                         param.toLowerCase();
      
      for (const [date, value] of Object.entries(values)) {
        if (typeof value === 'number') {
          metrics.push({
            domain: 'climate',
            metric: metricName,
            iso3: ctx.location.iso3,
            period: date,
            value: value,
            unit: param === 'T2M' ? '°C' : param === 'PRECTOT' ? 'mm' : '',
            confidence: 0.9,
            source: 'nasa_power',
            raw: { param, date, value }
          });
        }
      }
    }

    return metrics;
  }
};
