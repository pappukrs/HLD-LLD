// 08 · Quorum replicated KV (N, R, W): reference solution.
// Read this only after your own attempt passes.
//
// One coordinator, N replicas, every key is stored on all N replicas.
// A write succeeds when W replicas store it. A read asks R replicas and keeps the
// highest version (last write wins). Stale replicas that were asked get fixed (read repair).

export interface Versioned {
  value: string;
  version: number;
}

export interface QuorumConfig {
  /** Number of replicas. */
  n: number;
  /** Replicas a read must hear from. */
  r: number;
  /** Replicas a write must reach. */
  w: number;
}

export class QuorumError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuorumError';
  }
}

/** One storage node. It keeps a value only if its version is newer than what it has. */
class Replica {
  up = true;
  private readonly data = new Map<string, Versioned>();

  read(key: string): Versioned | undefined {
    return this.data.get(key);
  }

  /** Last write wins by version. An older or equal version is ignored. */
  write(key: string, v: Versioned): void {
    const current = this.data.get(key);
    if (!current || v.version > current.version) this.data.set(key, { ...v });
  }
}

export class QuorumKV {
  readonly n: number;
  readonly r: number;
  readonly w: number;
  private readonly replicas: Replica[];
  /** Stands in for a timestamp or hybrid logical clock. Strictly increasing. */
  private lastVersion = 0;

  constructor(config: QuorumConfig) {
    const { n, r, w } = config;
    if (!Number.isInteger(n) || n < 1) throw new Error('n must be a positive integer');
    for (const [name, v] of [['r', r], ['w', w]] as const) {
      if (!Number.isInteger(v) || v < 1 || v > n) throw new Error(`${name} must be an integer in 1..n`);
    }
    this.n = n;
    this.r = r;
    this.w = w;
    this.replicas = Array.from({ length: n }, () => new Replica());
  }

  /** true when R + W > N: every read set overlaps every write set. */
  get isStronglyConsistent(): boolean {
    return this.r + this.w > this.n;
  }

  /**
   * Writes to every replica that is up. Needs at least W up, else throws QuorumError
   * and writes nothing. Returns the new version.
   */
  put(key: string, value: string): number {
    const up = this.upReplicas();
    if (up.length < this.w) throw new QuorumError(`write needs ${this.w} replicas, only ${up.length} up`);
    const version = ++this.lastVersion;
    for (const replica of up) replica.write(key, { value, version });
    return version;
  }

  /**
   * Reads the first R replicas that are up (in id order), returns the newest value,
   * and repairs the replicas it read that were missing it or had an older version.
   */
  get(key: string): Versioned | undefined {
    const up = this.upReplicas();
    if (up.length < this.r) throw new QuorumError(`read needs ${this.r} replicas, only ${up.length} up`);
    const asked = up.slice(0, this.r);

    let newest: Versioned | undefined;
    for (const replica of asked) {
      const v = replica.read(key);
      if (v && (!newest || v.version > newest.version)) newest = v;
    }
    if (!newest) return undefined;

    // Read repair: push the winner to the replicas we asked that are behind.
    for (const replica of asked) {
      const v = replica.read(key);
      if (!v || v.version < newest.version) replica.write(key, newest);
    }
    return { ...newest };
  }

  failNode(id: number): void {
    this.replica(id).up = false;
  }

  recoverNode(id: number): void {
    this.replica(id).up = true;
  }

  isUp(id: number): boolean {
    return this.replica(id).up;
  }

  /** Looks at one replica directly, even if it is down. For tests and debugging. */
  peek(id: number, key: string): Versioned | undefined {
    const v = this.replica(id).read(key);
    return v ? { ...v } : undefined;
  }

  private upReplicas(): Replica[] {
    return this.replicas.filter((x) => x.up);
  }

  private replica(id: number): Replica {
    const replica = this.replicas[id];
    if (!replica) throw new Error(`Unknown node: ${id}`);
    return replica;
  }
}
