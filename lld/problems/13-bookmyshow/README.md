# 13 · BookMyShow (seat locking)

> Asked at: Swiggy, Flipkart, PhonePe, Razorpay, Uber, Atlassian, and most "booking" machine-coding rounds.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **Concurrency control** (seat holds with TTL, a mutex around check-then-write), **Strategy** (pricing)

## Problem statement (as the interviewer says it)

"Design the seat booking part of BookMyShow. A user picks seats for a show. The seats are held for a few minutes while the user pays.
If payment succeeds, the seats are booked. If the user leaves, the seats come back. Two users must never book the same seat."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Flow? | `holdSeats` → (user pays outside our code) → `confirm`. Or `release` if the user cancels |
| Hold time? | 5 minutes (configurable `holdTtlMs`) |
| When does a hold expire? | When `now >= expiresAt`. Time comes from an injected clock |
| How is expiry done? | Lazily. An expired hold reads as `AVAILABLE`. No timers |
| Many seats in one request? | All-or-nothing. If one seat is taken, nothing is held |
| Confirm after expiry? | Throw. The seats are free for others |
| Old hold released after someone else took the seats? | Must not touch the new holder's seats |
| Storage? | Behind an async `SeatStore` (like a DB or Redis). Every call is an `await` |
| Price? | `price × seats` by default. Pluggable `PricingStrategy` |
| Bad input (unknown show/seat, empty or duplicate seats)? | Throw (the promise rejects) |
| Payments, refunds, seat maps, multiple servers? | Out of scope. Mention them as extensions |

## Why there is a race in single-threaded Node

Node runs one piece of JavaScript at a time. So this is safe:

```ts
if (seat.status === 'AVAILABLE') seat.status = 'HELD';   // no await between check and write
```

But a real store is async. This is **not** safe:

```ts
const rec = await store.get(show, seat);     // user 1 pauses here ... user 2 runs and also sees AVAILABLE
if (rec.status !== 'AVAILABLE') throw ...;
await store.set(show, seat, HELD);           // both users write HELD. Both think they won
```

Every `await` lets other requests run. The fix inside one process is a lock around the whole check-then-write. One `Mutex` per show means different shows don't block each other. The test "why the lock matters" shows the double booking happen, then go away with the mutex.

Across many servers, an in-process mutex is not enough. See extensions.

## Step 2: public API (what the tests call)

```ts
const svc = new BookingService({
  clock: () => now,                 // injected time
  holdTtlMs: 5 * 60_000,
  store: new InMemorySeatStore(),   // optional; any SeatStore
  pricing: new FlatPricing(),       // optional; any PricingStrategy
});

await svc.addShow({ id: 'S1', movie: 'Interstellar', seats: ['A1', 'A2', 'B1'], price: 200 });
const hold = await svc.holdSeats('S1', 'u1', ['A1', 'A2']);  // → Hold { id, showId, userId, seats, expiresAt }
const booking = await svc.confirm(hold.id);                  // → Booking { id, showId, userId, seats, amount }
await svc.release(hold.id);
await svc.seatStatus('S1', 'A1');                            // → 'AVAILABLE' | 'HELD' | 'BOOKED'
await svc.availableSeats('S1');                              // → string[]

const mutex = new Mutex();
await mutex.runExclusive(async () => { /* one caller at a time */ });
```

`InMemorySeatStore` is given in `starter.ts`. You write `Mutex`, `FlatPricing` and `BookingService`.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `BookingService`: the facade. Validates input, takes the show's lock, does check-then-write, owns holds
- `SeatRecord`: a tagged union. `AVAILABLE` | `HELD { holdId, userId, expiresAt }` | `BOOKED { bookingId, userId }`. A held seat always knows who holds it and until when
- `Hold`: an immutable record. `confirm` checks that every seat still points to **this** hold id. That check stops an old, expired hold from booking seats someone else now holds
- `SeatStore` (interface) → `InMemorySeatStore`. Later: a Redis or SQL store
- `Mutex`: a promise chain. Each caller waits for the previous caller's promise, runs, then releases
- `PricingStrategy` (interface) → `FlatPricing`. Later: row-based, weekend, dynamic pricing

The seat state machine:

```
AVAILABLE --hold--> HELD --confirm--> BOOKED
    ^                 |
    +--release/expiry-+
```

Relationships: BookingService ⟶ SeatStore, PricingStrategy (dependency injection). BookingService ◆— Mutex (one per show).

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/13-bookmyshow` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Many servers.** The in-process mutex only protects one Node process. Options:
   - SQL: one row per seat. `UPDATE show_seats SET status='HELD', hold_id=?, expires_at=? WHERE show_id=? AND seat_id IN (...) AND (status='AVAILABLE' OR (status='HELD' AND expires_at <= now()))`. Check that the affected row count equals the seat count; otherwise roll back the transaction.
   - Or `SELECT … FOR UPDATE` on the seat rows inside a transaction, in a fixed seat order to avoid deadlocks.
   - Redis: `SET seat:S1:A1 <holdId> NX PX 300000` per seat. For many seats, use a Lua script so all-or-nothing is atomic.
2. **Payment succeeds just after the hold expired.** You took the money but the seat may be gone. Either refund automatically, or extend the hold when the payment starts. Log both cases.
3. **Confirm is called twice** (user double-clicks, or a webhook is retried). Make `confirm` idempotent: return the same booking for the same hold id.
4. **Cleaning up expired holds.** Lazy expiry is correct but leaves stale rows. A sweeper job frees them in batches. Redis keys with a TTL clean themselves.
5. **Fairness for a big release.** Thousands of users for one show: put a virtual queue (waiting room) in front, and limit seats per user.

## Self-check before you call it done

- [ ] There is no `await` between "check seat is free" and "mark seat held" outside the lock.
- [ ] All-or-nothing: a failed multi-seat request leaves no partial holds.
- [ ] Expiry uses the injected clock. No `setTimeout`, no `Date.now()` in the logic.
- [ ] `confirm` and `release` check the seat still belongs to this hold.
- [ ] You can explain why Node needs a lock even though it is single-threaded.

## Concepts used

- [Concurrency in Node LLD](../../5-machine-coding/L32-concurrency-in-node/README.md) · [Strategy](../../4-behavioral/L20-strategy/README.md) · [Repository and DI](../../5-machine-coding/L31-repository-and-di/README.md)
- HLD link: [Ticket Booking (BookMyShow)](../../../hld/case-studies/09-ticket-booking) · [SQL deep dive: locking](../../../hld/3-databases/H11-indexing/README.md) · [Distributed locks](../../../hld/5-reliability/H29-consensus-locks/README.md)
- Visuals: [Seat locking and race conditions](../../5-machine-coding/L32-concurrency-in-node/visual.html) · [Node.js event loop](../../5-machine-coding/L32-concurrency-in-node/visual.html)
