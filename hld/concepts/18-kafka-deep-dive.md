# 18 · Kafka Deep Dive

> **Read time:** 40 min · **Visual:** [v10 Kafka partitions and consumer groups](../../visuals/v10-kafka-consumer-groups.html), [v11 delivery semantics](../../visuals/v11-delivery-semantics.html) · **Code it:** [lld/problems/15-pub-sub-queue](../../lld/problems/15-pub-sub-queue/README.md)
> **Shows up in:** distributed message queue, payment events, ad click aggregation, metrics pipeline, CDC, ride location stream, news feed fan-out

## The idea in one line

Kafka is a replicated, partitioned, append-only log. Producers append to the end; each consumer group reads at its own offset; data stays for a set time whether it was read or not.

## The problem it solves

Classic queues delete a message once one consumer acks it, and slow down when backlogs grow. Many systems need **many independent readers of the same events**, **replay**, and **very high throughput** (clickstreams, payments events, CDC). A log that only appends and reads sequentially gives all three, because sequential disk I/O and the OS page cache are fast.

## How it works

### Building blocks

- **Topic**: a named stream, e.g. `payments.events`.
- **Partition**: a topic is split into P ordered logs. Each message in a partition has an increasing **offset**. Order is guaranteed **only inside a partition**.
- **Key → partition**: default partitioner is `murmur2(key) % P`. Same key, same partition, so events for one `payment_id` stay in order. No key: messages are spread (sticky batching).
- **Broker**: a server that stores partitions. Each partition has one **leader** and some **followers** on other brokers.
- **Controller**: manages metadata and leader election. Modern Kafka uses **KRaft** (built-in Raft); ZooKeeper was removed in Kafka 4.0.

```
topic payments.events (P=3, RF=3)
  p0: [0][1][2][3][4][5] ← producer appends (key=pay_17)
  p1: [0][1][2][3]
  p2: [0][1][2][3][4]
           ▲        ▲
  group "ledger" offset=2   group "webhooks" offset=5   (independent)
```

### Consumer groups

- A **consumer group** is one logical subscriber (one service). Each partition is read by **exactly one consumer in the group**.
- So max useful parallelism in a group = **number of partitions**. With 12 partitions, a 13th consumer sits idle.
- Different groups read the same data independently (ledger, notifications, analytics).
- **Rebalance**: when a consumer joins, leaves or misses heartbeats, partitions are reassigned. Older "eager" rebalances stop the whole group; use the **cooperative sticky** assignor and **static membership** to reduce pauses. Kafka 4.0 also ships a new server-side rebalance protocol (KIP-848).

### Offsets

- The consumer stores its position in the internal topic `__consumer_offsets`.
- **Commit after processing** = at-least-once. Commit before = at-most-once.
- Auto-commit (`enable.auto.commit=true`, every 5 s) can commit messages you have not finished. In payments, commit manually after the DB write.
- `auto.offset.reset=earliest|latest` decides where a **new** group starts.
- **Consumer lag** = latest offset − committed offset. This is the main health metric; autoscale and alert on it.

### Replication, ISR and acks

- **Replication factor (RF)**: copies of each partition, usually **3** across AZs.
- **ISR (in-sync replicas)**: followers that are caught up with the leader (within `replica.lag.time.max.ms`, default 30 s). Only ISR members can become leader (unless you allow unclean election).
- **High watermark**: the offset replicated to all ISR. Consumers only see messages below it.
- Producer `acks`:

| acks | Waits for | Risk |
|---|---|---|
| `0` | Nothing | Loses data silently |
| `1` | Leader wrote it | Lost if leader dies before followers copy |
| `all` (`-1`) | All current ISR | Safe if `min.insync.replicas ≥ 2` |

The standard durable setting: **RF=3, `min.insync.replicas=2`, `acks=all`**, `unclean.leader.election.enable=false`. One broker can die with no data loss and no write outage. If two die, writes fail (a CP choice) instead of losing data.

### Idempotent producer and transactions

- **Idempotent producer** (`enable.idempotence=true`, default since Kafka 3.0): broker drops duplicate retries using producer id + sequence number. No duplicates from producer retries, order kept per partition.
- **Transactions**: write to several partitions and commit consumer offsets atomically. Consumers with `isolation.level=read_committed` see only committed data. This gives **exactly-once for read-process-write inside Kafka** (Kafka Streams uses it). Side effects outside Kafka (DB writes, HTTP calls) still need idempotency. See [19](./19-idempotency-delivery-semantics.md).

### Retention and compaction

- **Delete policy** (default): keep data for `retention.ms` (default **7 days**) or up to `retention.bytes`, then delete old **segments** (files, default 1 GB each).
- **Compact policy**: keep at least the **latest value per key**; older values are removed in the background. A message with a null value (**tombstone**) deletes the key. Used for changelogs, CDC tables, `__consumer_offsets`, and "current state per entity" topics.
- **Tiered storage** (Kafka 3.6+): old segments move to object storage (S3), so retention can be long without big broker disks.

### Why it is fast

Sequential appends, the OS page cache instead of an app cache, **batching** (`linger.ms`, `batch.size`), **compression** per batch (lz4, zstd, snappy), and **zero-copy** (`sendfile`) from page cache to the network socket.

## Numbers to remember

- One partition can usually do **~10 MB/s** of writes comfortably (more with tuning). A broker: **hundreds of MB/s**, limited by disk and network.
- Sizing: `partitions ≥ max(target_throughput / per-partition_producer_rate, target_throughput / per-consumer_rate)`. Example: 100 MB/s, a consumer handles 5 MB/s → at least **20 partitions**; pick ~2× headroom, e.g. 48.
- You can **add** partitions but not remove them, and adding changes `key → partition`, breaking per-key order for a while. Over-provision at the start.
- Default max message ≈ **1 MB**. Large payloads go to S3 with a pointer.
- End-to-end latency with good tuning: **single-digit to tens of ms**. Higher `linger.ms` gives more throughput and more latency.
- Thousands of partitions per broker is fine with KRaft; very large counts cost more memory, open files and slower recovery.

## Trade-offs and when not to use it

| Choice | Gain | Cost |
|---|---|---|
| More partitions | More parallel consumers, more throughput | More files and metadata; longer failover; ordering split further |
| `acks=all` + `min.insync.replicas=2` | No data loss on one broker failure | A few ms more latency; writes fail if ISR < 2 |
| Bigger `linger.ms` / batches | Higher throughput, better compression | Added latency |
| Long retention / tiered storage | Replay, rebuild read models | Storage cost |
| Compacted topic | Small "latest state" stream | Not a full history |

**Not a great fit**: per-message delays and priorities, per-message ack/retry, thousands of tiny queues (one per user), or low-volume job queues where SQS/RabbitMQ is simpler. ("Share groups" for queue-style consumption are new in Kafka 4.x; don't depend on them in an interview.)

## In real systems

- **LinkedIn** built Kafka (2011) for activity streams and metrics; it runs trillions of messages a day.
- **Uber**: one of the largest Kafka users (trip events, surge, logs) with cross-region replication (uReplicator).
- **Indian fintechs** (Razorpay, PhonePe, Paytm): payment state events, ledger postings and CDC from MySQL/Postgres via Debezium into Kafka.
- **Flipkart / Swiggy**: order and catalog events; stream processing with Flink or Kafka Streams.
- Managed options: Confluent Cloud, Amazon MSK; compatible alternatives: Redpanda, WarpStream, Pulsar (different design).

## What to say in the interview

"Payment events go to a `payments.events` topic with 48 partitions, keyed by `payment_id`, so all events for a payment are ordered. RF is 3 across 3 AZs, `min.insync.replicas=2`, producers use `acks=all` with idempotence on. The ledger, webhook and analytics services are separate consumer groups. Each commits offsets manually after its DB write, so delivery is at-least-once, and handlers are idempotent on `event_id`. We alert on consumer lag. Retention is 7 days for replay; a compacted `payments.state` topic keeps the latest state per payment."

## Common follow-ups

<details><summary>A consumer is slow and lag keeps growing. What do you do?</summary>

Check if it is CPU, a slow DB, or one hot partition. Add consumers up to the partition count; process in parallel inside a consumer with per-key ordering (e.g. a worker per key hash); batch DB writes; and if one key is hot, re-think the key. Adding partitions helps only new data and changes key mapping.
</details>

<details><summary>How do you get exactly-once into a Postgres table?</summary>

Kafka transactions don't cover Postgres. Store the offset (or `event_id`) in the same DB transaction as the business write, with a unique constraint, and on restart seek to the stored offset. Duplicates then become no-ops.
</details>

<details><summary>What happens when the partition leader dies?</summary>

The controller picks a new leader from the ISR. Producers and consumers refresh metadata and move to it. With `acks=all` and `min.insync.replicas=2`, no acknowledged message is lost. With unclean election on, an out-of-sync replica may become leader and lose data.
</details>

<details><summary>How does Kafka keep order if the producer retries?</summary>

The idempotent producer adds a sequence number per partition. The broker rejects out-of-order or duplicate batches, so retries can't reorder, even with up to 5 in-flight requests.
</details>

## Self-test (answer before opening)

<details><summary>1. Topic with 8 partitions, consumer group with 10 consumers. How many are working?</summary>

8. Two are idle. Each partition is owned by one consumer in a group.
</details>

<details><summary>2. RF=3, min.insync.replicas=2, acks=all. Two brokers die. What happens to writes?</summary>

ISR drops to 1, below 2, so producers get `NotEnoughReplicas` errors. Writes stop; no data is lost. Reads of existing data from the surviving leader continue.
</details>

<details><summary>3. You need "latest balance per account" that a new service can load from scratch. Which topic setting?</summary>

`cleanup.policy=compact`, keyed by `account_id`. The topic keeps the latest value per key forever.
</details>

<details><summary>4. Why can't you just add partitions later to fix ordering-sensitive load?</summary>

`hash(key) % P` changes with P, so a key's new events go to a different partition than its old ones. Order between old and new events for that key is no longer guaranteed during the switch.
</details>

## Go deeper

- *Kafka: The Definitive Guide*, 2nd edition (Shapira, Palino, Sivaram, Petty): chapters on reliable delivery and exactly-once semantics
- Jay Kreps, "The Log: What every software engineer should know about real-time data's unifying abstraction" (2013); the original Kafka paper (Kreps, Narkhede, Rao, NetDB 2011)
- DDIA, chapter 11: "Partitioned Logs", "Log compaction"
- Older notes in this repo: `archive/notes/hld-parts/part2.md`, "Kafka Architecture Deep Dive", "Partitions & Parallelism"; `archive/notes/hld-parts/part7.md`, "Problem 1: Kafka-like Message Queue"
- Practice: [Distributed message queue](../problems/18-distributed-message-queue/README.md), [Ad click aggregation](../problems/20-ad-click-aggregation/README.md); related: [17 message queues](./17-message-queues.md), [33 batch and stream](./33-batch-stream-processing.md)
