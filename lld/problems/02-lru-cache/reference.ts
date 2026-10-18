// 02 · LRU / LFU Cache: reference solution.
// Read this only after your own attempt passes (or after 60 minutes).

export interface EvictionPolicy<K> {
  /** A new key was stored. */
  onInsert(key: K): void;
  /** An existing key was read (get) or overwritten (put). */
  onAccess(key: K): void;
  /** A key left the cache by delete or expiry. Not called for keys returned by evict(). */
  onRemove(key: K): void;
  /** Pick a victim, stop tracking it, and return it. */
  evict(): K | undefined;
}

export interface CacheOptions<K> {
  capacity: number;
  policy?: EvictionPolicy<K>; // default: LRU
  defaultTtlMs?: number; // default: no expiry
  clock?: () => number;
}

class ListNode<K> {
  prev: ListNode<K> | null = null;
  next: ListNode<K> | null = null;
  constructor(readonly key: K) {}
}

// Head = most recently used, tail = least recently used. Every operation is O(1).
class KeyList<K> {
  private head: ListNode<K> | null = null;
  private tail: ListNode<K> | null = null;

  pushFront(node: ListNode<K>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  remove(node: ListNode<K>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;
    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  popBack(): ListNode<K> | null {
    const node = this.tail;
    if (node) this.remove(node);
    return node;
  }
}

export class LRUPolicy<K> implements EvictionPolicy<K> {
  private readonly nodes = new Map<K, ListNode<K>>();
  private readonly list = new KeyList<K>();

  onInsert(key: K): void {
    const node = new ListNode(key);
    this.nodes.set(key, node);
    this.list.pushFront(node);
  }

  onAccess(key: K): void {
    const node = this.nodes.get(key);
    if (!node) return;
    this.list.remove(node);
    this.list.pushFront(node);
  }

  onRemove(key: K): void {
    const node = this.nodes.get(key);
    if (!node) return;
    this.list.remove(node);
    this.nodes.delete(key);
  }

  evict(): K | undefined {
    const node = this.list.popBack();
    if (!node) return undefined;
    this.nodes.delete(node.key);
    return node.key;
  }
}

export class LFUPolicy<K> implements EvictionPolicy<K> {
  private readonly freq = new Map<K, number>();
  // A Set keeps insertion order, so the first key in a bucket is the
  // least recently used one at that frequency. That gives the LRU tie-break for free.
  private readonly buckets = new Map<number, Set<K>>();
  private minFreq = 0;

  onInsert(key: K): void {
    this.freq.set(key, 1);
    this.bucket(1).add(key);
    this.minFreq = 1;
  }

  onAccess(key: K): void {
    const f = this.freq.get(key);
    if (f === undefined) return;
    this.detach(key, f);
    this.freq.set(key, f + 1);
    this.bucket(f + 1).add(key);
    if (this.minFreq === f && !this.buckets.has(f)) this.minFreq = f + 1;
  }

  onRemove(key: K): void {
    const f = this.freq.get(key);
    if (f === undefined) return;
    this.detach(key, f);
    this.freq.delete(key);
    // minFreq may now point to an empty bucket. evict() repairs it.
  }

  evict(): K | undefined {
    if (this.freq.size === 0) return undefined;
    // Only after an explicit delete/expiry. Cost is O(distinct frequencies), not O(n).
    if (!this.buckets.has(this.minFreq)) this.minFreq = Math.min(...this.buckets.keys());
    const bucket = this.buckets.get(this.minFreq)!;
    const key = bucket.values().next().value as K;
    this.detach(key, this.minFreq);
    this.freq.delete(key);
    return key;
  }

  private bucket(f: number): Set<K> {
    let b = this.buckets.get(f);
    if (!b) {
      b = new Set();
      this.buckets.set(f, b);
    }
    return b;
  }

  private detach(key: K, f: number): void {
    const b = this.buckets.get(f);
    if (!b) return;
    b.delete(key);
    if (b.size === 0) this.buckets.delete(f);
  }
}

interface Entry<V> {
  value: V;
  expiresAt: number; // Infinity = never
}

export class Cache<K, V> {
  private readonly entries = new Map<K, Entry<V>>();
  private readonly capacity: number;
  private readonly policy: EvictionPolicy<K>;
  private readonly defaultTtlMs?: number;
  private readonly clock: () => number;

  constructor(options: CacheOptions<K>) {
    if (!Number.isInteger(options.capacity) || options.capacity <= 0) {
      throw new Error('Capacity must be a positive integer');
    }
    this.capacity = options.capacity;
    this.policy = options.policy ?? new LRUPolicy<K>();
    this.defaultTtlMs = options.defaultTtlMs;
    this.clock = options.clock ?? Date.now;
  }

  get(key: K): V | undefined {
    const entry = this.live(key);
    if (!entry) return undefined;
    this.policy.onAccess(key);
    return entry.value;
  }

  // A peek: does not change recency or frequency.
  has(key: K): boolean {
    return this.live(key) !== undefined;
  }

  put(key: K, value: V, ttlMs: number | undefined = this.defaultTtlMs): void {
    if (ttlMs !== undefined && ttlMs <= 0) throw new Error('TTL must be positive');
    const expiresAt = ttlMs === undefined ? Infinity : this.clock() + ttlMs;

    if (this.entries.has(key)) {
      this.entries.set(key, { value, expiresAt });
      this.policy.onAccess(key);
      return;
    }
    if (this.entries.size >= this.capacity) {
      const victim = this.policy.evict();
      if (victim === undefined) throw new Error('Eviction policy returned no victim');
      this.entries.delete(victim);
    }
    this.entries.set(key, { value, expiresAt });
    this.policy.onInsert(key);
  }

  delete(key: K): boolean {
    if (!this.entries.delete(key)) return false;
    this.policy.onRemove(key);
    return true;
  }

  // Counts expired entries that nobody has touched yet (lazy expiry).
  get size(): number {
    return this.entries.size;
  }

  // Lazy expiry: an entry is checked only when someone asks for it.
  private live(key: K): Entry<V> | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.clock()) {
      this.delete(key);
      return undefined;
    }
    return entry;
  }
}
