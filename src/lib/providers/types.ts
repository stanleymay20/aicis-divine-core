import { ResolvedLocation } from '../geo/resolveLocation';

export interface NormalizedMetric {
  domain: string;
  metric: string;
  iso3?: string;
  period: string;
  value: number;
  unit?: string;
  confidence?: number;
  source: string;
  raw?: any;
}

export interface ProviderContext {
  endpoint: string;
  location: ResolvedLocation;
  params: Record<string, any>;
}

export interface ProviderAdapter {
  normalize(input: unknown, ctx: ProviderContext): NormalizedMetric[];
}

export interface ProviderEndpoint {
  url: string;
  method: string;
  path_map?: {
    data: string;
  };
  cache_ttl_sec: number;
}

export interface ProviderConfig {
  domain: string;
  type: string;
  auth: string;
  headers?: Record<string, string>;
  endpoints: Record<string, ProviderEndpoint>;
}

export interface ProviderRegistry {
  version: number;
  providers: Record<string, ProviderConfig>;
}
