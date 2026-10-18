import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { Snowflake, parseSnowflake, ClockMovedBackwardsError, DEFAULT_EPOCH } = (process.env.REF ? reference : starter) as typeof reference;

const EPOCH = 1_000_000;

describe('04 · Snowflake ID', () => {
  it('packs 41 bits of time, 10 bits of worker and 12 bits of sequence', () => {
    const gen = new Snowflake({ workerId: 3, epoch: EPOCH, clock: () => EPOCH + 5 });
    expect(gen.nextId()).toBe((5n << 22n) | (3n << 12n) | 0n);
    expect(gen.nextId()).toBe((5n << 22n) | (3n << 12n) | 1n);
  });

  it('parses an id back into its parts', () => {
    const now = DEFAULT_EPOCH + 123_456_789;
    const gen = new Snowflake({ workerId: 1023, clock: () => now });
    gen.nextId();
    const id = gen.nextId();
    expect(parseSnowflake(id)).toEqual({ timestamp: now, workerId: 1023, sequence: 1 });
  });

  it('rejects a worker id outside 0..1023', () => {
    expect(() => new Snowflake({ workerId: -1 })).toThrow();
    expect(() => new Snowflake({ workerId: 1024 })).toThrow();
    expect(() => new Snowflake({ workerId: 1.5 })).toThrow();
  });

  it('resets the sequence to 0 in a new millisecond', () => {
    let now = EPOCH + 10;
    const gen = new Snowflake({ workerId: 0, epoch: EPOCH, clock: () => now });
    gen.nextId();
    gen.nextId();
    now++;
    expect(parseSnowflake(gen.nextId(), EPOCH)).toEqual({ timestamp: EPOCH + 11, workerId: 0, sequence: 0 });
  });

  it('after 4096 ids in one ms, waits for the next ms', () => {
    const T = EPOCH + 50;
    let stuckCalls = Infinity; // how many more clock() calls return T
    const gen = new Snowflake({
      workerId: 7,
      epoch: EPOCH,
      clock: () => (stuckCalls-- > 0 ? T : T + 1),
    });
    const ids = Array.from({ length: 4096 }, () => gen.nextId());
    expect(new Set(ids).size).toBe(4096);
    expect(ids.every((id) => parseSnowflake(id, EPOCH).timestamp === T)).toBe(true);
    expect(parseSnowflake(ids[4095], EPOCH).sequence).toBe(4095);

    stuckCalls = 3; // the clock stays on T for 3 more calls, then moves on
    const next = parseSnowflake(gen.nextId(), EPOCH);
    expect(next).toEqual({ timestamp: T + 1, workerId: 7, sequence: 0 });
    expect(stuckCalls).toBeLessThan(0); // it really did call the clock again and again
  });

  it('throws when the clock moves backwards', () => {
    let now = EPOCH + 1000;
    const gen = new Snowflake({ workerId: 1, epoch: EPOCH, clock: () => now });
    gen.nextId();
    now = EPOCH + 999;
    expect(() => gen.nextId()).toThrow(ClockMovedBackwardsError);
  });

  it('throws when the time does not fit in 41 bits, or is before the epoch', () => {
    const tooLate = new Snowflake({ workerId: 1, epoch: 0, clock: () => 2 ** 41 });
    expect(() => tooLate.nextId()).toThrow();
    const tooEarly = new Snowflake({ workerId: 1, epoch: EPOCH, clock: () => EPOCH - 1 });
    expect(() => tooEarly.nextId()).toThrow();
  });

  it('ids are strictly increasing over time on one worker', () => {
    let now = EPOCH;
    let calls = 0;
    const gen = new Snowflake({ workerId: 9, epoch: EPOCH, clock: () => (calls++ % 7 === 0 ? ++now : now) });
    let prev = -1n;
    for (let i = 0; i < 20_000; i++) {
      const id = gen.nextId();
      expect(id > prev).toBe(true);
      prev = id;
    }
  });

  it('two workers never collide in the same millisecond', () => {
    const clock = () => EPOCH + 42;
    const a = new Snowflake({ workerId: 1, epoch: EPOCH, clock });
    const b = new Snowflake({ workerId: 2, epoch: EPOCH, clock });
    const ids = new Set<bigint>();
    for (let i = 0; i < 1000; i++) {
      ids.add(a.nextId());
      ids.add(b.nextId());
    }
    expect(ids.size).toBe(2000);
  });

  it('ids are positive and fit in a signed 64-bit integer', () => {
    const gen = new Snowflake({ workerId: 1023, epoch: 0, clock: () => 2 ** 41 - 1 });
    const id = gen.nextId();
    expect(id > 0n).toBe(true);
    expect(id <= 2n ** 63n - 1n).toBe(true);
  });
});
