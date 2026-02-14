/**
 * AICIS Client-Side Resilience Utilities
 * Circuit breaker + retry for frontend API calls.
 */

interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

const circuits: Map<string, CircuitState> = new Map();
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60_000;

export function isCircuitOpen(key: string): boolean {
  const state = circuits.get(key);
  if (!state || !state.open) return false;
  if (Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
    state.open = false;
    state.failures = 0;
    return false;
  }
  return true;
}

export function recordSuccess(key: string): void {
  circuits.set(key, { failures: 0, lastFailure: 0, open: false });
}

export function recordFailure(key: string): void {
  const state = circuits.get(key) || { failures: 0, lastFailure: 0, open: false };
  state.failures += 1;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_THRESHOLD) state.open = true;
  circuits.set(key, state);
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  baseDelayMs: number = 400,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export async function resilientCall<T>(
  key: string,
  fn: () => Promise<T>,
  maxRetries: number = 2,
): Promise<T> {
  if (isCircuitOpen(key)) {
    throw new Error(`Circuit open for ${key} — service temporarily unavailable`);
  }
  try {
    const result = await retryWithBackoff(fn, maxRetries);
    recordSuccess(key);
    return result;
  } catch (err) {
    recordFailure(key);
    throw err;
  }
}
