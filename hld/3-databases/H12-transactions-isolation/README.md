# H12 · Transactions, isolation levels and locking

> **Time:** ~75 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/3-databases/H12-transactions-isolation/demo.ts`)
> **Builds on:** [H11 Indexes](../H11-indexing/README.md) · **Used in:** [Payment system](../../case-studies/08-payment-system/README.md), [Ticket booking](../../case-studies/09-ticket-booking/README.md), [Hotel booking](../../case-studies/23-hotel-booking/README.md), [Digital wallet](../../case-studies/28-digital-wallet/README.md), LLD [BookMyShow](../../../lld/problems/13-bookmyshow/README.md), LLD [Payment wallet](../../../lld/problems/19-payment-wallet/README.md)

## The idea in one line

A transaction is a group of statements that applies all-or-nothing; the isolation level decides how much two transactions running at the same time can see of each other, and locks or version checks fix the races the level does not stop.

## Why it matters (the problem it solves)

Two requests touch the same data at the same time. Without care you get:

- A wallet debited twice but the balance only drops once (lost update).
- The last seat sold to two people (oversell).
- A rule like "at least one doctor on call" broken by two valid-looking changes (write skew).
- Two transfers stuck waiting on each other forever (deadlock).

The default level in Postgres (Read Committed) allows the first three. Interviewers love this because most candidates say "I'll use a transaction" and stop. A transaction alone does not stop a lost update.

## How it works

### ACID in one table

| Letter | Meaning | How the DB does it |
|---|---|---|
| **Atomicity** | All statements apply, or none | Write-ahead log (WAL) + undo on rollback |
| **Consistency** | Constraints hold after commit (FK, unique, check) | Mostly your schema's job |
| **Isolation** | Concurrent transactions do not see each other's half-done work, to the level you pick | MVCC snapshots + locks |
| **Durability** | Committed data survives a crash | WAL flushed with `fsync` before COMMIT returns |

### The five anomalies

| Anomaly | What happens | Example |
|---|---|---|
| **Dirty read** | Read a value another transaction has not committed | T1 sets bal = 50, T2 reads 50, T1 rolls back |
| **Non-repeatable read** | Same row read twice, different values | T1 reads 100, T2 commits 50, T1 reads 50 |
| **Phantom** | Same `WHERE` run twice, new rows appear | `COUNT(*) WHERE dept='eng'` gives 3 then 4 |
| **Lost update** | Two read-modify-write cycles; one write silently wins | Both read likes = 10, both write 11 |
| **Write skew** | Both check a rule, then update **different** rows; rule breaks | Two doctors each go off call because "the other is on call" |

### Isolation levels: what each one adds

| Level | Dirty | Non-repeatable | Phantom | Lost update | Write skew |
|---|---|---|---|---|---|
| Read Uncommitted | possible (Postgres treats it as RC) | possible | possible | possible | possible |
| **Read Committed** (Postgres, Oracle, SQL Server default) | no | possible | possible | possible | possible |
| **Repeatable Read** (MySQL InnoDB default) | no | no | Postgres: no. InnoDB: no for plain reads (snapshot) | Postgres: no (2nd writer aborts). InnoDB: **possible** | possible |
| **Serializable** | no | no | no | no | no |

- **Read Committed:** each *statement* gets a fresh snapshot of committed data.
- **Repeatable Read** in Postgres is *snapshot isolation*: the whole transaction reads one snapshot taken at its first statement. If two transactions update the same row, the second gets `ERROR 40001 could not serialize access`.
- **Serializable** in Postgres is *SSI* (serializable snapshot isolation). It tracks read-write dependencies. If it sees a dangerous cycle (T1 read what T2 wrote and T2 read what T1 wrote), it aborts one at commit. MySQL Serializable instead turns plain `SELECT` into locking reads (two-phase locking).

### MVCC: why readers do not block writers

```
 row "acct 1"   version 1: bal=100  xmin=101 xmax=205
                version 2: bal=50   xmin=205 xmax=-      <- UPDATE wrote a NEW version

 T(snapshot before 205 committed) sees version 1   (bal = 100)
 T(snapshot after  205 committed) sees version 2   (bal = 50)
```

- An `UPDATE` writes a new row version. Old versions stay until `VACUUM` removes them.
- Readers pick the version visible to their snapshot. **Readers never block writers, writers never block readers.** Two writers on the same row still block each other (row lock).
- Cost: dead versions pile up. A long-running transaction stops cleanup and bloats tables. Keep transactions short.
- MySQL InnoDB does the same with undo logs instead of in-table versions.

### Explicit locking: the tools that fix the hot spots

```sql
-- 1. Atomic single statement: often all you need
UPDATE wallets SET balance = balance - 30
WHERE id = 42 AND balance >= 30;            -- check rowCount = 1

-- 2. Pessimistic: lock the row, then decide in code
BEGIN;
SELECT balance FROM wallets WHERE id = 42 FOR UPDATE;   -- others wait here
UPDATE wallets SET balance = balance - 30 WHERE id = 42;
COMMIT;

-- 3. Optimistic: version column, no lock held while the user thinks
UPDATE seats SET status = 'HELD', version = version + 1
WHERE id = 'A7' AND version = 5;            -- 0 rows -> someone else won

-- 4. Work queue: each worker takes different rows, nobody waits
SELECT id FROM jobs WHERE status = 'PENDING'
ORDER BY created_at LIMIT 10
FOR UPDATE SKIP LOCKED;
```

| Lock clause | Effect |
|---|---|
| `FOR UPDATE` | Exclusive row lock until commit. Others' `FOR UPDATE` / `UPDATE` wait. Plain reads do not wait (MVCC) |
| `FOR SHARE` | Others can also share-lock, but nobody can update |
| `NOWAIT` | Fail at once instead of waiting |
| `SKIP LOCKED` | Skip rows locked by others. Great for job queues and "any free seat" |

### Which fix for which race

```
 Is the race on ONE row?
   yes -> can the logic fit in one UPDATE ... WHERE?   -> atomic UPDATE
          otherwise, high contention?                  -> SELECT ... FOR UPDATE
          low contention / long user think time?       -> version column (optimistic)
   no  -> rule spans many rows (write skew, overlap)?
          can a constraint express it?                 -> UNIQUE / EXCLUDE constraint
          otherwise                                    -> SERIALIZABLE + retry,
                                                          or FOR UPDATE on every row you check
```

### Deadlocks

```
 T1: lock A ......... wants B  ──┐
                                 │ wait-for graph: T1 -> T2 -> T1  (cycle)
 T2: lock B ......... wants A  ──┘
```

Postgres checks for cycles after `deadlock_timeout` (1 s) and aborts one transaction with `40P01`. Prevent it:

- Lock rows in a fixed order (sort account ids before a transfer).
- Keep transactions short. Never call an external API (payment gateway, email) inside a DB transaction.
- Retry the aborted transaction.

## In TypeScript

A retry wrapper for SERIALIZABLE (and deadlocks) with `pg`:

```ts
import { Pool, PoolClient } from 'pg';

const RETRYABLE = new Set(['40001', '40P01']); // serialization failure, deadlock

async function withTx<T>(pool: Pool, level: 'READ COMMITTED' | 'SERIALIZABLE',
                         fn: (c: PoolClient) => Promise<T>, maxTries = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const c = await pool.connect();
    try {
      await c.query(`BEGIN ISOLATION LEVEL ${level}`);
      const out = await fn(c);
      await c.query('COMMIT');
      return out;
    } catch (e: any) {
      await c.query('ROLLBACK');
      if (!RETRYABLE.has(e.code) || attempt >= maxTries) throw e;
      await new Promise((r) => setTimeout(r, 10 * 2 ** attempt + Math.random() * 10));
    } finally {
      c.release();
    }
  }
}

// Debit without a lost update: one atomic statement at Read Committed.
async function debit(pool: Pool, walletId: string, amount: number) {
  const r = await pool.query(
    'UPDATE wallets SET balance = balance - $2 WHERE id = $1 AND balance >= $2', [walletId, amount]);
  if (r.rowCount !== 1) throw new Error('INSUFFICIENT_FUNDS');
}
```

[demo.ts](demo.ts) simulates the races in memory: a lost update, the atomic and version-column fixes, write skew under snapshot isolation vs SSI, and a deadlock fixed by lock ordering.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Atomic `UPDATE ... WHERE balance >= x` | One-row checks (stock, balance, likes) | Logic must fit in one statement |
| `SELECT ... FOR UPDATE` | High contention, money movement | Waiting, lower throughput, deadlock risk |
| Version column (optimistic) | Low contention, user edits a form | Many retries under contention |
| `SKIP LOCKED` | Job queues, "give me any free item" | No fair ordering under load |
| SERIALIZABLE | Rules across rows that no constraint can express | Aborts under contention; every caller needs retry |
| Unique / exclusion constraint | "One booking per seat per show", "no overlapping room bookings" | None worth mentioning: use it first |

When NOT to:

- Do not run everything at SERIALIZABLE "to be safe". Under contention it aborts many transactions and throughput drops.
- Do not hold a row lock across a network call or user think time. Use a hold with expiry (status `HELD`, `held_until`) instead.
- Do not use DB transactions across services. That is a saga or outbox problem ([H23](../../4-async/H23-distributed-transactions/)).
- Do not use `FOR UPDATE` on a hot single row at 10k writes/s. Shard the counter, or batch updates in a queue.

## Common mistakes

- Saying "I'll wrap it in a transaction" and thinking that stops a lost update. At Read Committed it does not.
- Read-modify-write in app code (`SELECT`, compute in JS, `UPDATE x = computed`) instead of `x = x - 1`.
- Not checking `rowCount` after a conditional update, so a failed debit looks like success.
- Using SERIALIZABLE without retry logic. Error 40001 is normal, not a bug.
- Believing `FOR UPDATE` stops phantoms. It locks rows that exist; a rule about rows that do not exist yet ("no overlapping booking") needs a constraint, a parent-row lock, or SERIALIZABLE.
- Long transactions: holding locks while calling Stripe/Razorpay, which also blocks VACUUM.
- Locking two accounts in request order, which deadlocks under load.
- Assuming MySQL Repeatable Read behaves like Postgres. InnoDB still allows lost updates with plain reads.

## Say this in the interview

> "Postgres defaults to Read Committed, which still allows lost updates and write skew. For a balance or stock counter I'll use a single atomic update: `SET balance = balance - x WHERE id = ? AND balance >= x`, and check that one row changed. If I must read, decide in code and then write, I'll take `SELECT ... FOR UPDATE` on that row."

> "For seat or room booking, the database is the final guard: a unique constraint on `(show_id, seat_id)`, or an exclusion constraint on room and date range. For rules that span rows and that no constraint can express, I'll use SERIALIZABLE and retry on SQLSTATE 40001."

> "For transfers I lock both accounts in id order so two opposite transfers cannot deadlock. Transactions stay short: no external API calls inside them. The payment gateway call happens outside, tied together with an idempotency key and an outbox."

## Your experience hook

- **Payment orchestration (SenseGrass):** webhook processing ran inside a DB transaction with a unique constraint on the provider event id, so a webhook delivered twice is inserted once. The payment status moves with a conditional update (`WHERE status = 'PENDING'`), which makes out-of-order webhooks safe.
- **Idempotency keys:** `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING` is an atomic "check and claim" with no race, unlike "SELECT, then INSERT if missing".
- **IoT fleet (10k+ devices):** the same guard applies to device state: an update with `WHERE last_seen_at < $new` (or a version column) stops a late, old message from overwriting newer state. A good follow-up answer if asked how you would make device updates safe.

## Numbers to remember

| Fact | Value |
|---|---|
| Postgres default level | Read Committed |
| MySQL InnoDB default level | Repeatable Read |
| Serialization failure code | SQLSTATE `40001` |
| Deadlock code (Postgres) | `40P01` |
| Postgres `deadlock_timeout` | 1 s |
| Postgres `lock_timeout` / `statement_timeout` | off by default: set them (e.g. 2 s / 5 s) |
| Simple writes on one tuned primary | thousands to low tens of thousands per second |
| Hot single row under `FOR UPDATE` | a few hundred to ~1-2k updates/s (each waits for the previous commit + fsync) |
| Commit latency (fsync on SSD) | ~0.1-2 ms |

## Self-test

<details><summary>1. Two transfers debit the same account at Postgres Read Committed with "read, then write the computed value". Which anomaly, and how do you fix it?</summary>

Lost update. Fix with an atomic `balance = balance - x` update, `SELECT ... FOR UPDATE`, a version column, or Repeatable Read with retry.
</details>

<details><summary>2. Which anomaly does Postgres Repeatable Read still allow?</summary>

Write skew (and other serialization anomalies). Each transaction writes a different row, so there is no write-write conflict to detect. Only SERIALIZABLE (SSI) stops it.
</details>

<details><summary>3. What must the application do when it runs at SERIALIZABLE?</summary>

Catch SQLSTATE 40001 and retry the whole transaction, with a small backoff. Keep transactions short so retries are cheap.
</details>

<details><summary>4. 10 workers poll a jobs table and keep grabbing the same job or waiting on each other. Fix?</summary>

`SELECT ... FOR UPDATE SKIP LOCKED LIMIT n` inside a transaction, mark the rows RUNNING, commit. Each worker gets different rows without waiting.
</details>

<details><summary>5. Transfer A→B and B→A run at the same time and deadlock. How do you prevent it?</summary>

Always lock the two accounts in the same order, for example lower id first (`SELECT ... WHERE id IN (a, b) ORDER BY id FOR UPDATE`). Also retry on 40P01.
</details>

<details><summary>6. Is SELECT ... FOR UPDATE enough to stop two overlapping hotel bookings?</summary>

No. The conflicting booking row does not exist yet, so there is nothing to lock (a phantom). Use an exclusion constraint on (room, date range), lock a parent row (the room), or SERIALIZABLE.
</details>

<details><summary>7. Why not run every transaction at SERIALIZABLE?</summary>

Under contention it aborts many transactions, every caller needs retry code, and throughput drops. Most systems use Read Committed plus targeted locks and constraints on the few invariants that matter.
</details>

<details><summary>8. Optimistic or pessimistic locking for a hot ticket sale (everyone wants the same front rows)?</summary>

Contention is very high, so optimistic retries pile up. Use a conditional update or `FOR UPDATE SKIP LOCKED` for "any seat", or a short hold in Redis with a TTL in front of the DB. Keep the unique constraint as the final guard.
</details>

## Go deeper

- Visual: [visual.html](visual.html) (switch Level and Engine to compare the SQL standard with Postgres)
- Next: [H13 Data modelling](../H13-data-modeling/README.md), [H15 Replication](../H15-replication/README.md), [H23 Distributed transactions](../../4-async/H23-distributed-transactions/), [H38 Payments domain](../../6-building-blocks/H38-payments-domain/)
- In-process races in Node: [L32 Concurrency in Node](../../../lld/5-machine-coding/L32-concurrency-in-node/)
- Case studies: [Ticket booking](../../case-studies/09-ticket-booking/README.md), [Digital wallet](../../case-studies/28-digital-wallet/README.md), [Payment system](../../case-studies/08-payment-system/README.md)
- Archive notes: [hld-parts/part1.md](../../../archive/notes/hld-parts/part1.md) ("ACID Properties (Deep Dive)")
- Book: DDIA chapter 7 ("Weak Isolation Levels", "Serializability"). Postgres docs: "Transaction Isolation", "Explicit Locking".
