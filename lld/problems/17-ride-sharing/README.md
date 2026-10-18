# 17 · Ride Sharing

> Asked at: Uber, Ola, Rapido, Swiggy, Flipkart, PhonePe, and many machine-coding rounds.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **State** (ride lifecycle), **Strategy** (driver matching, fare), **Observer** (ride events)

## Your v1 attempt: what to fix

Your first attempt is in [`v1-attempt.js`](./v1-attempt.js). The pattern choices are right. The rules behind them are missing:

1. **`NearestDriverStrategy` ignores distance.** It returns `drivers.find(d => d.vehicle.type === ride.vehicle.type)`: the first match, not the nearest. The class name promises something the code doesn't do. An interviewer will notice. Compute the distance from each driver to the pickup and take the minimum (with a fixed tie-break, such as the lower id, so results don't depend on list order).
2. **No driver availability, so a driver can be double-booked.** Nothing marks a driver as busy. Two rides in a row get the same driver. Keep `activeRideId` (or a status) on the driver. Filter busy and offline drivers **in the service**, before the strategy runs, so no strategy can break the rule.
3. **`assignDriver(undefined)` isn't guarded.** When no driver matches, `findDriver` returns `undefined`, and `assignDriver` still moves the ride to `DRIVER_ASSIGNED` with no driver. Throw "No driver available" (or keep the ride in a `SEARCHING` state).
4. **Any status transition is allowed.** `updateStatus(status)` accepts anything: `COMPLETED` straight from `CREATED`, or `ON_THE_WAY` after `COMPLETED`. Write the allowed moves as a table (`ASSIGNED → IN_PROGRESS | CANCELLED`, `IN_PROGRESS → COMPLETED`) and check it in one place. That is the State pattern in its smallest form.
5. **No fare.** The ride ends with no price. Add a `FareStrategy` (base + per km, per vehicle type). Surge or discounts become new strategies (or decorators), not `if`s.
6. **Vehicle subclasses add nothing.** `Auto`, `Car`, `ACCar`, `Bike`, `EV` only set a type string, and `VehicleFactory` is a switch over them. A `VehicleType` union is enough until vehicles have different behaviour. Don't add a pattern only to name it.
7. **Observers per ride, added by hand.** Each caller must remember to attach observers to each ride. Subscribe once at the service level; the service emits events for every ride.

## Problem statement (as the interviewer says it)

"Design a ride-sharing app like Uber. Drivers register with a vehicle and share their location. A rider requests a ride from a pickup to a drop point for a vehicle type.
The system assigns a driver. The ride is started and completed, or cancelled. The rider pays a fare."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Vehicle types? | `BIKE`, `AUTO`, `CAR`. A rider asks for one type; only that type matches |
| Location? | A point `{ x, y }` on a flat grid in km. Distance is straight-line |
| Who can be matched? | Online drivers with no active ride, of the requested type |
| Which driver? | The nearest to the pickup. Tie → lower driver id. Optional max pickup distance |
| No driver? | Throw |
| Ride states? | `ASSIGNED → IN_PROGRESS → COMPLETED`, or `ASSIGNED → CANCELLED`. Anything else throws |
| Cancel after the trip started? | Not allowed |
| Fare? | `round(base + perKm × distance(pickup, drop))`. BIKE 20 + 8/km, AUTO 30 + 12/km, CAR 50 + 15/km. Computed on completion |
| After completion? | The driver is free again and is now at the drop point |
| One rider, two rides at once? | Not allowed until the first ride ends |
| Events? | `ASSIGNED`, `STARTED`, `COMPLETED`, `CANCELLED` to all subscribers |
| Payments, ratings, ETA, real maps, driver accept/reject? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const svc = new RideService({
  matching: new NearestDriverStrategy(5),   // optional; max pickup distance 5 km
  fare: new DistanceFare(),                 // optional; any FareStrategy
});

svc.addDriver({ id: 'd1', name: 'Ravi', vehicle: 'CAR', location: { x: 1, y: 0 } });
svc.setOnline('d1', false);
svc.updateLocation('d1', { x: 2, y: 2 });

const ride = svc.requestRide({ riderId: 'r1', pickup: { x: 0, y: 0 }, drop: { x: 3, y: 4 }, vehicle: 'CAR' });
svc.startRide(ride.id);
svc.completeRide(ride.id);   // → Ride { ..., status: 'COMPLETED', fare: 125 }
svc.cancelRide(id);          // only before start
svc.getRide(id); svc.getDriver('d1');   // → DriverView { id, name, vehicle, location, online, busy }

const off = svc.subscribe((event) => { /* { type, rideId, riderId, driverId } */ });
```

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `RideService`: the facade. Owns drivers and rides, enforces availability and transitions, emits events
- `Driver` (internal): id, name, vehicle, location, online, `activeRideId`. "Busy" is derived from `activeRideId`, so it can't drift
- `Ride`: id, rider, driver, vehicle, pickup, drop, status, fare. Callers get copies, so they can't change status behind the service's back
- `TRANSITIONS`: a table `status → allowed next statuses`. One `transition()` method checks it
- `MatchingStrategy` (interface) → `NearestDriverStrategy`. Later: highest-rated, lowest ETA, batched matching
- `FareStrategy` (interface) → `DistanceFare`. Later: `SurgeFare` wrapping another `FareStrategy` (decorator)
- Listeners (Observer): notifications, analytics and payments subscribe; the service doesn't know them

Split of responsibility for matching:

| Rule | Lives in | Why |
|---|---|---|
| Driver is online, free, right vehicle | `RideService` | A safety rule. No strategy may break it |
| Which of the valid drivers is best | `MatchingStrategy` | A business choice that changes often |

Relationships: RideService ◆— Driver, Ride. Ride ⟶ Driver (by id). RideService ⟶ MatchingStrategy, FareStrategy (dependency injection).

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/17-ride-sharing` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Finding nearby drivers fast.** Scanning all drivers is O(n). Index drivers by geohash cell (or a quadtree) and search the pickup cell plus its neighbours. See [Geospatial indexing](../../../hld/concepts/28-geospatial.md).
2. **Two requests pick the same driver** on two servers. Claim the driver atomically: `UPDATE drivers SET ride_id = ? WHERE id = ? AND ride_id IS NULL`, or a Redis `SET driver:d1 <rideId> NX`. If the claim fails, try the next candidate.
3. **Driver accept/reject.** Add a `SEARCHING` state and an `OFFERED` step with a timeout. On reject or timeout, offer the next driver. The transition table grows; the code doesn't.
4. **Surge pricing.** `SurgeFare(inner, multiplier)` wraps any fare strategy. The multiplier comes from demand/supply per area.
5. **Cancellation fee** after the driver has waited N minutes: needs an injected clock and a `CancellationPolicy` strategy.
6. **Ride sharing (pool).** One driver, many riders on one route. A driver's capacity replaces the boolean "busy".

## Self-check before you call it done

- [ ] "Nearest" really uses distance, and ties are broken in a fixed way.
- [ ] A driver with an active ride is never offered to the strategy.
- [ ] Every status change goes through one transition check.
- [ ] Fare logic is in a strategy, not inside `completeRide`.
- [ ] Returned rides are copies; outside code can't change internal state.

## Concepts used

- [State pattern](../../concepts/patterns/p12-state.md) · [Strategy](../../concepts/patterns/p10-strategy.md) · [Observer](../../concepts/patterns/p11-observer.md) · [Decorator](../../concepts/patterns/p06-decorator.md)
- Related problem: [Food Delivery](../18-food-delivery/) (the same shape: assign, track, complete)
- HLD link: [Ride Hailing (Uber/Ola)](../../../hld/problems/10-ride-hailing/) · [Geospatial indexing](../../../hld/concepts/28-geospatial.md)
- Visuals: [State machine](../../../visuals/v25-state-machine.html) · [Strategy + Factory](../../../visuals/v23-strategy-factory.html) · [Observer and pub-sub](../../../visuals/v24-observer-pubsub.html) · [Geohash and quadtree](../../../visuals/v17-geohash-quadtree.html)
