// 05 · Base62 encoding and an ID-range allocator: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run hld/code/05-base62-shortener

/** Digits, then lowercase, then uppercase. The index of a character is its value. */
export const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Non-negative safe integer → base62 string. encode(0) === '0'. Throws otherwise. */
export function encode(n: number): string {
  throw new Error('TODO');
}

/** Base62 string → number. Throws on an empty string, a bad character, or a value above MAX_SAFE_INTEGER. */
export function decode(s: string): number {
  throw new Error('TODO');
}

/** The shared counter that hands out blocks of ids (Redis INCRBY, a DB row, ZooKeeper). */
export interface RangeCoordinator {
  /** Atomically reserve `size` ids. Resolves to the first id of the block. */
  reserve(size: number): Promise<number>;
}

export class IdRangeAllocator {
  /** Throws if blockSize is not a positive integer. */
  constructor(coordinator: RangeCoordinator, blockSize: number) {
    // TODO
  }

  /**
   * Next unique id. Lease a new block only when the current one is used up.
   * Many concurrent calls on an empty block must share ONE lease.
   * If the lease fails, reject; a later call tries again.
   */
  async nextId(): Promise<number> {
    throw new Error('TODO');
  }

  /** encode(await nextId()) */
  async nextCode(): Promise<string> {
    throw new Error('TODO');
  }

  /** How many blocks this allocator has leased so far. */
  get leaseCount(): number {
    throw new Error('TODO');
  }
}
