// 16 · Task Scheduler: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/16-task-scheduler

export type TaskStatus = 'SCHEDULED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type TaskHandler = () => void | Promise<void>;
export type RunOutcome = 'SUCCEEDED' | 'RETRY_SCHEDULED' | 'FAILED';

export interface TaskInput {
  id: string;
  /** First run time (ms). */
  runAt: number;
  handler: TaskHandler;
  /** Higher runs first among due tasks. Default 0. */
  priority?: number;
  /** Extra attempts after the first failure. Default 0. */
  maxRetries?: number;
  /** Set for a recurring task. */
  intervalMs?: number;
}

export interface TaskInfo {
  readonly id: string;
  readonly status: TaskStatus;
  /** null when the task will not run again. */
  readonly nextRunAt: number | null;
  /** Failed attempts in the current cycle. */
  readonly attempts: number;
  /** Successful runs so far. */
  readonly runs: number;
}

export interface RunReport {
  readonly taskId: string;
  readonly outcome: RunOutcome;
  /** 1 for the first try of a cycle, 2 for the first retry, ... */
  readonly attempt: number;
  readonly error?: string;
}

export interface BackoffStrategy {
  /** Delay before retry number `attempt` (1 = first retry). */
  delay(attempt: number): number;
}

export interface SchedulerConfig {
  backoff?: BackoffStrategy;
}

export class ExponentialBackoff implements BackoffStrategy {
  constructor(
    private readonly baseMs = 1000,
    private readonly maxMs = 60_000,
  ) {}

  delay(attempt: number): number {
    throw new Error('TODO: min(maxMs, baseMs * 2^(attempt - 1))');
  }
}

export class Scheduler {
  constructor(config: SchedulerConfig = {}) {
    // TODO: keep the backoff; set up the task map and a priority queue (min-heap on run time)
  }

  schedule(input: TaskInput): void {
    throw new Error('TODO');
  }

  cancel(id: string): void {
    throw new Error('TODO');
  }

  /**
   * Runs every task due at `now`, one at a time, in priority order.
   * A task rescheduled during this call (retry or next cycle) waits for the next call.
   */
  async runDue(now: number): Promise<RunReport[]> {
    throw new Error('TODO');
  }

  get(id: string): TaskInfo {
    throw new Error('TODO');
  }
}
