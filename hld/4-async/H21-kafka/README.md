# H21 · Kafka deep dive

> **Time:** ~50 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/4-async/H21-kafka/demo.ts`)
> **Builds on:** [H20 Message queues and pub-sub](../H20-message-queues/README.md) · [H15 Replication](../../3-databases/H15-replication/README.md) · [H16 Partitioning and sharding](../../3-databases/H16-partitioning-sharding/README.md) · **Used in:** Distributed message queue, Ad click aggregation, Metrics monitoring, Payment system, Ride hailing, News feed

## The idea in one line

Kafka is a replicated, partitioned, append-only log: producers append to the end, each consumer group reads at its own offset, and data stays for a set time whether anyone read it or not.

## Why it matters (the problem it solves)

A classic queue deletes a message once one consumer acks it. Many systems need more than that:

- **Many independent readers** of the same events (ledger, notifications, analytics, search indexer).
- **Replay**: fix a bug, reset the offset, recompute. Or build a brand-new read model from history.
- **Very high throughput**: clickstreams, telemetry, CDC from databases. Millions of events per second.
- **Per-entity order**: all events of one `payment_id` processed in order.

An append-only log on disk gives all four, because sequential I/O and the OS page cache are fast, and reading does not change the log.

## How it works

### Building blocks

| Term | Meaning |
|---|---|
| **Topic** | A named stream, e.g. `payments.events` |
| **Partition** | One ordered, append-only log. A topic has P of them. Order is guaranteed **only inside a partition** |
| **Offset** | The position of a message in its partition (0, 1, 2, …) |
| **Key** | Picks the partition: `murmur2(key) % P`. Same key, same partition, same order |
| **Broker** | A server that stores partitions. Each partition has one **leader** and followers on other brokers |
| **Controller** | Manages metadata and leader election. Uses **KRaft** (built-in Raft); ZooKeeper was removed in Kafka 4.0 |
| **Consumer group** | One logical subscriber (one service). Each partition goes to exactly one consumer in the group |

```
topic payments.events  (P=3, RF=3)
  P0: [0][1][2][3][4][5]   ← producer appends (key=pay_17 → P0)
  P1: [0][1][2][3]
  P2: [0][1][2][3][4]
              ▲      ▲
   group "ledger" @2   group "webhooks" @5     (independent offsets, same data)
```

### Consumer groups and parallelism

- In a group, each partition has **one** owner. So the max useful consumers in a group = **number of partitions**. With 12 partitions, consumer 13 sits idle (a hot standby).
- Different groups read the same data independently. Fan-out is free: add a group.
- **Rebalance**: when a consumer joins, leaves or misses heartbeats, partitions are reassigned. The old "eager" protocol stopped the whole group. Use the **cooperative sticky** assignor and **static membership** (`group.instance.id`) to keep pauses small. Kafka 4.0 adds a server-side protocol (KIP-848) that avoids stop-the-world rebalances.
- A slow consumer only builds **lag**. It never slows the producer. That is the decoupling.

### Offsets and delivery

- The group stores its position in the internal topic `__consumer_offsets`.
- **Process, then commit** = at-least-once (a crash replays a few messages). **Commit, then process** = at-most-once (a crash loses messages).
- Auto-commit (`enable.auto.commit=true`, every 5 s) can commit work you have not finished. For payments, commit manually after the DB write.
- `auto.offset.reset=earliest|latest` decides where a **new** group starts.
- **Consumer lag** = log end offset − committed offset. The number one health metric. Alert and autoscale on it.

```
P1: [0][1][2][3][4][5][6][7]
             ▲               ▲
       committed=3      log end=8      lag = 5
```

### Replication, ISR and acks

- **Replication factor (RF)**: copies of each partition, usually **3**, one per AZ.
- **ISR (in-sync replicas)**: followers caught up with the leader (within `replica.lag.time.max.ms`, default 30 s). Only ISR members may become leader, unless you allow unclean election.
- **High watermark**: the offset copied to all ISR. Consumers only see messages below it.

| `acks` | Producer waits for | Risk |
|---|---|---|
| `0` | Nothing | Silent loss |
| `1` | Leader wrote it | Lost if the leader dies before followers copy it |
| `all` (`-1`) | All current ISR | Safe when `min.insync.replicas ≥ 2` |

The standard durable setting: **RF=3, `min.insync.replicas=2`, `acks=all`, `unclean.leader.election.enable=false`**. One broker can die with no loss and no outage. If two die, writes fail with `NotEnoughReplicas` (a CP choice, see [H18](../../3-databases/H18-cap-pacelc-consistency/README.md)) instead of losing data.

### Idempotent producer and transactions

- **Idempotent producer** (`enable.idempotence=true`, default since 3.0): each batch carries a producer id and a sequence number per partition. The broker drops duplicate retries and rejects gaps. No duplicates and no reordering from retries, even with 5 in-flight requests.
- **Transactions**: write to many partitions **and** commit consumer offsets in one atomic step. Consumers with `isolation.level=read_committed` see only committed data. This is **exactly-once for read-process-write inside Kafka** (Kafka Streams uses it).
- Side effects outside Kafka (a Postgres write, an HTTP call to a PSP) are **not** covered. You still need idempotent handlers. See [H22](../H22-delivery-semantics/README.md).

### Retention and compaction

| Policy | Keeps | Used for |
|---|---|---|
| `delete` (default) | Everything for `retention.ms` (7 days default) or `retention.bytes`, then deletes whole segments (1 GB files) | Event streams, replay window |
| `compact` | At least the **latest value per key**. A null value (**tombstone**) deletes the key | Changelogs, CDC tables, "current state per entity", `__consumer_offsets` |
| Tiered storage (3.6+) | Old segments in S3; recent ones on broker disk | Long retention without huge disks |

### Why it is fast

1. **Sequential appends** to segment files: disks and SSDs love sequential I/O.
2. **OS page cache** instead of an in-process cache: hot data is served from RAM.
3. **Batching** (`linger.ms`, `batch.size`) and **compression** per batch (lz4, zstd).
4. **Zero-copy** (`sendfile`): bytes go from page cache to the socket without passing through the JVM.

### Partition sizing

```
partitions ≥ max( target MB/s ÷ per-partition producer MB/s ,
                  target MB/s ÷ per-consumer MB/s )   × ~2 headroom
example: 100 MB/s, consumer handles 5 MB/s → ≥ 20 → pick 48
```

You can add partitions later but not remove them, and adding changes `key → partition`, which breaks per-key order for a while. So over-provision at the start.

## In TypeScript

The key-to-partition rule and a consumer loop with manual commit (full simulation in `demo.ts`; real code would use `kafkajs` or `@confluentinc/kafka-javascript`):

```ts
const partitionFor = (key: string, partitions: number) => murmur2(key) % partitions;

await consumer.run({
  autoCommit: false,
  eachMessage: async ({ topic, partition, message }) => {
    const evt = JSON.parse(message.value!.toString());
    await db.tx(async (t) => {
      // unique(event_id) makes a replayed message a no-op
      const fresh = await t.insertIgnore('processed_events', { event_id: evt.id });
      if (fresh) await t.applyLedgerPosting(evt);
    });
    await consumer.commitOffsets([{ topic, partition, offset: String(Number(message.offset) + 1) }]);
  },
});
```

Note the `+ 1`: you commit the **next** offset to read, not the one you just processed.

## Trade-offs / when NOT to use it

| Choice | Gain | Cost |
|---|---|---|
| More partitions | More parallel consumers and throughput | More files and metadata, slower failover, order split further |
| `acks=all` + `min.insync.replicas=2` | No loss on one broker failure | A few ms more latency; writes fail if ISR < 2 |
| Bigger `linger.ms` / batches | Throughput and better compression | Added latency |
| Long retention / tiered storage | Replay, rebuild read models | Storage cost |
| Compacted topic | Small "latest state" stream | No full history |

**Not a good fit:** per-message delays or priorities, per-message ack and retry with a DLQ, thousands of tiny per-user queues, or a low-volume job queue where SQS or RabbitMQ is simpler to run. Kafka is also heavy to operate yourself; managed options are Confluent Cloud and Amazon MSK. ("Share groups" for queue-style consumption are new in 4.x; don't rely on them in an interview.)

## Common mistakes

- Saying "Kafka guarantees order". Only **per partition**. Order across a topic needs one partition, which kills parallelism.
- Adding consumers beyond the partition count and expecting more throughput.
- Using no key (or a low-cardinality key like `country`) and then wondering why one partition is hot.
- Auto-commit in a payment consumer: a crash after commit and before the DB write loses the event.
- Saying "Kafka gives exactly-once" without saying "only inside Kafka". Your DB write still needs idempotency.
- `acks=all` with `min.insync.replicas=1`: if the ISR shrinks to the leader alone, `all` means "just the leader".
- Long processing per poll: exceeding `max.poll.interval.ms` (default 5 min) kicks the consumer out and triggers a rebalance loop.
- Putting 10 MB payloads in messages. Default max is about 1 MB; store the blob in S3 and send a pointer.

## Say this in the interview

> "Payment events go to `payments.events` with 48 partitions, keyed by `payment_id`, so all events of one payment are ordered. RF is 3 across 3 AZs, `min.insync.replicas=2`, and producers use `acks=all` with idempotence on, so one broker can die with no data loss."

> "Ledger, webhooks and analytics are separate consumer groups, so each gets every event and can replay on its own. Each consumer commits offsets manually after its DB write. That's at-least-once, so handlers are idempotent on `event_id` with a unique constraint. We alert on consumer lag, and keep 7 days of retention for replay plus a compacted `payments.state` topic with the latest state per payment."

## Your experience hook

- **10k+ IoT devices:** you buffered high-frequency device writes in a Redis queue and batched DB writes. At 10x, that ingestion firehose is a Kafka topic keyed by `device_id` (per-device order), with a time-series sink as one consumer group and alerting as another.
- **Payment orchestration:** webhook events from 3 PSPs can arrive twice and out of order. Keying by `payment_id` keeps per-payment order in one partition; the state machine plus an `event_id` dedupe table makes replays harmless.
- **RabbitMQ background:** you know the "delete after ack" model. Contrast it out loud: Kafka keeps the log and moves an offset, which is why replay and many groups are cheap.

## Numbers to remember

| Thing | Number |
|---|---|
| One partition, comfortable write rate | ~10 MB/s (more with tuning) |
| One broker | Hundreds of MB/s, bound by disk and network |
| Default retention | 7 days (`retention.ms`) |
| Segment size | 1 GB default |
| Default max message | ~1 MB |
| Durable default | RF=3, `min.insync.replicas=2`, `acks=all` |
| ISR lag timeout | `replica.lag.time.max.ms` = 30 s |
| Auto-commit interval | 5 s |
| End-to-end latency, tuned | Single-digit to tens of ms |
| LinkedIn scale | Trillions of messages per day |

## Self-test

<details><summary>1. A topic has 8 partitions and the group has 10 consumers. How many are working?</summary>

8. Two are idle standbys. Each partition has one owner in a group.
</details>

<details><summary>2. RF=3, min.insync.replicas=2, acks=all. Two brokers die. What happens?</summary>

ISR drops to 1, below 2, so producers get `NotEnoughReplicas`. Writes stop, nothing is lost. Reads of existing data from the surviving leader continue.
</details>

<details><summary>3. A consumer crashes after processing offsets 3 and 4 but its last commit was 3. What happens next?</summary>

After the rebalance the new owner starts at offset 3, so 3 and 4 are processed again. That is at-least-once; the handler must be idempotent.
</details>

<details><summary>4. You need "latest balance per account" that a new service can load from scratch. Which topic setting?</summary>

`cleanup.policy=compact` keyed by `account_id`. It keeps the latest value per key forever.
</details>

<details><summary>5. Why not just add partitions later to fix a hot partition?</summary>

`hash(key) % P` changes with P, so a key's new events go to a different partition than its old ones and per-key order breaks during the switch. And if one key is hot, more partitions don't help: that key still maps to one partition. Fix the key (add a suffix for that key) instead.
</details>

<details><summary>6. How do you get exactly-once into Postgres from Kafka?</summary>

Kafka transactions don't cover Postgres. Write the business row and the `event_id` (or the offset) in one DB transaction with a unique constraint. Duplicates become no-ops. Optionally store the offset in the DB and seek to it on start.
</details>

<details><summary>7. Lag keeps growing on one consumer group. Steps?</summary>

Find the cause: CPU, a slow DB, or one hot partition. Add consumers up to the partition count, process in parallel inside a consumer with per-key ordering, batch DB writes, and fix a hot key. Then autoscale on lag.
</details>

<details><summary>8. How does the idempotent producer stop retries from creating duplicates?</summary>

Each producer has an id and a per-partition sequence number on every batch. The broker remembers the last sequence and drops a batch it has already written, and rejects a gap, so retries cannot duplicate or reorder.
</details>

## Go deeper

- Next: [H22 Delivery semantics and idempotency](../H22-delivery-semantics/README.md), [H24 Event-driven architecture and CQRS](../H24-event-driven-cqrs/README.md)
- Case studies: [Distributed message queue](../../case-studies/18-distributed-message-queue/README.md), [Ad click aggregation](../../case-studies/20-ad-click-aggregation/README.md), [Metrics monitoring](../../case-studies/19-metrics-monitoring/README.md), [Payment system](../../case-studies/08-payment-system/README.md)
- LLD version: [Pub-sub queue](../../../lld/problems/15-pub-sub-queue/README.md)
- Hands-on broker setup: [H20 hands-on](../H20-message-queues/hands-on/)
- Archive notes: [hld-parts/part2.md](../../../archive/notes/hld-parts/part2.md) ("Kafka Architecture Deep Dive"), [hld-parts/part7.md](../../../archive/notes/hld-parts/part7.md) ("Kafka-like Message Queue")
- Jay Kreps, "The Log: What every software engineer should know about real-time data's unifying abstraction"; *Kafka: The Definitive Guide* (2nd ed.); DDIA chapter 11
