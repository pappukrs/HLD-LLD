# 02 · Rate limiter algorithms

> Time box: **60 min**
> Concept: [Rate limiting](../README.md) · Visual: [v09 rate limiting](../visual.html)

## What it is

A rate limiter decides, per client key (user id, API key, IP), whether a request may go through. You build three classic algorithms behind one interface:

| Algorithm | Idea | State per key | Accuracy |
|---|---|---|---|
| Token bucket | A bucket of `capacity` tokens refills at a steady rate. Each request takes one token. | 2 numbers | Allows bursts up to `capacity` |
| Sliding window log | Keep the timestamp of each accepted request. Count the ones inside the last `windowMs`. | Up to `limit` timestamps | Exact |
| Sliding window counter | Keep counts for the current and previous fixed windows. Weight the previous one by overlap. | 3 numbers | Approximate, cheap |

## Where it is used

- **Token bucket**: AWS API Gateway and EC2 API throttling, Stripe API limits, Guava `RateLimiter`.
- **Sliding window log**: low-volume, high-value limits (login attempts, OTP sends) where exactness matters.
- **Sliding window counter**: Cloudflare edge rate limiting, Redis-based limiters with `INCR` + `EXPIRE`.
- In a distributed system the state lives in Redis, and the check-and-update runs as one Lua script so it is atomic.

## API to implement (`starter.ts`)

```ts
type Clock = () => number;                       // ms; tests inject a fake clock
interface RateLimiter { allow(key: string): boolean }

const tb = new TokenBucket({ capacity: 10, refillPerSecond: 5, clock });
tb.allow('user:1');          // → boolean
tb.tokens('user:1');         // → current tokens after refill (does not consume)

const log = new SlidingWindowLog({ limit: 100, windowMs: 60_000, clock });
log.allow('user:1');

const swc = new SlidingWindowCounter({ limit: 100, windowMs: 60_000, clock });
swc.allow('user:1');
swc.estimate('user:1');      // → the weighted count used for the decision
```

Rules the tests check:

| Rule | Detail |
|---|---|
| Per key | Every key has its own state. |
| Token bucket start | A new key starts with a **full** bucket. |
| Token refill | Continuous: `tokens = min(capacity, tokens + elapsedMs × rate / 1000)`. Not in whole-second steps. |
| Log window | The window is `(now - windowMs, now]`. A timestamp `t` leaves when `t <= now - windowMs`. |
| Log content | Only **accepted** requests are logged. Rejected ones do not count. |
| Counter windows | Fixed windows start at `floor(now / windowMs) × windowMs`. |
| Counter estimate | `previous × (windowMs - (now - windowStart)) / windowMs + current` |
| Counter decision | Allow if `estimate + 1 <= limit`, then `current += 1`. |
| Counter gaps | If two or more windows passed, `previous` is 0. |

## Complexity

| Algorithm | Time per `allow` | Memory per key |
|---|---|---|
| Token bucket | `O(1)` | `O(1)` |
| Sliding window log | `O(1)` amortised (each timestamp is removed once) | `O(limit)` |
| Sliding window counter | `O(1)` | `O(1)` |

## Hints

<details>
<summary>Hint 1: no timers</summary>

Do not use `setInterval` to add tokens. Store `lastRefill` and compute the new tokens on each call from `now - lastRefill`. This is "lazy refill". It also works in Redis, where there are no timers.

</details>

<details>
<summary>Hint 2: the log is sorted</summary>

Timestamps are pushed in time order. So old ones are always at the front. Remove from the front while `log[0] <= now - windowMs`. In production, use a ring buffer or a Redis sorted set (`ZREMRANGEBYSCORE` + `ZCARD` + `ZADD`).

</details>

<details>
<summary>Hint 3: rolling the counter windows</summary>

On each call, compute the current `windowStart`. If it moved forward by exactly one window, `previous = current` and `current = 0`. If it moved by more, both become 0.

</details>

<details>
<summary>Hint 4: why the counter can be wrong</summary>

It assumes the previous window's requests were spread evenly. If they all came at the end of that window, the estimate is too low and you let a few extra through. Cloudflare measured this error at about 0.003% of requests on real traffic.

</details>

## Extensions interviewers ask

1. **Distributed limiter.** Many API servers share one Redis. Why must check-and-update be one Lua script? What happens if Redis is down: fail open or fail closed?
2. **Cost per request.** An expensive endpoint takes 5 tokens. Change `allow(key)` to `allow(key, cost)`.
3. **Response headers.** Return `X-RateLimit-Remaining` and `Retry-After`. Which algorithm makes `Retry-After` easy?
4. **Memory.** 10M keys × sliding log of 100 timestamps × 8 bytes = 8 GB. The counter needs about 240 MB. This is why the counter wins at scale.
5. **Fixed window.** Why does it allow up to `2 × limit` at a window boundary?

## Related

- [Rate limiter (LLD)](../../../../lld/problems/04-rate-limiter/README.md) · HLD problem: [Distributed rate limiter](../../../case-studies/02-rate-limiter/README.md)
