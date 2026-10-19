# H24 · Event-driven architecture, CQRS, event sourcing

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/4-async/H24-event-driven-cqrs/demo.ts`) · **Hands-on:** [hands-on/](hands-on/README.md)
> **Builds on:** [H20 Message queues](../H20-message-queues/README.md) · [H21 Kafka](../H21-kafka/README.md) · [H23 Distributed transactions](../H23-distributed-transactions/README.md) · **Used in:** Payment system, Digital wallet, Food delivery, News feed, Stock exchange, Ad click aggregation, Notification system

## The idea in one line

Services announce facts ("OrderPlaced") instead of calling each other; CQRS splits the write model from read models built from those facts; event sourcing goes further and stores the facts themselves as the source of truth.

## Why it matters (the problem it solves)

- **Coupling.** The order service calls notification, analytics, loyalty and search on every order. Every new consumer means a change and a deploy in the order service, and one slow consumer slows checkout.
- **One model for everything.** The same normalised tables serve strict transactional writes and wide, joined, searched reads. Indexes that help reads slow writes, and read traffic (often 100x writes) competes with checkout.
- **Lost history.** A row says `balance = 500`. It does not say how it got there. Auditors, support and debuggers want the history.

## How it works

### Events vs commands

| | Command | Event |
|---|---|---|
| Tense | Imperative: `CapturePayment` | Past: `PaymentCaptured` |
| Receiver | One owner | Zero to many subscribers |
| Can it be rejected? | Yes | No, it already happened |
| Coupling | Sender knows the receiver | Producer does not know who listens |

### Three styles of event-driven (Fowler)

| Style | Payload | Trade-off |
|---|---|---|
| Event notification | Only ids: `{orderId}` | Small events, but consumers call back for data (coupling returns) |
| Event-carried state transfer | Everything consumers need | Consumers are independent; bigger events and data copies everywhere |
| Event sourcing | Events **are** the database | Full history and replay; hardest to run |

Publish events with the **outbox** ([H23](../H23-distributed-transactions/README.md)), key them by aggregate id for per-entity order ([H21](../H21-kafka/README.md)), and make consumers idempotent ([H22](../H22-delivery-semantics/README.md)).

### CQRS (Command Query Responsibility Segregation)

```
             command                          query
  Client ───────────────► Write service      Client ──────────► Query service
                              │                                    │      │
                    one tx: row + outbox                           ▼      ▼
                              ▼                          Elasticsearch   Redis / Cassandra
                     Postgres (normalised) ──CDC──► Kafka ──► Projector A ─┘      │
                                                         └──► Projector B ────────┘
```

- The **write side** checks business rules in a model built for correctness (normalised Postgres, constraints, transactions).
- **Projectors** consume events and build **read models**, each shaped for one screen or query: a search index, a denormalised dashboard row, a per-user feed.
- Read models are **eventually consistent**: tens of ms to a few seconds of lag when healthy.
- A read model is **disposable**: drop it, replay events from the start, and it comes back. Adding a new view a year later is just a new consumer group from offset 0 (needs long retention or a compacted topic).

**Projectors must be idempotent and order-safe.** Store `last_version` per aggregate in the read model and skip any event with `version ≤ last_version`. That single check handles duplicates and replays.

**Read-your-writes on top of CQRS:**
1. Return the new state in the command response, and render from that.
2. Return the write's version; the client polls the read model until `version ≥ v` (or the query waits briefly).
3. For "my own item, right after I changed it", read from the write side.

### Event sourcing

Store every change as an event in an append-only stream per aggregate. Current state is a **fold** over the events.

```
account 7:  v1 Opened → v2 Deposited(1000) → v3 Withdrew(300) → v4 Deposited(50)
state = events.reduce(apply, empty) = { balance: 750, version: 4 }
```

| Concern | How |
|---|---|
| Writing | Load the stream, fold to state, check the rule, append with `expectedVersion` (optimistic concurrency). Two writers at v4: one wins (v5), the other gets a conflict, reloads and re-checks |
| Read speed | **Snapshot** every N events (100–1000): load snapshot + the few events after it |
| Queries ("balance > X") | Never query the event store. Build a projection table and query that |
| Schema change | Events live forever. Version them and **upcast** v1 → v2 when reading |
| Deleting personal data (GDPR / DPDP) | You cannot edit an immutable log: encrypt personal fields with a per-user key and delete the key (**crypto-shredding**) |
| Time travel | "State as of 31 March" = fold events up to that timestamp |

A ledger is the natural fit: double-entry journal lines are already immutable events, and the balance is a derived value ([H38](../../6-building-blocks/H38-payments-domain/README.md)).

### How much of this to use

```
Plain CRUD + audit table             ← most services
CRUD + events via outbox             ← when others must react
CQRS (write DB + read models)        ← reads very different from writes, or read scale ≫ write scale
Event sourcing                       ← only aggregates where history IS the product (ledger, wallet, order lifecycle)
```

## In TypeScript

Event-sourced aggregate with optimistic concurrency, plus an idempotent projector (full runnable version in `demo.ts`):

```ts
type Evt = { stream: string; version: number; type: 'Deposited' | 'Withdrew'; amount: number };

const apply = (bal: number, e: Evt) => (e.type === 'Deposited' ? bal + e.amount : bal - e.amount);

function withdraw(store: EventStore, id: string, amount: number, expectedVersion: number) {
  const events = store.load(id);
  if (events.length !== expectedVersion) throw new Error('ConcurrencyError: reload and retry');
  const balance = events.reduce(apply, 0);
  if (balance < amount) throw new Error('InsufficientFunds');
  store.append({ stream: id, version: expectedVersion + 1, type: 'Withdrew', amount });
}

// Projector: skip anything already applied (duplicates, replays).
function project(view: Map<string, { balance: number; version: number }>, e: Evt) {
  const row = view.get(e.stream) ?? { balance: 0, version: 0 };
  if (e.version <= row.version) return;
  view.set(e.stream, { balance: apply(row.balance, e), version: e.version });
}
```

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Sync calls (REST/gRPC) | You need the answer now (price, auth, stock check) | Coupling, cascading failures |
| Events (pub-sub) | Many consumers react to one fact | Eventual consistency; harder to trace (use trace ids in headers) |
| CQRS | Read and write shapes differ a lot; read scale ≫ write scale | Two models to sync; lag; more infra |
| Event sourcing | Audit is a requirement; "state as of T"; ledgers | Schema evolution, replay time, steep learning curve |
| CRUD + audit table | Most services | Audit table can drift from the real change |

- Do **not** event-source a whole system. Pick the one or two aggregates where history matters.
- Do **not** add CQRS to a CRUD admin panel with 10 requests a minute. It doubles the moving parts.
- Events are a public contract. Changing a field is a breaking API change: version schemas (Avro / Protobuf + schema registry).

## Common mistakes

- Naming events as commands (`SendEmail` instead of `UserRegistered`), which hides who owns the decision.
- Publishing events with a dual write instead of an outbox.
- Projectors that are not idempotent, so a replay doubles counters.
- Expecting the read model to be fresh right after a write, then calling it a bug. Design read-your-writes explicitly.
- Querying the event store for list views. Build a projection.
- No plan for event versioning, so a field rename breaks every consumer.
- Event notification with only ids, then every consumer calls the producer back: the coupling and load come straight back.

## Say this in the interview

> "The order service owns writes in Postgres. Every state change writes an outbox event in the same transaction; Debezium puts it on Kafka keyed by order id. Search, notifications and analytics each consume it and build their own read model. That's CQRS without full event sourcing. Projectors keep the last applied version per order, so duplicates and replays are no-ops."

> "Read models lag by up to a second, so right after checkout the order page reads that one order from the write side, or renders from the command response. I'd only event-source the wallet ledger: there the history is the product, I append with an expected version to stop double spends, and I snapshot every few hundred events."

## Your experience hook

- **IoT platform:** device events were fanned out across WebSocket nodes with a Redis adapter: that is event-driven fan-out. At 10x, the device stream on Kafka feeds separate read models: a "latest status" table, a time-series store, and alerting.
- **Microservices gateway project:** auth, order, payment and notification each had their own DB. "Notify on order paid" is a textbook event consumer instead of a sync call from the order service.
- **Payment orchestration:** your payment status history (created → pending → success/failed, with webhook events) is effectively an event stream per payment. Say how you would expose it: a status read model for the dashboard, and the raw events for audit.

## Numbers to remember

| Thing | Number |
|---|---|
| Read-model lag, healthy Kafka pipeline | Tens of ms to ~1–2 s |
| Read-model lag during a consumer outage | Unbounded: alert on consumer lag |
| Snapshot interval | Every ~100–1000 events |
| Replay speed of one projector | Often 10k–100k events/s; a 1B-event rebuild takes hours, so plan for it |
| Read:write ratio that justifies CQRS | Roughly 10:1 and up, or very different shapes |

## Self-test

<details><summary>1. "SendWelcomeEmail" or "UserRegistered": which is an event?</summary>

`UserRegistered`. It is a fact in the past tense owned by the user service. `SendWelcomeEmail` is a command to one service.
</details>

<details><summary>2. A user updates their profile, refreshes, and the old name shows. Why, and one fix?</summary>

The page reads a CQRS read model that has not applied the event yet. Return the new state in the write response, or read the user's own profile from the write side for a few seconds, or wait until the read model version ≥ the write version.
</details>

<details><summary>3. Two withdrawals hit the same event-sourced account at version 5. What stops a double spend?</summary>

Append with `expectedVersion = 5`. The first succeeds and makes version 6. The second fails the version check, reloads, re-checks the balance, and retries or rejects.
</details>

<details><summary>4. How does a projector handle duplicate and out-of-order events?</summary>

Key by aggregate id so one entity's events are in one partition in order. Store the last applied version per aggregate and skip events with version ≤ stored.
</details>

<details><summary>5. You need a new "top sellers" view a year after launch. How?</summary>

Start a new consumer group from the earliest offset (needs long retention or a compacted topic), or bootstrap from a DB snapshot and then stream from that position (Debezium does snapshot + stream).
</details>

<details><summary>6. How do you delete a user's personal data from an immutable event store?</summary>

Crypto-shredding: personal fields are encrypted with a per-user key stored elsewhere. Delete the key and the data is unreadable everywhere, including backups.
</details>

<details><summary>7. When is event sourcing a bad idea?</summary>

For simple CRUD with no audit need, for teams new to it, and for data that changes shape often. You pay for versioning, snapshots and replays without getting value from the history.
</details>

## Go deeper

- Hands-on: [hands-on/README.md](hands-on/README.md) (CQRS with Kafka and Postgres)
- Case studies: [Payment system](../../case-studies/08-payment-system/README.md), [Digital wallet](../../case-studies/28-digital-wallet/README.md), [News feed](../../case-studies/07-news-feed/README.md), [Food delivery](../../case-studies/11-food-delivery/README.md), [Stock exchange](../../case-studies/26-stock-exchange/README.md)
- LLD: [Pub-sub queue](../../../lld/problems/15-pub-sub-queue/README.md)
- Archive notes: [hld-parts/part3.md](../../../archive/notes/hld-parts/part3.md) ("Event Sourcing Pattern", "CQRS", "Handling Event Ordering & Consistency"), [hld-parts/part8.md](../../../archive/notes/hld-parts/part8.md) ("Event Sourcing & CQRS")
- Martin Fowler: "CQRS", "Event Sourcing", "What do you mean by Event-Driven?"; DDIA chapter 11 ("Databases and Streams", "Event Sourcing")
