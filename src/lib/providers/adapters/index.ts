import { ProviderAdapter } from '../types';
import { worldbankAdapter } from './worldbank';
import { whoAdapter } from './who';
import { faostatAdapter } from './faostat';

const adapters: Record<string, ProviderAdapter> = {
  worldbank: worldbankAdapter,
  who_gho: whoAdapter,
  faostat: faostatAdapter
};

export function getAdapter(providerName: string): ProviderAdapter | null {
  return adapters[providerName] || null;
}

export { type ProviderAdapter } from '../types';
