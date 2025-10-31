import { ProviderAdapter } from '../types';
import { worldbankAdapter } from './worldbank';
import { whoAdapter } from './who';
import { faostatAdapter } from './faostat';
import { nasaAdapter } from './nasa';
import { gdeltAdapter } from './gdelt';

const adapters: Record<string, ProviderAdapter> = {
  worldbank: worldbankAdapter,
  who_gho: whoAdapter,
  faostat: faostatAdapter,
  nasa_power: nasaAdapter,
  gdelt: gdeltAdapter
};

export function getAdapter(providerName: string): ProviderAdapter | null {
  return adapters[providerName] || null;
}

export { type ProviderAdapter } from '../types';
