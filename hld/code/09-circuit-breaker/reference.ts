// 09 · Circuit breaker + retry with backoff and jitter: reference solution.
// Read this only after your own attempt passes.

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
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly successThreshold: number;
  private readonly clock: () => number;

  private current: CircuitState = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private openedAt = 0;
  private trialInFlight = false;

  constructor(options: CircuitBreakerOptions) {
    if (!Number.isInteger(options.failureThreshold) || options.failureThreshold < 1) {
      throw new Error('failureThreshold must be a positive integer');
    }
    if (!(options.resetTimeoutMs >= 0)) throw new Error('resetTimeoutMs must be >= 0');
    this.failureThreshold = options.failureThreshold;
    this.resetTimeoutMs = options.resetTimeoutMs;
    this.successThreshold = options.successThreshold ?? 1;
    this.clock = options.clock ?? Date.now;
  }

  /** OPEN turns into HALF_OPEN by itself once the timeout has passed (checked lazily). */
  get state(): CircuitState {
    if (this.current === 'OPEN' && this.clock() - this.openedAt >= this.resetTimeoutMs) {
      this.current = 'HALF_OPEN';
      this.successes = 0;
    }
    return this.current;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const state = this.state;
    if (state === 'OPEN') throw new CircuitOpenError();
    if (state === 'HALF_OPEN') {
      // Only one trial at a time. Others fail fast, so a weak service is not flooded.
      if (this.trialInFlight) throw new CircuitOpenError();
      this.trialInFlight = true;
    }
    const isTrial = state === 'HALF_OPEN';
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    } finally {
      if (isTrial) this.trialInFlight = false;
    }
  }

  private onSuccess(): void {
    if (this.current === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.successThreshold) this.close();
    } else {
      this.failures = 0; // CLOSED counts CONSECUTIVE failures
    }
  }

  private onFailure(): void {
    if (this.current === 'HALF_OPEN') {
      this.open(); // the trial failed: back to OPEN, with a fresh timer
      return;
    }
    this.failures++;
    if (this.failures >= this.failureThreshold) this.open();
  }

  private open(): void {
    this.current = 'OPEN';
    this.openedAt = this.clock();
    this.failures = 0;
    this.successes = 0;
  }

  private close(): void {
    this.current = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
  }
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff and full jitter.
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Total tries, including the first one. */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Returns a number in [0, 1). Default Math.random. */
  random?: () => number;
  /** Default: a real setTimeout. Tests inject a fake one. */
  sleep?: (ms: number) => Promise<void>;
  /** Return false to stop retrying (for example on a 400 or a CircuitOpenError). Default: always retry. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Full jitter (AWS Architecture Blog, "Exponential Backoff and Jitter"):
 *   delay = random() × min(maxDelayMs, baseDelayMs × 2^retry)
 * `retry` is 0 for the wait after the first failure.
 */
export function backoffDelay(retry: number, baseDelayMs: number, maxDelayMs: number, random: () => number = Math.random): number {
  const ceiling = Math.min(maxDelayMs, baseDelayMs * 2 ** retry);
  return Math.floor(random() * ceiling);
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function retry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs } = options;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('maxAttempts must be a positive integer');
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? realSleep;
  const shouldRetry = options.shouldRetry ?? (() => true);

  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= maxAttempts || !shouldRetry(err, attempt)) throw err;
      await sleep(backoffDelay(attempt - 1, baseDelayMs, maxDelayMs, random));
    }
  }
}
