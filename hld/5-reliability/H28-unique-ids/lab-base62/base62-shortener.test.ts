import * as starter from './starter';
import * as reference from './reference';
import type { RangeCoordinator } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { encode, decode, IdRangeAllocator } = (process.env.REF ? reference : starter) as typeof reference;

/** A fake Redis INCRBY. Async, like a real network call. */
class FakeCoordinator implements RangeCoordinator {
  calls = 0;
  failNext = false;
  constructor(private counter = 0) {}
  async reserve(size: number): Promise<number> {
    this.calls++;
    await Promise.resolve(); // yield, like a network round trip
    if (this.failNext) {
      this.failNext = false;
      throw new Error('coordinator unavailable');
    }
    const start = this.counter;
    this.counter += size;
    return start;
  }
}

describe('05 · Base62 shortener', () => {
  describe('encode / decode', () => {
    it('encodes known values', () => {
      expect(encode(0)).toBe('0');
      expect(encode(9)).toBe('9');
      expect(encode(10)).toBe('a');
      expect(encode(36)).toBe('A');
      expect(encode(61)).toBe('Z');
      expect(encode(62)).toBe('10');
      expect(encode(62 ** 2)).toBe('100');
      expect(encode(62 ** 7 - 1)).toBe('ZZZZZZZ'); // 7 chars ≈ 3.5 trillion codes
    });

    it('decode reverses encode (property check)', () => {
      const values = [0, 1, 61, 62, 12345, 999_999_999, 2 ** 40, Number.MAX_SAFE_INTEGER];
      for (let i = 0; i < 1000; i++) values.push(i * 7919 * 104729);
      for (const n of values) expect(decode(encode(n))).toBe(n);
    });

    it('rejects bad input', () => {
      expect(() => encode(-1)).toThrow();
      expect(() => encode(1.5)).toThrow();
      expect(() => encode(2 ** 60)).toThrow();
      expect(() => decode('')).toThrow();
      expect(() => decode('ab-c')).toThrow();
      expect(() => decode('ZZZZZZZZZZZZ')).toThrow(); // 62^12 > 2^53
    });

    it('is case-sensitive', () => {
      expect(decode('a')).toBe(10);
      expect(decode('A')).toBe(36);
    });
  });

  describe('IdRangeAllocator', () => {
    it('hands out consecutive ids and leases one block per blockSize ids', async () => {
      const coord = new FakeCoordinator(1000);
      const alloc = new IdRangeAllocator(coord, 10);
      const ids: number[] = [];
      for (let i = 0; i < 25; i++) ids.push(await alloc.nextId());
      expect(ids).toEqual(Array.from({ length: 25 }, (_, i) => 1000 + i));
      expect(coord.calls).toBe(3);
      expect(alloc.leaseCount).toBe(3);
    });

    it('two allocators sharing a coordinator never give the same id', async () => {
      const coord = new FakeCoordinator();
      const a = new IdRangeAllocator(coord, 5);
      const b = new IdRangeAllocator(coord, 5);
      const ids = new Set<number>();
      for (let i = 0; i < 40; i++) {
        ids.add(await a.nextId());
        ids.add(await b.nextId());
      }
      expect(ids.size).toBe(80);
    });

    it('concurrent callers on an empty block share one lease', async () => {
      const coord = new FakeCoordinator();
      const alloc = new IdRangeAllocator(coord, 10);
      const ids = await Promise.all(Array.from({ length: 25 }, () => alloc.nextId()));
      expect(new Set(ids).size).toBe(25);
      expect(coord.calls).toBe(3); // not 25
    });

    it('a failed lease rejects, and the next call tries again', async () => {
      const coord = new FakeCoordinator();
      const alloc = new IdRangeAllocator(coord, 10);
      coord.failNext = true;
      await expect(alloc.nextId()).rejects.toThrow('coordinator unavailable');
      expect(await alloc.nextId()).toBe(0);
    });

    it('nextCode returns base62 short codes', async () => {
      const alloc = new IdRangeAllocator(new FakeCoordinator(61), 100);
      expect(await alloc.nextCode()).toBe('Z');
      expect(await alloc.nextCode()).toBe('10');
    });

    it('rejects a bad block size', () => {
      expect(() => new IdRangeAllocator(new FakeCoordinator(), 0)).toThrow();
    });
  });
});
