import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { Scheduler, ExponentialBackoff } = (process.env.REF ? reference : starter) as typeof reference;

/** A handler that fails the first `failures` times, then succeeds. */
function flaky(failures: number) {
  let calls = 0;
  const fn = () => {
    calls++;
    if (calls <= failures) throw new Error(`fail #${calls}`);
  };
  return { fn, calls: () => calls };
}

const ok = () => {};

describe('16 · Task Scheduler', () => {
  describe('one-off tasks', () => {
    it('runs a task only when it is due, and only once', async () => {
      const s = new Scheduler();
      let runs = 0;
      s.schedule({ id: 't1', runAt: 1000, handler: () => void runs++ });
      expect(await s.runDue(999)).toEqual([]);
      expect(await s.runDue(1000)).toEqual([{ taskId: 't1', outcome: 'SUCCEEDED', attempt: 1 }]);
      expect(await s.runDue(5000)).toEqual([]);
      expect(runs).toBe(1);
      expect(s.get('t1')).toMatchObject({ status: 'SUCCEEDED', nextRunAt: null, runs: 1 });
    });

    it('runs due tasks by priority (high first), then by run time, then by insertion', async () => {
      const s = new Scheduler();
      s.schedule({ id: 'low', runAt: 0, handler: ok, priority: 1 });
      s.schedule({ id: 'high-late', runAt: 50, handler: ok, priority: 5 });
      s.schedule({ id: 'high-early', runAt: 10, handler: ok, priority: 5 });
      s.schedule({ id: 'low-2', runAt: 0, handler: ok, priority: 1 });
      s.schedule({ id: 'future', runAt: 999, handler: ok, priority: 100 });
      const order = (await s.runDue(100)).map((r) => r.taskId);
      expect(order).toEqual(['high-early', 'high-late', 'low', 'low-2']);
    });

    it('awaits async handlers one at a time', async () => {
      const s = new Scheduler();
      const log: string[] = [];
      const task = (name: string) => async () => {
        log.push(`${name}:start`);
        await Promise.resolve();
        log.push(`${name}:end`);
      };
      s.schedule({ id: 'a', runAt: 0, handler: task('a'), priority: 2 });
      s.schedule({ id: 'b', runAt: 0, handler: task('b'), priority: 1 });
      await s.runDue(0);
      expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
    });

    it('cancel stops a task from running', async () => {
      const s = new Scheduler();
      let ran = false;
      s.schedule({ id: 't1', runAt: 0, handler: () => void (ran = true) });
      s.cancel('t1');
      expect(await s.runDue(10)).toEqual([]);
      expect(ran).toBe(false);
      expect(s.get('t1').status).toBe('CANCELLED');
      expect(() => s.cancel('t1')).toThrow();
      expect(() => s.cancel('nope')).toThrow();
    });
  });

  describe('retries', () => {
    it('retries with exponential backoff and then succeeds', async () => {
      const s = new Scheduler({ backoff: new ExponentialBackoff(1000) });
      const h = flaky(2);
      s.schedule({ id: 't', runAt: 0, handler: h.fn, maxRetries: 3 });

      expect(await s.runDue(0)).toEqual([{ taskId: 't', outcome: 'RETRY_SCHEDULED', attempt: 1, error: 'fail #1' }]);
      expect(s.get('t').nextRunAt).toBe(1000); // 1000 × 2^0
      expect(await s.runDue(999)).toEqual([]);

      expect((await s.runDue(1000))[0]).toMatchObject({ outcome: 'RETRY_SCHEDULED', attempt: 2 });
      expect(s.get('t').nextRunAt).toBe(3000); // 1000 + 1000 × 2^1

      expect((await s.runDue(3000))[0]).toMatchObject({ outcome: 'SUCCEEDED', attempt: 3 });
      expect(s.get('t')).toMatchObject({ status: 'SUCCEEDED', attempts: 0 });
    });

    it('gives up after maxRetries and reports the last error', async () => {
      const s = new Scheduler({ backoff: new ExponentialBackoff(10) });
      const h = flaky(100);
      s.schedule({ id: 't', runAt: 0, handler: h.fn, maxRetries: 2 });
      const reports = [...(await s.runDue(0)), ...(await s.runDue(10)), ...(await s.runDue(30))];
      expect(reports.map((r) => r.outcome)).toEqual(['RETRY_SCHEDULED', 'RETRY_SCHEDULED', 'FAILED']);
      expect(reports[2]).toMatchObject({ attempt: 3, error: 'fail #3' });
      expect(h.calls()).toBe(3);
      expect(s.get('t')).toMatchObject({ status: 'FAILED', nextRunAt: null });
    });

    it('one failing task does not stop the others', async () => {
      const s = new Scheduler();
      let ran = false;
      s.schedule({ id: 'bad', runAt: 0, handler: () => Promise.reject(new Error('boom')), priority: 9 });
      s.schedule({ id: 'good', runAt: 0, handler: () => void (ran = true) });
      const reports = await s.runDue(0);
      expect(reports.map((r) => [r.taskId, r.outcome])).toEqual([
        ['bad', 'FAILED'],
        ['good', 'SUCCEEDED'],
      ]);
      expect(ran).toBe(true);
    });

    it('a task rescheduled during runDue waits for the next call', async () => {
      const s = new Scheduler({ backoff: { delay: () => 0 } });
      const h = flaky(5);
      s.schedule({ id: 't', runAt: 0, handler: h.fn, maxRetries: 5 });
      await s.runDue(0);
      expect(h.calls()).toBe(1); // not retried in a loop inside the same call
    });
  });

  describe('recurring tasks', () => {
    it('runs every interval and skips missed runs instead of catching up', async () => {
      const s = new Scheduler();
      let runs = 0;
      s.schedule({ id: 'report', runAt: 0, intervalMs: 1000, handler: () => void runs++ });
      await s.runDue(0);
      expect(s.get('report').nextRunAt).toBe(1000);
      await s.runDue(3500); // missed 1000, 2000, 3000: run once
      expect(runs).toBe(2);
      expect(s.get('report')).toMatchObject({ status: 'SCHEDULED', nextRunAt: 4000, runs: 2 });
    });

    it('after the retries run out, a recurring task moves on to its next slot', async () => {
      const s = new Scheduler({ backoff: new ExponentialBackoff(100) });
      const h = flaky(2);
      s.schedule({ id: 'sync', runAt: 0, intervalMs: 1000, maxRetries: 1, handler: h.fn });
      await s.runDue(0); // fail, retry at 100
      expect((await s.runDue(100))[0].outcome).toBe('FAILED');
      expect(s.get('sync')).toMatchObject({ status: 'SCHEDULED', nextRunAt: 1000, attempts: 0 });
      expect((await s.runDue(1000))[0]).toMatchObject({ outcome: 'SUCCEEDED', attempt: 1 });
    });
  });

  describe('errors', () => {
    it('rejects duplicate ids, bad intervals, bad retries and unknown tasks', () => {
      const s = new Scheduler();
      s.schedule({ id: 't', runAt: 0, handler: ok });
      expect(() => s.schedule({ id: 't', runAt: 0, handler: ok })).toThrow();
      expect(() => s.schedule({ id: 'x', runAt: 0, handler: ok, intervalMs: 0 })).toThrow();
      expect(() => s.schedule({ id: 'y', runAt: 0, handler: ok, maxRetries: -1 })).toThrow();
      expect(() => s.get('nope')).toThrow();
    });
  });

  describe('extensibility', () => {
    it('accepts any BackoffStrategy', async () => {
      const linear = { delay: (attempt: number) => attempt * 500 };
      const s = new Scheduler({ backoff: linear });
      s.schedule({ id: 't', runAt: 0, handler: flaky(2).fn, maxRetries: 2 });
      await s.runDue(0);
      expect(s.get('t').nextRunAt).toBe(500);
      await s.runDue(500);
      expect(s.get('t').nextRunAt).toBe(1500);
    });
  });
});
