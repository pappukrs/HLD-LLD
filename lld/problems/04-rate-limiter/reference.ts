// 04 · Rate Limiter: reference solution.
// Read this only after your own attempt passes (or after 60 minutes).

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

const allow = (remaining: number): Decision => ({ allowed: true, remaining, retryAfterMs: 0 });
const deny = (retryAfterMs: number): Decision => ({ allowed: false, remaining: 0, retryAfterMs });

function assertPositive(name: string, value: number): void {
  if (!(value > 0) || !Number.isFinite(value)) throw new Error(`${name} must be a positive number`);
}

export class TokenBucket implements RateLimitAlgorithm {
  private tokens: number;
  private lastRefill: number | null = null;

  constructor(private readonly capacity: number, private readonly refillPerSecond: number) {
    assertPositive('capacity', capacity);
    assertPositive('refillPerSecond', refillPerSecond);
    this.tokens = capacity;
  }

  tryAcquire(now: number): Decision {
    this.refill(now);
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return allow(Math.floor(this.tokens));
    }
    return deny(Math.ceil(((1 - this.tokens) / this.refillPerSecond) * 1000));
  }

  // Lazy refill: no timers. Tokens are computed from elapsed time on each call.
  private refill(now: number): void {
    if (this.lastRefill !== null) {
      const elapsed = Math.max(0, now - this.lastRefill); // clocks can go backwards
      this.tokens = Math.min(this.capacity, this.tokens + (elapsed * this.refillPerSecond) / 1000);
    }
    this.lastRefill = now;
  }
}

export class FixedWindow implements RateLimitAlgorithm {
  private windowStart = -1;
  private count = 0;

  constructor(private readonly limit: number, private readonly windowMs: number) {
    assertPositive('limit', limit);
    assertPositive('windowMs', windowMs);
  }

  tryAcquire(now: number): Decision {
    // Windows are aligned to the clock ([0, w), [w, 2w), ...) like a Redis key per minute.
    const start = Math.floor(now / this.windowMs) * this.windowMs;
    if (start !== this.windowStart) {
      this.windowStart = start;
      this.count = 0;
    }
    if (this.count < this.limit) {
      this.count++;
      return allow(this.limit - this.count);
    }
    return deny(start + this.windowMs - now);
  }
}

export class SlidingWindowLog implements RateLimitAlgorithm {
  private readonly log: number[] = []; // timestamps of accepted requests, oldest first

  constructor(private readonly limit: number, private readonly windowMs: number) {
    assertPositive('limit', limit);
    assertPositive('windowMs', windowMs);
  }

  tryAcquire(now: number): Decision {
    while (this.log.length > 0 && this.log[0] <= now - this.windowMs) this.log.shift();
    if (this.log.length < this.limit) {
      this.log.push(now);
      return allow(this.limit - this.log.length);
    }
    return deny(this.log[0] + this.windowMs - now);
  }
}

// Factory: config.type picks the algorithm. Adding a type = one new case.
export function createAlgorithm(config: AlgorithmConfig): RateLimitAlgorithm {
  switch (config.type) {
    case 'TOKEN_BUCKET':
      return new TokenBucket(config.capacity, config.refillPerSecond);
    case 'FIXED_WINDOW':
      return new FixedWindow(config.limit, config.windowMs);
    case 'SLIDING_WINDOW_LOG':
      return new SlidingWindowLog(config.limit, config.windowMs);
    default: {
      const unknown: never = config;
      throw new Error(`Unknown algorithm ${JSON.stringify(unknown)}`);
    }
  }
}

const toFactory = (rule: Rule): AlgorithmFactory =>
  typeof rule === 'function' ? rule : () => createAlgorithm(rule);

interface KeyState {
  algorithm: RateLimitAlgorithm;
  lastSeen: number;
}

export class RateLimiter {
  private readonly rules: Map<string, AlgorithmFactory>;
  private readonly routeRules: Map<string, Map<string, AlgorithmFactory>>;
  private readonly keys = new Map<string, KeyState>();
  private readonly clock: () => number;
  private readonly idleTtlMs: number;

  constructor(options: RateLimiterOptions) {
    this.rules = new Map(Object.entries(options.rules).map(([tier, r]) => [tier, toFactory(r)]));
    this.routeRules = new Map(
      Object.entries(options.routeRules ?? {}).map(([route, byTier]) => [
        route,
        new Map(Object.entries(byTier).map(([tier, r]) => [tier, toFactory(r)])),
      ]),
    );
    // Fail fast on a bad config instead of on the first request in production.
    const configs = [options.rules, ...Object.values(options.routeRules ?? {})].flatMap(Object.values);
    for (const r of configs) if (typeof r !== 'function') createAlgorithm(r);
    this.clock = options.clock ?? Date.now;
    this.idleTtlMs = options.idleTtlMs ?? 10 * 60 * 1000;
  }

  allow({ userId, tier, route = '*' }: RequestKey): Decision {
    const now = this.clock();
    // Tier is part of the key, so an upgraded user starts with a fresh limiter on the new config.
    const key = `${tier}:${userId}:${route}`;
    let state = this.keys.get(key);
    if (!state) {
      state = { algorithm: this.factoryFor(tier, route)(), lastSeen: now };
      this.keys.set(key, state);
    }
    state.lastSeen = now;
    return state.algorithm.tryAcquire(now);
  }

  /** Removes keys idle for at least idleTtlMs. Returns how many were removed. */
  cleanup(): number {
    const now = this.clock();
    let removed = 0;
    for (const [key, state] of this.keys) {
      if (now - state.lastSeen >= this.idleTtlMs) {
        this.keys.delete(key);
        removed++;
      }
    }
    return removed;
  }

  get trackedKeys(): number {
    return this.keys.size;
  }

  private factoryFor(tier: string, route: string): AlgorithmFactory {
    const factory = this.routeRules.get(route)?.get(tier) ?? this.rules.get(tier);
    if (!factory) throw new Error(`No rate limit rule for tier "${tier}"`);
    return factory;
  }
}
