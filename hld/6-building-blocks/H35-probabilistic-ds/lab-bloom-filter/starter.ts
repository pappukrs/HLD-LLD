// 03 · Bloom filter: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run hld/code/03-bloom-filter

/** Bits needed for n items at false-positive rate p: m = ceil(-n·ln(p) / (ln 2)^2). Throws on bad input. */
export function optimalBitCount(n: number, p: number): number {
  throw new Error('TODO');
}

/** k = round((m / n)·ln 2), at least 1. */
export function optimalHashCount(m: number, n: number): number {
  throw new Error('TODO');
}

/** Two independent unsigned 32-bit hashes of a string. Make h2 odd. */
export function hashPair(item: string): [number, number] {
  throw new Error('TODO');
}

export class BloomFilter {
  /** Number of bits. */
  readonly m: number = 0;
  /** Number of hash functions. */
  readonly k: number = 0;

  /** Throws if expectedItems is not a positive integer or the rate is not in (0, 1). */
  constructor(expectedItems: number, falsePositiveRate: number) {
    // TODO: compute m and k, allocate a bit array (Uint8Array of ceil(m / 8) bytes)
    throw new Error('TODO');
  }

  add(item: string): void {
    throw new Error('TODO');
  }

  /** false = definitely not added. true = probably added. */
  mightContain(item: string): boolean {
    throw new Error('TODO');
  }

  /** How many times add() was called. */
  get count(): number {
    throw new Error('TODO');
  }

  /** (1 - e^(-k·count/m))^k */
  expectedFalsePositiveRate(): number {
    throw new Error('TODO');
  }

  /** The k bit indexes for an item: (h1 + i·h2) mod m for i = 0..k-1. */
  positions(item: string): number[] {
    throw new Error('TODO');
  }
}
