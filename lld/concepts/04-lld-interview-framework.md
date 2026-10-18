# 04 · The Machine-Coding Round Framework

> **Read time:** 20 min · **Practice:** start with [01 Parking Lot](../problems/01-parking-lot/README.md), then [04 Rate Limiter](../problems/04-rate-limiter/README.md) and [06 Vending Machine](../problems/06-vending-machine/README.md)
> **Related:** [01 OOP](01-oop-pillars.md) · [02 SOLID](02-solid.md) · [03 UML](03-uml-relationships.md) · [06 Concurrency](06-concurrency-in-node.md)

## The idea in one line

In a machine-coding round you must ship **working, modular code with a demo** in 90–120 minutes. A fixed timeline and a fixed file layout stop you from losing time on decisions that don't score.

## How the round runs (Indian product companies and fintechs)

Flipkart, PhonePe, Razorpay, Swiggy, Zomato, Meesho, CRED, Uber India and similar companies run some version of this:

1. You get a problem statement (often a document of 1–2 pages) with "must have" and "good to have" features.
2. You get **90–120 minutes**, on your own laptop, in any language. Usually no database, no framework: in-memory storage and a driver/`main` or tests.
3. The interviewer checks in a few times. At the end you **demo** it and walk through the code. Some companies ask you to upload the code for an offline review.
4. Then 10–20 minutes of extension questions: "add a new split type", "what if two users book the same seat?".

**What they score** (roughly in this order):

| Criterion | What it means in practice |
|---|---|
| Working code | The must-haves run end to end. Non-working code often fails the round, even if the design is nice. |
| Modularity | Entities, services, strategies and storage in separate files. No 600-line `index.ts`. |
| Extensibility | A new type is a new class, not an edited switch ([OCP](02-solid.md)). |
| Readability | Good names, small functions, no dead code, consistent style. |
| Edge cases | Invalid input, not found, duplicates, empty states, all as clear errors. |
| Demo / tests | A runnable driver or tests that show each feature. |
| Concurrency awareness | At least an answer for "what if this runs on 2 servers?" |

## Minute-by-minute timeline (90 minutes)

| Time | Do | Output |
|---|---|---|
| 0–8 | Read twice. Ask questions. Write assumptions at the top of `README` or a comment. Pick the must-haves. | A list of 4–6 features you will finish |
| 8–18 | Entities, relationships, interfaces for the parts that vary. Speak while you draw. | A small class list and a public API |
| 18–25 | Create folders and empty classes. Write the driver calls first (what the demo will do). | Skeleton that compiles |
| 25–65 | Implement the must-haves, one feature at a time. Run after each one. | Working core |
| 65–75 | Edge cases and errors. Custom error classes. | Clear failures |
| 75–85 | Demo script or tests for each feature. One "good to have" if time is left. | Green run |
| 85–90 | Clean up names, remove dead code, list what you'd add next. | A ready walkthrough |

For 120 minutes, give the extra time to implementation and one or two "good to have" features. Never skip the demo.

**Rule:** if you are behind at minute 45, cut scope. Say "I'll do X first and keep Y as an extension". A working subset beats a broken full set.

## Folder layout

```
src/
  models/          Order.ts, User.ts, Seat.ts          (entities + enums/types)
  strategies/      PricingStrategy.ts, FlatPricing.ts  (the parts that vary)
  repositories/    InMemoryOrderRepo.ts                (Map-based storage behind an interface)
  services/        BookingService.ts                   (use cases; orchestration)
  errors.ts        NotFoundError, ValidationError
  main.ts          composition root + demo
tests/             booking.test.ts                      (if tests are allowed)
```

In TypeScript, a single file with clear sections is acceptable when the interviewer asks for one file. Ask first.

## Checklist before you say "done"

- [ ] All must-haves run from `main.ts` or tests.
- [ ] No `if/else` or `switch` on a type in more than one place.
- [ ] External things are injected: clock, ID generator, gateway, storage.
- [ ] Entities protect their own state (no public mutable fields with rules).
- [ ] Errors are typed and messages are clear. No silent `return null` for failures.
- [ ] Inputs are validated at the service boundary.
- [ ] Names are domain words (`Booking`, `Seat`), not `Manager`, `Helper`, `data`.
- [ ] You can explain each class in one sentence.
- [ ] You know your answer for concurrency and for persistence.

## Phrases to say

- "Before I code, let me confirm the scope. I'll do these four must-haves first."
- "I'll keep storage in memory behind a repository interface, so we can switch to a database later."
- "This part changes often, so it's a strategy. The rest stays concrete to save time."
- "I'm making time injectable so the tests can control it."
- "I'm at minute 60. I'll skip the extra report and write the demo now."
- "In one Node process this is safe because the check and the update happen in one synchronous block. With several instances, I'd use a row lock or a version column."
- "With more time, I'd add X and Y. Here is where they would plug in."

## Design-discussion LLD rounds are different

Some companies (and many Amazon/Microsoft loops) run a **45–60 minute LLD discussion** instead of a coding round.

| | Machine-coding round | Design-discussion round |
|---|---|---|
| Time | 90–120 min | 45–60 min |
| Output | Running code + demo | Class diagram + method signatures + maybe key code |
| Focus | Working, readable code | Entities, relationships, patterns, trade-offs |
| Where you spend time | Implementation | Requirements, diagram, APIs, extensions |

Timeline for 45 minutes: requirements (5) → entities and relationships with a diagram (10) → public APIs and key flows (10) → code 1–2 core methods (10) → extensions, concurrency, patterns (10).

## How to use this repo's problems

Each problem in `lld/problems/<slug>/` has:

- `README.md`: the statement, clarifications with assumed answers, the public API, hidden entity hints, extensions.
- `starter.ts`: empty exports with the right names. You write your code here.
- `*.test.ts`: the tests. They check only the public API, so your internal design is free.
- `reference.ts`: one good solution. Open it only after your tests pass or the time box ends.

Commands:

```bash
npx vitest run lld/problems/01-parking-lot       # test your starter.ts
REF=1 npx vitest run lld/problems/01-parking-lot # test the reference solution
npm run test:ref                                  # all problems against reference.ts
```

Practice method: set a 90-minute timer, follow the timeline above, then compare with `reference.ts` and write down two things you'd change.

## Common follow-ups

<details><summary>Can I use a framework (NestJS, Express)?</summary>

Usually no, or it is discouraged. They want to see your design, not the framework's. A plain TS driver is safest. If they want an HTTP API, a thin Express layer over your services is fine.
</details>

<details><summary>Should I write tests or a driver?</summary>

Ask. If unsure, write a `main.ts` demo first (it is faster) and add a few tests if time is left. Either way, show each must-have working.
</details>

<details><summary>What if I don't finish?</summary>

Make sure what exists runs. Explain what is left and exactly where it plugs in. A clean partial solution often passes; a broken big one usually does not.
</details>

## Self-test (answer before opening)

<details><summary>1. Minute 50, two must-haves left, one is half done. What do you do?</summary>

Finish the half-done one, run it, then start the last one in its simplest form. Tell the interviewer the plan. Do not start any "good to have".
</details>

<details><summary>2. Name four things you inject in almost every problem.</summary>

Clock, ID generator, storage (repository) and the varying strategy (pricing, split type, scheduling). Often also a notifier.
</details>

<details><summary>3. How does a design-discussion round change your time split?</summary>

Less code, more diagram and API. About 10 minutes of code for core methods, and 10 minutes kept for extensions and trade-offs.
</details>

## Go deeper

- Older notes in this repo: `archive/notes/LLD-guide.md`, PART 5 "Problem-Solving Approach" and PART 8 "Interview Tips"; `archive/notes/LLD-walkthrough.md`
- [P10 Strategy](patterns/p10-strategy.md) and [P18 Repository and DI](patterns/p18-repository-di.md): the two patterns you will use in almost every round
