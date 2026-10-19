# 15 · Pub-Sub Queue (Kafka-lite)

> Asked at: Razorpay, PhonePe, Flipkart, Uber, Confluent-style infra teams, and fintechs that run Kafka in production.
> Time box: **90 min** (15 min design, 60 min code, 15 min tests and extensions)
> Patterns you should reach for: **Iterator** (a consumer is a cursor over a log), **Strategy** (partitioner, partition assignor), **Observer** (push vs pull: know why Kafka pulls)

## Problem statement (as the interviewer says it)

"Build an in-memory message queue like a small Kafka. Producers publish messages to topics. A topic has partitions.
Consumers join consumer groups. Each message is processed by one consumer per group. Consumers commit offsets and can replay."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Which partition gets a message? | With a key: `hash(key) % partitions`. Without a key: round-robin |
| Ordering? | Only inside a partition. Same key → same partition → ordered |
| Offsets? | Per partition, starting at 0. A partition is an append-only array |
| Groups? | Each group gets every message. Inside a group, each partition has exactly one owner |
| How are partitions split? | Range assignor: consumers sorted by id; contiguous ranges; the first `P % C` consumers get one extra. Pluggable |
| More consumers than partitions? | The extra consumers own nothing |
| Push or pull? | Pull. `poll(max)` reads from owned partitions, lowest partition first. Default max 100 |
| Where does a new group start? | Offset 0 (earliest) |
| What does `commit` save? | The current read position of each owned partition, for the group |
| Rebalance? | On join and on leave. A partition that stays with its owner keeps its position. A partition that moves starts at the group's committed offset. So uncommitted messages are delivered again: **at-least-once** |
| Replay? | `seek(partition, offset)` on an owned partition |
| Retention, replication, persistence, many topics per consumer? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const broker = new Broker({ hash: fnv1a, assignor: new RangeAssignor() });   // both optional
broker.createTopic('orders', 3);

broker.publish('orders', 'order-1', 'user-42');   // → { partition, offset }
broker.publish('orders', 'ping');                 // no key → round-robin

const c1 = broker.subscribe('orders', 'billing', 'c1');   // → Consumer (joins the group, rebalances)
c1.assignment();        // → [0, 1, 2]
c1.poll(10);            // → Message[] { topic, partition, offset, key, value }
c1.commit();
c1.seek(0, 0);          // replay partition 0
c1.close();             // leave the group

broker.committed('billing', 'orders', 0);   // next offset the group will read
broker.endOffset('orders', 0);              // log length
```

`Consumer` is an interface. Your class behind it is your design.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `Broker`: the facade. Owns topics and groups, picks partitions, runs rebalances
- `Topic`: name, `Message[][]` (one append-only log per partition), a round-robin counter
- `Group`: id, topic, members, `committed[]` (next offset per partition). Keyed by `(groupId, topic)`
- `GroupConsumer` implements `Consumer`: a map `partition → position`. This is an **Iterator** over the logs it owns. It never copies messages
- `AssignmentStrategy` (interface) → `RangeAssignor`. Later: round-robin, sticky
- The partitioner is just a `hash` function. Injecting it makes tests deterministic

Two numbers per partition, and they are different:

| | Lives in | Moves on |
|---|---|---|
| **position** | the consumer | `poll`, `seek` |
| **committed offset** | the group | `commit` |

The gap between them is the work that will be redone after a crash or rebalance.

Relationships: Broker ◆— Topic, Group. Group ◆— GroupConsumer. Broker ⟶ AssignmentStrategy, hash (dependency injection).

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/15-pub-sub-queue` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 90 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Exactly-once processing?** The queue gives at-least-once. Make the consumer idempotent: store a processed message id (or `topic-partition-offset`) in the same DB transaction as the side effect. In payments, this is how you avoid charging twice.
2. **Commit before or after processing?** After → at-least-once (duplicates on crash). Before → at-most-once (loss on crash). Say which one each use case needs.
3. **Retention.** Delete old messages by time or size. Keep a `startOffset` per partition; `seek` below it fails or jumps to the start.
4. **A poison message** that always fails. Retry N times, then publish it to a dead-letter topic and commit past it.
5. **Push instead of pull** (Observer): the broker calls `onMessage`. Why Kafka pulls: the consumer controls its own speed (backpressure) and can batch.
6. **Rebalance cost.** Eager rebalancing stops all consumers. Sticky and cooperative assignors move as few partitions as possible.
7. **Many brokers.** Each partition has a leader and replicas. See [Kafka deep dive](../../../hld/4-async/H21-kafka/README.md).

## Self-check before you call it done

- [ ] Inside one group, no partition has two owners, and every partition has an owner (when there is at least one consumer).
- [ ] Order is kept per partition.
- [ ] Position and committed offset are separate fields.
- [ ] A rebalance re-delivers uncommitted messages; it never skips them.
- [ ] The hash and the assignor are injected, so tests are deterministic.

## Concepts used

- [Iterator](../../4-behavioral/L27-iterator/README.md) · [Observer](../../4-behavioral/L21-observer/README.md) · [Strategy](../../4-behavioral/L20-strategy/README.md)
- HLD link: [Message queues](../../../hld/4-async/H20-message-queues/README.md) · [Kafka deep dive](../../../hld/4-async/H21-kafka/README.md) · [Idempotency and delivery semantics](../../../hld/4-async/H22-delivery-semantics/README.md) · [Distributed Message Queue](../../../hld/case-studies/18-distributed-message-queue)
- Visuals: [Kafka partitions and consumer groups](../../../hld/4-async/H21-kafka/visual.html) · [Delivery semantics](../../../hld/4-async/H22-delivery-semantics/visual.html) · [Observer and pub-sub](../../4-behavioral/L21-observer/visual.html)
