// 14 · In-memory KV Store (TTL + transactions): your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/14-kv-store

export interface SetOptions {
  /** Time to live in ms. Must be > 0. Omit it for no expiry. */
  ttlMs?: number;
}

export interface KVStoreConfig {
  clock?: () => number;
}

export class KVStore<V = string> {
  constructor(config: KVStoreConfig = {}) {
    // TODO: keep the clock, set up the data map and the transaction stack
  }

  get(key: string): V | undefined {
    throw new Error('TODO: an expired key reads as missing');
  }

  has(key: string): boolean {
    throw new Error('TODO');
  }

  /** Setting a key without ttlMs removes any old expiry. */
  set(key: string, value: V, options: SetOptions = {}): void {
    throw new Error('TODO');
  }

  /** Returns false if the key didn't exist (or had expired). */
  delete(key: string): boolean {
    throw new Error('TODO');
  }

  /** Number of live (not expired) keys. */
  size(): number {
    throw new Error('TODO');
  }

  begin(): void {
    throw new Error('TODO');
  }

  /** Commits the innermost transaction into its parent. Data is final only when the outermost commits. */
  commit(): void {
    throw new Error('TODO');
  }

  rollback(): void {
    throw new Error('TODO');
  }

  get transactionDepth(): number {
    throw new Error('TODO');
  }
}
