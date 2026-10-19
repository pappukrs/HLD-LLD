// 10 · Count-Min sketch + top-k heavy hitters: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run hld/code/10-count-min-sketch

/** width = ceil(e / ε), depth = ceil(ln(1 / δ)). Both inputs must be in (0, 1). */
export function dimensions(epsilon: number, delta: number): { width: number; depth: number } {
  throw new Error('TODO');
}

/** Two unsigned 32-bit hashes of a string. Make h2 odd. */
export function hashPair(item: string): [number, number] {
  throw new Error('TODO');
}

export class CountMinSketch {
  readonly width: number = 0;
  readonly depth: number = 0;

  /** Throws if width or depth is not a positive integer. */
  constructor(width: number, depth: number) {
    // TODO: allocate depth × width counters
    throw new Error('TODO');
  }

  static fromError(epsilon: number, delta: number): CountMinSketch {
    throw new Error('TODO');
  }

  /** count must be a positive integer (default 1). Row r uses column (h1 + r·h2) mod width. */
  add(item: string, count = 1): void {
    throw new Error('TODO');
  }

  /** Minimum over the rows. Never below the true count. */
  estimate(item: string): number {
    throw new Error('TODO');
  }

  /** Sum of all counts added. */
  get total(): number {
    throw new Error('TODO');
  }

  /** Adds another sketch of the same shape, cell by cell. Throws if the shapes differ. */
  merge(other: CountMinSketch): void {
    throw new Error('TODO');
  }
}

export interface HeavyHitter {
  item: string;
  count: number;
}

export class HeavyHitters {
  constructor(readonly k: number, readonly sketch: CountMinSketch) {
    // TODO: throw if k is not a positive integer
  }

  /** Add to the sketch. Keep at most k candidates with the highest estimates. */
  add(item: string, count = 1): void {
    throw new Error('TODO');
  }

  /** Highest count first. Ties: lexicographic by item. */
  top(): HeavyHitter[] {
    throw new Error('TODO');
  }
}
