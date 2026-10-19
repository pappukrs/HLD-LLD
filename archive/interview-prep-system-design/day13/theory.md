# SD Day 13 — Rate Limiting Algorithms (Token Bucket, Sliding Window)

*(~1 hr · first topic of the **building-blocks** block. Days 1–12 were "how to stay correct and scale";
rate limiting is "how to protect that system from being hammered" — by abusive clients, buggy retry
loops, scrapers, or a thundering herd. You already run Nginx and gateway limits in prod; today names
the algorithms so you can pick one and defend the trade-off in an interview. Pairs naturally with
Day 3 caching (Redis is where distributed limits live) and Day 12 idempotency (both tame retries).)*

---

## 1. Why rate-limit at all (the problem)

Without limits, a single client — malicious or just buggy — can swamp your service: a retry storm,
a scraper, credential-stuffing, or a free-tier user abusing an expensive endpoint. Rate limiting
**caps how many requests a caller may make in a time window**, rejecting the excess (usually HTTP
**429 Too Many Requests**). It buys you:

- **Protection** — one bad actor can't starve everyone else (a crude DoS defence).
- **Fairness** — shared capacity split across tenants/users.
- **Cost control** — expensive endpoints (search, AI, SMS) can't be drained.
- **Stability** — back-pressure instead of cascading overload.

> **One line:** *Rate limiting is a bouncer at the door — it counts who's coming in and turns away
> the excess so the room never overflows.*

The two questions every algorithm answers: **what counts as "too much"**, and **how smoothly** it
handles a sudden burst.

---

## 2. The five algorithms (know all five, master two)

### a) Fixed window counter
Count requests per fixed clock window (e.g. "100 per minute, reset at the top of each minute").

```
12:00:00 ──────────── 12:00:59   counter = 0..100, reject above
12:01:00 ──────────── 12:01:59   counter resets to 0
```

- ✅ Dead simple, one counter (`INCR` in Redis), tiny memory.
- ❌ **The boundary burst bug:** 100 requests at 12:00:59 **and** 100 at 12:01:00 = **200 in one
  second**, yet neither window exceeded 100. Bursts at the seam slip through at 2× the intended rate.

### b) Sliding window log
Store a **timestamp for every request**. To decide, count timestamps in the last 60s (drop older).

- ✅ **Perfectly accurate** — no boundary bug, true rolling window.
- ❌ **Memory-heavy** — stores every request timestamp per user (a Redis sorted set per key). At high
  QPS that's expensive. Use only when exactness matters more than cost.

### c) Sliding window counter (the practical favourite)
A hybrid that fixes the boundary bug **cheaply** by **weighting the previous window**:

```
estimate = current_window_count
         + previous_window_count × (overlap fraction of the previous window still in view)
```

Example: limit 100/min. 40% into the current minute → 60% of the previous window is still "in view".
Previous window had 80, current has 30 → `30 + 80×0.6 = 78` < 100 → allow. It smooths the seam with
**two counters**, not a full log. **This is what most production limiters actually use.**

### d) Token bucket (the interview default — learn this cold)
A bucket holds up to **N tokens**; tokens **refill at a steady rate** (e.g. 10/sec). Each request
**takes one token**; **no token → reject**. The bucket size **N** is the **burst allowance**.

```
        refill 10 tokens/sec
              │
         ┌────▼────┐  capacity N = 20 (max burst)
         │ tokens  │
         └────┬────┘
   request ───┤  take 1 → allow ;  empty → 429
```

- ✅ **Allows controlled bursts** (spend the whole bucket at once) while bounding the **average** rate
  to the refill rate. Matches real traffic, which is bursty. Cheap: store `(tokens, last_refill_ts)`.
- This is how AWS API Gateway, Stripe, and most cloud APIs shape traffic. **Default answer in an
  interview unless the question demands perfect smoothness.**

### e) Leaky bucket (token bucket's mirror)
A queue that **drains (leaks) at a fixed rate**; incoming requests join the queue; if the queue is
full, drop. **Output is perfectly smooth/constant** — no bursts ever leave.

- ✅ Smooth, steady outflow — good when a **downstream** needs a constant rate (e.g. don't exceed a
  third-party API's hard cap).
- ❌ Adds **latency** (requests wait in the queue) and bursts get queued/dropped, not served fast.

> **Token bucket vs leaky bucket in one line:** *token bucket allows bursts up to the bucket size;
> leaky bucket forbids bursts and emits a perfectly steady stream.*

---

## 3. Quick comparison

| Algorithm | Burst handling | Accuracy | Memory | Use when |
|---|---|---|---|---|
| Fixed window | Bursts at seam (2×) | Low | Tiny | Crude, simplest case |
| Sliding window log | No bursts | Exact | High | Exactness > cost |
| Sliding window counter | Smoothed | Good (approx) | Low | **General-purpose API limiting** |
| Token bucket | **Allows bursts ≤ N** | Good | Low | **Default; bursty real traffic** |
| Leaky bucket | **No bursts (smooths)** | Good | Low | Protect a fixed-rate downstream |

**Interview move:** name token bucket as the default, mention sliding-window-counter as the cheap
accurate alternative, and reach for leaky bucket only when downstream needs constant outflow.

---

## 4. Distributed rate limiting (the part that's actually hard)

A single in-memory counter works for **one** server. With a fleet behind a load balancer, each
instance only sees its slice — 10 servers × "100/min each" = the user actually gets 1000/min. The
limit must be **shared state**. Standard answer: **Redis**.

- Store the counter/tokens in Redis, keyed by `user:endpoint` (or `ip:endpoint`).
- **Atomicity matters:** a naive `GET` then `INCR` race lets two requests both pass. Use atomic ops —
  `INCR` (+ `EXPIRE` for the window), or a **Lua script** that reads-checks-writes in one round trip
  (the standard token-bucket-in-Redis trick). Redis is single-threaded, so a Lua script runs without
  interleaving.
- **Trade-offs:** every request now does a network hop to Redis → latency + Redis becomes a hot
  dependency (and a SPOF — needs HA). High-scale systems soften this with a **local token bucket per
  node synced periodically to Redis** (approximate but fast), accepting slight over-limit for speed.

> The senior nuance: perfect global accuracy and low latency trade against each other. Most systems
> pick **"approximately correct and fast"** over **"exact and slow."**

---

## 5. Where it lives + what to return

- **Where:** at the **edge / API gateway / load balancer** is ideal — reject early, before the request
  costs you real work (Nginx `limit_req`, AWS API Gateway, Kong, Cloudflare all do this). Can also be
  a middleware in the app or a dedicated limiter service.
- **Response:** HTTP **429 Too Many Requests**, plus a **`Retry-After`** header telling the client when
  to try again, and ideally `X-RateLimit-Limit / -Remaining / -Reset` headers so well-behaved clients
  self-throttle. Pair this with **client-side exponential backoff + jitter** so rejected clients don't
  retry in lockstep and create a new spike.

---

## 6. Map it to YOUR systems (interview gold)

- **Fintech APIs / payment endpoints:** per-client (per API key) **token bucket** at the gateway —
  bursts allowed for legit batch traffic, average capped; protects expensive charge/ledger calls and
  blunts credential-stuffing on auth. Ties to Day 12: limiting + idempotency together tame retry storms.
- **10k+ IoT devices:** classic per-device limiting so one misbehaving/firmware-looping device can't
  flood your ingest. A token bucket per device id, counters in Redis, is the textbook fit.
- **Webhooks / notifications:** **leaky bucket** when you must not exceed a third-party provider's hard
  send rate (SMS/email/push gateways) — smooth, constant outflow downstream.
- **Nginx in prod:** you already run `limit_req` (leaky-bucket-based) — now you can name the algorithm
  and contrast it with token bucket.

> The interview line: *"I default to **token bucket** — it caps the average rate but allows bursts up
> to the bucket size, which matches real bursty traffic, and it's cheap to store. For accuracy without
> the boundary-burst bug of fixed windows, **sliding-window-counter** is the practical pick. I make it
> **distributed** by keeping the counter in **Redis** with an **atomic Lua script** so concurrent
> requests can't race past the limit, return **429 with `Retry-After`**, and tell clients to back off
> with jitter. If a downstream has a hard cap, I switch to **leaky bucket** for smooth outflow."*

---

## 7. The traps that catch people

1. **Forgetting it's distributed.** Per-instance counters silently multiply the limit by the fleet
   size. Interviewers probe this immediately — say "shared counter in Redis."
2. **The race condition.** `GET`-then-`set` isn't atomic; two requests both read "under limit" and both
   pass. Use atomic `INCR` / Lua. This is the single most common follow-up.
3. **Fixed window's boundary burst.** If you propose fixed window, you must volunteer the 2×-at-the-seam
   flaw — otherwise it looks like you don't know it.
4. **Confusing token vs leaky bucket.** Token = bursts allowed (refill into a bucket you draw from);
   leaky = bursts smoothed (a queue draining at fixed rate). Mixing these up is a classic stumble.
5. **No `Retry-After` / no client backoff.** Rejecting without telling clients when to retry just
   produces a retry storm — the thing you were trying to prevent.
6. **Redis as an unguarded SPOF.** A global limiter that hard-fails when Redis is down can take your
   whole API down. Decide fail-open (allow on Redis outage) vs fail-closed and say why.

---

## 8. The whole day on one page (say it out loud)

> *"Rate limiting caps how many requests a caller makes per window and returns 429 on excess — it
> protects against abuse, ensures fairness, and controls cost. Five algorithms: **fixed window**
> (simplest but bursts at the seam to 2×), **sliding window log** (exact but stores every timestamp,
> memory-heavy), **sliding window counter** (cheap + accurate by weighting the previous window — the
> practical general choice), **token bucket** (refilling bucket; take a token per request; allows
> bursts up to bucket size while capping the average — my default), and **leaky bucket** (a queue
> draining at a fixed rate; perfectly smooth outflow, good for protecting a fixed-rate downstream).
> Token bucket allows bursts; leaky bucket forbids them. The hard part is **distributed**: per-instance
> counters multiply the limit by fleet size, so I keep the counter in **Redis** and make the
> check-and-decrement **atomic** with a Lua script to kill the race. I enforce at the **gateway/edge**,
> return **429 + Retry-After**, and have clients **back off with jitter**."*

**Why it matters next:** rate limiting is a building block you'll reuse in nearly every mock design
(it's literally Design #1 — the rate limiter — in Part B). Next up in the building-blocks block:
**API design (REST vs gRPC vs GraphQL)**, then **consistent hashing** — the latter being how a
distributed Redis limiter spreads its keys across nodes.
