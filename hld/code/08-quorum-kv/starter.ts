// 08 · Quorum replicated KV (N, R, W): your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run hld/code/08-quorum-kv

export interface Versioned {
  value: string;
  version: number;
}

export interface QuorumConfig {
  /** Number of replicas (ids 0..n-1). */
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

export class QuorumKV {
  readonly n: number = 0;
  readonly r: number = 0;
  readonly w: number = 0;

  /** Throws if n < 1, or r or w is not an integer in 1..n. */
  constructor(config: QuorumConfig) {
    // TODO: create n replicas, all up
    throw new Error('TODO');
  }

  /** true when R + W > N. */
  get isStronglyConsistent(): boolean {
    throw new Error('TODO');
  }

  /**
   * Fewer than W replicas up → throw QuorumError and write nothing.
   * Otherwise write { value, version } to every up replica. Versions strictly increase.
   */
  put(key: string, value: string): number {
    throw new Error('TODO');
  }

  /**
   * Fewer than R up → throw QuorumError.
   * Read the first R up replicas (lowest ids first). Return the highest version, or undefined.
   * Read repair: write the winner to the replicas you read that are missing it or older.
   */
  get(key: string): Versioned | undefined {
    throw new Error('TODO');
  }

  failNode(id: number): void {
    throw new Error('TODO');
  }

  recoverNode(id: number): void {
    throw new Error('TODO');
  }

  isUp(id: number): boolean {
    throw new Error('TODO');
  }

  /** Looks at one replica directly, even if it is down. */
  peek(id: number, key: string): Versioned | undefined {
    throw new Error('TODO');
  }
}
