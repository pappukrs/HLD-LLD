# 04 · Rate Limiter

> Asked at: Razorpay, Juspay, PhonePe, Atlassian, Uber, Amazon. Very common in fintech, because every payment API is rate limited.
> Time box: **60 min** (10 min design, 40 min code, 10 min tests and extensions)
> Patterns you should reach for: **Strategy** (the algorithm), **Factory** (config → algorithm instance)

## Your v1 attempt: what to fix

Your first attempt is in [`v1-attempt.js`](./v1-attempt.js). The structure (strategy classes + a factory + a context class) is a good start. These are the issues an interviewer will find:

1. **The tier is tied to the algorithm.** `case "free": return new TokenBucket(...)` and `case "premium": return new FixedWindow(...)`. The tier should only choose the numbers (limit, window, refill rate). The algorithm should come from `config.type`. Now you cannot give free users a fixed window, and a new tier like `enterprise` needs a code change instead of a config change.
2. **One limiter per user, not per key.** `/login` and `/search` share one budget. Real limiters key on `(user or IP or API key, route)`. Login and OTP routes usually need much stricter limits than read routes.
3. **Users must be registered first.** `allow()` throws for an unknown user. A limiter should create the state lazily on the first request.
4. **No cleanup.** `userLimiters` grows forever. With millions of IPs this is a memory leak. Track `lastSeen` and remove idle keys.
5. **`Date.now()` is called inside the classes.** You cannot test refill or window reset without real sleeps. Inject a clock.
6. **The fixed window has an off-by-one and is not aligned.** `now - windowStart > windowMillis` keeps a request at exactly `windowStart + windowMillis` in the old window. The window also starts when the object is created. Align windows to the clock: `Math.floor(now / windowMs) * windowMs`.
7. **The boundary burst is not discussed.** A fixed window lets `2 × limit` requests through in a few ms around a window boundary. You should say this, and name a fix: sliding window log or sliding window counter.
8. **The "concurrency" test is not concurrent.** `await Promise.resolve()` then a synchronous `allow()` runs on one JS thread. Two calls can never interleave inside `allowRequest()`. The real race is between **server instances** that share a counter in Redis: two servers read `count = 9`, both write `10`, and both allow the request.
9. **No distributed story.** With more than one server, the state must live in Redis (or similar) and each check must be atomic. See Step 5.
10. **It returns only a boolean.** An API needs `remaining` and `retryAfterMs` for the `X-RateLimit-Remaining` and `Retry-After` headers on a 429.
11. **Base class with `throw` instead of an interface.** In TypeScript, use `interface RateLimitAlgorithm`. The compiler then checks every implementation.

## Problem statement (as the interviewer says it)

"Design a rate limiter for our API. Free users get a small limit, premium users get a bigger one.
It should support more than one algorithm, for example token bucket and fixed window.
Some routes, like OTP, need their own stricter limit. Return enough information to build a 429 response."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| What is the key? | `(tier, userId, route)`. Route defaults to `'*'`. Tier is in the key, so an upgraded user starts fresh on the new config |
| What does a tier decide? | Only the rule (algorithm type + numbers). Any tier can use any algorithm |
| Which algorithms? | Token bucket, fixed window, sliding window log. Others must plug in without changes |
| Token bucket details? | Starts full. Refills continuously (`refillPerSecond`, fractions allowed). Never above capacity |
| Fixed window details? | Windows aligned to the clock: `[0, w)`, `[w, 2w)`, ... |
| Per-route limits? | `routeRules[route][tier]` overrides `rules[tier]` |
| Unknown tier? | Throw |
| Bad config (limit 0, negative window)? | Throw in the constructor, not on the first request |
| What does a check return? | `{ allowed, remaining, retryAfterMs }` |
| Idle keys? | `cleanup()` removes keys not seen for `idleTtlMs` (default 10 min) |
| Multiple servers? | Out of scope for the code. Explain the Redis design (Step 5) |

## Step 2: public API (what the tests call)

```ts
const limiter = new RateLimiter({
  rules: {
    free:    { type: 'TOKEN_BUCKET', capacity: 10, refillPerSecond: 1 },
    premium: { type: 'TOKEN_BUCKET', capacity: 100, refillPerSecond: 20 },
    beta:    () => new MyAlgorithm(),          // a factory works too
  },
  routeRules: { '/otp': { free: { type: 'SLIDING_WINDOW_LOG', limit: 3, windowMs: 60_000 } } },
  clock: () => Date.now(),                     // injectable, so tests control time
  idleTtlMs: 10 * 60_000,
});

limiter.allow({ userId: 'u1', tier: 'free', route: '/otp' }); // → { allowed, remaining, retryAfterMs }
limiter.cleanup();                                             // → number of keys removed
limiter.trackedKeys;                                           // → number

// The algorithms are exported too, and tested directly:
new TokenBucket(capacity, refillPerSecond).tryAcquire(now);
new FixedWindow(limit, windowMs).tryAcquire(now);
new SlidingWindowLog(limit, windowMs).tryAcquire(now);
```

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `RateLimitAlgorithm` (interface): `tryAcquire(now): Decision`. One instance holds the state of **one key**
- `TokenBucket`, `FixedWindow`, `SlidingWindowLog`: the strategies. Each takes `now` as an argument, so they are pure and easy to test
- `createAlgorithm(config)`: the factory. A `switch` on `config.type` with a `never` check, so TypeScript fails if you forget a case
- `RateLimiter`: the context. Maps a request to a key, creates the algorithm lazily, tracks `lastSeen`, cleans up
- Config types: a discriminated union `AlgorithmConfig`, plus `AlgorithmFactory` for custom algorithms

Two separate questions, two separate places:
- "Which numbers does this user get?" → the tier → `rules`
- "How are those numbers enforced?" → `config.type` → the factory

| Algorithm | Memory per key | Bursts | Boundary problem |
|---|---|---|---|
| Token bucket | O(1) | Allows up to `capacity` | No |
| Fixed window | O(1) | Up to `2 × limit` around a boundary | Yes |
| Sliding window log | O(limit) | No | No |
| Sliding window counter | O(1) | Approximate | Mostly fixed |

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/04-rate-limiter` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 60 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Many servers behind a load balancer.** In-memory state does not work: each server sees only part of the traffic. Keep the state in Redis, and make each check atomic:
   - Fixed window: `INCR rl:{key}:{windowStart}`, and set `EXPIRE` when the result is 1. Run both in a Lua script or `MULTI`, so a crash cannot leave a key without a TTL.
   - Token bucket: store `tokens` and `lastRefill` in a hash. Read, refill and write in **one Lua script**. Redis runs a script atomically, so two servers cannot both take the last token.
   - Sliding window log: a sorted set per key. `ZREMRANGEBYSCORE` old entries, `ZCARD`, then `ZADD`, all in one script.
2. **Redis is down.** Fail open (allow traffic) or fail closed (reject)? For a public read API, usually fail open. For OTP or login, fail closed is safer. Say which and why.
3. **Sliding window counter.** Keep counts for the current and previous window. Estimate: `prev × (overlap fraction) + current`. O(1) memory and no big boundary burst.
4. **Redis round trip on every request is too slow.** Keep a local token bucket per server with a share of the global limit, and sync with Redis in the background. You trade accuracy for latency.
5. **Where does the limiter run?** At the API gateway for coarse per-IP limits, in the service for per-user and per-merchant business limits.
6. **Cleanup without a full scan.** Run `cleanup()` on a timer, or in Redis just rely on key TTLs.

## Self-check before you call it done

- [ ] The tier never decides the algorithm. Adding a tier is a config change only.
- [ ] Each algorithm takes `now` as an argument. No `Date.now()` inside.
- [ ] A new algorithm plugs in with no change to `RateLimiter` (Open/Closed).
- [ ] You can explain the fixed-window boundary burst with numbers.
- [ ] You can explain the multi-server race and why a Lua script fixes it.

## Concepts used

- [Strategy](../../4-behavioral/L20-strategy/README.md) · [Factory](../../2-creational/L09-factory-method/README.md) · [Concurrency and race conditions in Node](../../5-machine-coding/L32-concurrency-in-node/README.md) · [SOLID](../../1-foundations/L04-solid-srp-ocp/README.md)
- HLD links: [Rate limiting](../../../hld/5-reliability/H26-rate-limiting/README.md) · [Distributed Rate Limiter](../../../hld/case-studies/02-rate-limiter) · [Rate limiter algorithms (code)](../../../hld/5-reliability/H26-rate-limiting/lab-rate-limiters)
- Visuals: [Rate limiting algorithms](../../../hld/5-reliability/H26-rate-limiting/visual.html) · [Strategy + Factory](../../4-behavioral/L20-strategy/visual.html)
