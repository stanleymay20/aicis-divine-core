import { ProviderAdapter, NormalizedMetric, ProviderContext } from '../types';

export const gdeltAdapter: ProviderAdapter = {
  normalize(input: unknown, ctx: ProviderContext): NormalizedMetric[] {
    if (!Array.isArray(input)) return [];

    const metrics: NormalizedMetric[] = [];
    const eventCount = input.length;
    
    // Calculate average tone if available
    let avgTone = 0;
    let toneCount = 0;
    
    for (const article of input) {
      if (article?.tone) {
        avgTone += parseFloat(article.tone);
        toneCount++;
      }
    }
    
    const finalTone = toneCount > 0 ? avgTone / toneCount : 0;
    const now = new Date().toISOString().split('T')[0];
    
    metrics.push({
      domain: 'security',
      metric: 'event_count',
      iso3: ctx.location.iso3,
      period: now,
      value: eventCount,
      unit: 'events',
      confidence: 0.8,
      source: 'gdelt',
      raw: { eventCount, avgTone: finalTone }
    });
    
    if (toneCount > 0) {
      metrics.push({
        domain: 'security',
        metric: 'avg_tone',
        iso3: ctx.location.iso3,
        period: now,
        value: finalTone,
        unit: 'index',
        confidence: 0.7,
        source: 'gdelt',
        raw: { toneCount, avgTone: finalTone }
      });
    }

    return metrics;
  }
};
