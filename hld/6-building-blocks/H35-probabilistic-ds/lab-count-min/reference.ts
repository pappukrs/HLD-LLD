// 10 · Count-Min sketch + top-k heavy hitters: reference solution.
// Read this only after your own attempt passes.

/**
 * width = ceil(e / ε), depth = ceil(ln(1 / δ)).
 * Then estimate(x) <= true(x) + ε × total, with probability at least 1 - δ.
 */
export function dimensions(epsilon: number, delta: number): { width: number; depth: number } {
  if (!(epsilon > 0 && epsilon < 1)) throw new Error('epsilon must be in (0, 1)');
  if (!(delta > 0 && delta < 1)) throw new Error('delta must be in (0, 1)');
  return { width: Math.ceil(Math.E / epsilon), depth: Math.ceil(Math.log(1 / delta)) };
}

/** Two unsigned 32-bit hashes (FNV-1a with two seeds + murmur3 finalizer). h2 is odd. */
export function hashPair(item: string): [number, number] {
  let a = 0x811c9dc5;
  let b = 0x050c5d1f;
  for (let i = 0; i < item.length; i++) {
    const c = item.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193);
  }
  return [fmix32(a), (fmix32(b ^ 0x9e3779b9) | 1) >>> 0];
}

function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export class CountMinSketch {
  readonly width: number;
  readonly depth: number;
  /** depth rows × width counters, stored flat: row r, column c is at r × width + c. */
  private readonly table: Float64Array;
  private sum = 0;

  constructor(width: number, depth: number) {
    if (!Number.isInteger(width) || width < 1) throw new Error('width must be a positive integer');
    if (!Number.isInteger(depth) || depth < 1) throw new Error('depth must be a positive integer');
    this.width = width;
    this.depth = depth;
    this.table = new Float64Array(width * depth);
  }

  static fromError(epsilon: number, delta: number): CountMinSketch {
    const { width, depth } = dimensions(epsilon, delta);
    return new CountMinSketch(width, depth);
  }

  add(item: string, count = 1): void {
    if (!Number.isInteger(count) || count < 1) throw new Error('count must be a positive integer');
    const [h1, h2] = hashPair(item);
    for (let r = 0; r < this.depth; r++) this.table[r * this.width + this.column(h1, h2, r)] += count;
    this.sum += count;
  }

  /** Never below the true count. Collisions can only add, so take the minimum over rows. */
  estimate(item: string): number {
    const [h1, h2] = hashPair(item);
    let min = Infinity;
    for (let r = 0; r < this.depth; r++) {
      min = Math.min(min, this.table[r * this.width + this.column(h1, h2, r)]);
    }
    return min;
  }

  /** Sum of all counts added. */
  get total(): number {
    return this.sum;
  }

  /** Adds another sketch with the same shape, cell by cell (for example from another server). */
  merge(other: CountMinSketch): void {
    if (other.width !== this.width || other.depth !== this.depth) throw new Error('Sketches must have the same width and depth');
    for (let i = 0; i < this.table.length; i++) this.table[i] += other.table[i];
    this.sum += other.sum;
  }

  /** Row r uses hash h1 + r·h2 (double hashing). */
  private column(h1: number, h2: number, r: number): number {
    return (h1 + r * h2) % this.width;
  }
}

export interface HeavyHitter {
  item: string;
  count: number;
}

/**
 * Keeps the k items with the highest estimated count seen so far.
 * The sketch does the counting; a small map holds the current candidates.
 */
export class HeavyHitters {
  private readonly candidates = new Map<string, number>();

  constructor(readonly k: number, readonly sketch: CountMinSketch) {
    if (!Number.isInteger(k) || k < 1) throw new Error('k must be a positive integer');
  }

  add(item: string, count = 1): void {
    this.sketch.add(item, count);
    const estimate = this.sketch.estimate(item);
    if (this.candidates.has(item) || this.candidates.size < this.k) {
      this.candidates.set(item, estimate);
      return;
    }
    // Full: replace the weakest candidate if this item now beats it. O(k) scan; a heap makes it O(log k).
    let minItem = '';
    let minCount = Infinity;
    for (const [candidate, c] of this.candidates) {
      if (c < minCount) {
        minCount = c;
        minItem = candidate;
      }
    }
    if (estimate > minCount) {
      this.candidates.delete(minItem);
      this.candidates.set(item, estimate);
    }
  }

  /** Highest count first. Ties: lexicographic by item. */
  top(): HeavyHitter[] {
    return [...this.candidates]
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count || (a.item < b.item ? -1 : a.item > b.item ? 1 : 0));
  }
}
