// 02 · Rate limiter algorithms: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run hld/code/02-rate-limiter-algorithms

/** Returns the current time in milliseconds. */
export type Clock = () => number;

export interface RateLimiter {
  /** true = let the request through (and count it). false = reject it. */
  allow(key: string): boolean;
}

export interface TokenBucketOptions {
  /** Maximum tokens. Also the maximum burst size. */
  capacity: number;
  /** Tokens added per second. Refill is continuous, not in steps. */
  refillPerSecond: number;
  clock?: Clock;
}

export interface WindowOptions {
  /** Maximum requests per window. */
  limit: number;
  windowMs: number;
  clock?: Clock;
}

export class TokenBucket implements RateLimiter {
  constructor(options: TokenBucketOptions) {
    // TODO: validate, keep options. A new key starts with a full bucket.
  }

  allow(key: string): boolean {
    throw new Error('TODO: refill lazily from elapsed time, then take 1 token if you can');
  }

  /** Current tokens for a key, after refill. Does not consume. */
  tokens(key: string): number {
    throw new Error('TODO');
  }
}

export class SlidingWindowLog implements RateLimiter {
  constructor(options: WindowOptions) {
    // TODO
  }

  allow(key: string): boolean {
    throw new Error('TODO: window is (now - windowMs, now]; log only accepted requests');
  }
}

export class SlidingWindowCounter implements RateLimiter {
  constructor(options: WindowOptions) {
    // TODO
  }

  allow(key: string): boolean {
    throw new Error('TODO: allow if estimate + 1 <= limit');
  }

  /** previous × (windowMs - elapsedInCurrentWindow) / windowMs + current */
  estimate(key: string): number {
    throw new Error('TODO');
  }
}
