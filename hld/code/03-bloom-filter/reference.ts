// 03 · Bloom filter: reference solution.
// Read this only after your own attempt passes.

/** Bits needed for n items at false-positive rate p: m = ceil(-n·ln(p) / (ln 2)^2). */
export function optimalBitCount(n: number, p: number): number {
  validate(n, p);
  return Math.ceil((-n * Math.log(p)) / (Math.LN2 * Math.LN2));
}

/** Hash functions that minimise false positives: k = round((m / n)·ln 2), at least 1. */
export function optimalHashCount(m: number, n: number): number {
  if (!(m > 0) || !(n > 0)) throw new Error('m and n must be positive');
  return Math.max(1, Math.round((m / n) * Math.LN2));
}

/**
 * Two independent 32-bit hashes of a string.
 * h1 = FNV-1a, h2 = a different FNV-1a seed, both mixed with the murmur3 finalizer.
 * h2 is forced odd so that h1 + i·h2 visits many different bits.
 */
export function hashPair(item: string): [number, number] {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < item.length; i++) {
    const c = item.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193);
  }
  return [fmix32(a), (fmix32(b ^ 0x9e3779b9) | 1) >>> 0]; // `| 1` gives a signed int; `>>> 0` makes it unsigned again
}

function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function validate(n: number, p: number): void {
  if (!Number.isInteger(n) || n <= 0) throw new Error('expectedItems must be a positive integer');
  if (!(p > 0 && p < 1)) throw new Error('falsePositiveRate must be between 0 and 1 (exclusive)');
}

export class BloomFilter {
  /** Number of bits. */
  readonly m: number;
  /** Number of hash functions. */
  readonly k: number;
  private readonly bits: Uint8Array;
  private added = 0;

  constructor(expectedItems: number, falsePositiveRate: number) {
    validate(expectedItems, falsePositiveRate);
    this.m = optimalBitCount(expectedItems, falsePositiveRate);
    this.k = optimalHashCount(this.m, expectedItems);
    this.bits = new Uint8Array(Math.ceil(this.m / 8));
  }

  add(item: string): void {
    for (const bit of this.positions(item)) this.bits[bit >>> 3] |= 1 << (bit & 7);
    this.added++;
  }

  /** false = definitely not added. true = probably added. */
  mightContain(item: string): boolean {
    for (const bit of this.positions(item)) {
      if ((this.bits[bit >>> 3] & (1 << (bit & 7))) === 0) return false;
    }
    return true;
  }

  /** How many times add() was called. */
  get count(): number {
    return this.added;
  }

  /** Expected false-positive rate now: (1 - e^(-k·count/m))^k. */
  expectedFalsePositiveRate(): number {
    return Math.pow(1 - Math.exp((-this.k * this.added) / this.m), this.k);
  }

  /**
   * Kirsch–Mitzenmacher double hashing: g_i(x) = (h1 + i·h2) mod m.
   * Two real hashes give k "good enough" hashes. Exported for tests and learning.
   */
  positions(item: string): number[] {
    const [h1, h2] = hashPair(item);
    const out: number[] = [];
    for (let i = 0; i < this.k; i++) {
      // h1 + i·h2 stays below 2^53 for any sane k, so plain number math is exact.
      out.push((h1 + i * h2) % this.m);
    }
    return out;
  }
}
