// 09 · Circuit breaker + retry with backoff and jitter: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run hld/code/09-circuit-breaker

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit is open: failing fast');
    this.name = 'CircuitOpenError';
  }
}

export interface CircuitBreakerOptions {
  /** Consecutive failures in CLOSED that open the circuit. */
  failureThreshold: number;
  /** How long to stay OPEN before allowing a trial call. */
  resetTimeoutMs: number;
  /** Consecutive trial successes in HALF_OPEN needed to close. Default 1. */
  successThreshold?: number;
  /** Returns ms. Default Date.now. */
  clock?: () => number;
}

export class CircuitBreaker {
  constructor(options: CircuitBreakerOptions) {
    // TODO
  }

  /** OPEN becomes HALF_OPEN once resetTimeoutMs has passed (check it when someone asks). */
  get state(): CircuitState {
    throw new Error('TODO');
  }

  /**
   * CLOSED: run fn; count consecutive failures; open at the threshold.
   * OPEN: throw CircuitOpenError without calling fn.
   * HALF_OPEN: allow ONE trial at a time (others get CircuitOpenError).
   *   Trial fails → OPEN again (new timer). successThreshold successes → CLOSED.
   * Always rethrow fn's own error unchanged.
   */
  async call<T>(fn: () => Promise<T>): Promise<T> {
    throw new Error('TODO');
  }
}

export interface RetryOptions {
  /** Total tries, including the first one. */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Returns a number in [0, 1). Default Math.random. */
  random?: () => number;
  /** Default: a real setTimeout. Tests inject a fake one. */
  sleep?: (ms: number) => Promise<void>;
  /** Return false to stop retrying. Default: always retry. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/** Full jitter: Math.floor(random() × min(maxDelayMs, baseDelayMs × 2^retry)). retry starts at 0. */
export function backoffDelay(retry: number, baseDelayMs: number, maxDelayMs: number, random: () => number = Math.random): number {
  throw new Error('TODO');
}

/**
 * Calls fn(attempt) with attempt = 1, 2, ... up to maxAttempts.
 * After failure number i (if another try is allowed): sleep(backoffDelay(i - 1, ...)).
 * When out of attempts, or shouldRetry says no: throw the last error.
 */
export async function retry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  throw new Error('TODO');
}
