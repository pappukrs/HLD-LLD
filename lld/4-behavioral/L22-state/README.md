# L22 · State

> **Time:** ~35 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx lld/4-behavioral/L22-state/demo.ts`)
> **Builds on:** [L20 Strategy](../L20-strategy/README.md) · [L04 SOLID: SRP and OCP](../../1-foundations/L04-solid-srp-ocp/README.md) · **Used in:** [06 Vending Machine](../../problems/06-vending-machine/README.md), [11 ATM](../../problems/11-atm/README.md), [10 Elevator](../../problems/10-elevator/README.md), [17 Ride Sharing](../../problems/17-ride-sharing/README.md), [18 Food Delivery](../../problems/18-food-delivery/README.md), [19 Payment Wallet](../../problems/19-payment-wallet/README.md), HLD [08 Payment System](../../../hld/case-studies/08-payment-system/README.md)

## The idea in one line

An object changes its behaviour when its internal state changes: each state is its own object (or a row in a transition table) that decides what each event does and which state comes next.

## Why it matters (the problem it solves)

Most LLD problems have a **lifecycle**: a vending machine, an ATM session, a ride, an order, a payment. Without a pattern, every method starts with `if (this.status === ...)`:

```ts
// Before: the rules are scattered over every method
class Payment {
  status = 'CREATED';
  authorize() {
    if (this.status === 'CREATED') this.status = 'AUTHORIZED';
    else throw new Error('bad state');
  }
  capture() {
    if (this.status === 'AUTHORIZED') this.status = 'CAPTURED';
    else if (this.status === 'CAPTURED') return;   // idempotent only here, by accident
    else throw new Error('bad state');
  }
  refund() {
    if (this.status === 'CAPTURED') this.status = 'REFUNDED';
    // forgot the else: refund of a FAILED payment silently does nothing
  }
}
```

Problems:
- To see "what can happen in CAPTURED?" you must read every method.
- Adding `PARTIALLY_REFUNDED` means editing every method (breaks Open/Closed).
- Missing `else` branches become silent bugs. In payments, a silent bug is lost money.

## How it works

### The three roles

| Role | Job | Example |
|---|---|---|
| **Context** | Holds the current state. Forwards every event to it. Has no `if` on status. | `Payment`, `VendingMachine` |
| **State interface** | One method per event. | `PaymentState { authorize, capture, fail, refund }` |
| **Concrete states** | Implement the events that are legal. Reject the rest. Choose the next state. | `Created`, `Authorized`, `Captured` |

### Class diagram

```
             ┌──────────────────────────┐   current   ┌─────────────────────────────┐
             │ Payment (context)        │────────────▶│ «interface» PaymentState     │
             │ - state: PaymentState    │             │ + authorize(p)               │
             │ + authorize()  → state.  │             │ + capture(p)                 │
             │ + capture()    → state.  │             │ + fail(p, reason)            │
             │ + setState(s)            │             │ + refund(p)                  │
             └──────────────────────────┘             └──────────────▲──────────────┘
                                                                     │ implements
                                                          ┌──────────┴──────────┐
                                                          │ BaseState (rejects   │
                                                          │ every event)         │
                                                          └──────────▲──────────┘
                                     ┌──────────────┬──────────────┼──────────────┬──────────────┐
                                  Created       Authorized      Captured         Failed       Refunded
```

### The state diagram (draw this first in the interview)

```
        authorize            capture             refund
 CREATED ─────────▶ AUTHORIZED ─────────▶ CAPTURED ─────────▶ REFUNDED
    │                   │   ⟲ authorize       ⟲ capture
    │ fail              │ fail                (duplicate webhooks are no-ops)
    ▼                   ▼
  FAILED ◀──────────────┘
```

Write the same thing as a table. The table is where you catch gaps:

| state \ event | authorize | capture | fail | refund |
|---|---|---|---|---|
| CREATED | → AUTHORIZED | reject | → FAILED | reject |
| AUTHORIZED | no-op | → CAPTURED | → FAILED | reject |
| CAPTURED | reject | no-op | reject | → REFUNDED |
| FAILED | reject | reject | reject | reject |
| REFUNDED | reject | reject | reject | reject |

### Step by step: one event

1. Caller: `payment.capture()`.
2. Context: `this.state.capture(this)`. No checks.
3. `Authorized.capture(p)` runs the rule and calls `p.setState(STATES.CAPTURED)`.
4. Next event goes to the `Captured` object. Same method call, different behaviour.

### Who decides the next state?

- **The state object** (GoF default): the transition rule sits next to the behaviour. Good when states have real logic (vending machine computes change).
- **A central table**: all transitions in one map, easy to review and to print as a diagram. Good when states have little logic (order or payment status).
- Both are fine. Say which one you picked and why.

### State data: where does it live?

- Data that belongs to the whole object (balance, payment amount) stays on the **context**.
- Data that only exists in one state (the selected item while dispensing) can live on the **state object**. Then create a new state instance per transition.
- If a state has no fields, share one instance (`STATES.CAPTURED`). That is a Flyweight.

### How to spot it in a problem statement

- Words like *status, lifecycle, stage, mode, phase*.
- "The same button does different things depending on ..." (insert coin while idle vs while dispensing).
- "It should not be possible to X before Y" (no dispense before payment, no refund before capture).
- Problems: vending machine, ATM, elevator, traffic light, order/ride/payment status, document approval, TCP connection, media player.

### State vs Strategy

They have the same class diagram. The difference is **who changes the object and when**:
- **Strategy**: the client picks it from outside, and it usually stays (pay by UPI vs card).
- **State**: the object changes it by itself as events arrive (Created → Authorized).

## In TypeScript

The context only delegates. The base class rejects everything, so a forgotten event fails loudly.

```ts
abstract class BaseState implements PaymentState {
  abstract readonly name: Status;
  authorize(_p: Payment): void { throw new InvalidTransition('authorize', this.name); }
  capture(_p: Payment): void { throw new InvalidTransition('capture', this.name); }
  fail(_p: Payment, _r: string): void { throw new InvalidTransition('fail', this.name); }
  refund(_p: Payment): void { throw new InvalidTransition('refund', this.name); }
}

class Authorized extends BaseState {
  readonly name = 'AUTHORIZED' as const;
  authorize() { /* duplicate webhook: no-op */ }
  capture(p: Payment) { p.setState(STATES.CAPTURED); }
  fail(p: Payment, reason: string) { p.failureReason = reason; p.setState(STATES.FAILED); }
}

class Payment {
  private state: PaymentState = STATES.CREATED;
  setState(s: PaymentState) { this.state = s; }
  capture() { this.state.capture(this); }   // no if, no switch
}
```

The table version, typed so a wrong status or event does not compile:

```ts
type Status = 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
type Event = 'authorize' | 'capture' | 'fail' | 'refund';
const TABLE: Record<Status, Partial<Record<Event, Status>>> = {
  CREATED: { authorize: 'AUTHORIZED', fail: 'FAILED' },
  AUTHORIZED: { authorize: 'AUTHORIZED', capture: 'CAPTURED', fail: 'FAILED' },
  CAPTURED: { capture: 'CAPTURED', refund: 'REFUNDED' },
  FAILED: {}, REFUNDED: {},
};
```

In a database, protect every transition with a compare-and-set update, so two workers cannot both move it:

```sql
UPDATE payments SET status = 'CAPTURED' WHERE id = $1 AND status = 'AUTHORIZED';
-- rowCount = 1: you won the transition. rowCount = 0: someone else did, do nothing.
```

`demo.ts` runs all three: state classes with duplicate and out-of-order webhooks, the table, and the DB race.

## Trade-offs / when NOT to use it

| Approach | Good | Bad | Use when |
|---|---|---|---|
| `switch` on a status field | Short | Rules spread over methods; edit all to add a state | 2–3 states, tiny logic |
| State classes | Each state is readable alone; OCP for new states | Many small classes; transitions spread across files | Rich behaviour per state (machine coding) |
| Transition table | All rules in one place; easy to persist and draw | Logic per state goes elsewhere | Many states, simple rules (order/payment status) |
| Library (XState) | Guards, nested states, visual tools | Extra dependency and learning | Complex UI or workflow statecharts |

- Don't create five classes for a `TODO / DONE` flag.
- Don't let state classes edit every field of the context. Give the context a few methods (`setState`, `refund(amount)`).
- In-memory state is not enough in a distributed system. The DB row is the source of truth; the class is just how you code the rules.

## Common mistakes

- **The context still has `if (state === ...)`.** Then you added classes but kept the switch. The context must only delegate.
- **Forgetting the reject path.** Use a base class that throws for every event; override only legal ones.
- **Treating duplicates as errors.** Providers retry webhooks. A second `capture` on `CAPTURED` should be a no-op success, not a 500 that causes more retries.
- **Mixing up State and Strategy.** Say the one-line difference above.
- **No concurrency story.** Two webhooks at the same time both read `AUTHORIZED`. Fix: conditional update, row lock, or a per-entity queue.
- **Not drawing the diagram.** Interviewers want the states and events listed before code.

## Say this in the interview

> "This object has a clear lifecycle, so I'll model it as a state machine. First the states and events: created goes to authorized or failed, authorized goes to captured or failed, captured goes to refunded. Each state is a class implementing the same interface. The payment holds the current state and forwards every call to it, so there is no switch in the payment class. A base state rejects every event by default, so an illegal call fails loudly. Adding partial refunds is one new class."

> "For persistence, every transition is a conditional update: set status to captured where status is authorized. If the row count is zero, another worker already moved it, so duplicate or out-of-order webhooks are safe."

## Your experience hook

- In the SenseGrass payment orchestration service, payment status was a state machine (created → pending → success/failed). It handled webhooks that arrived twice or out of order: a late `failed` after `success` was ignored, not applied.
- Tie it to idempotency: "at-least-once webhook delivery plus idempotent transitions gives an exactly-once effect."
- Mediasoup transports and producers also have lifecycles (new → connected → closed). Calling `produce` on a closed transport is the same "reject in this state" rule.

## Self-test

<details><summary>1. List the states and events of a vending machine.</summary>

States: `Idle`, `HasMoney`, `Dispensing`, optionally `SoldOut`. Events: insert coin, select item, cancel, dispense done, refill. `selectItem` has a guard: balance ≥ price.
</details>

<details><summary>2. State vs Strategy in one sentence.</summary>

Strategy is picked from outside and stays; State changes itself as events arrive.
</details>

<details><summary>3. What happens on `refund()` for a FAILED payment?</summary>

The base state throws `cannot refund when FAILED`. No silent no-op.
</details>

<details><summary>4. Two `capture` webhooks arrive at the same time on two servers. How do you stay correct?</summary>

Compare-and-set in the DB: `UPDATE ... SET status='CAPTURED' WHERE id=$1 AND status='AUTHORIZED'`. Only one gets rowCount 1. The other sees 0 and does nothing (or returns the stored result).
</details>

<details><summary>5. Should state objects be singletons?</summary>

If they have no fields, yes, share one instance per state. If a state carries data (the item being dispensed), create a new instance on each transition.
</details>

<details><summary>6. How do you add a SoldOut state to the vending machine?</summary>

Add a `SoldOutState` that rejects coins and selections. `DispensingState` moves to it when stock hits zero. `refill()` moves it back to `Idle`. No other class changes.
</details>

<details><summary>7. When is a transition table better than state classes?</summary>

When there are many states with little behaviour each (order status with 10 states). The table is one place to review, easy to store in config, and easy to render as a diagram.
</details>

## Go deeper

- Build it: [06 Vending Machine](../../problems/06-vending-machine/README.md), then [11 ATM](../../problems/11-atm/README.md) and [10 Elevator](../../problems/10-elevator/README.md)
- Related: [L20 Strategy](../L20-strategy/README.md) (same shape, different intent), [L23 Command](../L23-command/README.md) (events as objects)
- HLD: [08 Payment System](../../../hld/case-studies/08-payment-system/README.md) (status machine plus webhooks)
- Archive: [LLD-guide.md](../../../archive/notes/LLD-guide.md) (PART 3, "State Pattern")
