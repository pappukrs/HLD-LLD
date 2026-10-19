# SD Day 13 — Quiz: Rate Limiting Algorithms

*Answer each OUT LOUD, in your own words, before expanding. If you fumble, re-read that section.
Target: explain token vs leaky bucket (Q4) and the distributed race condition (Q6) cold — those are
the two follow-ups every interviewer asks.*

---

**Q1. Why rate-limit, and what does the server return when a caller exceeds the limit?**

<details><summary>answer</summary>

To stop one client (abusive or buggy) from swamping the system — giving **protection** against abuse/DoS,
**fairness** across tenants, **cost control** on expensive endpoints, and **stability** (back-pressure
instead of cascading overload). On excess the server returns **HTTP 429 Too Many Requests**, ideally
with a **`Retry-After`** header (and `X-RateLimit-*` headers) so clients know when to retry.
</details>

---

**Q2. What's the boundary-burst bug in the fixed-window counter?**

<details><summary>answer</summary>

A fixed window counts per clock window and resets at the boundary. A client can send the full limit at
the **end** of one window and the full limit at the **start** of the next — e.g. 100 at 12:00:59 and
100 at 12:01:00 = **200 requests in ~1 second**, even though neither minute exceeded 100. So bursts at
the seam slip through at up to **2×** the intended rate.
</details>

---

**Q3. Sliding window log vs sliding window counter — what's the trade-off?**

<details><summary>answer</summary>

- **Log:** store a timestamp for every request, count those in the last window. **Perfectly accurate**,
  no boundary bug, but **memory-heavy** (every request's timestamp per user).
- **Counter:** keep just two counters (current + previous window) and weight the previous window by the
  overlap fraction still in view. **Cheap and approximately accurate** — fixes the boundary bug without
  storing every request. The counter is the **practical general-purpose** choice.
</details>

---

**Q4. Explain token bucket vs leaky bucket and when you'd pick each.**

<details><summary>answer</summary>

- **Token bucket:** a bucket of up to N tokens **refills at a steady rate**; each request takes a token,
  empty → reject. Caps the **average** rate but **allows bursts up to N** (the bucket size). Matches
  bursty real traffic; cheap to store `(tokens, last_refill)`. **Default choice.**
- **Leaky bucket:** a queue **drains at a fixed rate**; requests join, full → drop. Output is
  **perfectly smooth** — no bursts ever leave, but it adds latency.

Pick **token bucket** for general API limiting (bursts are fine); pick **leaky bucket** when a
**downstream needs a constant rate** (e.g. a third-party SMS/email API with a hard cap).
</details>

---

**Q5. Why does in-memory rate limiting break across a fleet of servers?**

<details><summary>answer</summary>

Each instance only sees its own traffic. With a per-instance limit of "100/min" across 10 servers
behind a load balancer, a user spread across them actually gets up to **1000/min**. The limit must be
**shared state** — typically a counter/token bucket in **Redis** keyed by `user:endpoint`.
</details>

---

**Q6. What's the race condition in distributed limiting, and how do you fix it?**

<details><summary>answer</summary>

A naive **read-then-write** (`GET` count → check → `INCR`) lets two concurrent requests both read
"under limit" and both pass, exceeding the cap. Fix with **atomic** operations: `INCR`+`EXPIRE`, or a
**Lua script** in Redis that does read-check-decrement in one round trip. Redis is single-threaded, so
the Lua script runs without interleaving — no race.
</details>

---

**Q7. What's the trade-off of putting the counter in Redis, and how do high-scale systems soften it?**

<details><summary>answer</summary>

Every request now makes a **network hop** to Redis (latency) and Redis becomes a **hot dependency /
SPOF** that needs HA. High-scale systems use a **local token bucket per node, synced periodically to
Redis** — fast and mostly accurate, accepting slight over-limit for lower latency. The general lesson:
**"approximately correct + fast" usually beats "exact + slow."** Also decide **fail-open vs
fail-closed** if Redis is down.
</details>

---

**Q8. Where should rate limiting live, and what should the client do on a 429?**

<details><summary>answer</summary>

At the **edge / API gateway / load balancer** (Nginx `limit_req`, AWS API Gateway, Kong, Cloudflare) —
reject early, before the request costs real work. The client should read **`Retry-After`** and retry
with **exponential backoff + jitter**, so rejected clients don't all retry in lockstep and create a new
spike.
</details>

---

**Q9. Map it to your systems: where would you use token bucket vs leaky bucket?**

<details><summary>answer</summary>

- **Token bucket:** per-API-key limiting at the gateway for **fintech/payment** endpoints (allow legit
  bursts, cap average, blunt credential-stuffing); per-device limiting for **10k+ IoT devices** so one
  looping device can't flood ingest.
- **Leaky bucket:** **webhook/notification** delivery to a third-party SMS/email/push gateway with a
  hard send rate — smooth, constant outflow downstream.
- You already run **Nginx `limit_req`** (leaky-bucket-based) in prod — now you can name it.
</details>

---

**Q10 (interview close). In 30 seconds: how do you design a distributed rate limiter?**

<details><summary>answer</summary>

"I default to a **token bucket** — caps the average rate but allows bursts up to the bucket size, which
fits real bursty traffic and is cheap to store. For accuracy without fixed-window's boundary burst, I'd
use **sliding-window-counter**. I make it **distributed** with the counter in **Redis**, keyed by
user+endpoint, using an **atomic Lua script** so concurrent requests can't race past the limit. I
enforce at the **gateway**, return **429 with `Retry-After`**, and have clients **back off with
jitter**. If a downstream has a hard rate cap, I switch to a **leaky bucket** for smooth outflow."
</details>

---

> Next (building blocks): **API design — REST vs gRPC vs GraphQL trade-offs, versioning, pagination**,
> then **consistent hashing** (how a distributed limiter spreads its Redis keys across nodes). After the
> building-blocks block come the full mock designs — where **"design a rate limiter" is literally
> Design #1**, so today's algorithms are about to get reused immediately.
