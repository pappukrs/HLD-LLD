# 16 · Task Scheduler

> Asked at: Atlassian, Uber, Razorpay, Flipkart, Rippling, and backend-heavy machine-coding rounds.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **Priority queue** (min-heap on run time), **Strategy** (retry backoff)

## Problem statement (as the interviewer says it)

"Build a task scheduler. Clients schedule tasks to run at a given time. Some tasks run once, some repeat every N milliseconds.
Tasks have a priority. If a task fails, retry it with backoff, up to a limit. Tasks can be cancelled."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| How does time work? | No real timers. The caller passes the time: `runDue(now)`. A loop or `setInterval` can call it in production |
| What is "due"? | `nextRunAt <= now` |
| Order among due tasks? | Priority **high first**, then earlier `nextRunAt`, then insertion order |
| Parallel or one at a time? | One at a time. Each handler is awaited before the next starts |
| A task's handler throws or rejects? | That is a failure. Other tasks still run |
| Retries? | `maxRetries` extra attempts (default 0). Retry `n` waits `backoff.delay(n)` from `now` |
| Default backoff? | Exponential: `min(60000, 1000 × 2^(n-1))` → 1000, 2000, 4000 … |
| Can a task run twice in one `runDue` call? | No. A retry or next cycle waits for the next call, even if it is already due |
| Recurring tasks? | `intervalMs` from the planned slot (fixed rate). Missed slots are **skipped**, not caught up |
| Recurring task runs out of retries? | Report `FAILED` for this cycle, reset attempts, and move to its next slot |
| Cancel? | Only a `SCHEDULED` task. Cancel of an unknown or finished task throws |
| Duplicate id, `intervalMs <= 0`, `maxRetries < 0`? | Throw |
| Timeouts, parallel workers, persistence, cron syntax? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const s = new Scheduler({ backoff: new ExponentialBackoff(1000, 60_000) });   // optional

s.schedule({ id: 'email-42', runAt: 1000, handler: async () => sendEmail(), priority: 5, maxRetries: 3 });
s.schedule({ id: 'daily-report', runAt: 0, intervalMs: 86_400_000, handler: buildReport });

await s.runDue(1000);   // → RunReport[] { taskId, outcome: 'SUCCEEDED' | 'RETRY_SCHEDULED' | 'FAILED', attempt, error? }
s.get('email-42');      // → TaskInfo { id, status, nextRunAt, attempts, runs }
s.cancel('daily-report');
```

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `Scheduler`: the facade. Owns the task map and the priority queue, and runs due tasks
- `Task` (internal): id, handler, priority, maxRetries, intervalMs, status, `slot` (the planned time of this cycle), `nextRunAt` (slot or retry time), attempts, runs, `seq` (insertion order)
- `MinHeap<HeapEntry>`: ordered by `runAt`. `peek` is O(1), `push`/`pop` are O(log n). Finding due tasks never scans all tasks
- `BackoffStrategy` (interface) → `ExponentialBackoff`. Later: linear, exponential with jitter
- `RunReport`: what happened to each task in this call. Good for logs and for tests

Two ideas make the code simple:

1. **Lazy deletion.** `cancel` doesn't search the heap. It marks the task. When a heap entry pops, skip it if the task is no longer `SCHEDULED` or its `nextRunAt` doesn't match the entry.
2. **Pop first, then run.** Pop all due entries into a list, sort that list by priority, then run it. A task re-added during the run goes into the heap and waits for the next call. No infinite loops with a 0 ms retry.

Why not a heap keyed on priority? Because "is it due?" depends on time. Key the heap on time; sort the small due batch by priority.

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/16-task-scheduler` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Jitter.** Many tasks failing at the same moment retry at the same moment (thundering herd). Add random jitter to the delay. Inject the random function so tests stay deterministic.
2. **Run N tasks in parallel.** Replace the `for … await` with a small worker pool (a semaphore with N permits). Priority now means "starts first", not "finishes first".
3. **Timeouts.** Race the handler against a timer. Note: a JS promise can't be killed; pass an `AbortSignal` so the handler can stop itself.
4. **Survive a restart.** Store tasks in a DB with `next_run_at` and an index on it. Workers claim rows with `SELECT … FOR UPDATE SKIP LOCKED` (Postgres, MySQL 8) so two workers don't run the same task.
5. **At-least-once.** A worker can crash after the task ran but before it saved "done". The task runs again. Handlers must be idempotent.
6. **Cron expressions.** Make "next slot" a strategy: `FixedRate`, `FixedDelay` (interval after the run ends), `Cron`.

## Self-check before you call it done

- [ ] No `setTimeout`, no `Date.now()`. Time only comes from `runDue(now)`.
- [ ] Finding due tasks is O(k log n), not O(n).
- [ ] A cancelled task never runs, even though its heap entry is still there.
- [ ] A failure in one handler is caught and reported; it never stops the loop.
- [ ] A recurring task that was paused for a long time runs once, not once per missed slot.

## Concepts used

- [Strategy](../../concepts/patterns/p10-strategy.md) · [Command](../../concepts/patterns/p13-command.md) (a task is a command object) · [Concurrency in Node LLD](../../concepts/06-concurrency-in-node.md)
- HLD link: [Distributed Job Scheduler](../../../hld/problems/24-job-scheduler/) · [Resilience: retries and backoff](../../../hld/concepts/24-resilience-patterns.md)
- Visuals: [Circuit breaker and retries](../../../visuals/v13-circuit-breaker.html) · [Node.js event loop](../../../visuals/v30-node-event-loop.html)
