import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { CircuitBreaker, CircuitOpenError, backoffDelay, retry } = (process.env.REF ? reference : starter) as typeof reference;

const ok = () => Promise.resolve('ok');
const boom = () => Promise.reject(new Error('boom'));

function setup(options: { failureThreshold?: number; resetTimeoutMs?: number; successThreshold?: number } = {}) {
  let now = 0;
  const breaker = new CircuitBreaker({
    failureThreshold: options.failureThreshold ?? 3,
    resetTimeoutMs: options.resetTimeoutMs ?? 1000,
    successThreshold: options.successThreshold,
    clock: () => now,
  });
  return { breaker, advance: (ms: number) => (now += ms) };
}

async function failTimes(breaker: InstanceType<typeof CircuitBreaker>, times: number) {
  for (let i = 0; i < times; i++) await expect(breaker.call(boom)).rejects.toThrow('boom');
}

describe('09 · Circuit breaker and retry', () => {
  describe('circuit breaker', () => {
    it('passes results and errors through while CLOSED', async () => {
      const { breaker } = setup();
      expect(breaker.state).toBe('CLOSED');
      expect(await breaker.call(ok)).toBe('ok');
      await expect(breaker.call(boom)).rejects.toThrow('boom');
      expect(breaker.state).toBe('CLOSED');
    });

    it('opens after N consecutive failures; a success resets the count', async () => {
      const { breaker } = setup({ failureThreshold: 3 });
      await failTimes(breaker, 2);
      await breaker.call(ok);
      await failTimes(breaker, 2);
      expect(breaker.state).toBe('CLOSED');
      await failTimes(breaker, 1);
      expect(breaker.state).toBe('OPEN');
    });

    it('fails fast while OPEN, without calling the function', async () => {
      const { breaker } = setup({ failureThreshold: 1 });
      await failTimes(breaker, 1);
      const fn = vi.fn(ok);
      await expect(breaker.call(fn)).rejects.toBeInstanceOf(CircuitOpenError);
      expect(fn).not.toHaveBeenCalled();
    });

    it('moves to HALF_OPEN after the reset timeout, and a good trial closes it', async () => {
      const { breaker, advance } = setup({ failureThreshold: 1, resetTimeoutMs: 1000 });
      await failTimes(breaker, 1);
      advance(999);
      expect(breaker.state).toBe('OPEN');
      advance(1);
      expect(breaker.state).toBe('HALF_OPEN');
      expect(await breaker.call(ok)).toBe('ok');
      expect(breaker.state).toBe('CLOSED');
    });

    it('a failed trial re-opens it with a fresh timer', async () => {
      const { breaker, advance } = setup({ failureThreshold: 1, resetTimeoutMs: 1000 });
      await failTimes(breaker, 1);
      advance(1000);
      await failTimes(breaker, 1); // the trial
      expect(breaker.state).toBe('OPEN');
      advance(999);
      expect(breaker.state).toBe('OPEN');
      advance(1);
      expect(breaker.state).toBe('HALF_OPEN');
    });

    it('allows only one trial at a time in HALF_OPEN', async () => {
      const { breaker, advance } = setup({ failureThreshold: 1 });
      await failTimes(breaker, 1);
      advance(1000);
      let release!: () => void;
      const slow = () => new Promise<string>((resolve) => (release = () => resolve('slow')));
      const trial = breaker.call(slow);
      await expect(breaker.call(ok)).rejects.toBeInstanceOf(CircuitOpenError);
      release();
      expect(await trial).toBe('slow');
      expect(breaker.state).toBe('CLOSED');
    });

    it('needs successThreshold good trials before closing', async () => {
      const { breaker, advance } = setup({ failureThreshold: 1, successThreshold: 2 });
      await failTimes(breaker, 1);
      advance(1000);
      await breaker.call(ok);
      expect(breaker.state).toBe('HALF_OPEN');
      await breaker.call(ok);
      expect(breaker.state).toBe('CLOSED');
    });
  });

  describe('retry with backoff and full jitter', () => {
    it('computes full-jitter delays: random × min(cap, base × 2^retry)', () => {
      const half = () => 0.5;
      expect(backoffDelay(0, 100, 10_000, half)).toBe(50);
      expect(backoffDelay(3, 100, 10_000, half)).toBe(400); // 0.5 × 800
      expect(backoffDelay(10, 100, 10_000, half)).toBe(5000); // capped at 10 000
      expect(backoffDelay(5, 100, 10_000, () => 0)).toBe(0);
      expect(backoffDelay(2, 100, 10_000, () => 0.999)).toBe(399);
    });

    it('stays within [0, ceiling) for any random value (property check)', () => {
      let seed = 5;
      const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
      for (let i = 0; i < 1000; i++) {
        const r = i % 15;
        const d = backoffDelay(r, 50, 5000, rand);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(d).toBeLessThan(Math.min(5000, 50 * 2 ** r));
      }
    });

    it('retries until success and sleeps the jittered delays in between', async () => {
      const sleeps: number[] = [];
      const fn = vi.fn(async (attempt: number) => {
        if (attempt < 4) throw new Error(`fail ${attempt}`);
        return 'done';
      });
      const result = await retry(fn, {
        maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 1000,
        random: () => 0.5,
        sleep: async (ms) => void sleeps.push(ms),
      });
      expect(result).toBe('done');
      expect(fn).toHaveBeenCalledTimes(4);
      expect(sleeps).toEqual([50, 100, 200]);
    });

    it('throws the last error after maxAttempts, with no sleep after the last try', async () => {
      const sleeps: number[] = [];
      let calls = 0;
      await expect(
        retry(async (attempt) => { calls++; throw new Error(`fail ${attempt}`); }, {
          maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 150,
          random: () => 0.5,
          sleep: async (ms) => void sleeps.push(ms),
        }),
      ).rejects.toThrow('fail 3');
      expect(calls).toBe(3);
      expect(sleeps).toEqual([50, 75]); // second delay capped at 150 × 0.5
    });

    it('does not retry when shouldRetry says no (e.g. the circuit is open)', async () => {
      const { breaker } = setup({ failureThreshold: 1 });
      await failTimes(breaker, 1);
      const sleep = vi.fn(async () => {});
      const fn = vi.fn(ok);
      await expect(
        retry(() => breaker.call(fn), {
          maxAttempts: 5, baseDelayMs: 10, maxDelayMs: 100, sleep,
          shouldRetry: (err) => !(err instanceof CircuitOpenError),
        }),
      ).rejects.toBeInstanceOf(CircuitOpenError);
      expect(sleep).not.toHaveBeenCalled();
      expect(fn).not.toHaveBeenCalled();
    });
  });
});
