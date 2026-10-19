# SD Day 11 — Quiz: RabbitMQ vs Kafka

*Answer each OUT LOUD, in your own words, before expanding. If you fumble, re-read that section.
Target: explain the one core difference (Q2) and the delivery-guarantee reality (Q6) cold.*

---

**Q1. What problem does a message queue solve? Name three concrete things it buys you.**

<details><summary>answer</summary>

It **decouples producer from consumer in time** — A hands off work without waiting for B. Three wins:
**buffering / load-leveling** (a spike fills the queue, the consumer drains steadily instead of
crashing), **resilience** (consumer down → messages wait), and **fan-out** (one event, many
independent consumers). Bonus: independent scaling of producer vs consumer.
</details>

---

**Q2. In one breath, the core difference between RabbitMQ and Kafka?**

<details><summary>answer</summary>

**RabbitMQ deletes a message once it's delivered+acked (a to-do list); Kafka keeps every message in a
durable log for a retention period and lets consumers re-read at their own pace by remembering their
offset (a replayable podcast feed).** Delete-after-delivery vs keep-and-replay — every other
difference follows from that.
</details>

---

**Q3. In RabbitMQ, walk the path of a message and say when it gets deleted.**

<details><summary>answer</summary>

Producer publishes to an **exchange** → exchange **routes** it into one or more **queues** (by
direct/topic/fanout rules) → broker **pushes** it to a subscribed consumer → consumer processes and
sends an **ack** → broker **deletes** it. No ack (consumer died) → message is **requeued** and
redelivered. It's gone after ack — no replay.
</details>

---

**Q4. In Kafka, what is a partition, what is an offset, and what does "order is only guaranteed within a partition" mean?**

<details><summary>answer</summary>

A **partition** is one append-only shard of a topic — the unit of both parallelism and ordering. An
**offset** is a consumer's bookmark = how far it has read in a partition. Order holds **only inside a
single partition**, not across the whole topic, so to keep related events ordered you give them the
**same key** (e.g. `userId`) → they hash to the same partition → stay in order. Events in different
partitions have no guaranteed relative order.
</details>

---

**Q5. How does scaling consumers differ, and what's a "consumer group" in Kafka?**

<details><summary>answer</summary>

- **RabbitMQ:** put N **competing consumers** on one queue; each message goes to exactly one of them.
- **Kafka:** a **consumer group** splits the partitions across its members — each partition is read by
  **exactly one** consumer in the group (so parallelism is capped by partition count). A **different**
  group reading the same topic gets its **own independent copy** of the whole stream → that's fan-out.
</details>

---

**Q6. Explain at-most-once, at-least-once, exactly-once. Which is the real-world default, and how do you cope with its downside?**

<details><summary>answer</summary>

- **At-most-once:** confirm before processing → no duplicates but possible **loss**.
- **At-least-once:** process before confirming → no loss but possible **duplicates**. **This is the
  practical default** for both systems.
- **Exactly-once:** no loss and no dups — genuinely hard; Kafka has an EOS mode internally, but
  end-to-end across your own services it's mostly a myth.

Cope by designing for **at-least-once + idempotent consumers**: assume a message can arrive twice and
make handling it twice harmless (idempotency keys / dedup) — that *behaves* like exactly-once.
</details>

---

**Q7. Pick RabbitMQ or Kafka for each and justify: (a) "charge this card" command, (b) 10k IoT device telemetry many teams consume, (c) request-reply RPC.**

<details><summary>answer</summary>

- **(a) Charge card → RabbitMQ:** it's a **command** one worker should do once; ack after success,
  at-least-once + idempotency key so a redelivery doesn't double-charge.
- **(b) IoT telemetry → Kafka:** high-throughput **event stream** that many consumers (dashboard,
  storage, alerting, ML) read independently; key by `deviceId` for per-device order; new services can
  replay history.
- **(c) Request-reply RPC → RabbitMQ (or gRPC):** Kafka isn't built for "send and wait for one
  reply." Wrong tool for Kafka.
</details>

---

**Q8. Two classic traps: why is "Kafka is just a faster RabbitMQ" wrong, and what's a dead-letter queue?**

<details><summary>answer</summary>

- **"Faster RabbitMQ" is wrong** because they're different *shapes*, not different speeds: Kafka
  **keeps + replays** a log; RabbitMQ **delivers + deletes**. You pick by access pattern (task vs
  replayable stream), not raw throughput.
- A **dead-letter queue (DLQ)** is where a message goes after it fails N times (a *poison message*) —
  so you stop retrying it forever and can inspect/replay it separately. Prevents one bad message from
  blocking or looping the pipeline.
</details>

---

**Q9 (interview close). In 30 seconds: how do you choose between them for a new feature?**

<details><summary>answer</summary>

"Ask: is this a **command** one worker should execute once, with maybe rich routing? → **RabbitMQ**.
Or is it an **event** that happened, which several consumers read independently, or where I'd want
**replay / high throughput / ordered history**? → **Kafka**, keyed so related events stay ordered.
Either way I assume **at-least-once** delivery and make the consumer **idempotent**, and I route
poison messages to a **dead-letter queue**."
</details>

---

> Tomorrow (Day 12): **Idempotency + distributed transactions — outbox pattern, sagas.** The direct
> fix for "messages arrive twice" and "a multi-service write fails halfway." You did payments — this
> formalizes the idempotency keys and outbox you've effectively already built.
