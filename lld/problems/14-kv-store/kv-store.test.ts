import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { KVStore } = (process.env.REF ? reference : starter) as typeof reference;

function setup() {
  let now = 0;
  const kv = new KVStore({ clock: () => now });
  return { kv, advance: (ms: number) => (now += ms) };
}

describe('14 · KV Store', () => {
  describe('basic operations', () => {
    it('gets, sets, overwrites and deletes', () => {
      const { kv } = setup();
      expect(kv.get('a')).toBeUndefined();
      kv.set('a', '1');
      kv.set('a', '2');
      expect(kv.get('a')).toBe('2');
      expect(kv.has('a')).toBe(true);
      expect(kv.delete('a')).toBe(true);
      expect(kv.delete('a')).toBe(false);
      expect(kv.get('a')).toBeUndefined();
    });
  });

  describe('TTL', () => {
    it('expires a key exactly at its deadline', () => {
      const { kv, advance } = setup();
      kv.set('otp', '4821', { ttlMs: 1000 });
      advance(999);
      expect(kv.get('otp')).toBe('4821');
      advance(1);
      expect(kv.get('otp')).toBeUndefined();
      expect(kv.delete('otp')).toBe(false);
    });

    it('set without a TTL removes the old expiry', () => {
      const { kv, advance } = setup();
      kv.set('a', '1', { ttlMs: 100 });
      kv.set('a', '2');
      advance(10_000);
      expect(kv.get('a')).toBe('2');
    });

    it('rejects a zero or negative TTL', () => {
      const { kv } = setup();
      expect(() => kv.set('a', '1', { ttlMs: 0 })).toThrow();
      expect(() => kv.set('a', '1', { ttlMs: -5 })).toThrow();
    });

    it('size counts only live keys', () => {
      const { kv, advance } = setup();
      kv.set('a', '1');
      kv.set('b', '2', { ttlMs: 50 });
      kv.set('c', '3', { ttlMs: 500 });
      advance(100);
      expect(kv.size()).toBe(2);
    });
  });

  describe('transactions', () => {
    it('rollback undoes sets, overwrites and deletes', () => {
      const { kv } = setup();
      kv.set('a', '1');
      kv.set('b', '2');
      kv.begin();
      kv.set('a', '10'); // overwrite
      kv.delete('b'); // delete
      kv.set('c', '3'); // new key
      expect(kv.get('a')).toBe('10'); // reads see own writes
      kv.rollback();
      expect([kv.get('a'), kv.get('b'), kv.get('c')]).toEqual(['1', '2', undefined]);
      expect(kv.transactionDepth).toBe(0);
    });

    it('commit keeps the changes', () => {
      const { kv } = setup();
      kv.begin();
      kv.set('a', '1');
      kv.commit();
      expect(kv.get('a')).toBe('1');
      expect(kv.transactionDepth).toBe(0);
    });

    it('commit or rollback with no open transaction throws', () => {
      const { kv } = setup();
      expect(() => kv.commit()).toThrow();
      expect(() => kv.rollback()).toThrow();
    });

    it('nested: an inner rollback keeps the outer changes', () => {
      const { kv } = setup();
      kv.begin();
      kv.set('a', 'outer');
      kv.begin();
      kv.set('a', 'inner');
      kv.set('b', 'inner');
      expect(kv.transactionDepth).toBe(2);
      kv.rollback();
      expect(kv.get('a')).toBe('outer');
      expect(kv.get('b')).toBeUndefined();
      kv.commit();
      expect(kv.get('a')).toBe('outer');
    });

    it('nested: an inner commit is undone by an outer rollback', () => {
      const { kv } = setup();
      kv.set('a', 'base');
      kv.begin();
      kv.set('b', 'outer');
      kv.begin();
      kv.set('a', 'inner');
      kv.delete('b');
      kv.commit();
      expect([kv.get('a'), kv.get('b')]).toEqual(['inner', undefined]);
      kv.rollback();
      expect([kv.get('a'), kv.get('b')]).toEqual(['base', undefined]);
    });

    it('a rolled-back key keeps its original absolute expiry', () => {
      const { kv, advance } = setup();
      kv.set('session', 's1', { ttlMs: 1000 });
      kv.begin();
      kv.set('session', 's2'); // no TTL inside the transaction
      advance(400);
      kv.rollback();
      expect(kv.get('session')).toBe('s1');
      advance(600); // t = 1000: the original deadline
      expect(kv.get('session')).toBeUndefined();
    });
  });

  describe('extensibility', () => {
    it('works with any value type', () => {
      let now = 0;
      const kv = new KVStore<{ count: number }>({ clock: () => now });
      kv.set('cart', { count: 1 }, { ttlMs: 10 });
      kv.begin();
      kv.set('cart', { count: 2 });
      kv.rollback();
      expect(kv.get('cart')).toEqual({ count: 1 });
      now = 10;
      expect(kv.get('cart')).toBeUndefined();
    });
  });
});
