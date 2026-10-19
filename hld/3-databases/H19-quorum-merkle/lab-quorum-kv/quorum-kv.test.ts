import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { QuorumKV, QuorumError } = (process.env.REF ? reference : starter) as typeof reference;

describe('08 · Quorum KV', () => {
  it('validates N, R and W', () => {
    expect(() => new QuorumKV({ n: 0, r: 1, w: 1 })).toThrow();
    expect(() => new QuorumKV({ n: 3, r: 4, w: 1 })).toThrow();
    expect(() => new QuorumKV({ n: 3, r: 2, w: 0 })).toThrow();
    expect(new QuorumKV({ n: 3, r: 2, w: 2 }).isStronglyConsistent).toBe(true);
    expect(new QuorumKV({ n: 3, r: 1, w: 2 }).isStronglyConsistent).toBe(false);
  });

  it('stores and reads values with increasing versions', () => {
    const kv = new QuorumKV({ n: 3, r: 2, w: 2 });
    expect(kv.get('k')).toBeUndefined();
    const v1 = kv.put('k', 'a');
    const v2 = kv.put('k', 'b');
    expect(v2).toBeGreaterThan(v1);
    expect(kv.get('k')).toEqual({ value: 'b', version: v2 });
    for (let id = 0; id < 3; id++) expect(kv.peek(id, 'k')).toEqual({ value: 'b', version: v2 });
  });

  it('a write fails with fewer than W replicas up, and writes nothing', () => {
    const kv = new QuorumKV({ n: 3, r: 1, w: 2 });
    kv.failNode(0);
    kv.failNode(1);
    expect(() => kv.put('k', 'a')).toThrow(QuorumError);
    expect(kv.peek(2, 'k')).toBeUndefined();
  });

  it('a read fails with fewer than R replicas up', () => {
    const kv = new QuorumKV({ n: 3, r: 2, w: 1 });
    kv.put('k', 'a');
    kv.failNode(1);
    kv.failNode(2);
    expect(() => kv.get('k')).toThrow(QuorumError);
    kv.recoverNode(2);
    expect(kv.get('k')?.value).toBe('a');
  });

  it('a down replica misses writes and is stale after it comes back', () => {
    const kv = new QuorumKV({ n: 3, r: 2, w: 2 });
    kv.put('k', 'old');
    kv.failNode(0);
    expect(kv.isUp(0)).toBe(false);
    const v = kv.put('k', 'new');
    kv.recoverNode(0);
    expect(kv.peek(0, 'k')?.value).toBe('old');
    expect(kv.peek(1, 'k')).toEqual({ value: 'new', version: v });
  });

  it('R + W <= N can return a stale value', () => {
    const kv = new QuorumKV({ n: 3, r: 1, w: 2 });
    kv.put('k', 'old');
    kv.failNode(0);
    kv.put('k', 'new'); // reaches nodes 1 and 2 only
    kv.recoverNode(0);
    expect(kv.get('k')?.value).toBe('old'); // R = 1 asked only node 0
  });

  it('R + W > N returns the latest value and read-repairs the stale replica', () => {
    const kv = new QuorumKV({ n: 3, r: 2, w: 2 });
    kv.put('k', 'old');
    kv.failNode(0);
    const v = kv.put('k', 'new');
    kv.recoverNode(0);
    expect(kv.get('k')).toEqual({ value: 'new', version: v }); // asks nodes 0 and 1
    expect(kv.peek(0, 'k')).toEqual({ value: 'new', version: v }); // repaired
  });

  it('read repair only touches the replicas it read', () => {
    const kv = new QuorumKV({ n: 5, r: 2, w: 3 });
    kv.failNode(0);
    kv.failNode(4);
    kv.put('k', 'v'); // nodes 1, 2, 3
    kv.recoverNode(0);
    kv.recoverNode(4);
    kv.get('k'); // asks nodes 0 and 1
    expect(kv.peek(0, 'k')?.value).toBe('v');
    expect(kv.peek(4, 'k')).toBeUndefined();
  });

  it('a replica never goes back to an older version (last write wins)', () => {
    const kv = new QuorumKV({ n: 3, r: 3, w: 1 });
    kv.put('k', 'v1');
    kv.failNode(1);
    kv.failNode(2);
    const v2 = kv.put('k', 'v2'); // only node 0
    kv.recoverNode(1);
    kv.recoverNode(2);
    expect(kv.get('k')).toEqual({ value: 'v2', version: v2 });
    for (let id = 0; id < 3; id++) expect(kv.peek(id, 'k')?.version).toBe(v2);
  });

  it('with R + W > N, reads always see the last successful write (property check)', () => {
    let seed = 2024;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (const [n, r, w] of [[3, 2, 2], [5, 3, 3], [5, 1, 5], [5, 4, 2]]) {
      const kv = new QuorumKV({ n, r, w });
      let lastOk: { value: string; version: number } | undefined;
      for (let step = 0; step < 500; step++) {
        // Random failures: each node is down with 30% chance.
        for (let id = 0; id < n; id++) (rand() < 0.3 ? kv.failNode(id) : kv.recoverNode(id));
        if (rand() < 0.5) {
          try {
            const value = `v${step}`;
            lastOk = { value, version: kv.put('k', value) };
          } catch (e) {
            expect(e).toBeInstanceOf(QuorumError);
          }
        } else {
          try {
            expect(kv.get('k')).toEqual(lastOk);
          } catch (e) {
            expect(e).toBeInstanceOf(QuorumError);
          }
        }
      }
    }
  });
});
