import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { TokenBucket, SlidingWindowLog, SlidingWindowCounter } = (process.env.REF ? reference : starter) as typeof reference;

function fakeClock(start = 0) {
  let now = start;
  return { clock: () => now, set: (t: number) => (now = t), advance: (ms: number) => (now += ms) };
}

function allowMany(limiter: { allow(key: string): boolean }, key: string, times: number): number {
  let ok = 0;
  for (let i = 0; i < times; i++) if (limiter.allow(key)) ok++;
  return ok;
}

describe('02 · Rate limiter algorithms', () => {
  describe('token bucket', () => {
    it('allows a burst up to capacity, then rejects', () => {
      const t = fakeClock();
      const tb = new TokenBucket({ capacity: 5, refillPerSecond: 1, clock: t.clock });
      expect(allowMany(tb, 'u1', 8)).toBe(5);
    });

    it('refills at the given rate and never above capacity', () => {
      const t = fakeClock();
      const tb = new TokenBucket({ capacity: 5, refillPerSecond: 2, clock: t.clock });
      allowMany(tb, 'u1', 5);
      t.advance(500); // +1 token
      expect(tb.allow('u1')).toBe(true);
      expect(tb.allow('u1')).toBe(false);
      t.advance(60_000); // long idle: back to full, not 120 tokens
      expect(tb.tokens('u1')).toBe(5);
      expect(allowMany(tb, 'u1', 10)).toBe(5);
    });

    it('keeps a separate bucket per key', () => {
      const t = fakeClock();
      const tb = new TokenBucket({ capacity: 2, refillPerSecond: 1, clock: t.clock });
      expect(allowMany(tb, 'a', 3)).toBe(2);
      expect(allowMany(tb, 'b', 3)).toBe(2);
    });
  });

  describe('sliding window log', () => {
    it('allows `limit` requests in a window and frees a slot when the oldest leaves', () => {
      const t = fakeClock();
      const log = new SlidingWindowLog({ limit: 3, windowMs: 1000, clock: t.clock });
      expect(log.allow('u')).toBe(true); // t=0
      t.set(400);
      expect(allowMany(log, 'u', 3)).toBe(2); // t=400: 2 more, then full
      t.set(999);
      expect(log.allow('u')).toBe(false); // t=0 is still inside (−1, 999]
      t.set(1000);
      expect(log.allow('u')).toBe(true); // t=0 left the window (0, 1000]
      expect(log.allow('u')).toBe(false);
    });

    it('does not count rejected requests', () => {
      const t = fakeClock();
      const log = new SlidingWindowLog({ limit: 2, windowMs: 1000, clock: t.clock });
      allowMany(log, 'u', 2);
      t.set(500);
      allowMany(log, 'u', 50); // all rejected; must not fill the log
      t.set(1000);
      expect(allowMany(log, 'u', 5)).toBe(2);
    });

    it('never allows more than `limit` in any window (property check)', () => {
      const t = fakeClock();
      const limit = 5;
      const windowMs = 1000;
      const log = new SlidingWindowLog({ limit, windowMs, clock: t.clock });
      let seed = 42;
      const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
      const accepted: number[] = [];
      for (let i = 0; i < 2000; i++) {
        t.advance(Math.floor(rand() * 120));
        if (log.allow('u')) accepted.push(t.clock());
      }
      // Any `limit + 1` consecutive accepted requests must span at least one window.
      for (let i = limit; i < accepted.length; i++) {
        expect(accepted[i] - accepted[i - limit]).toBeGreaterThanOrEqual(windowMs);
      }
    });
  });

  describe('sliding window counter', () => {
    it('weights the previous window by how much of it still overlaps', () => {
      const t = fakeClock();
      const swc = new SlidingWindowCounter({ limit: 10, windowMs: 1000, clock: t.clock });
      t.set(500);
      expect(allowMany(swc, 'u', 12)).toBe(10); // window [0, 1000) is full
      t.set(1000);
      expect(swc.estimate('u')).toBe(10); // 10 × 100% + 0
      expect(swc.allow('u')).toBe(false);
      t.set(1500);
      expect(swc.estimate('u')).toBe(5); // 10 × 50% + 0
      expect(allowMany(swc, 'u', 10)).toBe(5);
      t.set(1750);
      expect(swc.estimate('u')).toBe(7.5); // 10 × 25% + 5
      expect(allowMany(swc, 'u', 10)).toBe(2);
    });

    it('forgets everything after two idle windows', () => {
      const t = fakeClock();
      const swc = new SlidingWindowCounter({ limit: 4, windowMs: 1000, clock: t.clock });
      allowMany(swc, 'u', 4);
      t.set(2100); // windows [1000, 2000) were empty, so "previous" is 0
      expect(swc.estimate('u')).toBe(0);
      expect(allowMany(swc, 'u', 10)).toBe(4);
    });

    it('keeps separate counters per key', () => {
      const t = fakeClock();
      const swc = new SlidingWindowCounter({ limit: 3, windowMs: 1000, clock: t.clock });
      expect(allowMany(swc, 'a', 5)).toBe(3);
      expect(allowMany(swc, 'b', 5)).toBe(3);
    });
  });
});
