// 04 · Rate Limiter: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/04-rate-limiter

export interface Decision {
  readonly allowed: boolean;
  readonly remaining: number; // requests left right now (for X-RateLimit-Remaining)
  readonly retryAfterMs: number; // 0 when allowed (for Retry-After on a 429)
}

/** State for ONE key. The limiter creates one instance per (tier, user, route). */
export interface RateLimitAlgorithm {
  tryAcquire(now: number): Decision;
}

export interface TokenBucketConfig {
  type: 'TOKEN_BUCKET';
  capacity: number;
  refillPerSecond: number;
}

export interface FixedWindowConfig {
  type: 'FIXED_WINDOW';
  limit: number;
  windowMs: number;
}

export interface SlidingWindowLogConfig {
  type: 'SLIDING_WINDOW_LOG';
  limit: number;
  windowMs: number;
}

export type AlgorithmConfig = TokenBucketConfig | FixedWindowConfig | SlidingWindowLogConfig;

/** Plug in any algorithm without touching the limiter. Called once per new key. */
export type AlgorithmFactory = () => RateLimitAlgorithm;

export type Rule = AlgorithmConfig | AlgorithmFactory;

export interface RateLimiterOptions {
  rules: Record<string, Rule>; // tier -> rule. The tier picks numbers, not code paths.
  routeRules?: Record<string, Record<string, Rule>>; // route -> tier -> rule (override)
  clock?: () => number;
  idleTtlMs?: number; // keys unused this long are removed by cleanup(). Default 10 min
}

export interface RequestKey {
  userId: string;
  tier: string;
  route?: string; // default '*'
}

export class TokenBucket implements RateLimitAlgorithm {
  constructor(capacity: number, refillPerSecond: number) {
    // TODO: validate, start full
  }

  tryAcquire(now: number): Decision {
    throw new Error('TODO: refill lazily from elapsed time, then take one token');
  }
}

export class FixedWindow implements RateLimitAlgorithm {
  constructor(limit: number, windowMs: number) {
    // TODO: validate
  }

  tryAcquire(now: number): Decision {
    throw new Error('TODO: windows aligned to the clock: [0, w), [w, 2w), ...');
  }
}

export class SlidingWindowLog implements RateLimitAlgorithm {
  constructor(limit: number, windowMs: number) {
    // TODO: validate
  }

  tryAcquire(now: number): Decision {
    throw new Error('TODO: keep timestamps of accepted requests in the last windowMs');
  }
}

export function createAlgorithm(config: AlgorithmConfig): RateLimitAlgorithm {
  throw new Error('TODO: factory on config.type');
}

export class RateLimiter {
  constructor(options: RateLimiterOptions) {
    // TODO: keep rules, validate configs early, keep clock and idleTtlMs
  }

  allow(request: RequestKey): Decision {
    throw new Error('TODO: one algorithm instance per key, created lazily');
  }

  /** Removes keys idle for at least idleTtlMs. Returns how many were removed. */
  cleanup(): number {
    throw new Error('TODO');
  }

  get trackedKeys(): number {
    throw new Error('TODO');
  }
}
