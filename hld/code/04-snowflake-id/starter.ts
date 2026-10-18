// 04 · Snowflake ID generator: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run hld/code/04-snowflake-id
//
// Layout of a 64-bit id (the top sign bit is always 0):
//   | 1 unused | 41 bits: ms since epoch | 10 bits: worker id | 12 bits: sequence |

export const TIMESTAMP_BITS = 41n;
export const WORKER_BITS = 10n;
export const SEQUENCE_BITS = 12n;

export const MAX_WORKER_ID = 1023;
export const MAX_SEQUENCE = 4095;

/** 2024-01-01T00:00:00.000Z */
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
    super(`Clock moved backwards: last=${lastMs}, now=${nowMs}`);
    this.name = 'ClockMovedBackwardsError';
  }
}

export class Snowflake {
  /** Throws if workerId is not an integer in 0..1023. */
  constructor(options: SnowflakeOptions) {
    // TODO
  }

  /**
   * Same ms as last time: sequence + 1. After 4095, wait (call clock() again) until the next ms.
   * New ms: sequence = 0. Clock earlier than last time: throw ClockMovedBackwardsError.
   */
  nextId(): bigint {
    throw new Error('TODO');
  }
}

export function parseSnowflake(id: bigint, epoch: number = DEFAULT_EPOCH): SnowflakeParts {
  throw new Error('TODO');
}
