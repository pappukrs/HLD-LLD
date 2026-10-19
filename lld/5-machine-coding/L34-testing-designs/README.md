# L34 · Testing your design with Vitest

> **Time:** ~35 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx lld/5-machine-coding/L34-testing-designs/demo.ts`)
> **Builds on:** [L31 Repository and DI](../L31-repository-and-di/README.md) · [L32 Concurrency in Node](../L32-concurrency-in-node/README.md) · [L33 Domain modelling](../L33-domain-modeling/README.md) · **Used in:** every problem in `lld/problems/` ships a `*.test.ts`; good models to read: [BookMyShow](../../problems/13-bookmyshow/README.md), [Parking lot](../../problems/01-parking-lot/README.md), [Notification service](../../problems/05-notification-service/README.md), [Rate limiter](../../problems/04-rate-limiter/README.md)

## The idea in one line

A good design is easy to test: **inject the clock, ids and storage, test only the public API, and assert on behaviour and typed errors**, so a handful of fast tests prove every must-have and survive any internal refactor.

## Why it matters (the problem it solves)

- In a machine-coding round, tests are the most convincing demo: green checks for each must-have, edge case and concurrency case.
- Tests are also a **design check**. If a test needs a running Postgres, real `setTimeout` waits or `vi.mock('../../db')`, the design is too coupled. Hard-to-test code is the smell; the test is the detector.
- Interviewers ask "how would you test this?" in LLD discussions too. A structured answer (unit with fakes, contract tests for repos, a few integration tests) is an SDE-2 signal.

```ts
// Before: untestable, so people skip tests
class RateLimiter {
  private hits = new Map<string, number[]>();
  allow(user: string) {
    const now = Date.now();                       // real clock: you must sleep 60 s to test a window
    const recent = (this.hits.get(user) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= 5) return false;         // why? the caller can't tell
    this.hits.set(user, [...recent, now]);
    return true;
  }
}
```

## How it works

### The test pyramid for LLD

```
          /\        few:   end-to-end through main.ts / HTTP (1–2 in a round)
         /  \
        /----\      some:  contract tests: same suite against InMemoryRepo and PgRepo
       /      \
      /--------\    many:  unit tests on services + entities with fakes and a fixed clock
```

In a 90-minute round you write only the bottom layer, 6–12 tests.

### Rules that make tests cheap

| Rule | Why | How |
|---|---|---|
| Test the **public API**, not private fields | Refactors stay green | `lot.park()` then `lot.availableSpots()`, never `lot['spots']` |
| **Inject time** | No sleeps, no flakiness | `clock: () => now`; or `vi.useFakeTimers()` + `vi.advanceTimersByTime()` |
| **Inject ids** | Stable assertions | `nextId: () => 'T' + ++n` |
| **Fakes over mocks** for storage | Real behaviour, reusable | `InMemoryRepo` (L31), not 6 `vi.fn()` stubs |
| **Spies** for outbound effects | Check "was the SMS sent once?" | `const send = vi.fn(); ... expect(send).toHaveBeenCalledTimes(1)` |
| **Arrange, Act, Assert** | Readable | one `setup()` helper, one action, few expects |
| One behaviour per `it` | Clear failure message | name it as a sentence: "falls back to a bigger spot" |
| Assert on **error class** | Messages change | `expect(() => x()).toThrow(NotFoundError)` |

### Test doubles, plainly

| Double | What it is | Example | Use for |
|---|---|---|---|
| Stub | Returns canned answers | `{ charge: async () => 'txn_1' }` | Inputs your code reads |
| Fake | A working light implementation | `InMemoryWalletRepo` | Storage, queues, caches |
| Spy | Records calls | `vi.fn()` | Outbound effects: notify, publish |
| Mock (strict) | Pre-programmed expectations | `vi.mock('./gateway')` | Rarely; couples tests to internals |

### What to test in a machine-coding problem

1. **Each must-have happy path** (one test each).
2. **Each typed error**: not found, invalid input, conflict, insufficient funds.
3. **Boundaries**: exactly at the limit, empty, zero, the last spot, TTL expiry at `t = ttl` vs `ttl + 1`.
4. **Time-based rules** with the injected clock: holds expire, windows slide, fees round up.
5. **Concurrency**: fire two calls with `Promise.all` and assert only one wins.
6. **Extension point**: a new strategy class works without editing the service.

### Vitest essentials

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';   // or globals: true (this repo)

describe('RateLimiter', () => {
  let now = 0;
  const make = () => new RateLimiter({ limit: 5, windowMs: 60_000, clock: () => now });
  beforeEach(() => { now = 0; });

  it('allows up to the limit, then rejects', () => {
    const rl = make();
    for (let i = 0; i < 5; i++) expect(rl.allow('u1')).toBe(true);
    expect(() => rl.check('u1')).toThrow(RateLimitedError);
  });

  it.each([[59_999, false], [60_000, true]])('at t=%i allowed again: %s', (t, ok) => {
    const rl = make();
    for (let i = 0; i < 5; i++) rl.allow('u1');
    now = t;
    expect(rl.allow('u1')).toBe(ok);
  });
});
```

Async: `await expect(svc.book('A1')).rejects.toThrow(SeatTaken)`. Timers: `vi.useFakeTimers(); vi.advanceTimersByTime(5 * 60_000); vi.useRealTimers()`. Partial match: `toMatchObject({ status: 'HELD' })`.

### Contract tests: one suite, many implementations

```ts
function walletRepoContract(name: string, make: () => WalletRepository) {
  describe(`${name} meets WalletRepository`, () => {
    it('returns copies', async () => { /* ... */ });
    it('rejects a stale version', async () => { /* ... */ });
  });
}
walletRepoContract('InMemory', () => new InMemoryWalletRepository());
walletRepoContract('Postgres', () => new PgWalletRepository(testPool)); // CI only
```

This is how you know the in-memory fake behaves like the real thing (L31).

### How this repo uses it

Every `lld/problems/NN-*/` has `starter.ts`, `reference.ts` and `*.test.ts`. The tests touch only the public API, so your internals are free:

```bash
npx vitest run lld/problems/13-bookmyshow          # your starter.ts
REF=1 npx vitest run lld/problems/13-bookmyshow    # the reference
```

## In TypeScript

**After:** the same rate limiter, now testable, and the tests that prove it (runnable in [demo.ts](demo.ts) with a 30-line `describe/it/expect` so it needs no Vitest):

```ts
class RateLimitedError extends Error { name = 'RateLimitedError'; }
class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly o: { limit: number; windowMs: number; clock: () => number }) {}
  check(user: string) {
    const now = this.o.clock();
    const recent = (this.hits.get(user) ?? []).filter((t) => now - t < this.o.windowMs);
    if (recent.length >= this.o.limit) throw new RateLimitedError(user);
    this.hits.set(user, [...recent, now]);
  }
}

it('resets after the window, using the fake clock', () => {
  let now = 0;
  const rl = new RateLimiter({ limit: 2, windowMs: 1000, clock: () => now });
  rl.check('u'); rl.check('u');
  expect(() => rl.check('u')).toThrow(RateLimitedError);
  now = 1000;                       // no sleep: move time
  expect(() => rl.check('u')).not.toThrow();
});
```

## Trade-offs / when NOT to use it

- **Driver vs tests in a round.** A `main.ts` demo is faster to write. If the interviewer did not ask for tests, write the driver first and add 4–6 tests at the end.
- **Mock-heavy tests** (`vi.mock` on every module) pass while the real wiring is broken, and break on every refactor. Use them only at true process edges.
- **Snapshot tests** are poor for domain logic: they assert everything, so they catch nothing specific.
- **100% coverage** is not the goal. Cover rules, boundaries and errors; skip getters.
- Fake timers and real promises interact in surprising ways; an injected clock function is simpler and works everywhere.

## Common mistakes

- Reading private fields (`svc['map'].size`) in asserts. The first refactor breaks every test.
- `await sleep(1000)` in tests. Slow and flaky. Inject the clock.
- One giant test that checks five behaviours. When it fails, you do not know which.
- Asserting on error **messages** instead of error classes.
- Forgetting `await` on `expect(...).rejects`, so the test passes before the promise settles.
- Sharing state between tests (a module-level `Map`). Build fresh objects in `setup()` or `beforeEach`.
- No test for the concurrency case, then saying "it's safe" without proof.

## Say this in the interview

> "Because the clock, id generator and repositories are injected, I can test the service in milliseconds with an in-memory repo and a fixed clock. I test only the public API, one behaviour per test, and I assert on typed errors like `SeatTakenError`, not on messages."

> "For time rules I move the fake clock: hold at t=0, confirm at t=TTL minus 1 succeeds, at TTL plus 1 it fails. For concurrency I fire two bookings with `Promise.all` and assert exactly one wins."

> "To trust the in-memory fake, I run the same contract test suite against it and against the Postgres repository in CI."

## Your experience hook

- Payment orchestration: provider adapters are the textbook case for stubs (canned gateway responses) plus a spy on the webhook publisher. Say you tested duplicate webhooks by delivering the same event twice and asserting one state change.
- NestJS: `Test.createTestingModule(...).overrideProvider(TOKEN).useValue(fake)` is the framework version of passing fakes to a constructor.

## Self-test

<details><summary>1. A test needs <code>await sleep(60_000)</code> to check a rate-limit window. What is wrong and how do you fix it?</summary>

The class reads the real clock. Inject `clock: () => number` (or use `vi.useFakeTimers()`), then set `now = 60_000` in the test. The design, not the test, was the problem.
</details>

<details><summary>2. Fake, stub, spy, mock: which for the wallet repository, the payment gateway, and the SMS sender?</summary>

Repository: a fake (in-memory implementation). Gateway: a stub returning canned results (success, decline, timeout). SMS sender: a spy, to assert it was called once with the right args.
</details>

<details><summary>3. Why should tests touch only the public API?</summary>

So you can refactor internals freely. Tests that read private fields fail on every change and do not prove behaviour.
</details>

<details><summary>4. How do you test that two concurrent bookings do not both succeed?</summary>

`const r = await Promise.allSettled([svc.book('A1','u1'), svc.book('A1','u2')])`, then assert exactly one is fulfilled and one rejected with `SeatTakenError`.
</details>

<details><summary>5. What is a contract test and why do you need one?</summary>

One test suite run against every implementation of an interface (in-memory and Postgres). It proves the fake behaves like the real store, so unit tests that use the fake can be trusted.
</details>

<details><summary>6. Which boundaries would you test for a 10-minute seat hold?</summary>

Confirm at t = 0, at t = 10 min minus 1 ms (succeeds), at exactly 10 min and after (fails, depending on the rule you state), release twice (second is an error), and a second user holding after expiry.
</details>

## Go deeper

- [L30 Machine-coding framework](../L30-machine-coding-framework/README.md): when to write tests vs a driver
- [L31 Repository and DI](../L31-repository-and-di/README.md): fakes come from good injection
- Read the tests: [13 BookMyShow](../../problems/13-bookmyshow/bookmyshow.test.ts), [01 Parking lot](../../problems/01-parking-lot/parking-lot.test.ts), [05 Notification service](../../problems/05-notification-service/notification-service.test.ts)
- Vitest docs: "Mocking", "Fake timers", `it.each`
- Book: Khorikov, *Unit Testing: Principles, Practices, and Patterns* (fakes vs mocks, testing behaviour)
