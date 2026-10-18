# 18 · Food Delivery

> Asked at: Swiggy, Zomato, Flipkart, Uber, PhonePe. Common in machine-coding rounds.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **State** (order lifecycle), **Strategy** (driver assignment), **Observer** (notifications)

## Your v1 attempt: what to fix

`v1-attempt.js` is your best attempt so far. The structure is right. The problems are about testability, coupling and a few hidden bugs.

**What is good**

- The State pattern is used properly. The base `OrderState` throws for every action, and each state overrides only what it allows. Illegal moves fail by default.
- The cancellation rule lives inside the states (`PreparingState.cancel` returns the penalty). This is the right place for it.
- `DriverAssignmentStrategy` with `NearestDriverStrategy` and `setStrategy` is a correct Strategy. The Haversine distance in `Location` is correct.
- The retry loop in `assignDriverToOrder` removes a rejected driver before it tries again. Good thinking.

**What is weak**

1. **`HighestRatedDriverStrategy` is a stub.** It calls `NearestDriverStrategy`. `Driver` has no `rating` field, so the strategy cannot work. In an interview, a fake strategy is worse than no strategy. Add `rating` and sort by it.
2. **Four singletons** (`OrderService`, `DriverAssignmentService`, `DriverPoolManager`, `NotificationService`). The state lives for the whole process. Two tests share the same orders and drivers, and you cannot reset them. Nothing here needs a singleton. Create the objects once and pass them in through the constructor.
3. **The entity calls a global service.** `Order._notifyObservers` calls `NotificationService.getInstance()`. Now `Order` cannot exist without that global. The service that changes the state should publish the event, or inject the publisher into the order.
4. **Side effects before the guard.** `DeliveryAssignment.markPickedUp` sets `pickedUpAt` and `status = 'PICKED_UP'` first, and calls `order.pickUp()` after it. If the order is not READY, `order.pickUp()` throws, but the assignment already says PICKED_UP. `markDelivered` has the same bug. Validate first, then mutate.
5. **Every observer gets every event.** The base `Observer` class has both `update` and `updateDriver`. So `DriverNotifier` inherits `update` and logs every order change, and `CustomerNotifier` inherits `updateDriver`. The `if (observer.update)` checks are always true. Use one `notify(event)` method with a typed event, and let each observer ignore what it does not need.
6. **One failing observer breaks the order.** `notifyOrderUpdate` has no try/catch. If the SMS sender throws, `setState` throws after the state changed.
7. **Duplicate guards.** `OrderService.cancelOrder` checks for CANCELLED and DELIVERED by hand, but the states already reject these. Keep the rule in one place.
8. **Cancel misuses `completeDelivery()`** to free the driver. Name it `release()`. Then the next reader knows that the delivery did not happen.
9. **No driver found is ignored.** `acceptOrder` drops the `null` from `assignDriverToOrder`. The order stays ACCEPTED with no driver and no way to retry. Either throw, or expose `assignDriver(orderId)` so a retry job can call it.
10. **Not testable.** `new Date()` is called directly (no clock injection). `console.log` is inside domain classes. `runDemo()` runs on import. `Restaurant.acceptOrder` always returns `true` and its result is never used.
11. **Money.** Prices are plain numbers printed with `$`. Use integer paise (`29900`, not `299.00`) and say so in the clarify step.

## Problem statement (as the interviewer says it)

"Design the order flow for a food delivery app. A customer places an order at a restaurant. The restaurant accepts it,
prepares it, and marks it ready. A delivery partner is assigned, picks it up and delivers it. The customer can cancel.
Everyone gets notified when the order changes."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Which order states? | `PLACED → ACCEPTED → PREPARING → READY → PICKED_UP → DELIVERED`, plus `CANCELLED` |
| Can a state be skipped? | No. Any other move throws |
| When is a driver assigned? | By calling `assignDriver(orderId)` in ACCEPTED, PREPARING or READY. One driver per order |
| How do we pick a driver? | A pluggable strategy. Nearest free driver by default. Highest rated is the second one |
| Distance? | Straight line on a flat x/y grid in km. Real systems use lat/lng and a geo index |
| Driver busy? | A driver has at most one active order. Free again after delivery or cancel |
| No free driver? | `assignDriver` throws. The order stays as it was |
| Pickup without a driver? | Throws. The order stays READY |
| Cancel rules? | PLACED or ACCEPTED: free. PREPARING or READY: a fixed fee. PICKED_UP or later: not allowed |
| Money? | Integer paise. Total = sum of `pricePaise × quantity` |
| Notifications? | Observers get `STATUS_CHANGED` and `DRIVER_ASSIGNED` events. A failing observer must not break the flow |
| Payments, ratings after delivery, ETA, surge? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const svc = new FoodDeliveryService({
  strategy: new NearestDriverStrategy(),   // or new HighestRatedStrategy(maxDistanceKm)
  cancellationFeePaise: 5000,
  clock: () => Date.now(),                 // injectable, so tests control time
});

svc.addRestaurant('R1', { x: 0, y: 0 });
svc.addDriver({ id: 'D1', location: { x: 1, y: 0 }, rating: 4.7 });
svc.updateDriverLocation('D1', { x: 2, y: 0 });
const off = svc.subscribe({ notify: (event) => console.log(event) });  // returns unsubscribe

const order = svc.placeOrder('C1', 'R1', [{ name: 'Pizza', pricePaise: 29900, quantity: 2 }]);
svc.acceptOrder(order.id);          // each of these returns an Order snapshot
svc.startPreparing(order.id);
svc.assignDriver(order.id);         // → 'D1'
svc.markReady(order.id);
svc.pickUp(order.id);
svc.deliver(order.id);

svc.cancel(id);                     // → { orderId, feePaise }
svc.getOrder(id);                   // → Order { id, customerId, restaurantId, items, totalPaise, status, driverId }
svc.isDriverFree('D1');             // → boolean
```

The internals (how you store states, drivers and observers) are **your design**. The tests only use the API above.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `FoodDeliveryService`: the facade. Owns restaurants, drivers, orders, the strategy and the observers
- `Order` record: id, items, total, status, driverId. `getOrder` returns a copy, so callers cannot change state from outside
- The state machine: a transition table `status → action → next status`. With this table, an illegal move is just a missing entry. Use State classes instead when each state has its own behaviour (timers, refunds, different fees)
- Cancel policy: two sets, "free cancel" states and "paid cancel" states
- `DriverRecord`: driver info + `busyWith: orderId | null`
- `DriverAssignmentStrategy` (interface) → `NearestDriverStrategy`, `HighestRatedStrategy`. It gets only free drivers
- `OrderObserver` (interface) with one `notify(event)` method. `OrderEvent` is a discriminated union

Relationships: Service ◆— Order, Service ◆— DriverRecord (composition). Service ⟶ Strategy and Observers (dependency injection).

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/18-food-delivery` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Two orders assigned the same driver at the same time.** In one Node process the synchronous `assignDriver` is safe. With many instances, use a conditional update (`UPDATE drivers SET busy_with = ? WHERE id = ? AND busy_with IS NULL`) or a Redis `SET NX` lock per driver.
2. **The driver rejects the offer.** Add an `OFFERED` step with a timeout. On reject or timeout, exclude that driver and call the strategy again.
3. **Batching.** One driver carries two orders from the same restaurant. `busyWith` becomes a list with a capacity.
4. **Driver search at scale.** Do not scan all drivers. Keep drivers in a geohash or quadtree index and query only nearby cells.
5. **Notifications over a queue.** Publish events to RabbitMQ or Kafka after the state change is saved (transactional outbox). Then SMS and push run in other services, with retries.
6. **Refunds on cancel.** Cancel creates a refund of `total − fee` in the payment service (see problem 19).

## Self-check before you call it done

- [ ] No `if (status === …)` chains spread across methods. The legal moves are in one table or in State classes.
- [ ] Every guard runs before any mutation. A failed call leaves the order and the driver unchanged.
- [ ] The strategy gets only free drivers and is injected. Adding a new strategy changes no other code.
- [ ] No singletons, no `Date.now()` inside methods, no `console.log` in the domain.
- [ ] An observer that throws does not stop the order flow.

## Concepts used

- [State pattern](../../concepts/patterns/p12-state.md) · [Strategy pattern](../../concepts/patterns/p10-strategy.md) · [Observer pattern](../../concepts/patterns/p11-observer.md) · [Singleton (and why to avoid it here)](../../concepts/patterns/p01-singleton.md)
- [Repository and DI](../../concepts/patterns/p18-repository-di.md) · [Concurrency in Node LLD](../../concepts/06-concurrency-in-node.md)
- Related HLD: [Food Delivery (Swiggy/Zomato)](../../../hld/problems/11-food-delivery/) · [Geospatial indexing](../../../hld/concepts/28-geospatial.md)
- Visuals: [State machine](../../../visuals/v25-state-machine.html) · [Observer and pub-sub](../../../visuals/v24-observer-pubsub.html) · [Strategy + Factory](../../../visuals/v23-strategy-factory.html)
