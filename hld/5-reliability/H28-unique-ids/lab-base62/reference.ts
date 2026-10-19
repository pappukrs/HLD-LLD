// 05 · Base62 encoding and an ID-range allocator: reference solution.
// Read this only after your own attempt passes.

/** Digits, then lowercase, then uppercase. The index of a character is its value. */
export const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = ALPHABET.length; // 62

const VALUE_OF = new Map<string, number>([...ALPHABET].map((ch, i) => [ch, i]));

/** Non-negative safe integer → base62 string. encode(0) === '0'. */
export function encode(n: number): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('encode expects a non-negative safe integer');
  if (n === 0) return ALPHABET[0];
  let out = '';
  while (n > 0) {
    out = ALPHABET[n % BASE] + out;
    n = Math.floor(n / BASE);
  }
  return out;
}

/** Base62 string → number. Throws on an empty string, a bad character, or overflow. */
export function decode(s: string): number {
  if (s.length === 0) throw new Error('decode expects a non-empty string');
  let n = 0;
  for (const ch of s) {
    const v = VALUE_OF.get(ch);
    if (v === undefined) throw new Error(`Invalid base62 character: ${ch}`);
    n = n * BASE + v;
    if (n > Number.MAX_SAFE_INTEGER) throw new Error('Value is larger than Number.MAX_SAFE_INTEGER');
  }
  return n;
}

/**
 * The shared counter that hands out blocks of ids.
 * In production: Redis INCRBY, a DB row updated in a transaction, or a ZooKeeper/etcd node.
 */
export interface RangeCoordinator {
  /** Atomically reserve `size` ids. Resolves to the first id of the block. */
  reserve(size: number): Promise<number>;
}

/**
 * Hands out unique ids from a leased block [start, start + blockSize).
 * Only talks to the coordinator once per block, so most calls are local and fast.
 */
export class IdRangeAllocator {
  private next = 0;
  private end = 0; // exclusive; next >= end means "no ids left"
  private leasing: Promise<void> | null = null;
  private leases = 0;

  constructor(private readonly coordinator: RangeCoordinator, private readonly blockSize: number) {
    if (!Number.isSafeInteger(blockSize) || blockSize < 1) throw new Error('blockSize must be a positive integer');
  }

  async nextId(): Promise<number> {
    while (this.next >= this.end) {
      // Many callers may arrive while the block is empty. Only one of them leases;
      // the others wait on the same promise. Without this, a burst would lease many blocks.
      this.leasing ??= this.lease().finally(() => {
        this.leasing = null;
      });
      await this.leasing;
    }
    return this.next++;
  }

  /** A short code for a new URL: base62 of the next id. */
  async nextCode(): Promise<string> {
    return encode(await this.nextId());
  }

  /** How many blocks this allocator has leased so far. */
  get leaseCount(): number {
    return this.leases;
  }

  private async lease(): Promise<void> {
    const start = await this.coordinator.reserve(this.blockSize);
    this.next = start;
    this.end = start + this.blockSize;
    this.leases++;
  }
}
