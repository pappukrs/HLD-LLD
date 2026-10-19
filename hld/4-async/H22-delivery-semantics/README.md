# H22 · Delivery semantics and idempotency

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/4-async/H22-delivery-semantics/demo.ts`)
> **Builds on:** [H20 Message queues and pub-sub](../H20-message-queues/README.md) · [H21 Kafka deep dive](../H21-kafka/README.md) · [H04 API design](../../1-basics/H04-api-design/README.md) · **Used in:** Payment system, Digital wallet, Notification system, Ad click aggregation, Ticket booking, Stock exchange

## The idea in one line

Networks lose messages and acks, so exactly-once **delivery** is impossible. You get at-least-once delivery and make the **processing** idempotent: doing it twice has the same effect as doing it once.

## Why it matters (the problem it solves)

A client calls `POST /payments`. The server charges the card, but the response is lost (timeout, pod restart, LB reset). The client cannot tell "never happened" from "happened, reply lost":

- If it does **not** retry, a real payment may be lost.
- If it **does** retry, the customer may pay twice.

Queues have the same problem. A consumer credits a wallet, then crashes before it acks. The broker redelivers. Without protection, the wallet is credited twice or two SMS go out. This is the single most common "deep dive" in payment and wallet interviews.

## How it works

### The three delivery semantics

| Semantic | How you get it | Failure looks like | Use for |
|---|---|---|---|
| **At-most-once** | Ack (or commit the offset) **before** processing. Never retry | Lost messages | Metrics, logs, presence pings |
| **At-least-once** | Ack **after** processing. Retry on timeout | Duplicates | Default for business events |
| **Exactly-once effect** | At-least-once **+** idempotent / deduplicated processing | Needs a dedupe store and care with side effects | Money, inventory, notifications |

```
 consumer timeline        crash here →  result
 ack ─ work               after ack      LOST      (at-most-once)
 work ─ ack               before ack     DUPLICATE (at-least-once)
 [dedupe+work] ─ ack      before ack     redelivered, dedupe row exists → skipped (exactly-once effect)
```

"Exactly-once" in product docs nearly always means "inside one system". Kafka EOS covers read-from-Kafka, process, write-to-Kafka. It does **not** cover an email you sent or a call to a bank.

### Idempotent by nature vs needs a key

| Operation | Idempotent? | Why |
|---|---|---|
| `PUT /users/42 {name}`, `DELETE /x/1`, `SET status='PAID'` | Yes | Absolute end state |
| `UPDATE orders SET status='PAID' WHERE id=? AND status='PENDING'` | Yes | Conditional: 2nd run updates 0 rows |
| Upsert `INSERT … ON CONFLICT (id) DO NOTHING` | Yes | Unique key absorbs repeats |
| `POST /payments`, `INCR`, `balance = balance + 100` | **No** | Each run adds again: needs a key |
| Send an email / SMS / call a PSP | **No** | External side effect: needs a key and the provider's dedupe |

### Idempotency keys for APIs (Stripe style)

1. The client creates one UUID per **logical operation** and sends `Idempotency-Key: <uuid>`. It reuses the **same** key on every retry.
2. The server inserts `(scope, key, request_hash, status='IN_PROGRESS')` with a **unique constraint**.
3. Insert wins → run the operation → store the response (code + body) against the key.
4. Insert loses (key exists):

| Stored state | Same request hash? | Return |
|---|---|---|
| `COMPLETED` | Yes | The **saved** response. Do not run again |
| `IN_PROGRESS` | Yes | `409 Conflict` (or wait). Another attempt is running |
| any | No | `422`: key reused for a different request |

```sql
CREATE TABLE idempotency_keys (
  merchant_id   BIGINT,
  idem_key      VARCHAR(64),
  request_hash  CHAR(64),
  status        VARCHAR(16),      -- IN_PROGRESS | COMPLETED
  response_code INT,
  response_body JSONB,
  created_at    TIMESTAMPTZ,
  PRIMARY KEY (merchant_id, idem_key)   -- scope per client
);
```

Best case: write the key row and the business change **in the same DB transaction**, so "charged but key not saved" cannot happen. If the side effect is external (a PSP), also send **your own reference id** to the provider so it can dedupe, and query its status API after a timeout instead of charging again.

### Deduplicating consumers (the inbox table)

```
Broker ──m1──► Consumer ── BEGIN
                          INSERT processed(event_id=m1)   ← UNIQUE
                          UPDATE wallet SET bal = bal - 100
                          COMMIT
               ✗ ack lost
Broker ──m1──► Consumer ── INSERT processed(m1) → unique violation → ROLLBACK, ack, skip
```

- The dedupe insert and the business change must commit **together**. If they are separate, a crash between them brings the duplicate back (or loses the effect).
- The id must be **stable**: `event_id` set by the producer, or a business key (`order_id + action`). A fresh random id per send defeats dedupe.
- Kafka variant: store the consumed offset in the same DB transaction and seek to it on restart.

### Where duplicates come from

| Source | Example | Defence |
|---|---|---|
| Client retry | Mobile app times out and resends | `Idempotency-Key` header |
| Producer retry | Publish ack lost, producer resends | Kafka idempotent producer, SQS FIFO dedup id, stable `event_id` |
| Consumer crash | Work done, ack not sent | Inbox table / conditional update |
| Rebalance | Partition moves before commit | Same: idempotent handler |
| Webhook retry | PSP retries for hours or days | Dedupe on provider `event_id`; state machine that only moves forward |

### Ordering is a separate problem

Idempotency stops repeats. It does not stop **out-of-order** events (`payment.captured` arriving before `payment.authorized`). Handle that with a state machine that rejects invalid transitions, or a version number: `UPDATE … WHERE version = :expected`.

## In TypeScript

An idempotent consumer with an inbox set and a single "transaction" (full runnable version in `demo.ts`):

```ts
async function handle(evt: { id: string; orderId: string; amount: number }) {
  await db.transaction(async (tx) => {
    const inserted = await tx.query(
      'INSERT INTO processed_events(event_id) VALUES ($1) ON CONFLICT DO NOTHING', [evt.id]);
    if (inserted.rowCount === 0) return;               // duplicate: skip the effect
    await tx.query('UPDATE wallets SET balance = balance - $1 WHERE order_id = $2',
      [evt.amount, evt.orderId]);
  });                                                  // both or neither
  // ack / commit offset only after the transaction commits
}
```

An idempotency-key middleware decision:

```ts
type Row = { status: 'IN_PROGRESS' | 'COMPLETED'; hash: string; response?: { code: number; body: unknown } };

function decide(row: Row | undefined, hash: string) {
  if (!row) return { run: true };
  if (row.hash !== hash) return { run: false, code: 422 };
  if (row.status === 'IN_PROGRESS') return { run: false, code: 409 };
  return { run: false, code: row.response!.code, body: row.response!.body }; // replay saved response
}
```

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| At-most-once | Metrics, logs, presence: losing a few is fine | Data loss on crash |
| At-least-once + idempotent handler | Default for business events | You must design the handler and the dedupe store |
| Natural idempotency (conditional update, upsert, absolute set) | Clear "from → to" state changes | Not possible for increments or external calls |
| Idempotency-key table | Public write APIs, payments | One extra write per request; storage and TTL |
| Kafka transactions (EOS) | Kafka-to-Kafka stream processing | Does not reach external systems; adds latency |
| Redis `SET key NX EX 86400` | High volume where a rare duplicate is OK | Not atomic with the DB write; Redis can lose keys on failover |

Do not add a dedupe table to naturally idempotent operations. It is extra writes for nothing.

## Common mistakes

- Saying "we use Kafka so it's exactly-once". It is not, once you write to Postgres or call a PSP.
- "Check then insert" without a unique constraint: two concurrent retries both see "not found" and both charge.
- Dedupe row and business write in **separate** transactions (or Redis + DB): a crash between them breaks it.
- Generating a new key on each retry, so nothing ever matches. The key belongs to the user action, created once.
- Keeping keys for less time than the retry window (webhooks can retry for 3 days).
- Ignoring the "unknown state": the PSP call timed out. Retrying with a **new** reference double-charges. Retry with the same reference or query status first.
- Forgetting ordering: idempotent, but `captured` applied before `authorized`.

## Say this in the interview

> "Delivery is at-least-once everywhere, so every write path is idempotent. Clients send an `Idempotency-Key`. I store it with a unique constraint, the request hash and the saved response, in the same transaction as the business change. A retry gets the stored response; a concurrent retry gets 409; a reused key with a different body gets 422."

> "Consumers keep a `processed_events` table keyed by event id and insert into it in the same transaction as the side effect, then ack. For external calls I pass our own reference id, so the provider can dedupe, and after a timeout I query status instead of charging again. That's an exactly-once effect over an at-least-once network."

## Your experience hook

- **Payment orchestration across 3 PSPs:** you used client-generated idempotency keys per payment intent; a repeat returned the stored result instead of re-charging. Say the exact sentence: "at-least-once delivery plus idempotent processing equals an exactly-once effect."
- **Webhooks:** PSP webhooks arrived more than once and out of order. You deduped on the provider event id inside a DB transaction and drove status through a state machine (`created → pending → success/failed`) that ignores backwards moves.
- **IoT (10k devices, MQTT):** you removed duplicate MQTT processing with load-sharing. MQTT QoS 1 is at-least-once, so handlers keyed by `device_id + seq` make repeats harmless.

## Numbers to remember

| Thing | Number |
|---|---|
| Stripe idempotency key retention | At least 24 hours |
| SQS FIFO dedup window | 5 minutes (`MessageDeduplicationId`) |
| SQS standard | At-least-once, best-effort order |
| Kafka idempotent producer | Default on since 3.0; up to 5 in-flight requests keep order |
| PSP webhook retries | Often up to ~3 days with backoff |
| Key table size | 10M req/day × ~1 KB ≈ 10 GB/day: partition by day, drop old partitions |

## Self-test

<details><summary>1. Is `UPDATE accounts SET balance = balance - 100 WHERE id = 7` idempotent? How do you make it safe?</summary>

No, each run takes 100 more. Insert a ledger entry with a unique `txn_id` in the same transaction, or use a conditional update on a version number.
</details>

<details><summary>2. A consumer commits the Kafka offset first, then writes to the DB. Which semantic?</summary>

At-most-once. A crash after the commit and before the write loses the message.
</details>

<details><summary>3. Two retries with the same key arrive at the same moment. What happens?</summary>

Both try to insert the key. The unique constraint lets one win. The other sees `IN_PROGRESS` and gets 409 (or waits). Never "read then insert" without a constraint.
</details>

<details><summary>4. A client retries with the same key but a different amount. What should the server do?</summary>

Reject with 422. The key is bound to the hash of the first request.
</details>

<details><summary>5. The handler called the PSP, then crashed before saving the result. What does the retry do?</summary>

The key is still `IN_PROGRESS`. Do not charge with a new reference. Call the PSP with the same reference (it dedupes), or query its status API first, then complete the row. This is the "unknown state" problem.
</details>

<details><summary>6. Why can't the broker alone give exactly-once?</summary>

The broker cannot see your side effects. If the consumer writes to Postgres and crashes before committing the offset, the message returns. The dedupe has to live where the side effect lives.
</details>

<details><summary>7. How long do you keep dedupe records?</summary>

Longer than the longest redelivery: client retry window, broker retention, and webhook retry period. Partition by day and drop old partitions instead of row deletes.
</details>

## Go deeper

- Next: [H23 Distributed transactions: 2PC, Saga, Outbox](../H23-distributed-transactions/README.md) (the outbox is how the producer side gets "write + publish" atomic)
- Case studies: [Payment system](../../case-studies/08-payment-system/README.md), [Digital wallet](../../case-studies/28-digital-wallet/README.md), [Notification system](../../case-studies/05-notification-system/README.md), [Ad click aggregation](../../case-studies/20-ad-click-aggregation/README.md)
- LLD: [Payment wallet](../../../lld/problems/19-payment-wallet/README.md)
- Archive notes: [hld-parts/part2.md](../../../archive/notes/hld-parts/part2.md) ("Delivery Guarantees", "Handling Duplicates: Idempotency"), [hld-parts/part6b.md](../../../archive/notes/hld-parts/part6b.md) ("Delivery Guarantees", "Exactly-Once")
- Stripe: "Designing robust and predictable APIs with idempotency"; DDIA chapter 11 ("Idempotence") and chapter 12 ("Operation identifiers")
