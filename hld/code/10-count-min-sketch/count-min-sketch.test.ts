import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { CountMinSketch, HeavyHitters, dimensions, hashPair } = (process.env.REF ? reference : starter) as typeof reference;

/** A skewed (Zipf-like) stream: item i appears about 2000 / (i + 1) times. Deterministic. */
function skewedStream(): { stream: string[]; truth: Map<string, number> } {
  const truth = new Map<string, number>();
  const stream: string[] = [];
  for (let i = 0; i < 2000; i++) {
    const n = Math.max(1, Math.floor(2000 / (i + 1)));
    truth.set(`item:${i}`, n);
    for (let j = 0; j < n; j++) stream.push(`item:${i}`);
  }
  // Interleave deterministically so order is not sorted by item.
  let seed = 17;
  for (let i = stream.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    const j = seed % (i + 1);
    [stream[i], stream[j]] = [stream[j], stream[i]];
  }
  return { stream, truth };
}

describe('10 · Count-Min sketch', () => {
  it('computes width and depth from ε and δ', () => {
    expect(dimensions(0.01, 0.01)).toEqual({ width: 272, depth: 5 });
    expect(dimensions(0.001, 0.0001)).toEqual({ width: 2719, depth: 10 });
    const cms = CountMinSketch.fromError(0.01, 0.01);
    expect([cms.width, cms.depth]).toEqual([272, 5]);
    expect(() => dimensions(0, 0.1)).toThrow();
    expect(() => dimensions(0.1, 1)).toThrow();
  });

  it('counts exactly when there are no collisions to speak of', () => {
    const cms = new CountMinSketch(1000, 4);
    cms.add('a', 5);
    cms.add('a');
    cms.add('b', 3);
    expect(cms.estimate('a')).toBe(6);
    expect(cms.estimate('b')).toBe(3);
    expect(cms.estimate('never-added')).toBe(0);
    expect(cms.total).toBe(9);
  });

  it('uses unsigned hashes with an odd h2', () => {
    const [h1, h2] = hashPair('x');
    expect(h1).toBeGreaterThanOrEqual(0);
    expect(h2).toBeGreaterThanOrEqual(0);
    expect(h2 % 2).toBe(1);
  });

  it('never under-counts, even in a tiny sketch (property check)', () => {
    const { stream, truth } = skewedStream();
    const cms = new CountMinSketch(50, 3); // far too small: many collisions
    for (const x of stream) cms.add(x);
    for (const [item, n] of truth) expect(cms.estimate(item)).toBeGreaterThanOrEqual(n);
  });

  it('stays within ε × total for at least (1 - δ) of the items', () => {
    const epsilon = 0.005;
    const delta = 0.01;
    const { stream, truth } = skewedStream();
    const cms = CountMinSketch.fromError(epsilon, delta);
    for (const x of stream) cms.add(x);
    expect(cms.total).toBe(stream.length);
    let within = 0;
    for (const [item, n] of truth) if (cms.estimate(item) - n <= epsilon * cms.total) within++;
    expect(within / truth.size).toBeGreaterThanOrEqual(1 - delta);
  });

  it('merges two sketches into the sketch of the combined stream', () => {
    const a = new CountMinSketch(64, 3);
    const b = new CountMinSketch(64, 3);
    const both = new CountMinSketch(64, 3);
    for (let i = 0; i < 500; i++) {
      const x = `k${i % 37}`;
      (i % 2 ? a : b).add(x);
      both.add(x);
    }
    a.merge(b);
    expect(a.total).toBe(both.total);
    for (let i = 0; i < 37; i++) expect(a.estimate(`k${i}`)).toBe(both.estimate(`k${i}`));
    expect(() => a.merge(new CountMinSketch(32, 3))).toThrow();
  });

  it('rejects bad parameters', () => {
    expect(() => new CountMinSketch(0, 3)).toThrow();
    expect(() => new CountMinSketch(10, 1.5)).toThrow();
    expect(() => new CountMinSketch(10, 3).add('a', 0)).toThrow();
    expect(() => new HeavyHitters(0, new CountMinSketch(10, 3))).toThrow();
  });

  describe('heavy hitters', () => {
    it('finds the true top 5 in a skewed stream', () => {
      const { stream } = skewedStream();
      const hh = new HeavyHitters(5, CountMinSketch.fromError(0.001, 0.01));
      for (const x of stream) hh.add(x);
      const top = hh.top();
      expect(top.map((t) => t.item)).toEqual(['item:0', 'item:1', 'item:2', 'item:3', 'item:4']);
      expect(top[0].count).toBeGreaterThanOrEqual(2000);
      expect(top.length).toBe(5);
    });

    it('keeps at most k items, sorted by count then by name', () => {
      const hh = new HeavyHitters(3, new CountMinSketch(1000, 4));
      hh.add('b', 5);
      hh.add('a', 5);
      hh.add('c', 1);
      hh.add('d', 2); // beats 'c' (1), so 'c' is evicted
      expect(hh.top()).toEqual([
        { item: 'a', count: 5 },
        { item: 'b', count: 5 },
        { item: 'd', count: 2 },
      ]);
      hh.add('d', 10);
      expect(hh.top()[0]).toEqual({ item: 'd', count: 12 });
    });
  });
});
