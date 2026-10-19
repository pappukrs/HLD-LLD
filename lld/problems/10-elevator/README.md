# 10 · Elevator System

> Asked at: Uber, Flipkart, Atlassian, Microsoft, Amazon, and many machine-coding rounds.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **State** (elevator state machine), **Strategy** (which elevator serves a call)

## Problem statement (as the interviewer says it)

"Design an elevator system for a building with N floors and M elevators. People press UP or DOWN on a floor.
People inside an elevator press a floor number. The system decides which elevator serves each call and in which order each elevator stops."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Floors? | `0 .. floors - 1`. Any other floor throws |
| Where do elevators start? | Floor 0, unless `startFloors` is given |
| How does time work? | A discrete simulation. Each `step()` call, every elevator does **one** action: open its doors at a stop, or move one floor |
| How long do doors stay open? | One step. On the next step the doors close and the elevator moves in the same step |
| In which order does one elevator stop? | **LOOK**: keep going in the current direction while there are stops ahead, then reverse. Don't go to the end floor if nobody needs it (that would be SCAN) |
| Idle elevator gets stops on both sides? | Go to the nearest one first. On a tie, go UP |
| Which elevator serves a hall call? | The one with the lowest travel cost. Idle: the distance. Moving toward the floor in the same direction: the distance. Otherwise: distance to its turning point, plus distance back. Tie: lowest id |
| UP at the top floor, DOWN at floor 0? | Throw |
| Same floor requested twice? | One stop. Requests are a set |
| Capacity, weight, emergency, VIP mode? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const sys = new ElevatorSystem({
  floors: 10,
  elevators: 2,
  startFloors: [0, 8],              // optional
  dispatch: new NearestCarDispatch(), // optional, any DispatchStrategy
});

sys.call(7, 'DOWN');     // hall call → returns the chosen elevator id (1 here)
sys.selectFloor(0, 5);   // cabin request inside elevator 0
sys.step();              // advance the simulation by one tick
sys.status();            // → ElevatorStatus[] { id, floor, state, direction, stops }
```

`state` is one of `IDLE`, `MOVING_UP`, `MOVING_DOWN`, `DOORS_OPEN`.
The internals (elevator class, how you store stops, how you pick a direction) are **your design**.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `ElevatorSystem`: the facade. Validates input, owns the elevators, asks the dispatch strategy, drives `step()`
- `Elevator`: id, floor, state, committed direction, a `Set<number>` of stops. Its `step()` is the state machine
- `DispatchStrategy` (interface) → `NearestCarDispatch`. Later: `ZoneDispatch` (elevator A serves floors 0-9 only), `LeastBusyDispatch`
- `ElevatorStatus`: a read-only snapshot. The strategy gets snapshots, not live objects, so it can't move an elevator by mistake

State transitions inside `Elevator.step()`:

| Now | Condition | Next |
|---|---|---|
| any | current floor is a stop | `DOORS_OPEN` (remove the stop) |
| `IDLE` / `DOORS_OPEN` / `MOVING_*` | stops left | move one floor → `MOVING_UP` or `MOVING_DOWN` |
| any | no stops | `IDLE`, direction `null` |

Four states and three rules fit in one method. Separate State classes are also fine. Say why you chose one.

Relationships: System ◆— Elevator (composition). System ⟶ DispatchStrategy (dependency injection).

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/10-elevator` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **SCAN vs LOOK.** SCAN always runs to the end floor before it reverses. LOOK reverses at the last stop. LOOK saves travel. Make the direction rule a strategy if they want both.
2. **Direction-aware hall calls.** Today a DOWN call on floor 5 is just "stop at 5". A real elevator going UP should skip it and pick it up on the way down. Store hall calls as `(floor, direction)` and only open when directions match.
3. **Capacity.** Add a load count. A full elevator skips hall calls (but still serves cabin stops). The dispatch cost adds a large penalty for full cars.
4. **Maintenance mode.** Add an `OUT_OF_SERVICE` state. Dispatch ignores those elevators. Re-dispatch their pending hall calls.
5. **Real time instead of `step()`.** Keep `step()` pure and call it from a `setInterval`. The logic stays testable because time is outside it.
6. **Display panels on each floor.** Observer on elevator state changes.

## Self-check before you call it done

- [ ] `step()` is deterministic. No `Date.now()`, no `setTimeout`, no randomness.
- [ ] The dispatch rule lives in one class. You can swap it without touching `Elevator`.
- [ ] Stops are a set. Duplicate requests don't create duplicate stops.
- [ ] Invalid floors and unknown elevator ids throw clear errors.
- [ ] You can draw the state transitions on a whiteboard in 30 seconds.

## Concepts used

- [State pattern](../../4-behavioral/L22-state/README.md) · [Strategy pattern](../../4-behavioral/L20-strategy/README.md) · [Machine-coding framework](../../5-machine-coding/L30-machine-coding-framework/README.md)
- Visuals: [State machine](../../4-behavioral/L22-state/visual.html) · [Strategy + Factory](../../4-behavioral/L20-strategy/visual.html)
