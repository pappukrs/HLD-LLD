# 01 · Parking Lot

> Asked at: Amazon, Flipkart, Razorpay, Uber, PhonePe and nearly every machine-coding round.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **Strategy** (pricing, spot allocation), **Factory** (spots and tickets), **Singleton** (only if asked)

## Problem statement (as the interviewer says it)

"Design a parking lot system. It has multiple floors. Each floor has spots of different sizes.
Vehicles come in, get a ticket, park, and pay when they leave. Pricing depends on the vehicle type and the time parked."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Which vehicle types? | `BIKE`, `CAR`, `TRUCK` |
| Which spot sizes? | `SMALL`, `MEDIUM`, `LARGE` |
| What fits where? | BIKE → SMALL, MEDIUM or LARGE. CAR → MEDIUM or LARGE. TRUCK → LARGE only |
| Which spot do we pick? | Lowest floor first; on that floor, the **smallest** size that fits |
| Pricing? | Hourly rate per vehicle type. Partial hours round **up**. Minimum 1 hour |
| Same plate parked twice? | Reject it |
| Lot full? | Reject with an error |
| Payment methods, EV charging, reservations? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const lot = new ParkingLot({
  floors: [{ small: 2, medium: 2, large: 1 }, { small: 0, medium: 5, large: 2 }],
  pricing: new HourlyPricing({ BIKE: 10, CAR: 20, TRUCK: 50 }),
  clock: () => Date.now(),           // injectable, so tests control time
});

const ticket = lot.park('KA01AB1234', 'CAR');   // → Ticket { id, plate, vehicleType, floor, spotId, entryTime }
lot.availableSpots('MEDIUM');                    // → number
const receipt = lot.unpark(ticket.id);           // → Receipt { ticketId, amount, durationMinutes }
```

The internals (spot classes, floors, allocation strategy) are **your design**. The tests only use the API above.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `ParkingLot`: the facade. Owns the floors, the active tickets and the pricing strategy
- `Floor`: owns its `Spot`s and finds a free spot for a size
- `Spot`: id, size, `occupiedBy: string | null`
- `Ticket`: an immutable record
- `PricingStrategy` (interface) → `HourlyPricing`. Later: `WeekendPricing`, `FlatPricing`
- `SpotAllocationStrategy` (optional) → `LowestFloorSmallestFit`

Relationships: Lot ◆— Floor ◆— Spot (composition). Lot ⟶ PricingStrategy (dependency injection).

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/01-parking-lot` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Two gates, two cars, one last spot.** How do you avoid double allocation? In Node, a single process is single-threaded, so a synchronous `park` is safe. With multiple instances you need a DB row lock (`SELECT … FOR UPDATE SKIP LOCKED`) or a Redis lock.
2. Add EV spots with charging. Does your design need `if (type === 'EV')` all over the code? It shouldn't: add a size/capability and a fit rule.
3. Different pricing on weekends: a new `PricingStrategy`. Nothing else changes (Open/Closed).
4. A display board showing free spots per floor: the **Observer** pattern on spot state changes.
5. How do you persist this? Tables: `spots`, `tickets`, `payments`, with an index on `(floor, size, occupied)`.

## Self-check before you call it done

- [ ] No `if/else` chain on vehicle type inside `ParkingLot`. Fit rules live in a table or map.
- [ ] Time is injected (`clock`), not read directly with `Date.now()` all over the code.
- [ ] Errors are explicit (`throw new Error('Lot full')`), not silent `null`s.
- [ ] You can explain each class's single responsibility in one sentence.

## Concepts used

- [Strategy pattern](../../concepts/patterns/p10-strategy.md) · [SOLID](../../concepts/02-solid.md) · [Machine-coding framework](../../concepts/04-lld-interview-framework.md)
- Visual: [Strategy + Factory](../../../visuals/v23-strategy-factory.html)
