// 01 · Consistent hash ring: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run hld/code/01-consistent-hashing

/** Maps a string to an unsigned 32-bit integer (0 .. 2^32 - 1). */
export type HashFn = (key: string) => number;

export interface RingOptions {
  /** Virtual nodes per physical node. Default 100. */
  vnodes?: number;
  /** Hash function for both keys and virtual nodes. Default: defaultHash. */
  hash?: HashFn;
}

/** Any good 32-bit string hash. FNV-1a is a fine start. Must return an unsigned int. */
export function defaultHash(key: string): number {
  throw new Error('TODO');
}

export class ConsistentHashRing {
  constructor(options: RingOptions = {}) {
    // TODO: keep vnodes (default 100) and hash (default defaultHash)
  }

  /** Adds `vnodes` points, hashed as `${node}#${i}`. Throws if the node exists. */
  addNode(node: string): void {
    throw new Error('TODO');
  }

  /** Removes all points of the node. Throws if the node is unknown. */
  removeNode(node: string): void {
    throw new Error('TODO');
  }

  hasNode(node: string): boolean {
    throw new Error('TODO');
  }

  /** Physical nodes, sorted by name. */
  nodes(): string[] {
    throw new Error('TODO');
  }

  /** First virtual node clockwise from hash(key) (position >= hash, wrapping). Throws if empty. */
  getNode(key: string): string {
    throw new Error('TODO');
  }

  /** min(n, node count) distinct physical nodes, walking clockwise. First = getNode(key). */
  getNodes(key: string, n: number): string[] {
    throw new Error('TODO');
  }
}
