import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { ConsistentHashRing } = (process.env.REF ? reference : starter) as typeof reference;

const keys = Array.from({ length: 10_000 }, (_, i) => `user:${i}`);

function ringWith(nodes: string[], vnodes = 150) {
  const ring = new ConsistentHashRing({ vnodes });
  nodes.forEach((n) => ring.addNode(n));
  return ring;
}

describe('01 · Consistent hashing', () => {
  it('throws on an empty ring and on bad membership changes', () => {
    const ring = new ConsistentHashRing();
    expect(() => ring.getNode('k')).toThrow();
    ring.addNode('A');
    expect(() => ring.addNode('A')).toThrow();
    expect(() => ring.removeNode('B')).toThrow();
    expect(ring.hasNode('A')).toBe(true);
    expect(ring.nodes()).toEqual(['A']);
  });

  it('uses the injected hash: first point clockwise, wrapping at the end', () => {
    const positions: Record<string, number> = { 'A#0': 100, 'B#0': 200, k50: 50, k100: 100, k150: 150, k250: 250 };
    const ring = new ConsistentHashRing({ vnodes: 1, hash: (s) => positions[s] });
    ring.addNode('A');
    ring.addNode('B');
    expect(ring.getNode('k50')).toBe('A');
    expect(ring.getNode('k100')).toBe('A'); // a key exactly on a point belongs to that point
    expect(ring.getNode('k150')).toBe('B');
    expect(ring.getNode('k250')).toBe('A'); // wraps around
  });

  it('is deterministic: the same key always maps to the same node', () => {
    const a = ringWith(['A', 'B', 'C']);
    const b = ringWith(['C', 'A', 'B']); // insertion order must not matter
    for (const k of keys.slice(0, 500)) expect(a.getNode(k)).toBe(b.getNode(k));
  });

  it('spreads keys evenly with virtual nodes (each node within 0.7x..1.3x of the mean)', () => {
    const nodes = ['A', 'B', 'C', 'D', 'E'];
    const ring = ringWith(nodes);
    const counts = new Map<string, number>();
    for (const k of keys) counts.set(ring.getNode(k), (counts.get(ring.getNode(k)) ?? 0) + 1);
    const mean = keys.length / nodes.length;
    for (const n of nodes) {
      expect(counts.get(n)!).toBeGreaterThan(mean * 0.7);
      expect(counts.get(n)!).toBeLessThan(mean * 1.3);
    }
  });

  it('adding a node moves at most ~1.5/N of keys, and only to the new node', () => {
    const ring = ringWith(['A', 'B', 'C', 'D']);
    const before = new Map(keys.map((k) => [k, ring.getNode(k)]));
    ring.addNode('E');
    let moved = 0;
    for (const k of keys) {
      const now = ring.getNode(k);
      if (now !== before.get(k)) {
        moved++;
        expect(now).toBe('E');
      }
    }
    expect(moved).toBeGreaterThan(0);
    expect(moved / keys.length).toBeLessThanOrEqual((1 / 5) * 1.5);
  });

  it('removing a node moves only the keys that node owned', () => {
    const ring = ringWith(['A', 'B', 'C', 'D']);
    const before = new Map(keys.map((k) => [k, ring.getNode(k)]));
    ring.removeNode('C');
    for (const k of keys) {
      if (before.get(k) !== 'C') expect(ring.getNode(k)).toBe(before.get(k));
      else expect(ring.getNode(k)).not.toBe('C');
    }
  });

  it('getNodes returns distinct physical nodes, starting with the owner', () => {
    const ring = ringWith(['A', 'B', 'C', 'D', 'E']);
    for (const k of keys.slice(0, 1000)) {
      const replicas = ring.getNodes(k, 3);
      expect(replicas).toHaveLength(3);
      expect(new Set(replicas).size).toBe(3);
      expect(replicas[0]).toBe(ring.getNode(k));
    }
  });

  it('getNodes caps at the number of physical nodes', () => {
    const ring = ringWith(['A', 'B']);
    expect([...ring.getNodes('k', 5)].sort()).toEqual(['A', 'B']);
  });

  it('getNodes walks the ring in clockwise order with the injected hash', () => {
    const positions: Record<string, number> = { 'A#0': 10, 'A#1': 20, 'B#0': 30, 'C#0': 40, 'B#1': 50, 'C#1': 60, key: 25 };
    const ring = new ConsistentHashRing({ vnodes: 2, hash: (s) => positions[s] });
    ['A', 'B', 'C'].forEach((n) => ring.addNode(n));
    // From 25: B#0 (30), C#0 (40), skip B#1 and C#1, wrap to A#0 (10).
    expect(ring.getNodes('key', 3)).toEqual(['B', 'C', 'A']);
  });
});
