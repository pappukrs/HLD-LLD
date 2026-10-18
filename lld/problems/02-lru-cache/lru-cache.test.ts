import * as starter from './starter';
import * as reference from './reference';
import type { EvictionPolicy } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { Cache, LRUPolicy, LFUPolicy } = (process.env.REF ? reference : starter) as typeof reference;

function makeClock() {
  let now = 0;
  return { clock: () => now, advance: (ms: number) => (now += ms) };
}

describe('02 · LRU / LFU Cache', () => {
  describe('basics (LRU by default)', () => {
    it('returns undefined for a missing key and the value for a stored key', () => {
      const cache = new Cache<string, number>({ capacity: 2 });
      expect(cache.get('a')).toBeUndefined();
      cache.put('a', 1);
      expect(cache.get('a')).toBe(1);
      expect(cache.size).toBe(1);
    });

    it('rejects a capacity that is zero, negative or not an integer', () => {
      expect(() => new Cache({ capacity: 0 })).toThrow();
      expect(() => new Cache({ capacity: -1 })).toThrow();
      expect(() => new Cache({ capacity: 1.5 })).toThrow();
    });

    it('evicts the least recently used key when full', () => {
      const cache = new Cache<string, number>({ capacity: 2, policy: new LRUPolicy() });
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('c', 3);
      expect(cache.has('a')).toBe(false);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.size).toBe(2);
    });

    it('treats get as a use, so the read key survives', () => {
      const cache = new Cache<string, number>({ capacity: 2 });
      cache.put('a', 1);
      cache.put('b', 2);
      cache.get('a');
      cache.put('c', 3);
      expect(cache.get('a')).toBe(1);
      expect(cache.has('b')).toBe(false);
    });

    it('updates an existing key in place without evicting anyone', () => {
      const cache = new Cache<string, number>({ capacity: 2 });
      cache.put('a', 1);
      cache.put('b', 2);
      cache.put('a', 10); // also makes 'a' most recent
      expect(cache.size).toBe(2);
      cache.put('c', 3);
      expect(cache.get('a')).toBe(10);
      expect(cache.has('b')).toBe(false);
    });

    it('deletes a key and frees its slot', () => {
      const cache = new Cache<string, number>({ capacity: 2 });
      cache.put('a', 1);
      cache.put('b', 2);
      expect(cache.delete('a')).toBe(true);
      expect(cache.delete('a')).toBe(false);
      cache.put('c', 3);
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
    });
  });

  describe('LFU policy', () => {
    it('evicts the least frequently used key', () => {
      const cache = new Cache<string, number>({ capacity: 2, policy: new LFUPolicy() });
      cache.put('a', 1);
      cache.put('b', 2);
      cache.get('a');
      cache.get('a');
      cache.get('b');
      cache.put('c', 3); // a:3 uses, b:2 uses -> b goes
      expect(cache.has('b')).toBe(false);
      expect(cache.get('a')).toBe(1);
    });

    it('breaks a frequency tie by evicting the least recently used key', () => {
      const cache = new Cache<string, number>({ capacity: 2, policy: new LFUPolicy() });
      cache.put('a', 1);
      cache.put('b', 2);
      cache.get('b');
      cache.get('a'); // both have 2 uses; 'b' was used longer ago
      cache.put('c', 3);
      expect(cache.has('b')).toBe(false);
      expect(cache.has('a')).toBe(true);
    });

    it('gives a new key frequency 1, so it is the next victim', () => {
      const cache = new Cache<string, number>({ capacity: 2, policy: new LFUPolicy() });
      cache.put('a', 1);
      cache.get('a');
      cache.put('b', 2);
      cache.put('c', 3); // evicts b (1 use), not a (2 uses)
      cache.put('d', 4); // evicts c (1 use)
      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
      expect(cache.has('c')).toBe(false);
      expect(cache.get('d')).toBe(4);
    });

    it('still evicts correctly after a delete empties the lowest bucket', () => {
      const cache = new Cache<string, number>({ capacity: 2, policy: new LFUPolicy() });
      cache.put('a', 1);
      cache.put('b', 2);
      cache.get('b');
      cache.get('b');
      cache.delete('a'); // the frequency-1 bucket is now empty
      cache.put('c', 3);
      cache.put('d', 4); // c has 1 use, b has 3 -> c goes
      expect(cache.has('c')).toBe(false);
      expect(cache.get('b')).toBe(2);
    });
  });

  describe('TTL', () => {
    it('expires an entry after the default TTL using the injected clock', () => {
      const { clock, advance } = makeClock();
      const cache = new Cache<string, number>({ capacity: 2, defaultTtlMs: 1000, clock });
      cache.put('a', 1);
      advance(999);
      expect(cache.get('a')).toBe(1);
      advance(1);
      expect(cache.get('a')).toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('lets a per-entry TTL override the default, and rejects a TTL <= 0', () => {
      const { clock, advance } = makeClock();
      const cache = new Cache<string, number>({ capacity: 3, defaultTtlMs: 1000, clock });
      cache.put('short', 1, 100);
      cache.put('default', 2);
      advance(500);
      expect(cache.has('short')).toBe(false);
      expect(cache.has('default')).toBe(true);
      expect(() => cache.put('bad', 3, 0)).toThrow();
    });
  });

  describe('extensibility', () => {
    it('accepts any EvictionPolicy, for example FIFO (Open/Closed)', () => {
      class FifoPolicy implements EvictionPolicy<string> {
        private queue: string[] = [];
        onInsert(key: string) {
          this.queue.push(key);
        }
        onAccess() {}
        onRemove(key: string) {
          this.queue = this.queue.filter((k) => k !== key);
        }
        evict() {
          return this.queue.shift();
        }
      }
      const cache = new Cache<string, number>({ capacity: 2, policy: new FifoPolicy() });
      cache.put('a', 1);
      cache.put('b', 2);
      cache.get('a'); // FIFO ignores reads
      cache.put('c', 3);
      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(true);
    });
  });
});
