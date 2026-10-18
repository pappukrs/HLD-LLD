// 14 · In-memory KV Store (TTL + transactions): reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

export interface SetOptions {
  /** Time to live in ms. Must be > 0. Omit it for no expiry. */
  ttlMs?: number;
}

export interface KVStoreConfig {
  clock?: () => number;
}

interface Entry<V> {
  readonly value: V;
  readonly expiresAt: number | null; // absolute time, so a restored entry keeps its real deadline
}

// The undo-log design: reads and writes go straight to `data` (O(1)).
// Each open transaction keeps, per key, the entry before the transaction first touched it (a memento).
// Rollback restores those mementos. Commit hands them to the parent transaction.
export class KVStore<V = string> {
  private readonly data = new Map<string, Entry<V>>();
  private readonly undoLogs: Map<string, Entry<V> | undefined>[] = [];
  private readonly clock: () => number;

  constructor(config: KVStoreConfig = {}) {
    this.clock = config.clock ?? Date.now;
  }

  get(key: string): V | undefined {
    return this.live(key)?.value;
  }

  has(key: string): boolean {
    return this.live(key) !== undefined;
  }

  /** Setting a key without ttlMs removes any old expiry. */
  set(key: string, value: V, options: SetOptions = {}): void {
    const { ttlMs } = options;
    if (ttlMs !== undefined && (!Number.isFinite(ttlMs) || ttlMs <= 0)) throw new Error(`Invalid ttlMs ${ttlMs}`);
    this.write(key, { value, expiresAt: ttlMs === undefined ? null : this.clock() + ttlMs });
  }

  /** Returns false if the key didn't exist (or had expired). */
  delete(key: string): boolean {
    if (!this.live(key)) return false;
    this.write(key, undefined);
    return true;
  }

  /** Number of live (not expired) keys. */
  size(): number {
    let n = 0;
    for (const key of [...this.data.keys()]) if (this.live(key)) n++;
    return n;
  }

  begin(): void {
    this.undoLogs.push(new Map());
  }

  /** Commits the innermost transaction into its parent. Data is final only when the outermost commits. */
  commit(): void {
    const log = this.undoLogs.pop();
    if (!log) throw new Error('No transaction');
    const parent = this.undoLogs.at(-1);
    if (!parent) return;
    // The parent keeps its own older memento if it has one. Otherwise it takes ours.
    for (const [key, before] of log) if (!parent.has(key)) parent.set(key, before);
  }

  rollback(): void {
    const log = this.undoLogs.pop();
    if (!log) throw new Error('No transaction');
    for (const [key, before] of log) {
      if (before) this.data.set(key, before);
      else this.data.delete(key);
    }
  }

  get transactionDepth(): number {
    return this.undoLogs.length;
  }

  private write(key: string, entry: Entry<V> | undefined): void {
    const log = this.undoLogs.at(-1);
    if (log && !log.has(key)) log.set(key, this.data.get(key));
    if (entry) this.data.set(key, entry);
    else this.data.delete(key);
  }

  // Lazy expiry. Removing an expired entry is not logged: if a rollback brings it back, it is still expired.
  private live(key: string): Entry<V> | undefined {
    const entry = this.data.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && this.clock() >= entry.expiresAt) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }
}
