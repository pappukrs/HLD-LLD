# SD Day 12 — Quiz: Idempotency + Distributed Transactions

*Answer each OUT LOUD, in your own words, before expanding. If you fumble, re-read that section.
Target: explain the outbox two-writes bug (Q5) and the saga vs 2PC choice (Q3) cold — these are
the senior differentiators.*

---

**Q1. What does "idempotent" mean, and which common operations are NOT idempotent?**

<details><summary>answer</summary>

An operation is **idempotent** if doing it multiple times has the **same effect as doing it once**.
`GET`, `PUT x=5`, `DELETE` are naturally idempotent. **Not** idempotent: "increment", "append",
"add ₹500", a raw `POST` that creates a row — running them twice does the thing twice (double-charge,
double-row). Those are the ones you must protect.
</details>

---

**Q2. How does an idempotency key work, and what's the #1 mistake in choosing the key?**

<details><summary>answer</summary>

The caller attaches a unique key (UUID) per **logical operation**. The server checks: seen this key?
**No** → do the work, store `key → result`, return it. **Yes** → skip the work, return the **same
stored result**. So retries are safe. The #1 mistake: generating a **new key per network attempt**
instead of per *intent* — then every retry looks new and dedup never fires. One operation = one key
across all retries. (Also: the check+store must be atomic — unique constraint / `SET NX`.)
</details>

---

**Q3. Why is 2-phase commit (2PC) avoided across microservices, and what's used instead?**

<details><summary>answer</summary>

2PC (coordinator asks "can you commit?" then "commit!") gives strong consistency but **blocks** —
participants hold locks waiting on the slowest — and if the **coordinator dies** mid-protocol they're
stuck in-doubt holding locks. It scales poorly and hurts availability. Instead use a **saga**:
per-service local transactions with **compensating actions**, accepting eventual consistency.
</details>

---

**Q4. Define a saga. Explain choreography vs orchestration and which you'd pick for payments.**

<details><summary>answer</summary>

A **saga** is a sequence of local transactions (one per service), each with a **compensating action**
that undoes it; if a step fails you run the prior compensations in reverse (semantic rollback).
- **Choreography:** services react to each other's events, no central brain — decoupled but the flow
  is implicit and hard to debug.
- **Orchestration:** a central orchestrator tells each service what to do and triggers compensations —
  easier to understand, monitor, and change.

For **payments** (complex, needs visibility/auditing) → **orchestration**.
</details>

---

**Q5. Describe the "two writes" problem and how the outbox pattern solves it.**

<details><summary>answer</summary>

A service must (1) write to its **DB** and (2) **publish an event** to the broker — two separate
systems that can't be made atomic. Crash between them → either the event is **lost** (DB updated, no
event) or a **phantom** (event sent, DB rolled back). **Outbox:** write the event into an `outbox`
**table in the same DB transaction** as the business data → one atomic commit (both or neither). A
separate **relay / CDC (e.g. Debezium)** reads unsent outbox rows and publishes them, marking them
sent. If it crashes after publishing but before marking → re-publish → **at-least-once** → so
consumers must be **idempotent**.
</details>

---

**Q6. How do idempotency, outbox, and sagas fit together in one sentence?**

<details><summary>answer</summary>

The **outbox** emits events reliably (at-least-once) atomically with the DB write; the **saga** uses
those events to drive multi-service steps and compensations; and because at-least-once means
duplicates, **idempotency keys** make handling a duplicate harmless — together giving distributed
correctness **without 2PC**.
</details>

---

**Q7. A saga compensation can't literally undo everything. Give an example and the principle.**

<details><summary>answer</summary>

You can't un-send an email or un-ship a package. The principle: compensation is **semantic /
forward-recovery**, not a real rollback — you issue a **new** action that offsets the effect (send a
correction/apology, issue a **refund** instead of "un-charging", cancel + restock). And the
compensator itself needs retries + idempotency because it can fail too.
</details>

---

**Q8. Map it to your payments system: where do idempotency, saga, and outbox each show up?**

<details><summary>answer</summary>

- **Idempotency:** keys on the charge endpoint / dedup webhook event ids so provider retries don't
  double-charge.
- **Saga (orchestrated):** sequence payment → ledger → notification, with **refund** as the
  compensation if a later step fails.
- **Outbox:** write "PaymentSucceeded" into an outbox row in the same transaction as the ledger
  update, relay to RabbitMQ — so the event is never lost between DB and broker.
- **Reconciliation** is the safety net that catches any saga stuck in a half state.
</details>

---

**Q9 (interview close). In 30 seconds: how do you keep a multi-service business action correct?**

<details><summary>answer</summary>

"I avoid 2-phase commit — it blocks and fails badly. I make each step a local transaction in a
**saga** with **compensating actions**, usually **orchestrated** for visibility. I emit the driving
events with the **outbox pattern** so they're written atomically with the DB and never lost. Since
that delivery is **at-least-once**, every consumer is **idempotent** via an idempotency key. The
result is eventual consistency with semantic rollback, plus reconciliation to catch stragglers."
</details>

---

> Next block (building blocks): **consistent hashing, bloom filters, unique ID generation
> (Snowflake), rate limiting** — and then full mock designs, where payments / order / notification
> flows reuse exactly this outbox + saga + idempotency trio you just learned.
