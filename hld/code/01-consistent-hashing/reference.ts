// 01 · Consistent hash ring: reference solution.
// Read this only after your own attempt passes.

/** Maps a string to an unsigned 32-bit integer (0 .. 2^32 - 1). */
export type HashFn = (key: string) => number;

export interface RingOptions {
  /** Virtual nodes per physical node. Default 100. */
  vnodes?: number;
  /** Hash function for both keys and virtual nodes. Default: defaultHash. */
  hash?: HashFn;
}

/** FNV-1a (32-bit) followed by the murmur3 finalizer for better bit mixing. */
export function defaultHash(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // murmur3 fmix32: spreads small input differences across all bits.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

interface Point {
  readonly hash: number;
  readonly node: string;
}

export class ConsistentHashRing {
  private readonly vnodes: number;
  private readonly hash: HashFn;
  private readonly physical = new Set<string>();
  /** Sorted by hash, then by node name (a stable tie-break for hash collisions). */
  private points: Point[] = [];

  constructor(options: RingOptions = {}) {
    const vnodes = options.vnodes ?? 100;
    if (!Number.isInteger(vnodes) || vnodes < 1) throw new Error('vnodes must be a positive integer');
    this.vnodes = vnodes;
    this.hash = options.hash ?? defaultHash;
  }

  addNode(node: string): void {
    if (this.physical.has(node)) throw new Error(`Node already exists: ${node}`);
    this.physical.add(node);
    for (let i = 0; i < this.vnodes; i++) {
      this.points.push({ hash: this.hash(`${node}#${i}`), node });
    }
    // O(V log V). Fine: membership changes are rare compared to lookups.
    this.points.sort((a, b) => a.hash - b.hash || (a.node < b.node ? -1 : a.node > b.node ? 1 : 0));
  }

  removeNode(node: string): void {
    if (!this.physical.delete(node)) throw new Error(`Unknown node: ${node}`);
    this.points = this.points.filter((p) => p.node !== node);
  }

  hasNode(node: string): boolean {
    return this.physical.has(node);
  }

  /** Physical nodes, sorted by name. */
  nodes(): string[] {
    return [...this.physical].sort();
  }

  /** The owner of a key: the first virtual node clockwise from hash(key). */
  getNode(key: string): string {
    if (this.points.length === 0) throw new Error('Ring is empty');
    return this.points[this.firstIndexAtOrAfter(this.hash(key))].node;
  }

  /**
   * The owner plus the next distinct physical nodes clockwise (a replica set).
   * Returns min(n, number of nodes) nodes. The first one equals getNode(key).
   */
  getNodes(key: string, n: number): string[] {
    if (this.points.length === 0) throw new Error('Ring is empty');
    if (!Number.isInteger(n) || n < 1) throw new Error('n must be a positive integer');
    const want = Math.min(n, this.physical.size);
    const result: string[] = [];
    const seen = new Set<string>();
    let i = this.firstIndexAtOrAfter(this.hash(key));
    // Walk clockwise, skipping virtual nodes of physical nodes we already have.
    while (result.length < want) {
      const { node } = this.points[i];
      if (!seen.has(node)) {
        seen.add(node);
        result.push(node);
      }
      i = (i + 1) % this.points.length;
    }
    return result;
  }

  /** Binary search: index of the first point with hash >= h, wrapping to 0. */
  private firstIndexAtOrAfter(h: number): number {
    let lo = 0;
    let hi = this.points.length; // answer is in [lo, hi]
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.points[mid].hash < h) lo = mid + 1;
      else hi = mid;
    }
    return lo === this.points.length ? 0 : lo;
  }
}
