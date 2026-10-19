# H27 · Resilience: timeouts, retries, circuit breakers, bulkheads

> **Time:** ~50 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/5-reliability/H27-resilience/demo.ts`) · **Lab:** [lab-circuit-breaker](lab-circuit-breaker/README.md)
> **Builds on:** [H25 Microservices](../H25-microservices/README.md) · [H22 Delivery semantics and idempotency](../../4-async/H22-delivery-semantics/README.md) · [H26 Rate limiting](../H26-rate-limiting/README.md) · **Used in:** [Payment system](../../case-studies/08-payment-system/README.md), [Food delivery](../../case-studies/11-food-delivery/README.md), [Ride hailing](../../case-studies/10-ride-hailing/README.md), [Notification system](../../case-studies/05-notification-system/README.md), [Digital wallet](../../case-studies/28-digital-wallet/README.md)

## The idea in one line

Assume every remote call can be slow or fail: give it a deadline, retry only safe calls with backoff and jitter, stop calling a dependency that is clearly down, and isolate resources so one bad dependency cannot sink the whole service.

## Why it matters (the problem it solves)

A bank API starts taking 30 s instead of 300 ms. Your Node service has no timeout. Requests pile up in memory, sockets and DB connections stay open, the event loop slows down, health checks fail, Kubernetes restarts pods, and now checkout is down for **every** payment method, not just that bank. This is a **cascading failure**.

Retrying blindly makes it worse. Every client now sends 3× the traffic to a service that is already struggling, and when it comes back, all the retries hit it at the same second (a **thundering herd**).

In a microservice system with 5 hops, a slow leaf is the most common way the whole site goes down. Interviewers expect you to name the protection on every sync call you draw.

## How it works

### The toolbox at a glance

```
           ┌─────────────────────── Service A (caller) ───────────────────────┐
request ──►│ deadline ─► bulkhead (max 50 in flight) ─► circuit breaker ─► retry │──► timeout ──► Service B
           │                 │ full: reject fast         │ open: fallback    (jitter)          │
           └─────────────────┴───────────────────────────┴──────────────────────────────────────┘
```

| Pattern | Protects against | One-line rule |
|---|---|---|
| Timeout / deadline | Slow calls holding resources | Every remote call has one, set near the callee's p99 |
| Retry + backoff + jitter | Short, transient blips | Only idempotent calls, max 2–3, randomised delay |
| Circuit breaker | A dependency that is down for a while | Stop calling it, fail fast, probe later |
| Bulkhead | One dependency eating all threads/sockets | Separate, capped pool per dependency |
| Fallback | A user-facing error when a degraded answer is fine | Cached data, default, other provider, "pending" |
| Load shedding | The server itself being overloaded | Reject early with 503; drop low-priority work first |

### 1. Timeouts and deadlines

- Every outbound call gets a timeout. In Node: `fetch(url, { signal: AbortSignal.timeout(800) })`, or the client library's option. Many HTTP clients default to **no timeout**.
- Set it from the callee's latency: a bit above its **p99**, not its average. p99 = 400 ms → timeout ~600–800 ms.
- Separate a short **connect timeout** (~100–300 ms) from the **request timeout**.
- **Propagate a deadline**: if the user request has 1.2 s left, a downstream call must not wait 5 s. gRPC carries deadlines natively; for HTTP pass a header such as `x-deadline-ms`. Each hop computes `timeout = min(own timeout, deadline − now)`.

### 2. Retries with exponential backoff and full jitter

```
delay(attempt) = random(0, min(cap, base × 2^attempt))      # "full jitter" (AWS)
attempt 1: 0–200 ms   attempt 2: 0–400 ms   attempt 3: 0–800 ms
```

- Retry only **transient** errors: timeouts, connection resets, 502/503/504, 429 (after `Retry-After`).
- Never retry 400/401/403/404/422. They fail again, and a card decline retried may trip fraud checks.
- Retry only **idempotent** operations, or send an **idempotency key** ([H22](../../4-async/H22-delivery-semantics/README.md)).
- Cap attempts (2–3) and use a **retry budget**: retries may be at most ~10% of normal traffic per client.
- Retry at **one layer**. Gateway, A and B each doing 3 attempts turns one failing call into 3 × 3 × 3 = **27** calls on the bottom service.

```
gateway (3 tries) ─► A (3 tries each) ─► B (3 tries each) ─► DB
     3            ×        3          ×        3          = 27 calls for 1 user click
```

### 3. Circuit breaker

```
                failure rate ≥ 50% over ≥ 20 calls
   ┌────────┐ ───────────────────────────────────► ┌──────┐
   │ CLOSED │                                      │ OPEN │◄──────────┐
   └────────┘ ◄──── trial calls succeed ──┐        └──────┘           │ a trial fails
        ▲                                 │           │ after 30 s     │
        │                            ┌───────────┐    │ cool-down      │
        └────────────────────────────│ HALF-OPEN │◄───┘                │
                                     └───────────┘ ────────────────────┘
```

- **Closed**: calls pass; the breaker counts results in a rolling window (last 20 calls or last 10 s).
- **Open**: fail fast with no network call (≈1 ms instead of a 2 s timeout). The fallback runs. The dependency gets room to recover; your pool stays free.
- **Half-open**: after the cool-down, let 1–5 trial calls through. Success closes it; a failure opens it again.
- Trip on a **rate with a minimum call count**, not a raw count: 2 failures out of 3 calls at 3 a.m. should not open it.
- One breaker **per dependency** (per bank, per PSP, per host), never one for everything.
- Put the **retry inside the breaker**, so retried failures count toward the rate and an open breaker stops retries too.

### 4. Bulkheads

Ships have watertight compartments so one hole does not sink the ship. Give each dependency its own capped pool: max concurrent calls, own connection pool, own queue.

```
Shared pool (100 sockets)                     Bulkheads
┌─────────────────────────────┐               ┌────────────┐┌────────────┐┌────────────┐
│ bank A A A A A A A A A A A A│ ← all stuck   │ bank A: 40 ││ bank B: 40 ││ SMS: 20    │
└─────────────────────────────┘               │ A A A A ...││ B B . . .  ││ s . . .    │
bank B call: no socket → fails                └────────────┘└────────────┘└────────────┘
                                              only bank A's 40 fill up; B and SMS keep working
```

In Node there are no thread pools to split, but the same idea applies: a **semaphore per downstream** (`p-limit`, `cockatiel` bulkhead), a separate `http.Agent` with `maxSockets` per host, and a separate DB pool for slow reports.

### 5. Fallbacks and graceful degradation

- Recommendations down → show popular items from cache.
- One PSP's breaker is open → route new payments to the next PSP.
- Pricing service slow → last cached price with a short TTL, if the business allows it.
- **Payments: a fallback is never "assume success".** It is "mark PENDING, check status later, reconcile".

### 6. Load shedding, backpressure, health checks

- When the server is near saturation, reject early (`503`) instead of queueing forever. Drop analytics before checkout. A request that waited 10 s in a queue is worthless anyway.
- Bounded queues give **backpressure**: when full, callers slow down.
- **Liveness** = "is the process stuck?" Keep it trivial; never check the DB, or a DB blip restarts every pod at once.
- **Readiness** = "should I get traffic now?" May include warm-up and critical dependencies.
- **Hedged requests**: for idempotent reads, send a second copy if the first has not answered by p95. Cuts tail latency for ~5% extra load (Google, "The Tail at Scale").

## In TypeScript

```ts
type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

class CircuitBreaker {
  private state: State = 'CLOSED';
  private results: boolean[] = [];     // rolling window, true = success
  private openedAt = 0;
  constructor(private window = 20, private minCalls = 10, private failRate = 0.5, private coolMs = 30_000) {}

  async call<T>(fn: () => Promise<T>, fallback: () => T, now = Date.now()): Promise<T> {
    if (this.state === 'OPEN') {
      if (now - this.openedAt < this.coolMs) return fallback();   // fail fast
      this.state = 'HALF_OPEN';                                   // let one trial through
    }
    try {
      const v = await fn();
      this.record(true, now);
      return v;
    } catch {
      this.record(false, now);
      return fallback();
    }
  }
  private record(ok: boolean, now: number) {
    if (this.state === 'HALF_OPEN') { this.state = ok ? 'CLOSED' : 'OPEN'; this.results = []; this.openedAt = now; return; }
    this.results = [...this.results, ok].slice(-this.window);
    const fails = this.results.filter((r) => !r).length;
    if (this.results.length >= this.minCalls && fails / this.results.length >= this.failRate) {
      this.state = 'OPEN'; this.openedAt = now;
    }
  }
}

const backoff = (attempt: number, base = 100, cap = 2000) => Math.random() * Math.min(cap, base * 2 ** attempt);
```

[demo.ts](demo.ts) simulates 100 clients retrying with fixed delay, backoff and jitter, the 27× amplification, a breaker tripping and recovering, and a bulkhead.

## Trade-offs / when NOT to use it

| Pattern | Use when | Weakness |
|---|---|---|
| Timeout | Always | Too short: false failures; too long: resource pile-up |
| Retry + backoff + jitter | Transient errors on idempotent calls | Amplifies load if layered or unbounded |
| Circuit breaker | A dependency can be down for minutes | Tuning; may reject healthy calls during half-open |
| Bulkhead | Several dependencies share one process | Reserved capacity sits idle |
| Fallback | A degraded answer is acceptable | Hides failures if you do not alert on fallback rate |
| Hedged requests | Read-only calls where tail latency matters | Extra load; never for writes |
| Load shedding | Server near saturation | Some users get errors by design |

Do not retry non-idempotent writes without a key. Do not add a breaker around an in-process call or a dependency with no fallback and no recovery benefit (it only adds states to debug). Do not stack retries in the SDK, the service code and the service mesh at once.

## Common mistakes

- No timeout at all, or the library default (sometimes infinite or 2 minutes).
- Exponential backoff **without** jitter: clients still retry in lockstep.
- Retrying a `400` or a non-idempotent `POST /charge`.
- Retrying at every layer (27×), with no retry budget.
- One global breaker for all downstreams, so one bad bank blocks every bank.
- Liveness probe that checks the DB → restart storm during a DB blip.
- Treating a payment timeout as a failure and charging again. It is **unknown**: mark pending and query status.
- Never alerting on breaker state or fallback rate, so degradation goes unnoticed for days.

## Say this in the interview

> "Every call to a bank or PSP has a timeout just above its p99, and a deadline that comes from the user request, so we never wait longer than the user will. Retries happen in one layer only: at most 2, exponential backoff with full jitter, and only for idempotent calls that carry our payment reference as the idempotency key."

> "Each PSP has its own circuit breaker and its own connection pool, which is the bulkhead. If one bank hangs, only its 40 sockets fill up. When a breaker opens, the router sends new payments to the next PSP. A timed-out payment is marked pending and resolved by a status check, never retried as a new charge."

## Your experience hook

- **Payment orchestration across 3 providers** (SenseGrass): you already had retry strategies and webhook handling. Frame it as: idempotency key per intent, retry only on timeouts and 5xx, per-provider breaker, failover to the next adapter, and "timeout = unknown, reconcile later".
- **Video SFU** (Signaling ↔ Media over gRPC): gRPC deadlines propagate across hops; a dead Mediasoup worker should be ejected (breaker/outlier detection) instead of every join timing out.
- **IoT platform, 10k devices**: Redis queue + batching is backpressure. When devices reconnect after an outage, jittered reconnect delays stop all 10k sockets from hitting Nginx in the same second.

## Numbers to remember

- 3 layers × 3 attempts = **27×** load on the bottom service.
- Availability of 5 sync dependencies at 99.9% each ≈ **99.5%** without isolation.
- Timeout ≈ callee p99 + margin (p99 400 ms → 600–800 ms, not 30 s).
- Breaker: open at **≥50% failures over ≥20 calls**; cool-down **10–30 s**; 1–5 trial calls.
- Retry budget: retries ≤ **~10%** of normal traffic.
- Fail fast from an open breaker: **~1 ms** vs a 2 s timeout.

## Self-test

<details><summary>1. Why is a timeout alone not enough?</summary>

With a 2 s timeout, every call to a dead service still holds a socket or slot for 2 s. Under load the pool fills and the caller fails too. The breaker turns those 2 s waits into instant failures, and the bulkhead caps how many can be stuck at once.
</details>

<details><summary>2. Why add jitter to exponential backoff?</summary>

Without it, all clients that failed at the same moment retry at the same moments (1 s, 2 s, 4 s), hitting the server in synchronised waves. Jitter spreads them out so load stays near capacity.
</details>

<details><summary>3. A PSP returns 400 "invalid card". Retry?</summary>

No. It is a permanent client error. Retrying adds load and can trigger fraud rules. Retry only timeouts, connection errors, 502/503/504 and 429.
</details>

<details><summary>4. Retry and circuit breaker: which wraps which?</summary>

The breaker wraps the retry loop's individual attempts, so each failed attempt counts toward the failure rate, and once the breaker opens, the remaining retries fail fast instead of hitting the dead service.
</details>

<details><summary>5. Why should a liveness probe not check the database?</summary>

A short DB outage would fail liveness on every pod, and Kubernetes would restart all of them at once. That adds a restart storm and cold caches to the DB problem. Put dependency checks in readiness.
</details>

<details><summary>6. A charge call to the bank times out. What do you do?</summary>

Do not charge again. The result is unknown: the bank may have debited. Mark the payment PENDING, query the bank's status API (with the same reference), or wait for the webhook, and let reconciliation settle it.
</details>

<details><summary>7. Timeout vs deadline?</summary>

A timeout is per call ("wait 500 ms"). A deadline is per user request across all hops ("must finish by 12:00:01.200"). Each hop sets its own timeout from the time left, so deep calls never outlive the user's patience.
</details>

## Go deeper

- Lab: [lab-circuit-breaker](lab-circuit-breaker/README.md) (breaker states + retry with backoff and jitter, with tests)
- Case studies: [Payment system](../../case-studies/08-payment-system/README.md), [Notification system](../../case-studies/05-notification-system/README.md)
- Related: [H25 Microservices](../H25-microservices/README.md), [H30 Observability](../H30-observability/README.md) (alert on breaker state and fallback rate)
- Archive notes: [hld-parts/part4.md](../../../archive/notes/hld-parts/part4.md) ("Module 4.1: Reliability Patterns": circuit breaker, retry with jitter, bulkhead, timeouts, graceful degradation)
- AWS Builders' Library: "Timeouts, retries, and backoff with jitter"; Michael Nygard, *Release It!* (stability patterns); Google SRE book, "Addressing Cascading Failures"
