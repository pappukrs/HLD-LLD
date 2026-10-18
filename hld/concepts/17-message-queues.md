# 17 · Message Queues (RabbitMQ, SQS, Kafka)

> **Read time:** 35 min · **Visual:** [v11 delivery semantics and idempotency](../../visuals/v11-delivery-semantics.html), [v10 Kafka consumer groups](../../visuals/v10-kafka-consumer-groups.html) · **Code it:** [lld/problems/15-pub-sub-queue](../../lld/problems/15-pub-sub-queue/README.md)
> **Shows up in:** notification system, payment system (webhooks, settlements), food delivery, video processing, web crawler, order pipelines

## The idea in one line

Put a durable buffer between the service that produces work and the service that does it, so they can fail, scale and run at different speeds independently.

## The problem it solves

With direct synchronous calls:

- If the downstream is slow or down, the caller is slow or fails too.
- Traffic spikes hit the slowest service directly.
- One event (e.g. `payment.captured`) must be sent to five services, and the caller must know all of them.

A queue gives **decoupling**, **load levelling** (absorb a spike, drain it later), **retries**, and **fan-out**.

## How it works

### Two models

- **Point-to-point (work queue)**: each message goes to **one** consumer out of many. Used for jobs: send email, resize image.
- **Publish-subscribe**: each message goes to **every subscriber group**. Used for events: `order.placed` → inventory, notifications, analytics.

### Queue vs log

| | Queue (RabbitMQ, SQS) | Log (Kafka, Kinesis, Pulsar) |
|---|---|---|
| After consume | Message is deleted after ack | Message stays until retention ends |
| Consumer state | Broker tracks each message | Consumer tracks an **offset** |
| Replay | No | Yes, move the offset back |
| Parallelism | Add consumers freely | Limited by number of partitions |
| Per-message ack / retry | Yes | No; commit an offset (retry is your job) |

### Acknowledgements and visibility

- **RabbitMQ**: the consumer gets a message, works, then sends `ack`. If the connection drops before the ack, the message is re-queued. `prefetch` limits unacked messages per consumer.
- **SQS**: `ReceiveMessage` hides the message for a **visibility timeout**. If you don't `DeleteMessage` before it ends, it becomes visible again and someone else gets it.
- **Kafka**: the consumer commits the offset after processing. A crash before commit means the batch is read again.

### Delivery guarantees

| Guarantee | How | Risk |
|---|---|---|
| **At-most-once** | Ack/commit **before** processing | Crash = message lost |
| **At-least-once** | Ack/commit **after** processing | Crash = message processed twice |
| **Exactly-once (effect)** | At-least-once + **idempotent consumer**, or a transactional system (Kafka transactions within Kafka) | Needs design work |

Industry default: **at-least-once + idempotency**. Store a processed `message_id` (or business key like `payment_id`) in the same DB transaction as the side effect, with a unique constraint. See [19 idempotency](./19-idempotency-delivery-semantics.md).

### Ordering

- Global order across a busy queue is expensive and rarely needed. You need order **per entity** (per order, per account).
- **Kafka**: order is guaranteed only inside one partition. Use the entity id as the message key.
- **SQS FIFO**: order per `MessageGroupId`; standard SQS has best-effort order.
- **RabbitMQ**: order per queue with one consumer; multiple consumers or re-queues break it. Use the consistent-hash exchange or single active consumer to keep order per key.

### Retries and DLQs

1. A consumer fails on a message. Retry with **exponential backoff and jitter** (RabbitMQ: a delay queue with TTL + dead-letter exchange; SQS: visibility timeout; Kafka: separate retry topics like `orders.retry.1m`, `orders.retry.10m`).
2. After `maxReceiveCount` (e.g. 5) failures, move it to a **dead-letter queue**.
3. Alert on DLQ depth. Fix the bug, then **redrive** messages from the DLQ.

A **poison message** (one that always fails) must not block the queue forever. The DLQ is the fix.

### Back-pressure

Watch **queue depth / consumer lag**. Scale consumers on it (KEDA, or SQS-based autoscaling). If the producer is much faster for a long time, the queue only hides the problem; rate-limit at the edge.

## Numbers to remember

- SQS standard: nearly unlimited throughput; message size up to **1 MiB** (it was 256 KB until 2025, and many docs still say 256 KB); retention **4 days default, up to 14 days**; visibility timeout up to **12 hours**.
- SQS FIFO: **300 messages/s per API action, 3,000/s with batching** (high-throughput mode allows much more).
- RabbitMQ: tens of thousands of messages/s per node is normal; throughput drops a lot with persistence + publisher confirms + large queues.
- Kafka: hundreds of MB/s per broker; millions of small messages/s per cluster (see [18](./18-kafka-deep-dive.md)).
- Keep messages small (KB). For large payloads, put the file in S3 and send a pointer (*claim check*).

## Trade-offs and when not to use it

| Option | Pick when | Weakness |
|---|---|---|
| **RabbitMQ** | Task queues, complex routing (direct/topic/fanout/headers exchanges), per-message ack, priorities, delays | Not built for replay or very high throughput; long queues hurt it |
| **SQS (+ SNS for fan-out)** | AWS, zero ops, simple job queues, Lambda triggers | No replay; FIFO throughput limits; AWS-only |
| **Kafka** | Event streaming, very high throughput, many independent consumers, replay, event sourcing, CDC | Ops heavy; ordering only per partition; no per-message retry; consumers ≤ partitions |
| **Redis Streams / BullMQ** | Small Node.js systems, delayed jobs, already have Redis | Memory-bound; weaker durability |
| No queue (sync call) | The user needs the result now (auth, balance check) | Coupling |

Don't use a queue where the caller needs the answer to continue. Don't use Kafka as a job queue that needs per-message delays and priorities.

## In real systems

- **Payments (Razorpay/Stripe style)**: payment events go to Kafka; webhook delivery workers read them, retry merchants' endpoints with backoff for hours, then mark the webhook failed.
- **Swiggy / Zomato**: order state changes published as events; delivery assignment, notifications and analytics consume independently.
- **Uber**: Kafka is the central event bus; Uber built a consumer proxy and DLQ/retry-topic pattern on top of it.
- **AWS shops**: SNS topic → many SQS queues (one per consumer service) is the standard fan-out.

## What to say in the interview

"After the payment is captured, the API writes the payment row and an outbox row in one transaction, and returns. A relay publishes the outbox event to Kafka with `payment_id` as the key, so events for one payment stay in order. Notification, ledger and webhook services each have their own consumer group. Delivery is at-least-once, so every consumer is idempotent on `event_id` with a unique constraint. Failures retry with backoff through retry topics, and after 5 tries go to a DLQ that we alert on and redrive."

## Common follow-ups

<details><summary>How do you publish to the queue and update the DB atomically?</summary>

You can't do both in one step across two systems. Use the **transactional outbox**: write the event to an `outbox` table in the same DB transaction, then a relay (poller or CDC like Debezium) publishes it. The relay is at-least-once, so consumers stay idempotent. See [20 distributed transactions](./20-distributed-transactions.md) and [v12](../../visuals/v12-saga-outbox.html).
</details>

<details><summary>SQS visibility timeout is 30 s but the job takes 2 minutes. What happens?</summary>

The message becomes visible again and a second worker starts the same job. Set the timeout above the job's p99 time, or extend it with `ChangeMessageVisibility` as a heartbeat while working.
</details>

<details><summary>How do you keep per-key order and still retry failures?</summary>

If a message for key K goes to a retry topic, later messages for K may be processed first. Either block the partition until it succeeds (simple, slows everything), or park all later messages for K too until K is fixed. Choose per use case; most event consumers can tolerate it if handlers check versions.
</details>

<details><summary>Fan-out: one queue with many consumers, or one queue per consumer?</summary>

One queue per consuming service (SNS → SQS per service, RabbitMQ fanout exchange → queue per service, or one Kafka consumer group per service). Inside one service, many workers share that queue.
</details>

## Self-test (answer before opening)

<details><summary>1. Consumer commits the Kafka offset, then crashes while writing to the DB. Which guarantee is this?</summary>

At-most-once. The message is lost. Commit after the DB write to get at-least-once.
</details>

<details><summary>2. Why is "exactly-once delivery" usually the wrong phrase?</summary>

Networks can always duplicate or drop. What you build is exactly-once **effect**: at-least-once delivery plus idempotent processing.
</details>

<details><summary>3. You need to replay last week's events into a new analytics service. RabbitMQ or Kafka?</summary>

Kafka. It keeps messages for the retention period and a new consumer group can start from an old offset. RabbitMQ deletes messages after ack.
</details>

<details><summary>4. What should happen to a message that crashes the consumer every time?</summary>

After N attempts it goes to a DLQ, so the rest of the queue keeps moving. Alert, fix, redrive.
</details>

## Go deeper

- DDIA, chapter 11 (Stream Processing): "Messaging Systems", "Partitioned Logs", "Acknowledgments and redelivery"
- *Enterprise Integration Patterns* (Hohpe and Woolf): Dead Letter Channel, Idempotent Receiver, Claim Check
- Older notes in this repo: `archive/notes/hld-parts/part2.md`, "Module 2.4: Message Queues & Async Processing", "Delivery Guarantees", "Dead Letter Queues (DLQ)", "RabbitMQ vs Kafka vs SQS"; `archive/notes/hld-parts/part3.md`, "Topic 4: Event Streaming vs Messaging"; `archive/notes/hld-parts/part6b.md`, "1.5 Delivery Guarantees"
- Practice: [Notification system](../problems/05-notification-system/README.md), [Distributed message queue](../problems/18-distributed-message-queue/README.md)
