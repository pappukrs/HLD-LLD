// 04 · Snowflake ID generator: reference solution.
// Read this only after your own attempt passes.
//
// Layout of a 64-bit id (the top sign bit is always 0):
//   | 1 unused | 41 bits: ms since epoch | 10 bits: worker id | 12 bits: sequence |

export const TIMESTAMP_BITS = 41n;
export const WORKER_BITS = 10n;
export const SEQUENCE_BITS = 12n;

export const MAX_WORKER_ID = Number((1n << WORKER_BITS) - 1n); // 1023
export const MAX_SEQUENCE = Number((1n << SEQUENCE_BITS) - 1n); // 4095
const MAX_TIMESTAMP = (1n << TIMESTAMP_BITS) - 1n; // about 69.7 years of ms

/** 2024-01-01T00:00:00.000Z. A recent epoch keeps ids small and gives ~69 years. */
export const DEFAULT_EPOCH = 1_704_067_200_000;

export interface SnowflakeOptions {
  /** 0 .. 1023. Must be unique per running generator. */
  workerId: number;
  /** Custom epoch in Unix ms. Default DEFAULT_EPOCH. */
  epoch?: number;
  /** Returns Unix time in ms. Default Date.now. */
  clock?: () => number;
}

export interface SnowflakeParts {
  /** Unix time in ms (epoch already added back). */
  timestamp: number;
  workerId: number;
  sequence: number;
}

export class ClockMovedBackwardsError extends Error {
  constructor(readonly lastMs: number, readonly nowMs: number) {
    super(`Clock moved backwards: last=${lastMs}, now=${nowMs}. Refusing to generate ids.`);
    this.name = 'ClockMovedBackwardsError';
  }
}

export class Snowflake {
  private readonly workerId: bigint;
  private readonly epoch: number;
  private readonly clock: () => number;
  private lastMs = -1;
  private sequence = 0;

  constructor(options: SnowflakeOptions) {
    const { workerId } = options;
    if (!Number.isInteger(workerId) || workerId < 0 || workerId > MAX_WORKER_ID) {
      throw new Error(`workerId must be an integer in 0..${MAX_WORKER_ID}`);
    }
    this.workerId = BigInt(workerId);
    this.epoch = options.epoch ?? DEFAULT_EPOCH;
    this.clock = options.clock ?? Date.now;
  }

  nextId(): bigint {
    let now = this.clock();
    if (now < this.lastMs) throw new ClockMovedBackwardsError(this.lastMs, now);

    if (now === this.lastMs) {
      this.sequence = (this.sequence + 1) & MAX_SEQUENCE;
      if (this.sequence === 0) {
        // 4096 ids in this ms already. Spin until the clock moves to the next ms.
        while (now <= this.lastMs) {
          now = this.clock();
          if (now < this.lastMs) throw new ClockMovedBackwardsError(this.lastMs, now);
        }
      }
    } else {
      this.sequence = 0;
    }

    const elapsed = BigInt(now - this.epoch);
    if (elapsed < 0n) throw new Error('Clock is before the epoch');
    if (elapsed > MAX_TIMESTAMP) throw new Error('Timestamp does not fit in 41 bits; the epoch is too old');
    this.lastMs = now;

    return (
      (elapsed << (WORKER_BITS + SEQUENCE_BITS)) |
      (this.workerId << SEQUENCE_BITS) |
      BigInt(this.sequence)
    );
  }
}

/** Splits an id back into its parts. Useful for debugging ("when was this created?"). */
export function parseSnowflake(id: bigint, epoch: number = DEFAULT_EPOCH): SnowflakeParts {
  const sequence = Number(id & BigInt(MAX_SEQUENCE));
  const workerId = Number((id >> SEQUENCE_BITS) & BigInt(MAX_WORKER_ID));
  const elapsed = Number(id >> (WORKER_BITS + SEQUENCE_BITS));
  return { timestamp: elapsed + epoch, workerId, sequence };
}
