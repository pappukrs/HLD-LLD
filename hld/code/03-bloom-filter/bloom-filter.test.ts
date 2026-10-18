import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { BloomFilter, optimalBitCount, optimalHashCount, hashPair } = (process.env.REF ? reference : starter) as typeof reference;

describe('03 · Bloom filter', () => {
  it('computes the optimal number of bits', () => {
    expect(optimalBitCount(1000, 0.01)).toBe(9586);
    expect(optimalBitCount(1_000_000, 0.01)).toBe(9_585_059);
    expect(optimalBitCount(1000, 0.001)).toBe(14_378);
  });

  it('computes the optimal number of hash functions', () => {
    expect(optimalHashCount(9586, 1000)).toBe(7);
    expect(optimalHashCount(14_378, 1000)).toBe(10);
    expect(optimalHashCount(10, 1000)).toBe(1); // never 0
  });

  it('rejects bad parameters', () => {
    expect(() => new BloomFilter(0, 0.01)).toThrow();
    expect(() => new BloomFilter(100, 0)).toThrow();
    expect(() => new BloomFilter(100, 1)).toThrow();
  });

  it('sizes itself from n and p', () => {
    const bf = new BloomFilter(1000, 0.01);
    expect(bf.m).toBe(9586);
    expect(bf.k).toBe(7);
  });

  it('says "no" for everything when empty', () => {
    const bf = new BloomFilter(100, 0.01);
    expect(bf.mightContain('anything')).toBe(false);
    expect(bf.count).toBe(0);
  });

  it('uses double hashing: position i is (h1 + i·h2) mod m', () => {
    const bf = new BloomFilter(1000, 0.01);
    const [h1, h2] = hashPair('hello');
    expect(h1).toBeGreaterThanOrEqual(0);
    expect(h2).toBeGreaterThanOrEqual(0); // unsigned: a negative index would cause false negatives
    expect(h2 % 2).toBe(1);
    expect(bf.positions('hello')).toEqual(Array.from({ length: bf.k }, (_, i) => (h1 + i * h2) % bf.m));
    expect(hashPair('hello')).toEqual([h1, h2]); // deterministic
  });

  it('never gives a false negative over 10k inserts', () => {
    const bf = new BloomFilter(10_000, 0.01);
    for (let i = 0; i < 10_000; i++) bf.add(`user:${i}`);
    for (let i = 0; i < 10_000; i++) expect(bf.mightContain(`user:${i}`)).toBe(true);
    expect(bf.count).toBe(10_000);
  });

  it('keeps the false-positive rate close to the target', () => {
    const p = 0.01;
    const bf = new BloomFilter(10_000, p);
    for (let i = 0; i < 10_000; i++) bf.add(`user:${i}`);
    let falsePositives = 0;
    const trials = 20_000;
    for (let i = 0; i < trials; i++) if (bf.mightContain(`other:${i}`)) falsePositives++;
    const rate = falsePositives / trials;
    expect(rate).toBeLessThan(p * 2);
    expect(bf.expectedFalsePositiveRate()).toBeCloseTo(p, 2);
  });

  it('gets worse when you add more than it was sized for', () => {
    const bf = new BloomFilter(1000, 0.01);
    for (let i = 0; i < 5000; i++) bf.add(`user:${i}`);
    let fp = 0;
    for (let i = 0; i < 5000; i++) if (bf.mightContain(`other:${i}`)) fp++;
    expect(fp / 5000).toBeGreaterThan(0.1);
    expect(bf.expectedFalsePositiveRate()).toBeGreaterThan(0.1);
  });
});
