# 10 · SQL Deep Dive (Indexes, Transactions, Isolation, Locking)

> **Read time:** 50 min · **Visual:** [v20 transaction isolation levels](../../visuals/v20-isolation-levels.html), [v28 seat locking](../../visuals/v28-seat-locking.html) · **Code it:** [lld/problems/13-bookmyshow](../../lld/problems/13-bookmyshow/README.md) (seat locking in code)
> **Shows up in:** payment system, digital wallet, ticket booking, hotel booking, inventory, job scheduler, any "no double booking / no double spend" question

## The idea in one line

A relational DB gives you fast lookups through indexes and correct concurrent updates through transactions. You must know which anomalies each isolation level still allows, and lock explicitly when it allows the one you care about.

## The problem it solves

- Without an index, `WHERE user_id = 42` scans every row. On 100M rows that is seconds, not milliseconds.
- Two requests that each "read balance, check, write balance" at the same time can both succeed and spend the money twice.
- Fintech and booking interviews always ask: "How do you stop two users booking the same seat?" The answer is in this card.

## How it works

### Indexes

| Index | Structure | Supports | Notes |
|---|---|---|---|
| **B-tree / B+tree** (default) | Balanced tree, sorted keys, leaves linked | `=`, `<`, `>`, `BETWEEN`, `ORDER BY`, prefix `LIKE 'abc%'` | 3–4 levels deep even for 100M+ rows |
| **Hash** | Hash table | `=` only | No ranges, no ordering. Postgres has it; rarely better than B-tree |
| GIN / inverted | Value → list of rows | Arrays, JSONB, full-text | Slower writes |
| LSM-tree (not in Postgres/MySQL core) | Memtable + sorted files | Write-heavy | Cassandra, RocksDB; see [11 NoSQL](./11-nosql-types.md) |

**Every index slows writes** (each insert updates every index) and uses disk and memory. Index what queries need, nothing more.

**Composite index and the leftmost prefix rule.** An index on `(merchant_id, status, created_at)` is sorted by merchant, then status, then time.

- Uses the index: `merchant_id = ?`; `merchant_id = ? AND status = ?`; `merchant_id = ? AND status = ? ORDER BY created_at DESC`.
- Cannot use it well: `status = ?` alone; `created_at > ?` alone (no leftmost column).
- The order of conditions in `WHERE` does not matter. The order of columns in the index does.
- A range on a column stops seeking on the columns after it. With an index on `(merchant_id, created_at, status)`, the query `merchant_id = ? AND created_at > ? AND status = ?` seeks on merchant and the time range, then only filters by status.
- Rule of thumb: equality columns first, then the range or sort column.

**Covering index.** If the index holds every column the query needs, the DB answers from the index without reading the table ("index-only scan" in Postgres, "Using index" in MySQL). Postgres: `CREATE INDEX … (merchant_id, created_at) INCLUDE (amount)`.

**EXPLAIN.** `EXPLAIN ANALYZE SELECT …` (Postgres) shows the real plan and timings. Look for:

- `Seq Scan` on a big table → missing or unusable index.
- `Index Scan` / `Index Only Scan` → good.
- Estimated rows far from actual rows → stale statistics; run `ANALYZE`.
- MySQL: `EXPLAIN` column `type` (`ALL` = full scan, `ref`/`range` = index) and `Extra` (`Using filesort`, `Using temporary` = extra work).

### ACID

- **Atomicity**: all statements of a transaction apply, or none (undo / WAL).
- **Consistency**: constraints (FK, unique, check) hold after commit. Mostly your schema's job.
- **Isolation**: concurrent transactions do not see each other's half-done work, to the level you choose.
- **Durability**: after commit, data survives a crash (WAL flushed with `fsync`).

### Anomalies

| Anomaly | Example |
|---|---|
| **Dirty read** | T1 reads T2's uncommitted write; T2 rolls back |
| **Non-repeatable read** | T1 reads a row twice and gets different values because T2 committed in between |
| **Phantom** | T1 runs the same `WHERE` twice and gets a different set of rows because T2 inserted one |
| **Lost update** | T1 and T2 both read balance 100, both write 100 − 30 = 70. One debit is lost |
| **Write skew** | Two doctors on call; each checks "another doctor is on call", each removes themselves. Both commit. Nobody is on call. Different rows written, so no write conflict |

### Isolation levels (what actually happens)

| Level | Dirty read | Non-repeatable | Phantom | Lost update | Write skew |
|---|---|---|---|---|---|
| Read Uncommitted | possible (Postgres treats it as RC) | possible | possible | possible | possible |
| **Read Committed** (Postgres default) | no | possible | possible | possible | possible |
| **Repeatable Read** (MySQL InnoDB default) | no | no | Postgres: no. InnoDB: mostly no (next-key locks for locking reads) | Postgres: no (second writer aborts). InnoDB: possible with plain reads | possible |
| **Serializable** | no | no | no | no | no |

Notes:

- Postgres Repeatable Read is **snapshot isolation**. If two transactions update the same row, the second gets `could not serialize access` and must retry. It still allows write skew.
- Postgres Serializable is **SSI** (serializable snapshot isolation). It detects dangerous read/write patterns and aborts one transaction. Your code must retry on serialization failure (SQLSTATE `40001`).
- MySQL Serializable turns plain `SELECT` into locking reads.

### MVCC in Postgres

- Every row version has `xmin` (the transaction that created it) and `xmax` (the one that deleted or replaced it).
- An `UPDATE` writes a new version; it does not overwrite in place.
- Each statement (Read Committed) or each transaction (Repeatable Read) gets a snapshot and sees only versions committed before it.
- Result: **readers never block writers, and writers never block readers.** Writers on the same row still block each other.
- Cost: dead versions pile up. `VACUUM` (autovacuum) cleans them. Long-running transactions stop that cleanup and cause table bloat.
- MySQL InnoDB also uses MVCC, with undo logs instead of in-table versions.

### Explicit locking

```sql
-- Pessimistic: lock the row, then decide
BEGIN;
SELECT balance FROM wallets WHERE id = 42 FOR UPDATE;   -- others wait here
UPDATE wallets SET balance = balance - 30 WHERE id = 42;
COMMIT;

-- Atomic single statement (often enough, no explicit lock)
UPDATE wallets SET balance = balance - 30
WHERE id = 42 AND balance >= 30;          -- check affected rows = 1

-- Optimistic: version column
UPDATE seats SET status='HELD', version = version + 1
WHERE id = 'A7' AND version = 5;          -- 0 rows → someone else won, retry or fail

-- Job queue: each worker takes different rows, nobody waits
SELECT id FROM jobs WHERE status = 'PENDING'
ORDER BY created_at LIMIT 10
FOR UPDATE SKIP LOCKED;
```

- `FOR UPDATE`: exclusive row lock until commit. `FOR SHARE`: others can read-lock but not update.
- `NOWAIT`: fail at once instead of waiting.
- `SKIP LOCKED`: skip rows other transactions have locked. Perfect for work queues and for "give me any free seat".
- Write skew fix: lock the rows you **read** (`FOR UPDATE` on all on-call doctors), add a constraint, or use Serializable.

### Deadlocks

T1 locks row A then wants B. T2 locks B then wants A. Both wait forever. The DB detects the cycle (Postgres checks after `deadlock_timeout`, default 1 s) and aborts one with an error.

Prevent: lock rows in a fixed order (e.g. sort account ids before a transfer), keep transactions short, never call external APIs inside a transaction, and retry the aborted one.

## Numbers to remember

- B-tree depth: 3–4 levels for 100M–1B rows (fan-out of hundreds per page). An indexed point lookup touches ~3–4 pages, mostly in memory.
- Postgres/MySQL page size: 8 KB (Postgres), 16 KB (InnoDB).
- A well-tuned single Postgres/MySQL primary: thousands to low tens of thousands of simple writes/s. Reads scale further with replicas.
- `deadlock_timeout` in Postgres: 1 s by default.
- Connection limit: Postgres processes are heavy; use a pooler (PgBouncer) above a few hundred connections.

## Trade-offs and when not to use it

| Option | Use when | Weakness |
|---|---|---|
| Atomic conditional `UPDATE … WHERE balance >= x` | One-row checks | Logic must fit in one statement |
| `SELECT … FOR UPDATE` (pessimistic) | High contention, money movement | Waiting, deadlock risk, lower throughput |
| Optimistic (version column) | Low contention, user edits | Many retries under contention |
| `SKIP LOCKED` | Work queues, "any free item" | Not fair ordering under load |
| Serializable | Complex invariants across rows | Aborts under contention; must retry |
| Unique constraint | "Only one booking per seat per show" | — use it; it is the simplest guard |

## In real systems

- **Payments ledgers (Razorpay, Stripe-style)**: Postgres/MySQL with double-entry rows, unique idempotency keys and short transactions.
- **Ticket booking**: a unique constraint on `(show_id, seat_id)` plus a hold with expiry; `SKIP LOCKED` to grab free seats.
- **Job queues on Postgres** (e.g. Graphile Worker, Que, `pg-boss` in Node): built on `FOR UPDATE SKIP LOCKED`.
- **Uber, Shopify, GitHub**: run large MySQL fleets; schema changes through online tools (gh-ost, pt-online-schema-change).

## What to say in the interview

"The booking table has a unique constraint on show and seat, so the DB itself stops a double booking. To hold a seat I run one conditional update: set status to HELD where the seat is AVAILABLE, and check that one row changed. For the wallet debit I use a single transaction with `SELECT … FOR UPDATE` on the wallet row, or an atomic `balance >= amount` update, at Read Committed. I lock accounts in id order to avoid deadlocks, and retry on serialization or deadlock errors. Queries are backed by composite indexes like `(merchant_id, created_at)`, and I'd check them with `EXPLAIN ANALYZE`."

## Common follow-ups

<details><summary>Why not just use Serializable everywhere?</summary>

Under contention it aborts many transactions, and every caller needs retry logic. Throughput drops. Most systems use Read Committed plus targeted locks or constraints on the few hot invariants.
</details>

<details><summary>Why can too many indexes hurt?</summary>

Every insert and update must change every index: more write I/O, more WAL, slower replication. They also use memory, pushing hot data out of the buffer pool.
</details>

<details><summary>Optimistic or pessimistic locking for seat booking at a big release?</summary>

Contention is very high (everyone wants the same front rows), so optimistic retries pile up. Use a conditional update or `FOR UPDATE SKIP LOCKED` for "any seat", or a short hold in Redis with a TTL before the DB write. Keep the DB unique constraint as the final guard.
</details>

<details><summary>What is an N+1 query problem?</summary>

Loading a list (1 query), then one query per item for related data (N queries). Fix with a join, `WHERE id IN (…)`, or a batching loader (DataLoader in Node).
</details>

## Self-test (answer before opening)

<details><summary>1. Index on (a, b, c). Which of these use it to seek: `a=1`, `b=2`, `a=1 AND c=3`, `a=1 AND b=2 ORDER BY c`?</summary>

`a=1`: yes. `b=2`: no. `a=1 AND c=3`: seeks on `a`, filters `c`. `a=1 AND b=2 ORDER BY c`: yes, fully, with no sort.
</details>

<details><summary>2. Two transfers debit the same account at Postgres Read Committed with "read, then write the computed value". Which anomaly?</summary>

Lost update. Fix with `FOR UPDATE`, an atomic `balance = balance - x` update, or Repeatable Read with retry.
</details>

<details><summary>3. Which anomaly does Postgres Repeatable Read still allow?</summary>

Write skew (and other serialization anomalies). Only Serializable (SSI) prevents it.
</details>

<details><summary>4. 10 workers poll a `jobs` table and often take the same job or wait on each other. Fix?</summary>

`SELECT … FOR UPDATE SKIP LOCKED LIMIT n` inside a transaction, then mark the jobs as running.
</details>

<details><summary>5. Transfer A→B and B→A run at the same time and deadlock. How do you prevent it?</summary>

Always lock the two accounts in the same order (lower id first).
</details>

## Go deeper

- Concepts: [11 NoSQL types](./11-nosql-types.md), [12 replication](./12-replication.md), [20 distributed transactions](./20-distributed-transactions.md), [35 payments domain](./35-payments-domain.md)
- Problems: [09 ticket booking](../problems/09-ticket-booking/README.md), [08 payment system](../problems/08-payment-system/README.md), [28 digital wallet](../problems/28-digital-wallet/README.md)
- DDIA, chapter 3 (B-trees vs LSM-trees) and chapter 7 (Transactions: "Weak Isolation Levels", "Serializability")
- Postgres docs: "Transaction Isolation" and "Explicit Locking"
- Older notes in this repo: `archive/notes/hld-parts/part1.md`, "ACID Properties (Deep Dive)" and "Database Indexing (Complete Guide)"; `archive/notes/hld-parts/part6a.md`, "1.1 Understanding EXPLAIN & Query Plans" and "1.2 Indexing Strategies"
