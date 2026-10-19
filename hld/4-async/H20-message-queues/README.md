# H20 · Message queues and pub-sub (RabbitMQ, SQS, Redis)

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/4-async/H20-message-queues/demo.ts`) · **Hands-on:** [hands-on/](hands-on/README.md) (RabbitMQ + Kafka in Docker)
> **Builds on:** [H07 Scaling and stateless services](../../2-scaling/H07-scaling-stateless/README.md) · [H18 CAP and consistency](../../3-databases/H18-cap-pacelc-consistency/README.md) · **Used in:** Notification system, Payment system, Food delivery, Video streaming, Web crawler, Distributed message queue, Job scheduler

## The idea in one line

Put a durable buffer between the service that produces work and the service that does it, so they can fail, scale and run at different speeds independently.

## Why it matters (the problem it solves)

With direct synchronous calls:

- If the downstream is slow or down, the caller is slow or fails too (failures chain).
- A traffic spike hits the slowest service directly (a 10× sale-day burst on a PDF generator).
- One event like `payment.captured` must reach five services, and the caller must know all of them.

A queue gives you four things: **decoupling** (producer doesn't know consumers), **load levelling** (absorb a spike, drain it later), **retries** (failed work comes back), and **fan-out** (one event, many consumers). Almost every HLD answer past the basics has a queue in it; the interviewer then asks about acks, ordering, retries and the DLQ.

## How it works

### Two delivery models

```
Point-to-point (work queue)               Publish-subscribe (fan-out)
                   ┌─► worker 1                            ┌─► [q.email]   ─► email svc
producer ─► [queue]┼─► worker 2           producer ─► exch ┼─► [q.ledger]  ─► ledger svc
                   └─► worker 3                            └─► [q.analytics]─► analytics
each message → ONE worker                 each message → EVERY subscribed queue
use: jobs (resize image, send email)      use: events (order.placed, payment.captured)
```

Inside one service, many workers share one queue (competing consumers). Across services, each service gets **its own queue** bound to the topic. That is the standard combo.

### The broker landscape

| | RabbitMQ | SQS (+ SNS) | Redis Pub/Sub | Redis Streams / BullMQ | Kafka ([H21](../H21-kafka/README.md)) |
|---|---|---|---|---|---|
| Model | Smart broker: exchanges route to queues | Managed queue; SNS topic fans out to queues | Fire-and-forget channels | Append-only stream with consumer groups | Partitioned log |
| After consume | Deleted on ack | Deleted on `DeleteMessage` | Never stored | Kept (trim with `MAXLEN`) | Kept until retention ends |
| Offline subscriber | Messages wait in its queue | Messages wait | **Message lost** | Reads later from its last ID | Reads from its offset |
| Replay | No | No | No | Yes (by ID) | Yes (move the offset) |
| Per-message ack / retry | Yes | Yes (visibility timeout) | No | Yes (`XACK`, pending list) | No (commit offset) |
| Ordering | Per queue, single consumer | FIFO queue: per `MessageGroupId` | Per channel, best-effort | Per stream | Per partition |
| Good for | Task queues, routing, priorities, delays | Zero-ops AWS jobs, Lambda | Live signals: presence, cache invalidation, WS fan-out across nodes | Small Node systems, delayed jobs | Event streaming, replay, many consumers |

**RabbitMQ exchanges:** `direct` (exact routing key), `topic` (`order.*.created` wildcards), `fanout` (every bound queue), `headers`. Queues are bound to exchanges; producers never publish straight to a consumer.

### Acknowledgements: where duplicates and losses come from

```
consumer:  receive ──► process ──► ACK          crash before ACK → broker redelivers (duplicate)
                    ACK ──► process            crash after early ACK → message lost
```

- **RabbitMQ:** manual `ack` after work. If the channel closes with unacked messages, they go back to the queue. `prefetch = 10` caps unacked messages per consumer so one slow worker doesn't hoard.
- **SQS:** `ReceiveMessage` hides a message for the **visibility timeout** (default 30 s). Not deleted in time → visible again → another worker gets it. Long jobs must extend it with `ChangeMessageVisibility` as a heartbeat.
- **Redis Streams:** `XREADGROUP` moves the entry to the group's pending list; `XACK` removes it; `XAUTOCLAIM` lets another consumer take entries pending too long.

| Guarantee | How | Risk |
|---|---|---|
| At-most-once | Ack **before** processing (or Redis Pub/Sub) | Crash = message lost |
| At-least-once | Ack **after** processing | Crash = processed twice |
| Exactly-once effect | At-least-once + **idempotent consumer** | Needs a dedupe key (see [H22](../H22-delivery-semantics/README.md)) |

Default answer: **at-least-once + idempotent consumers**.

### Retries, backoff and the dead-letter queue

1. Handler throws → `nack` / don't delete → retry later with **exponential backoff + jitter** (1 s, 2 s, 4 s … ± random). RabbitMQ: a delay queue with TTL that dead-letters back to the main queue. SQS: visibility timeout. Kafka: retry topics.
2. After `maxReceiveCount` (e.g. 5) failures → move to a **DLQ**.
3. Alert on DLQ depth > 0. Fix the bug. **Redrive** the DLQ back to the main queue.

A **poison message** (always fails) without a DLQ blocks a FIFO queue forever or burns CPU in an endless retry loop.

### Ordering

You rarely need global order. You need order **per entity** (per order, per account, per device).

- SQS FIFO: `MessageGroupId = orderId`.
- RabbitMQ: one queue + single active consumer, or a consistent-hash exchange that pins a key to one queue.
- Kafka: message key = entity id → same partition.
- Retries break order: if message 1 for order 42 goes to a retry queue, message 2 may run first. Make handlers check a version / state machine so a late message is ignored.

### Back-pressure and scaling consumers

- The key metric is **queue depth** (or consumer lag) and **age of oldest message**.
- Scale workers on depth (KEDA, SQS target tracking): `workers ≈ arrival_rate × processing_time` (Little's law). 2,000 msg/s × 50 ms = 100 concurrent handlers.
- If producers are faster than consumers for hours, the queue only delays the crash. Rate-limit at the edge or shed load.
- Keep messages small (a few KB). For big payloads, upload to S3 and send a pointer (**claim check**).

## In TypeScript

A worker loop with ack-after-work, backoff and a DLQ (full simulation in `demo.ts`):

```ts
type Msg = { id: string; body: string; attempts: number };

async function handle(msg: Msg, queue: Msg[], dlq: Msg[], work: (m: Msg) => Promise<void>, maxAttempts = 5) {
  try {
    await work(msg);                 // 1. do the side effect
    // 2. ack only now: a crash above means redelivery, never loss
  } catch {
    msg.attempts++;
    if (msg.attempts >= maxAttempts) dlq.push(msg);          // poison: park it
    else {
      const delayMs = Math.min(30_000, 2 ** msg.attempts * 100) * (0.5 + Math.random()); // backoff + jitter
      setTimeout(() => queue.push(msg), delayMs);
    }
  }
}
```

Idempotent consumer with a processed-ids table:

```ts
// INSERT ... ON CONFLICT DO NOTHING in the SAME transaction as the side effect
if (!(await db.tryInsert('processed_messages', { id: msg.id }))) return; // duplicate: skip
await db.insert('emails_sent', { orderId, to });
```

## Trade-offs / when NOT to use it

| Choice | Pick when | Weakness |
|---|---|---|
| RabbitMQ | Task queues, complex routing, per-message ack, priorities, delays | No replay; very long queues hurt memory and throughput |
| SQS + SNS | On AWS, want zero ops | No replay; FIFO throughput caps; AWS lock-in |
| Redis Pub/Sub | Ephemeral live signals (Socket.io adapter, cache invalidation) | No persistence: offline subscriber loses messages |
| Redis Streams / BullMQ | Node.js jobs, delays, already run Redis | Memory-bound; durability depends on AOF settings |
| Kafka | High throughput, many consumer groups, replay, CDC | Ops heavy; no per-message retry; consumers ≤ partitions |

**Don't** put a queue where the user needs the answer to continue (login, balance check, "is the seat free?"). **Don't** use a queue to hide a consumer that is permanently too slow. **Don't** use Redis Pub/Sub for anything you can't lose.

## Common mistakes

- Saying "the queue guarantees exactly-once". It doesn't; your consumer must be idempotent.
- Auto-ack (`noAck: true`) in production consumers: a crash loses messages silently.
- No DLQ, so one bad message blocks a FIFO queue or loops forever.
- SQS visibility timeout shorter than the job: two workers process the same job.
- One shared queue for several services, so they steal each other's messages instead of each getting a copy.
- Retrying instantly in a tight loop (retry storm) instead of backoff with jitter.
- Writing to the DB and then publishing, without an outbox: a crash between the two loses the event (see [H23](../H23-distributed-transactions/README.md)).
- Using Redis Pub/Sub for order events: a restarting subscriber misses them forever.

## Say this in the interview

> "After the order is placed, the API writes the order and an outbox row in one transaction and returns 202. A relay publishes `order.placed` to a topic exchange. Email, inventory and analytics each have their own durable queue bound to it, so each gets a copy, and inside each service several workers compete on that queue."

> "Delivery is at-least-once: workers ack only after the side effect is committed, and every consumer is idempotent on the message id with a unique constraint. Failures retry with exponential backoff and jitter; after 5 attempts the message goes to a DLQ that we alert on and redrive after the fix. We autoscale workers on queue depth and age of the oldest message."

> "I'd pick RabbitMQ or SQS for job-style work with per-message retries, and Kafka when I need replay, very high throughput or many independent consumers of the same event stream."

## Your experience hook

- **IoT platform (10k+ devices):** a Redis queue with batch processing absorbed high-frequency device writes and turned them into fewer, bigger DB writes. That is load levelling. At 10× you'd move ingestion to Kafka.
- **WebSocket scaling:** the Redis adapter for Socket.io is Redis **Pub/Sub**: each node publishes room events and the others deliver to their local sockets. Fine for live signals, and you can explain why it is not used for anything durable.
- **Notification service / microservices gateway:** RabbitMQ events between services, adapters per channel, retries. Talk about per-service queues, ack-after-work and the DLQ.

## Numbers to remember

| Thing | Number |
|---|---|
| SQS message size | Up to 1 MiB (was 256 KB; many docs still say 256 KB) |
| SQS retention | 4 days default, up to 14 days |
| SQS visibility timeout | 30 s default, max 12 h |
| SQS FIFO throughput | 300 msg/s per API action, 3,000/s with batching (high-throughput mode: far more) |
| RabbitMQ single node | ~10k–50k msg/s with persistence + confirms; much more without |
| Redis Pub/Sub | ~100k+ msg/s, zero durability |
| Typical maxReceiveCount before DLQ | 3–5 |
| Little's law | workers = arrival rate × processing time |

## Self-test

<details><summary>1. A consumer acks, then crashes while writing to the DB. Which guarantee is that?</summary>

At-most-once: the message is gone and the work was never done. Ack after the DB commit to get at-least-once.
</details>

<details><summary>2. Three services must react to <code>order.placed</code>. One queue with three consumers, or something else?</summary>

One queue per service, all bound to the same topic/fanout exchange (or SNS → 3 SQS queues). With one shared queue each message reaches only one of the services.
</details>

<details><summary>3. SQS visibility timeout is 30 s, the job takes 2 minutes. What happens and how do you fix it?</summary>

The message becomes visible again after 30 s and a second worker starts the same job. Set the timeout above the job's p99, or extend it with <code>ChangeMessageVisibility</code> as a heartbeat; and keep the handler idempotent.
</details>

<details><summary>4. Why does a poison message need a DLQ?</summary>

It fails every time. Without a cap it retries forever, burns workers and in a FIFO queue blocks everything behind it. After N attempts it goes to the DLQ, the queue keeps moving, and you alert and redrive after the fix.
</details>

<details><summary>5. Redis Pub/Sub vs Redis Streams?</summary>

Pub/Sub pushes to whoever is connected right now and stores nothing: an offline subscriber misses messages. Streams store entries, support consumer groups, pending lists and acks, so a consumer can resume where it left off.
</details>

<details><summary>6. 2,000 messages/s arrive, each takes 50 ms. How many concurrent handlers?</summary>

Little's law: 2,000 × 0.05 = 100 in flight. Add headroom (e.g. 150) and autoscale on queue depth.
</details>

<details><summary>7. How do you keep per-order ordering with many workers?</summary>

Route by order id: SQS FIFO <code>MessageGroupId</code>, RabbitMQ consistent-hash exchange or single active consumer, Kafka key → partition. Retries can still reorder, so handlers check a version or state machine.
</details>

## Go deeper

- Hands-on: [hands-on/README.md](hands-on/README.md) (RabbitMQ and Kafka producer/consumer in Docker)
- Next: [H21 Kafka deep dive](../H21-kafka/README.md) · [H22 Delivery semantics and idempotency](../H22-delivery-semantics/README.md) · [H23 Outbox and sagas](../H23-distributed-transactions/README.md)
- LLD version: [Pub-sub queue](../../../lld/problems/15-pub-sub-queue/README.md)
- Case studies: [Notification system](../../case-studies/05-notification-system/README.md), [Distributed message queue](../../case-studies/18-distributed-message-queue/README.md), [Payment system](../../case-studies/08-payment-system/README.md), [Web crawler](../../case-studies/13-web-crawler/README.md), [Job scheduler](../../case-studies/24-job-scheduler/README.md)
- Archive notes: [hld-parts/part2.md](../../../archive/notes/hld-parts/part2.md) ("Message Queues & Async Processing", "Dead Letter Queues"), [hld-parts/part3.md](../../../archive/notes/hld-parts/part3.md) ("Event Streaming vs Messaging")
- DDIA chapter 11 ("Messaging Systems"); *Enterprise Integration Patterns*: Dead Letter Channel, Idempotent Receiver, Claim Check
