# 09 · Circuit breaker + retry with backoff and jitter

> Time box: **60 min**
> Concept: [Resilience: timeouts, retries, circuit breakers](../README.md) · Visual: [v13 circuit breaker and retries](../visual.html)

## What it is

Two tools that protect a service when a dependency (a DB, a payment provider, another microservice) is slow or down.

**Circuit breaker.** It wraps calls to the dependency and has three states:

```
          N consecutive failures
 CLOSED ───────────────────────────► OPEN ◄─────────┐
   ▲                                  │             │ trial fails
   │                                  │ timeout     │
   │   successThreshold trial         ▼  passed     │
   └────────── successes ──────── HALF_OPEN ────────┘
```

- **CLOSED**: calls go through. Count consecutive failures.
- **OPEN**: calls fail **at once** with `CircuitOpenError`. The dependency gets time to recover, and your threads are not stuck waiting.
- **HALF_OPEN**: after the timeout, let **one** trial call through. Success closes the circuit. Failure opens it again.

**Retry with exponential backoff and full jitter.** A failed call is tried again after a wait. The wait grows (`base × 2^retry`, up to a cap). **Full jitter** picks a random wait between 0 and that value. Without jitter, thousands of clients retry at the same moment and knock the service over again ("thundering herd").

## Where it is used

- **Netflix Hystrix** (now retired), **resilience4j** (Java), **Polly** (.NET), **opossum** (Node.js).
- **Envoy and Istio**: outlier detection and retry policies in the service mesh.
- **AWS SDKs**: every SDK retries with exponential backoff and jitter by default.
- Payment gateways, notification senders, any call to a third-party API.

## API to implement (`starter.ts`)

```ts
const breaker = new CircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 10_000, successThreshold: 1, clock });
await breaker.call(() => fetchUser(id));   // → result, or throws fn's error, or CircuitOpenError
breaker.state;                             // 'CLOSED' | 'OPEN' | 'HALF_OPEN'

backoffDelay(retry, baseDelayMs, maxDelayMs, random);   // → Math.floor(random() × min(max, base × 2^retry))

await retry((attempt) => callApi(), {
  maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 2000,
  random: Math.random,                     // injected in tests
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),  // injected in tests
  shouldRetry: (err, attempt) => !(err instanceof CircuitOpenError),
});
```

Rules the tests check:

| Rule | Detail |
|---|---|
| CLOSED | Errors from `fn` are rethrown unchanged. A success resets the failure count. |
| Opening | After `failureThreshold` **consecutive** failures. |
| OPEN | Throw `CircuitOpenError`. **Do not call** `fn`. |
| Timeout | `state` is `HALF_OPEN` when `now - openedAt >= resetTimeoutMs`. Check it lazily, no timers. |
| HALF_OPEN | One trial at a time. A second call during a trial gets `CircuitOpenError`. |
| Trial result | Failure → `OPEN` with a new `openedAt`. `successThreshold` successes in a row → `CLOSED`. |
| `backoffDelay` | `retry` starts at 0 (the wait after the first failure). Result is in `[0, ceiling)`, rounded down. |
| `retry` | `fn(attempt)` with attempt `1..maxAttempts`. Sleep only between tries, never after the last. Throw the last error. |
| `shouldRetry` | If it returns false, throw at once, no sleep. |

## Complexity

All operations are `O(1)` time and memory.

## Hints

<details>
<summary>Hint 1: lazy state change</summary>

Do not use `setTimeout` to move from OPEN to HALF_OPEN. Store `openedAt`. In the `state` getter, if the state is OPEN and enough time has passed, switch to HALF_OPEN. Read `state` at the start of `call`.

</details>

<details>
<summary>Hint 2: one trial at a time</summary>

Keep a flag `trialInFlight`. Set it before you call `fn` in HALF_OPEN. Clear it in `finally`. If the flag is set, reject the call with `CircuitOpenError`.

</details>

<details>
<summary>Hint 3: keep the original error</summary>

Use `try { const r = await fn(); onSuccess(); return r; } catch (e) { onFailure(); throw e; }`. The caller must see the real error, not a wrapped one.

</details>

<details>
<summary>Hint 4: the retry loop</summary>

`for (let attempt = 1; ; attempt++)`. In `catch`: if `attempt >= maxAttempts` or `!shouldRetry(err, attempt)`, rethrow. Else `await sleep(backoffDelay(attempt - 1, ...))`.

</details>

## Extensions interviewers ask

1. **Retry + breaker order.** Retry outside the breaker (as in the last test) so an open circuit stops retries at once. Retry inside means each try counts as a separate failure.
2. **Only retry safe things.** Retry a `GET`, a timeout, a 503. Do not retry a 400. Retry a `POST /payments` only with an **idempotency key**.
3. **Retry budget.** Limit retries to about 10% of normal traffic per client. Retries at every layer multiply: 3 layers × 3 tries = 27 calls to the bottom service.
4. **Failure rate instead of a count.** resilience4j opens when, for example, more than 50% of the last 100 calls failed. Use a sliding window.
5. **What do you return when the circuit is open?** A cached value, a default, a "try later" page, or a queued request (fallback).
6. **Timeouts first.** A breaker only helps if each call has a timeout. Without one, a hung call never counts as a failure.

## Related

- [Idempotency and delivery semantics](../../../4-async/H22-delivery-semantics/README.md) · [Microservices](../../H25-microservices/README.md)
- HLD problems: [Payment system](../../../case-studies/08-payment-system/README.md) · [Notification system](../../../case-studies/05-notification-system/README.md)
