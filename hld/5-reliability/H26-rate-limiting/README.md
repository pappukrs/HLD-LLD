# H26 · Rate limiting algorithms

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/5-reliability/H26-rate-limiting/demo.ts`) · **Lab:** [lab-rate-limiters](lab-rate-limiters/README.md)
> **Builds on:** [H06 Proxies and API gateway](../../1-basics/H06-proxies-api-gateway/README.md) · [H09 Caching](../../2-scaling/H09-caching/README.md) (Redis) · **Used in:** [Distributed rate limiter](../../case-studies/02-rate-limiter/README.md), [Payment system](../../case-studies/08-payment-system/README.md), [Notification system](../../case-studies/05-notification-system/README.md), [Web crawler](../../case-studies/13-web-crawler/README.md), LLD [Rate limiter](../../../lld/problems/04-rate-limiter/README.md)

## The idea in one line

Count requests per key (user, API key, IP) over time, and reject or delay the ones over the limit, so one client cannot hurt everyone else or the backend.

## Why it matters (the problem it solves)

- A buggy merchant script loops and sends 5,000 requests per second. With no limit it fills your thread pools and DB connections, and every other merchant sees timeouts.
- An attacker brute-forces a 6-digit OTP. 1M combinations is nothing at 10k requests per second.
- A downstream (a bank, an SMS vendor) allows only 100 TPS. Go over and you get blocked or billed extra.
- Paid plans need quotas: "free tier = 100 requests per minute, pro = 5,000".

Rate limiting is **fairness per client**. It is the first line of defence in almost every HLD answer, and "design a rate limiter" is a top-5 interview question on its own.

## How it works

### The five algorithms

| Algorithm | Rule | Bursts | State per key | Accuracy |
|---|---|---|---|---|
| **Token bucket** | Bucket of capacity `B` refills at `r` tokens/s. A request takes 1 token or is rejected | Up to `B` at once, then `r`/s | 2 numbers: tokens, last refill | Good |
| **Leaky bucket** | Requests join a queue of size `Q` that drains at a fixed rate | Queued; output is smooth | Queue (or a level + time) | Good, adds delay |
| **Fixed window counter** | `INCR user:minute`; reject over `N` | Up to **2N** across a window edge | 1 counter | Weak at edges |
| **Sliding window log** | Store each request timestamp; count the ones in the last window | Never over limit | 1 entry per request | Exact |
| **Sliding window counter** | Weight the previous window by how much of it still overlaps | Smoothed | 2 counters | Close (assumes even spread) |

### Token bucket, computed lazily

No background timer refills the bucket. You compute the refill when a request arrives:

```
tokens   = min(capacity, tokens + (now - lastRefill) * ratePerSec)
lastRefill = now
if tokens >= 1: tokens -= 1, allow   else: reject, Retry-After = (1 - tokens) / ratePerSec
```

Two knobs: **capacity** = the biggest burst you accept, **rate** = the long-term average. Stripe and AWS API Gateway both use this shape ("rate" and "burst" settings).

### The fixed window edge problem

```
limit 100 per minute

         window 12:00                window 12:01
 |-------------------------|-------------------------|
                      100 req ^ 100 req
                     12:00:59 | 12:01:00
                     200 requests in ~1 second, both windows say "fine"
```

### Sliding window counter: the formula

```
estimate = prev_count × (1 − elapsed_in_current / window) + current_count
allow if estimate + 1 <= limit
```

Example: limit 100/min. Previous minute had 80, current minute has 30, we are 15 s in. Estimate = 80 × 0.75 + 30 = 90, so allow. Cloudflare measured this approximation wrongly allowing or blocking only about 0.003% of requests.

### Making it distributed

With 20 gateway pods, a counter in each pod's memory allows 20× the limit. Put the state in **Redis**, and make check-and-update **atomic**.

```
 client ──► gateway pod 1 ─┐
 client ──► gateway pod 2 ─┼──► Redis Cluster  (key rl:{apiKey}, one Lua script per check)
 client ──► gateway pod N ─┘        │
                                    └─ shard by limiter key: one key lives on one node
```

The race when you do GET → compute in Node → SET:

```
pod A: GET rl:k42 → 99          pod B: GET rl:k42 → 99
pod A: 99 < 100 → allow         pod B: 99 < 100 → allow
pod A: SET 100                  pod B: SET 100        → 101 requests passed, counter says 100
```

Fixes:
- Fixed window: `INCR` returns the new value atomically. Add `EXPIRE` on the first hit (in `MULTI` or Lua).
- Token bucket or sliding window: a **Lua script** (`EVAL`) that reads, computes and writes. Redis runs a script without interleaving other commands.
- Use Redis server time (`TIME`) or pass one clock, so pods with skewed clocks do not refill differently.

**Latency budget:** one Redis round trip (~0.5–1 ms in-region) per request. For very hot paths, a **local + global hybrid**: each pod keeps a local bucket and syncs to Redis every 100–500 ms. A little accuracy for no network hop.

**If Redis is down:** fail **open** (allow) for normal APIs, so a limiter outage is not a full outage. Fail **closed** for abuse-sensitive endpoints (login, OTP, money movement).

### Where to put it, and what to return

```
Client ─► Edge / WAF ─────► API gateway ──────────► Service ─────► Outbound limiter
          per-IP, DDoS      per API key / user         │           per bank / SMS vendor
                            per plan quota             └ concurrency limit (in-flight cap)
```

- Return `429 Too Many Requests` with `Retry-After`. Also `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (an IETF draft standardises `RateLimit` headers).
- Key by API key or user id. Key by IP only at the edge: NAT and mobile carriers put thousands of users behind one IP.
- Stack limits: per second (bursts) **and** per day (quota). Different limits per endpoint (`POST /payments` stricter than `GET /status`).
- Keep rules in config (DB or etcd), cached in the gateway and refreshed every few seconds, so limits change without a deploy.

**Rate limiting vs load shedding:** rate limiting is per client and fair. Load shedding drops low-priority traffic when the **server** is overloaded, whoever sent it. Stripe runs both. See [H27](../H27-resilience/README.md).

## In TypeScript

```ts
class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(private capacity: number, private ratePerSec: number, now: number) {
    this.tokens = capacity;
    this.last = now;
  }
  tryTake(now: number): { ok: boolean; retryAfterMs: number } {
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.ratePerSec);
    this.last = now;
    if (this.tokens >= 1) { this.tokens -= 1; return { ok: true, retryAfterMs: 0 }; }
    return { ok: false, retryAfterMs: Math.ceil(((1 - this.tokens) / this.ratePerSec) * 1000) };
  }
}
```

The same logic as a Redis Lua script (what you would ship):

```lua
-- KEYS[1]=bucket key  ARGV: capacity, ratePerSec, nowMs
local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(b[1]) or tonumber(ARGV[1])
local ts = tonumber(b[2]) or tonumber(ARGV[3])
tokens = math.min(tonumber(ARGV[1]), tokens + (tonumber(ARGV[3]) - ts) / 1000 * tonumber(ARGV[2]))
local ok = tokens >= 1
if ok then tokens = tokens - 1 end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', ARGV[3])
redis.call('PEXPIRE', KEYS[1], 60000)
return ok and 1 or 0
```

[demo.ts](demo.ts) runs all five algorithms on the same traffic and shows the Redis race.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Token bucket | Public APIs that should allow short bursts (page load fires 10 calls) | Two knobs to tune |
| Leaky bucket (queue) | A downstream needs a steady rate (SMS vendor, bank TPS) | Adds queueing delay; queue can fill |
| Fixed window | Daily or monthly quotas, where edge bursts do not matter | 2× burst at the edge |
| Sliding window log | Low volume, must be exact ("5 OTPs per hour") | Memory grows with requests |
| Sliding window counter | High volume, near-exact | Approximate |
| Local in-memory only | One instance, or rough per-pod protection | Real limit = limit × pods |
| Central Redis | Accurate global limits | Extra hop; Redis must be HA |

Do not use a rate limiter as your only overload defence. It does not protect you when 1M legitimate users each stay under their limit. You still need autoscaling, load shedding and timeouts.

## Common mistakes

- Keeping counters in pod memory behind a load balancer and calling it a "global limit".
- GET then SET from application code instead of one atomic `INCR` or Lua script.
- Keying logged-in traffic by IP (one office NAT = one key for 2,000 users).
- Forgetting `Retry-After`, so clients retry instantly and make it worse.
- One limit for everything. Login, OTP and payment creation need their own, much stricter limits.
- Not saying what happens when Redis is down (fail open or fail closed, per endpoint).
- Rate limiting only inbound. Outbound calls to a bank with a 100 TPS cap need a limiter too.

## Say this in the interview

> "I'll rate-limit at the API gateway with a token bucket per API key: for example 100 requests per second with a burst of 200. The state lives in Redis Cluster, sharded by the key, and each check is one Lua script, so read-refill-decrement is atomic across all gateway pods. Over the limit I return 429 with Retry-After and the X-RateLimit headers."

> "If Redis is unavailable I fail open for normal reads, but fail closed for login, OTP and payment creation. Limits live in a config store so we can change a merchant's plan without a deploy. Outbound, each bank gets a leaky-bucket queue matched to its TPS cap."

## Your experience hook

- You built the **Express API gateway** (SenseGrass / node-microservices) that did JWT auth, routing, LRU caching **and rate limiting** in front of auth, order and payment services. Say which algorithm, which key, and what you would move to Redis + Lua at 10×.
- In payment orchestration across 3 providers, each provider had its own TPS limit and retry rules. That is the **outbound** limiter story: per-provider leaky bucket, plus `429` handling with backoff.

## Numbers to remember

- Fixed window worst case: **2×** the limit in a short span around the boundary.
- Memory: 10M active keys × ~50 bytes (key + 2 numbers) ≈ **500 MB** in Redis.
- Redis does ~100k simple ops/s per core; one Lua check per request, so one shard serves tens of thousands of checks per second.
- One Redis round trip in-region: **~0.5–1 ms** added to each request.
- Cloudflare's sliding window counter error: about **0.003%** of requests.
- OTP: 6 digits = 1M values. Limit to 3–5 attempts per OTP and a few OTPs per hour per number.

## Self-test

<details><summary>1. Limit 100/min with a fixed window. How can a client send 200 in about one second?</summary>

100 at 00:59.5 and 100 at 01:00.1. Each batch lands in a different window, so both pass.
</details>

<details><summary>2. Token bucket, capacity 10, refill 1/s, empty at t=0. How many requests can pass at t=5?</summary>

5. Five seconds refilled five tokens. At t=20 it would be 10, not 20, because the capacity caps it.
</details>

<details><summary>3. Why must the Redis check-and-update be one Lua script?</summary>

Otherwise two gateway pods read the same value, both decide "allowed", and both write. Redis runs a script atomically, so no other command runs in between.
</details>

<details><summary>4. Token bucket or leaky bucket for calls to an SMS vendor that allows 50 TPS?</summary>

Leaky bucket (a queue drained at 50/s). The vendor needs a steady rate and SMS can wait a second. For user-facing APIs a token bucket is better, because users should not wait in a queue.
</details>

<details><summary>5. Previous window 80, current 30, 15 s into a 60 s window, limit 100. Sliding window counter: allow?</summary>

80 × (1 − 15/60) + 30 = 60 + 30 = 90. 90 + 1 ≤ 100, so allow.
</details>

<details><summary>6. Your users are in 3 regions. Is the limit global?</summary>

Usually per region is enough: give each region a share of the limit, or sync counters across regions asynchronously and accept a small overshoot. A strict global limit needs a cross-region round trip on every request, which costs 50–150 ms.
</details>

<details><summary>7. Why is a sliding window log in a Redis ZSET expensive at scale?</summary>

It stores one member per request. 1,000 requests per minute per key × 1M keys = 1 billion entries, and each check runs `ZREMRANGEBYSCORE` + `ZCARD`. Use it only for low-volume, high-value limits.
</details>

## Go deeper

- Lab: [lab-rate-limiters](lab-rate-limiters/README.md) (token bucket, sliding log, sliding counter behind one interface, with tests)
- Case study: [Distributed rate limiter](../../case-studies/02-rate-limiter/README.md); LLD version: [lld/problems/04-rate-limiter](../../../lld/problems/04-rate-limiter/README.md)
- Next: [H27 Resilience](../H27-resilience/README.md) (load shedding, retries that respect 429)
- Archive notes: [hld-parts/part6b.md](../../../archive/notes/hld-parts/part6b.md) ("Rate Limiter - Token Bucket & Variants"), [hld-parts/part4.md](../../../archive/notes/hld-parts/part4.md) ("Rate Limiting & Throttling")
- Alex Xu, *System Design Interview* Vol. 1, ch. 4; Stripe blog "Scaling your API with rate limiters"; Cloudflare blog "How we built rate limiting capable of scaling to millions of domains"
