import "server-only";

/**
 * Per-provider circuit breaker.
 *
 * Without this, a bulk screener scan over 300 symbols against a dead or
 * throttling upstream retries three times per symbol with backoff — roughly
 * 1.5 seconds each, 45+ seconds in total, which blows straight through the
 * serverless execution limit and returns nothing useful.
 *
 * The fix is to learn from the first few failures. After `FAILURE_THRESHOLD`
 * consecutive failures the circuit opens and every subsequent call short
 * circuits instantly for `COOLDOWN_MS`. One success closes it again.
 *
 * State is per serverless instance, which is the right scope: each instance
 * has its own outbound IP and therefore its own rate-limit budget.
 */

const FAILURE_THRESHOLD = 4;
const COOLDOWN_MS = 60_000;

export type ProviderName = "angel-history" | "angel-quote" | "yahoo-summary";

interface BreakerState {
  consecutiveFailures: number;
  openedAt: number | null;
}

const breakers = new Map<ProviderName, BreakerState>();

function stateFor(provider: ProviderName): BreakerState {
  let state = breakers.get(provider);
  if (!state) {
    state = { consecutiveFailures: 0, openedAt: null };
    breakers.set(provider, state);
  }
  return state;
}

/** True when the provider is being skipped entirely right now. */
export function isCircuitOpen(provider: ProviderName): boolean {
  const state = stateFor(provider);
  if (state.openedAt === null) return false;

  if (Date.now() - state.openedAt >= COOLDOWN_MS) {
    // Cooldown elapsed. Let exactly one call through to test the water; if it
    // fails, `recordFailure` re-opens immediately.
    state.openedAt = null;
    state.consecutiveFailures = FAILURE_THRESHOLD - 1;
    return false;
  }
  return true;
}

export function recordSuccess(provider: ProviderName): void {
  const state = stateFor(provider);
  state.consecutiveFailures = 0;
  state.openedAt = null;
}

export function recordFailure(provider: ProviderName): void {
  const state = stateFor(provider);
  state.consecutiveFailures += 1;
  if (state.consecutiveFailures >= FAILURE_THRESHOLD && state.openedAt === null) {
    state.openedAt = Date.now();
  }
}

/**
 * How many attempts a single call should make right now.
 *
 * Retries are worth it when the provider is generally healthy and this one
 * request was unlucky. They are pure waste when it has already failed
 * repeatedly, so the budget shrinks as confidence drops.
 */
export function attemptsFor(provider: ProviderName, max = 3): number {
  const state = stateFor(provider);
  if (state.consecutiveFailures === 0) return max;
  if (state.consecutiveFailures < FAILURE_THRESHOLD) return 2;
  return 1;
}

/** Diagnostics for `/api/health`. */
export function circuitSnapshot(): Record<string, { open: boolean; consecutiveFailures: number }> {
  const out: Record<string, { open: boolean; consecutiveFailures: number }> = {};
  for (const [name, state] of breakers) {
    out[name] = {
      open: state.openedAt !== null && Date.now() - state.openedAt < COOLDOWN_MS,
      consecutiveFailures: state.consecutiveFailures,
    };
  }
  return out;
}

/** Test helper — resets everything. Not used by application code. */
export function resetCircuits(): void {
  breakers.clear();
}
