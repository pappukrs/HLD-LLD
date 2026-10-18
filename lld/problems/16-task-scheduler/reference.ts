// 16 · Task Scheduler: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

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
    return Math.min(this.maxMs, this.baseMs * 2 ** (attempt - 1));
  }
}

// ---------- Binary min-heap ----------

class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly less: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(a[i], a[parent])) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < a.length && this.less(a[l], a[smallest])) smallest = l;
        if (r < a.length && this.less(a[r], a[smallest])) smallest = r;
        if (smallest === i) break;
        [a[i], a[smallest]] = [a[smallest], a[i]];
        i = smallest;
      }
    }
    return top;
  }
}

// ---------- Scheduler ----------

interface Task {
  readonly id: string;
  readonly handler: TaskHandler;
  readonly priority: number;
  readonly maxRetries: number;
  readonly intervalMs: number | null;
  readonly seq: number; // insertion order, the last tie-breaker
  status: TaskStatus;
  slot: number; // the planned time of the current cycle (retries don't move it)
  nextRunAt: number | null;
  attempts: number;
  runs: number;
}

interface HeapEntry {
  readonly runAt: number;
  readonly id: string;
}

export class Scheduler {
  private readonly tasks = new Map<string, Task>();
  private readonly queue = new MinHeap<HeapEntry>((a, b) => a.runAt < b.runAt);
  private readonly backoff: BackoffStrategy;
  private nextSeq = 0;
  private running = false;

  constructor(config: SchedulerConfig = {}) {
    this.backoff = config.backoff ?? new ExponentialBackoff();
  }

  schedule(input: TaskInput): void {
    if (this.tasks.has(input.id)) throw new Error(`Task ${input.id} already exists`);
    if (!Number.isFinite(input.runAt)) throw new Error('runAt must be a number');
    if (input.intervalMs !== undefined && !(input.intervalMs > 0)) throw new Error('intervalMs must be > 0');
    const maxRetries = input.maxRetries ?? 0;
    if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new Error('maxRetries must be >= 0');

    const task: Task = {
      id: input.id,
      handler: input.handler,
      priority: input.priority ?? 0,
      maxRetries,
      intervalMs: input.intervalMs ?? null,
      seq: this.nextSeq++,
      status: 'SCHEDULED',
      slot: input.runAt,
      nextRunAt: input.runAt,
      attempts: 0,
      runs: 0,
    };
    this.tasks.set(task.id, task);
    this.queue.push({ runAt: input.runAt, id: task.id });
  }

  cancel(id: string): void {
    const task = this.task(id);
    if (task.status !== 'SCHEDULED') throw new Error(`Task ${id} is already ${task.status}`);
    task.status = 'CANCELLED';
    task.nextRunAt = null; // its heap entry becomes stale and is skipped on pop
  }

  /**
   * Runs every task due at `now`, one at a time, in priority order.
   * A task rescheduled during this call (retry or next cycle) waits for the next call.
   */
  async runDue(now: number): Promise<RunReport[]> {
    if (this.running) throw new Error('runDue is already running');
    this.running = true;
    try {
      const due = this.takeDue(now);
      const reports: RunReport[] = [];
      for (const task of due) reports.push(await this.execute(task, now));
      return reports;
    } finally {
      this.running = false;
    }
  }

  get(id: string): TaskInfo {
    const t = this.task(id);
    return { id: t.id, status: t.status, nextRunAt: t.nextRunAt, attempts: t.attempts, runs: t.runs };
  }

  private takeDue(now: number): Task[] {
    const due: Task[] = [];
    while (this.queue.size > 0 && this.queue.peek()!.runAt <= now) {
      const entry = this.queue.pop()!;
      const task = this.tasks.get(entry.id)!;
      // Skip stale entries (cancelled, or moved to another time).
      if (task.status === 'SCHEDULED' && task.nextRunAt === entry.runAt) due.push(task);
    }
    return due.sort((a, b) => b.priority - a.priority || a.nextRunAt! - b.nextRunAt! || a.seq - b.seq);
  }

  private async execute(task: Task, now: number): Promise<RunReport> {
    const attempt = task.attempts + 1;
    try {
      await task.handler();
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      task.attempts = attempt;
      if (task.attempts <= task.maxRetries) {
        this.reschedule(task, now + this.backoff.delay(task.attempts));
        return { taskId: task.id, outcome: 'RETRY_SCHEDULED', attempt, error };
      }
      this.finishCycle(task, now, 'FAILED');
      return { taskId: task.id, outcome: 'FAILED', attempt, error };
    }
    task.runs++;
    this.finishCycle(task, now, 'SUCCEEDED');
    return { taskId: task.id, outcome: 'SUCCEEDED', attempt };
  }

  // One-off tasks end here. Recurring tasks move to the next slot after `now`; missed slots are skipped.
  private finishCycle(task: Task, now: number, result: 'SUCCEEDED' | 'FAILED'): void {
    task.attempts = 0;
    if (task.intervalMs === null) {
      task.status = result;
      task.nextRunAt = null;
      return;
    }
    const missed = Math.floor((now - task.slot) / task.intervalMs) + 1;
    task.slot += Math.max(1, missed) * task.intervalMs;
    this.reschedule(task, task.slot);
  }

  private reschedule(task: Task, at: number): void {
    task.nextRunAt = at;
    this.queue.push({ runAt: at, id: task.id });
  }

  private task(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Unknown task ${id}`);
    return task;
  }
}
