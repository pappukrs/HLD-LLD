import * as starter from './starter';
import * as reference from './reference';
import type { Decision, RateLimiterOptions } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { RateLimiter, TokenBucket, FixedWindow, SlidingWindowLog } = (
  process.env.REF ? reference : starter
) as typeof reference;

function makeLimiter(options: Omit<RateLimiterOptions, 'clock'>) {
  let now = 0;
  const limiter = new RateLimiter({ ...options, clock: () => now });
  return { limiter, advance: (ms: number) => (now += ms) };
}

function hit(times: number, fn: () => Decision): boolean[] {
  return Array.from({ length: times }, () => fn().allowed);
}

describe('04 · Rate Limiter', () => {
  describe('token bucket', () => {
    it('allows a burst up to capacity, then rejects', () => {
      const bucket = new TokenBucket(3, 1);
      expect(hit(4, () => bucket.tryAcquire(0))).toEqual([true, true, true, false]);
    });

    it('refills over time and reports remaining and retry-after', () => {
      const bucket = new TokenBucket(2, 2); // 1 token every 500 ms
      bucket.tryAcquire(0);
      expect(bucket.tryAcquire(0)).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 });
      expect(bucket.tryAcquire(0)).toEqual({ allowed: false, remaining: 0, retryAfterMs: 500 });
      expect(bucket.tryAcquire(500).allowed).toBe(true);
    });

    it('never holds more than capacity after a long idle time', () => {
      const bucket = new TokenBucket(2, 10);
      bucket.tryAcquire(0);
      expect(hit(3, () => bucket.tryAcquire(60_000))).toEqual([true, true, false]);
    });

    it('rejects an invalid config', () => {
      expect(() => new TokenBucket(0, 1)).toThrow();
      expect(() => new FixedWindow(5, -1)).toThrow();
    });
  });

  describe('fixed window vs sliding window log', () => {
    it('fixed window: counts per window and resets at the boundary', () => {
      const w = new FixedWindow(2, 1000);
      expect(hit(3, () => w.tryAcquire(100))).toEqual([true, true, false]);
      expect(w.tryAcquire(999).retryAfterMs).toBe(1);
      expect(w.tryAcquire(1000).allowed).toBe(true);
    });

    it('fixed window: lets 2x the limit through around a boundary (known weakness)', () => {
      const w = new FixedWindow(3, 1000);
      const late = hit(3, () => w.tryAcquire(999));
      const early = hit(3, () => w.tryAcquire(1000));
      expect([...late, ...early].filter(Boolean)).toHaveLength(6); // 6 requests in 2 ms
    });

    it('sliding window log: blocks that boundary burst', () => {
      const w = new SlidingWindowLog(3, 1000);
      hit(3, () => w.tryAcquire(999));
      expect(w.tryAcquire(1000)).toEqual({ allowed: false, remaining: 0, retryAfterMs: 999 });
      expect(w.tryAcquire(1999).allowed).toBe(true); // the requests at 999 have left the window
    });
  });

  describe('RateLimiter', () => {
    it('uses the tier only to pick the config, so any tier can use any algorithm', () => {
      const { limiter } = makeLimiter({
        rules: {
          free: { type: 'TOKEN_BUCKET', capacity: 2, refillPerSecond: 1 },
          premium: { type: 'TOKEN_BUCKET', capacity: 5, refillPerSecond: 5 },
        },
      });
      expect(hit(3, () => limiter.allow({ userId: 'u1', tier: 'free' }))).toEqual([true, true, false]);
      expect(hit(6, () => limiter.allow({ userId: 'u2', tier: 'premium' })).filter(Boolean)).toHaveLength(5);
    });

    it('keeps a separate counter per user and per route', () => {
      const { limiter } = makeLimiter({ rules: { free: { type: 'FIXED_WINDOW', limit: 1, windowMs: 1000 } } });
      expect(limiter.allow({ userId: 'u1', tier: 'free', route: '/search' }).allowed).toBe(true);
      expect(limiter.allow({ userId: 'u1', tier: 'free', route: '/search' }).allowed).toBe(false);
      expect(limiter.allow({ userId: 'u1', tier: 'free', route: '/orders' }).allowed).toBe(true);
      expect(limiter.allow({ userId: 'u2', tier: 'free', route: '/search' }).allowed).toBe(true);
      expect(limiter.trackedKeys).toBe(3);
    });

    it('applies a stricter rule to one route when configured', () => {
      const { limiter } = makeLimiter({
        rules: { free: { type: 'FIXED_WINDOW', limit: 100, windowMs: 1000 } },
        routeRules: { '/otp': { free: { type: 'SLIDING_WINDOW_LOG', limit: 1, windowMs: 30_000 } } },
      });
      expect(hit(2, () => limiter.allow({ userId: 'u1', tier: 'free', route: '/otp' }))).toEqual([true, false]);
      expect(hit(2, () => limiter.allow({ userId: 'u1', tier: 'free', route: '/home' }))).toEqual([true, true]);
    });

    it('throws for an unknown tier and for a bad config at construction', () => {
      const { limiter } = makeLimiter({ rules: { free: { type: 'FIXED_WINDOW', limit: 1, windowMs: 1000 } } });
      expect(() => limiter.allow({ userId: 'u1', tier: 'gold' })).toThrow();
      expect(() => new RateLimiter({ rules: { free: { type: 'FIXED_WINDOW', limit: 0, windowMs: 1000 } } })).toThrow();
    });

    it('removes idle keys on cleanup and keeps active ones', () => {
      const { limiter, advance } = makeLimiter({
        rules: { free: { type: 'TOKEN_BUCKET', capacity: 1, refillPerSecond: 1 } },
        idleTtlMs: 60_000,
      });
      limiter.allow({ userId: 'idle', tier: 'free' });
      advance(30_000);
      limiter.allow({ userId: 'active', tier: 'free' });
      advance(30_000);
      expect(limiter.cleanup()).toBe(1);
      expect(limiter.trackedKeys).toBe(1);
    });
  });

  describe('extensibility', () => {
    it('accepts a custom algorithm factory without changing the limiter (Open/Closed)', () => {
      class AllowEveryOther {
        private n = 0;
        tryAcquire(): Decision {
          const allowed = this.n++ % 2 === 0;
          return { allowed, remaining: allowed ? 1 : 0, retryAfterMs: 0 };
        }
      }
      const { limiter } = makeLimiter({ rules: { beta: () => new AllowEveryOther() } });
      expect(hit(4, () => limiter.allow({ userId: 'u1', tier: 'beta' }))).toEqual([true, false, true, false]);
      expect(limiter.allow({ userId: 'u2', tier: 'beta' }).allowed).toBe(true); // a fresh instance per key
    });
  });
});
