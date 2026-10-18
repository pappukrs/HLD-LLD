// 02 · Rate limiter algorithms: reference solution.
// Read this only after your own attempt passes.

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

function assertPositive(name: string, value: number): void {
  if (!(value > 0) || !Number.isFinite(value)) throw new Error(`${name} must be a positive number`);
}

// ---------------------------------------------------------------------------
// Token bucket: allows bursts up to `capacity`, then a steady rate.
// State per key: 2 numbers. Used by AWS API Gateway, Stripe, NGINX (leaky variant).
// ---------------------------------------------------------------------------
interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucket implements RateLimiter {
  private readonly capacity: number;
  private readonly ratePerMs: number;
  private readonly clock: Clock;
  private readonly buckets = new Map<string, Bucket>();

  constructor(options: TokenBucketOptions) {
    assertPositive('capacity', options.capacity);
    assertPositive('refillPerSecond', options.refillPerSecond);
    this.capacity = options.capacity;
    this.ratePerMs = options.refillPerSecond / 1000;
    this.clock = options.clock ?? Date.now;
  }

  allow(key: string): boolean {
    const now = this.clock();
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, lastRefill: now };
    // Lazy refill: compute what was added since the last call. No timers needed.
    const elapsed = Math.max(0, now - bucket.lastRefill);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsed * this.ratePerMs);
    bucket.lastRefill = now;
    this.buckets.set(key, bucket);
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Current tokens for a key, after refill. Does not consume. */
  tokens(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.capacity;
    const elapsed = Math.max(0, this.clock() - bucket.lastRefill);
    return Math.min(this.capacity, bucket.tokens + elapsed * this.ratePerMs);
  }
}

// ---------------------------------------------------------------------------
// Sliding window log: exact. Stores one timestamp per accepted request.
// Memory per key: O(limit).
// ---------------------------------------------------------------------------
export class SlidingWindowLog implements RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly clock: Clock;
  private readonly logs = new Map<string, number[]>();

  constructor(options: WindowOptions) {
    assertPositive('limit', options.limit);
    assertPositive('windowMs', options.windowMs);
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.clock = options.clock ?? Date.now;
  }

  allow(key: string): boolean {
    const now = this.clock();
    const log = this.logs.get(key) ?? [];
    // The window is (now - windowMs, now]. Drop timestamps that are out of it.
    // The log is sorted, so we only look at the front. (A real queue would avoid shift().)
    while (log.length > 0 && log[0] <= now - this.windowMs) log.shift();
    this.logs.set(key, log);
    if (log.length < this.limit) {
      log.push(now); // only accepted requests are logged
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sliding window counter: approximate. Two counters per key.
// estimate = previousCount × (overlap of the previous window) + currentCount
// Used by Cloudflare. Error is small when traffic is smooth.
// ---------------------------------------------------------------------------
interface Counter {
  windowStart: number;
  current: number;
  previous: number;
}

export class SlidingWindowCounter implements RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly clock: Clock;
  private readonly counters = new Map<string, Counter>();

  constructor(options: WindowOptions) {
    assertPositive('limit', options.limit);
    assertPositive('windowMs', options.windowMs);
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.clock = options.clock ?? Date.now;
  }

  allow(key: string): boolean {
    const now = this.clock();
    const c = this.roll(key, now);
    if (this.estimateFor(c, now) + 1 <= this.limit) {
      c.current += 1;
      return true;
    }
    return false;
  }

  /** The weighted count the limiter compares with `limit` right now. */
  estimate(key: string): number {
    const now = this.clock();
    return this.estimateFor(this.roll(key, now), now);
  }

  private roll(key: string, now: number): Counter {
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    let c = this.counters.get(key);
    if (!c) {
      c = { windowStart, current: 0, previous: 0 };
      this.counters.set(key, c);
    } else if (windowStart !== c.windowStart) {
      // Moved one window forward: current becomes previous.
      // Moved two or more windows: both are empty.
      c.previous = windowStart - c.windowStart === this.windowMs ? c.current : 0;
      c.current = 0;
      c.windowStart = windowStart;
    }
    return c;
  }

  private estimateFor(c: Counter, now: number): number {
    const elapsedInWindow = now - c.windowStart;
    const previousWeight = (this.windowMs - elapsedInWindow) / this.windowMs;
    return c.previous * previousWeight + c.current;
  }
}
