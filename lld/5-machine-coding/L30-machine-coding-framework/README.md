# L30 · The machine-coding round framework

> **Time:** ~35 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx lld/5-machine-coding/L30-machine-coding-framework/demo.ts`)
> **Builds on:** [L04 SRP and OCP](../../1-foundations/L04-solid-srp-ocp/README.md) · [L20 Strategy](../../4-behavioral/L20-strategy/README.md) · [L31 Repository and DI](../L31-repository-and-di/README.md) · **Used in:** every LLD problem, best first: [Parking lot](../../problems/01-parking-lot/README.md), [Rate limiter](../../problems/04-rate-limiter/README.md), [Vending machine](../../problems/06-vending-machine/README.md), [BookMyShow](../../problems/13-bookmyshow/README.md)

## The idea in one line

A machine-coding round wants **working, modular code with a demo** in 90–120 minutes, so you follow a fixed timeline and a fixed folder layout and spend your thinking only on the parts that score.

## Why it matters (the problem it solves)

Flipkart, PhonePe, Razorpay, Swiggy, Zomato, Meesho, CRED and Uber India all run some version of this round. Most candidates who fail do not fail on design. They fail because:

- At minute 90 nothing runs end to end. A half-built "perfect" design scores lower than a small working one.
- Everything lives in one 600-line `index.ts`, so "add a new vehicle type" means editing five `switch` blocks.
- They spend 25 minutes on a class diagram and start typing at minute 40.
- The demo crashes on the first edge case (`unpark` of an unknown ticket).

A framework removes these decisions. You do not ask yourself "what next?". The clock tells you.

## How it works

### What happens in the round

1. You get a 1–2 page problem with **must-have** and **good-to-have** features.
2. 90–120 minutes, your own laptop, any language. Usually no DB and no framework: in-memory storage plus a driver or tests.
3. The interviewer checks in 2–3 times. At the end you **demo** and walk through the code. Some companies also review the uploaded code offline.
4. Then 10–20 minutes of extensions: "add a new split type", "what if two users book the same seat?".

### What they score (roughly in this order)

| Criterion | What it means in practice |
|---|---|
| Working code | Must-haves run end to end. Non-working code usually fails the round. |
| Modularity | Entities, services, strategies and storage in separate files or sections. |
| Extensibility | A new type is a new class, not an edited `switch` (OCP). |
| Readability | Domain names, small functions, no dead code. |
| Edge cases | Invalid input, not found, duplicates, empty state: all typed errors. |
| Demo or tests | A driver or tests that show every must-have. |
| Concurrency awareness | A clear answer for "what if this runs on two servers?" |

### The 90-minute timeline

```
 0      8        18     25                         65       75       85  90
 |-READ-|--MODEL--|-SKEL-|--------- BUILD ---------|--EDGE--|--DEMO--|POL|
   ask    entities  empty   one feature at a time,    errors   driver/   names,
   scope  + 1 API   classes run after each one        + guards tests     "next"
```

| Time | Do | Output |
|---|---|---|
| 0–8 | Read twice. Ask 3–5 questions. Write assumptions as a comment. Pick the must-haves. | 4–6 features you will finish |
| 8–18 | Nouns become entities, verbs become service methods. Find the part that varies. | Class list + public API |
| 18–25 | Create files and empty classes. Write the driver calls **first**. | Skeleton that compiles |
| 25–65 | Build must-haves one by one. Run after each. | Working core |
| 65–75 | Edge cases, typed errors, input checks at the service boundary. | Clear failures |
| 75–85 | Demo script or tests for each feature. One good-to-have if time is left. | Green run |
| 85–90 | Rename, delete dead code, list what you would add next. | Ready walkthrough |

For 120 minutes, give the extra 30 to building and one or two good-to-haves. **Never skip the demo.**

**The minute-45 rule:** if fewer than half the must-haves run at minute 45, cut scope out loud: "I'll finish booking and cancel first and keep the waitlist as an extension."

### Step 2 in detail: how to spot the classes in a problem statement

| In the statement | Becomes | Example (parking lot) |
|---|---|---|
| Nouns with identity and a lifecycle | Entity class | `Ticket`, `Spot`, `Vehicle` |
| Fixed small sets | Union type or enum | `VehicleType = 'BIKE' \| 'CAR' \| 'TRUCK'` |
| Verbs the user does | Service methods | `park()`, `unpark()`, `availableSpots()` |
| "can be X or Y, more later" | Strategy interface | `PricingStrategy`, `SpotAllocator` |
| "store", "find", "list" | Repository interface | `TicketRepository` |
| Time, ids, money gateways | Injected dependency | `clock`, `idGen`, `PaymentGateway` |

### The folder layout

```
src/
  models/        Ticket.ts, Spot.ts, types.ts        entities + unions
  strategies/    PricingStrategy.ts, HourlyPricing.ts the parts that vary
  repositories/  TicketRepo.ts, InMemoryTicketRepo.ts Map behind an interface
  services/      ParkingService.ts                   use cases, orchestration
  errors.ts      NotFoundError, ValidationError
  main.ts        composition root + demo
```

Dependencies point one way:

```
main.ts ──creates──> ParkingService ──uses──> PricingStrategy (interface)
                          │                        ▲
                          └──uses──> TicketRepo    │ implements
                                     (interface)   HourlyPricing
                                         ▲
                                         │ implements
                                  InMemoryTicketRepo
```

If the interviewer asks for one file, keep the same sections in one file, top to bottom in this order.

### The "done" checklist

- All must-haves run from `main.ts` or tests.
- No `switch` on a type in more than one place.
- Clock, id generator, storage and gateways are injected.
- Entities guard their own rules (no public mutable fields with invariants).
- Errors are typed; no silent `return null` for a failure.
- You can explain each class in one sentence.
- You have an answer for concurrency and for persistence.

### Design-discussion rounds are different

Amazon, Microsoft and many SDE-2 loops run a 45–60 minute **LLD discussion** instead.

| | Machine coding | Design discussion |
|---|---|---|
| Time | 90–120 min | 45–60 min |
| Output | Running code + demo | Class diagram + signatures + 1–2 key methods |
| Split | Mostly building | Req 5 · diagram 10 · APIs 10 · code 10 · extensions 10 |

## In TypeScript

**Before** (what a rushed candidate writes at minute 30):

```ts
class ParkingManager {
  tickets: any = {};                       // public, untyped
  park(plate: string, type: string) {
    const id = Math.random().toString();   // not repeatable
    this.tickets[id] = { plate, type, at: Date.now() };  // hidden clock
    return id;
  }
  unpark(id: string) {
    const t = this.tickets[id];
    if (!t) return null;                   // silent failure
    const h = Math.ceil((Date.now() - t.at) / 3_600_000);
    switch (t.type) {                      // edited for every new type
      case 'CAR': return h * 20;
      case 'BIKE': return h * 10;
    }
  }
}
```

**After**: write the driver first. It is your contract and your demo:

```ts
// main.ts — written at minute 18, before any logic exists
const lot = new ParkingService({
  floors: [{ small: 2, medium: 2, large: 1 }],
  pricing: new HourlyPricing({ BIKE: 10, CAR: 20, TRUCK: 50 }),
  repo: new InMemoryTicketRepo(),
  clock: () => now,
});
const t = lot.park('KA-01-1234', 'CAR');
now += 2 * HOUR;
console.log(lot.unpark(t.id)); // { fee: 40 }
```

Then every feature is "make the next driver line work". The part that varies is an interface from day one:

```ts
interface PricingStrategy { fee(type: VehicleType, ms: number): number }
class HourlyPricing implements PricingStrategy {
  constructor(private readonly rates: Record<VehicleType, number>) {}
  fee(type: VehicleType, ms: number) { return Math.ceil(ms / HOUR) * this.rates[type]; }
}
```

The full version (entities, repo, errors, strategy, demo) is in [demo.ts](demo.ts), laid out exactly like the folder layout above.

## Trade-offs / when NOT to use it

- **Over-patterning.** Only the part that varies gets an interface. A `SpotFactory` for one spot class is wasted minutes.
- **Tests vs driver.** A driver is faster to write. Tests look more senior. Ask; if unsure, driver first, a few tests at the end.
- **One file vs folders.** Folders read better, but switching files costs time in a browser IDE. Ask what they review.
- **Frameworks.** NestJS or Express hide your design. Use plain classes unless they ask for HTTP; then add a thin layer on top.
- The timeline is a default. If the problem is mostly one hard algorithm (LRU, rate limiter), shift time from modelling to building.

## Common mistakes

- Coding before confirming scope, then building the wrong good-to-have.
- Writing all classes, then running for the first time at minute 80.
- `Manager`, `Helper`, `Utils`, `data` as class names.
- `Date.now()` and `Math.random()` inside logic, so nothing is testable or repeatable.
- Returning `null` or `false` for failures instead of throwing a typed error.
- Saying nothing for 20 minutes. Narrate your choices; the interviewer scores reasoning too.
- Ignoring concurrency until asked, then having no answer.

## Say this in the interview

> "Before I code, let me confirm the scope. I'll do these four must-haves first: park, unpark with fee, availability per type, and errors for invalid tickets. Multi-floor display boards I'll keep as an extension."

> "I'll keep storage in memory behind a repository interface, and inject the clock and the pricing strategy. That keeps the service testable and lets us swap in a database or a new pricing rule without touching the core."

> "It's minute 60, so I'll stop adding features and write the demo now. With more time I'd add the waitlist; it would plug in as a listener on the unpark event."

## Your experience hook

- In the payment orchestration service you put three providers behind one adapter interface. That is the same "isolate what varies" move you make at minute 10 of this round.
- Your NestJS services already use constructor injection for repos and clients. Say: "I'm doing by hand what Nest's DI container does for me at work."

## Self-test

<details><summary>1. Minute 50: two must-haves left, one is half done. What do you do?</summary>

Finish the half-done one and run it. Then build the last one in its simplest form. Tell the interviewer the plan. Start no good-to-have.
</details>

<details><summary>2. Name four things you inject in almost every problem.</summary>

Clock, id generator, storage (repository) and the varying strategy (pricing, split type, allocation). Often a notifier too.
</details>

<details><summary>3. Why write the driver before the logic?</summary>

It fixes the public API early, gives you a runnable target after each feature, and becomes the demo for free.
</details>

<details><summary>4. How do you decide which part gets an interface?</summary>

The part the statement says can change ("multiple pricing models", "more payment modes later") and anything external (storage, time, gateways). Everything else stays a concrete class.
</details>

<details><summary>5. How does a 45-minute design-discussion round change your time split?</summary>

Less code, more diagram and API. About 10 minutes of code for 1–2 core methods, and 10 minutes kept for extensions and trade-offs.
</details>

<details><summary>6. The interviewer asks "what if this runs on two servers?". What is your short answer?</summary>

In one Node process the check-and-update is one synchronous block, so it is safe. With two instances, memory is not shared, so I'd move state to a DB and use a conditional update or a row lock (or a Redis lock with a TTL) on the contended row. See L32.
</details>

## Go deeper

- [L31 Repository and DI](../L31-repository-and-di/README.md): the storage and wiring half of the layout
- [L32 Concurrency in Node](../L32-concurrency-in-node/README.md): the "two servers" follow-up
- [L34 Testing your design](../L34-testing-designs/README.md): tests instead of a driver
- Practice: [01 Parking lot](../../problems/01-parking-lot/README.md) → [06 Vending machine](../../problems/06-vending-machine/README.md) → [09 Splitwise](../../problems/09-splitwise/README.md), each with a 90-minute timer
- Archive: [LLD guide](../../../archive/notes/LLD-guide.md) (problem-solving approach and interview tips), [LLD walkthrough](../../../archive/notes/LLD-walkthrough.md)
