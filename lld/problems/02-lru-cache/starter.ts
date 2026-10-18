// 02 · LRU / LFU Cache: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/02-lru-cache

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

// Hint: HashMap + doubly linked list. Every method must be O(1).
export class LRUPolicy<K> implements EvictionPolicy<K> {
  onInsert(key: K): void {
    throw new Error('TODO');
  }

  onAccess(key: K): void {
    throw new Error('TODO');
  }

  onRemove(key: K): void {
    throw new Error('TODO');
  }

  evict(): K | undefined {
    throw new Error('TODO');
  }
}

// Hint: key -> frequency, frequency -> keys in LRU order, and a minFreq pointer.
export class LFUPolicy<K> implements EvictionPolicy<K> {
  onInsert(key: K): void {
    throw new Error('TODO');
  }

  onAccess(key: K): void {
    throw new Error('TODO');
  }

  onRemove(key: K): void {
    throw new Error('TODO');
  }

  evict(): K | undefined {
    throw new Error('TODO: least frequent first; ties go to the least recently used');
  }
}

export class Cache<K, V> {
  constructor(options: CacheOptions<K>) {
    // TODO: validate capacity, keep policy (default LRU), TTL and clock
  }

  get(key: K): V | undefined {
    throw new Error('TODO');
  }

  has(key: K): boolean {
    throw new Error('TODO: a peek, must not change recency or frequency');
  }

  put(key: K, value: V, ttlMs?: number): void {
    throw new Error('TODO');
  }

  delete(key: K): boolean {
    throw new Error('TODO');
  }

  get size(): number {
    throw new Error('TODO');
  }
}
