# H23 · Distributed transactions: 2PC, Saga, Outbox

> **Time:** ~50 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/4-async/H23-distributed-transactions/demo.ts`)
> **Builds on:** [H12 Transactions and isolation](../../3-databases/H12-transactions-isolation/README.md) · [H22 Delivery semantics and idempotency](../H22-delivery-semantics/README.md) · [H21 Kafka](../H21-kafka/README.md) · **Used in:** Payment system, Food delivery, Hotel booking, Ticket booking, Digital wallet, E-commerce checkout

## The idea in one line

When one business action spans several services, you either lock them all and commit together (2PC, rarely), or run a chain of local transactions with undo steps (Saga); and you publish events reliably with a transactional outbox.

## Why it matters (the problem it solves)

"Place order" must reserve stock, charge the customer and create a delivery. Each lives in a different service with its own database. There is no `BEGIN … COMMIT` across them.

The second problem is quieter and shows up in every event-driven design, the **dual write**:

```ts
await db.update(order, 'PAID');     // succeeds
await kafka.send('order.paid');     // pod dies here → event lost forever, downstream never knows
```

Swapping the order does not help: then the event goes out for a change that may roll back. Any two separate writes can half-fail.

## How it works

### Two-phase commit (2PC)

```
Coordinator           Inventory DB           Payments DB
    │── PREPARE ──────────►│                      │
    │── PREPARE ─────────────────────────────────►│
    │◄─ YES (locks held) ──│                      │
    │◄─ YES (locks held) ─────────────────────────│
    │  write COMMIT to own log  ← decision point
    │── COMMIT ───────────►│                      │
    │── COMMIT ──────────────────────────────────►│
```

1. **Prepare:** each participant writes the change durably, **keeps its locks**, and votes yes or no.
2. **Commit:** if all vote yes, the coordinator logs the decision and tells everyone to commit. Any "no" → abort everywhere.

**The blocking problem.** After voting yes, a participant may not decide alone. If the coordinator crashes now, the participant is **in doubt**: it holds row locks until the coordinator returns. Every other transaction on those rows waits. 3PC tries to fix this but assumes bounded network delay, so nobody uses it.

Other costs: 2 round trips plus forced log writes per participant, the slowest participant sets latency, and everyone must speak XA. Kafka, Stripe, Razorpay and banks do not.

**Where 2PC is fine:** inside one database product. Spanner and CockroachDB run 2PC across shards, but each participant and the coordinator is a Paxos/Raft group, so a "crashed coordinator" is replaced in seconds and never blocks for long.

### Saga

A saga is a sequence of **local** transactions `T1 → T2 → T3`, each committed on its own. If `Tk` fails, run **compensations** `Ck-1 … C1` in reverse.

| Step | Action | Compensation |
|---|---|---|
| T1 | Order: create `PENDING` | Mark `CANCELLED` |
| T2 | Inventory: reserve 2 items (TTL 15 min) | Release reservation |
| T3 | Payment: charge ₹500 (**pivot**) | Refund |
| T4 | Delivery: assign rider | none: retry forward until it works |
| T5 | Notify: send receipt | none: retry forward |

```
happy path:   T1 ─► T2 ─► T3 ─► T4 ─► T5   order CONFIRMED
T3 fails:     T1 ─► T2 ─► T3 ✗
                     C2 ◄─ C1 ◄┘           order CANCELLED (stock released)
```

Rules:

- A compensation is a **semantic undo** (a refund, a release), not a rollback. The original write stays in history.
- Every step and compensation is **idempotent** and retried until it succeeds. A compensation that keeps failing goes to `NEEDS_ATTENTION` and a human queue; never drop it.
- The **pivot** is the point of no return (usually the payment capture). Put cheap, undoable steps before it and retriable, can't-fail steps after it. Irreversible side effects (email, shipping) go last.
- Sagas have **no isolation** (the "I" in ACID is missing). Others can see `PENDING` data. Use semantic locks (a `PENDING` / reserved state other flows respect), reservations with TTL, and re-check values at each step.

### Choreography vs orchestration

```
Choreography:  Order ──OrderCreated──► Inventory ──StockReserved──► Payment ──PaymentDone──► Delivery
Orchestration: Orchestrator ──reserve──► Inventory
                            ──charge───► Payment
                            ──assign───► Delivery       (state machine + saga log in its own DB)
```

| | Choreography | Orchestration |
|---|---|---|
| Control | Each service reacts to events | One orchestrator owns the state machine |
| Good for | 2–4 steps, loosely owned | Many steps, branches, timeouts |
| Weakness | Flow is hidden across services; cyclic dependencies | One more service to run |
| Tools | Kafka / RabbitMQ events | Temporal, AWS Step Functions, Camunda, a DB-backed state machine |

For payments and checkout, prefer orchestration: one place answers "where is order o-42 stuck?". The orchestrator writes the saga state after every step, so after a crash it resumes forward or keeps compensating.

### Transactional outbox

Write the event into an `outbox` table **in the same local transaction** as the business change. A separate relay publishes it.

```sql
BEGIN;
UPDATE orders SET status = 'PAID' WHERE id = 42;
INSERT INTO outbox (id, aggregate_id, type, payload) VALUES (gen_random_uuid(), 42, 'order.paid', '{...}');
COMMIT;   -- both rows or neither
```

```
Order service ──one local tx──► [ orders | outbox ] ──WAL/binlog──► Debezium ──► Kafka ──► consumers (inbox dedupe)
                                                   └─ or: poller every 100 ms ─┘
```

| Relay | How | Pros | Cons |
|---|---|---|---|
| Polling publisher | `SELECT … WHERE published_at IS NULL ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED`, publish, mark | Simple, no new infra | DB load, 100–500 ms delay |
| CDC (Debezium) | Reads Postgres WAL / MySQL binlog, Outbox Event Router | Tens of ms, commit order, no polling | Kafka Connect to operate |

The relay can publish and crash before marking the row. So the outbox gives **at-least-once**, and consumers dedupe with an **inbox table** (see [H22](../H22-delivery-semantics/README.md)). Publish with the aggregate id as the Kafka key, so events of one order stay in commit order.

### Which tool when

```
All data in one DB?                         → plain ACID transaction. Done.
Several shards of one DB product?           → its built-in distributed tx (Spanner, CockroachDB, Vitess).
Several services / external APIs?           → saga (orchestrated for >3 steps) + outbox + inbox.
Just "save + publish"?                      → outbox alone.
```

## In TypeScript

An orchestrator that runs steps and compensates in reverse (full version with retries and an outbox in `demo.ts`):

```ts
type Step = { name: string; run: () => Promise<void>; compensate?: () => Promise<void> };

async function runSaga(steps: Step[], log: SagaLog): Promise<'COMPLETED' | 'COMPENSATED'> {
  const done: Step[] = [];
  for (const s of steps) {
    try {
      await s.run();                       // each run() is a local tx + outbox row, idempotent
      done.push(s);
      await log.save(s.name, 'DONE');      // resume point after an orchestrator crash
    } catch {
      for (const d of done.reverse()) await retryForever(() => d.compensate?.() ?? Promise.resolve());
      return 'COMPENSATED';
    }
  }
  return 'COMPLETED';
}
```

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Single DB transaction | All data fits one DB (often true early on) | Couples services to one schema |
| 2PC / XA | Few participants, all XA-capable, same DC | Blocks on coordinator failure; locks held across round trips; no broker / PSP support |
| Saga, orchestrated | Long or branching flows, external calls | No isolation; you design every compensation |
| Saga, choreographed | Short flows, teams own their reactions | Flow hard to see and debug |
| Outbox + polling | Any "write then publish" | Poll load, slight delay |
| Outbox + CDC | High volume, ordered events | Debezium and Kafka Connect to run |

Do not split into services and then reach for distributed transactions everywhere. If two things must always change together, they probably belong in one service and one database.

## Common mistakes

- Proposing 2PC across microservices and a PSP. The PSP will never join your transaction.
- Calling a compensation a "rollback". The charge happened; the refund is a new, visible event.
- Compensations that are not idempotent or not retried, so a failed refund is silently lost.
- Putting the irreversible step (send email, ship) before the risky step (charge).
- Forgetting isolation: two sagas both read "1 left in stock" and both reserve. Make the reservation itself atomic (`UPDATE … WHERE available >= 1`).
- "We publish after commit, it's fine": that is still a dual write. Use the outbox.
- Using an outbox but no consumer dedupe. The relay delivers at-least-once.

## Say this in the interview

> "I won't use 2PC across services: the PSP doesn't support it, and a coordinator crash leaves locks held. Checkout is an orchestrated saga: create the order as PENDING, reserve stock with a TTL, charge, then confirm. If the charge fails, the orchestrator releases stock and cancels the order, in reverse. The charge is the pivot; everything after it only retries forward."

> "Every state change writes an outbox row in the same local transaction, and a relay or Debezium streams the outbox to Kafka keyed by order id. Delivery is at-least-once, so consumers dedupe on event id with an inbox table. The orchestrator persists saga state after each step, so after a crash it resumes, and stuck sagas go to an ops queue."

## Your experience hook

- **Payment orchestration:** your payment service was already a state machine (`created → pending → success/failed`) across 3 PSPs. That is an orchestrated saga with one step. Name the 10x answer you wrote yourself: "outbox pattern + queue so the charge and the DB write can't diverge, plus a reconciliation job against the provider."
- **Microservices gateway project:** each service owned its DB (auth, order, payment, notification), so cross-service flows like "order → payment → notification" needed a saga, not a JOIN or 2PC.
- **RabbitMQ events:** if you published to RabbitMQ right after a DB commit, that was a dual write. Say how you would harden it: an outbox table and a poller.

## Numbers to remember

| Thing | Number |
|---|---|
| 2PC cost | ≥ 2 round trips + 2 forced log writes per participant; locks held throughout |
| Outbox delay, polling | 100–500 ms |
| Outbox delay, CDC | Tens of ms |
| Stock reservation TTL | 10–15 min is typical for checkout |
| Saga with N steps | Up to N−1 compensations, each with retry + alert |
| PSP "unknown" state | Resolve by status query / reconciliation, often within minutes; webhook retries for up to ~3 days |

## Self-test

<details><summary>1. In 2PC a participant voted YES and the coordinator died. Can it commit or abort on its own?</summary>

No. It is in doubt: another participant may have voted NO, or the coordinator may have logged COMMIT. It waits, holding locks, or asks the other participants.
</details>

<details><summary>2. Why is "publish to Kafka, then write to the DB" also wrong?</summary>

The DB write can fail or roll back after the event is out. Consumers act on a change that never happened.
</details>

<details><summary>3. Which saga step should be the pivot in an order flow, and why?</summary>

The payment capture. Before it, undo is cheap (release stock, cancel order). After it, steps should be retriable forward (assign delivery, send receipt), because undo means a refund.
</details>

<details><summary>4. What if a compensation fails?</summary>

Retry with backoff; it must be idempotent. After N attempts, set the saga to `NEEDS_ATTENTION`, alert, and add it to an ops queue. For money, the ledger keeps the open item until it is resolved.
</details>

<details><summary>5. The orchestrator crashes in the middle of a saga. What happens?</summary>

It saved the saga state after each step. On restart it reads that state and continues forward or keeps compensating. Steps are idempotent, so repeating the last one is safe.
</details>

<details><summary>6. How do you stop two sagas from overselling the last item?</summary>

Make the reservation atomic in the inventory DB: `UPDATE stock SET reserved = reserved + 1 WHERE sku = ? AND available - reserved >= 1`. Never "read, then decide" across services. Give reservations a TTL so abandoned sagas free the stock.
</details>

<details><summary>7. Does the outbox keep event order?</summary>

Per aggregate, yes, if you publish with the aggregate id as the Kafka key: one order's events go to one partition in commit order. There is no global order across aggregates, and you rarely need it.
</details>

## Go deeper

- Next: [H24 Event-driven architecture, CQRS, event sourcing](../H24-event-driven-cqrs/README.md)
- Case studies: [Payment system](../../case-studies/08-payment-system/README.md), [Food delivery](../../case-studies/11-food-delivery/README.md), [Hotel booking](../../case-studies/23-hotel-booking/README.md), [Ticket booking](../../case-studies/09-ticket-booking/README.md), [Digital wallet](../../case-studies/28-digital-wallet/README.md)
- LLD: [Payment wallet](../../../lld/problems/19-payment-wallet/README.md), [E-commerce cart and coupons](../../../lld/problems/20-ecommerce-cart-coupons/README.md)
- Archive notes: [hld-parts/part8.md](../../../archive/notes/hld-parts/part8.md) ("Distributed Transactions", "When to Use 2PC"), [hld-parts/part3.md](../../../archive/notes/hld-parts/part3.md) ("Saga Pattern for Distributed Transactions")
- Chris Richardson, *Microservices Patterns*, chapters 3–4; Garcia-Molina and Salem, "Sagas" (1987); DDIA chapter 9 ("Atomic Commit and Two-Phase Commit"); Debezium "Outbox Event Router"
