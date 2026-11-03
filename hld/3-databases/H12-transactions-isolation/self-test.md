# H12 Transactions and isolation: self-test answers (Day 16, Tue 3 Nov 2026)

Written answers to the README self-test, checked against its `<details>` blocks. Q3, Q4 and Q6 are also worked out in code in `practice.ts`.

1. **Two debits, "read then write the computed value", at Read Committed?** Lost update: both read 100, both write 70, one debit disappears. Fix: an atomic `SET balance = balance - x WHERE id = ? AND balance >= x` and check `rowCount = 1`. Other fixes: `SELECT ... FOR UPDATE`, a version column, or Repeatable Read with retry.
2. **What does Postgres Repeatable Read still allow?** Write skew. Each transaction updates a different row, so there is no write-write conflict to catch. Only SERIALIZABLE (SSI) sees the read-write cycle and aborts one.
3. **What must the app do at SERIALIZABLE?** Catch SQLSTATE `40001` (and `40P01` for deadlocks) and retry the whole transaction with backoff and jitter. Don't retry real errors like `23505`. `withTx()` in `practice.ts` checks all three cases.
4. **10 workers grab the same job or wait on each other?** `SELECT ... FOR UPDATE SKIP LOCKED LIMIT n`, mark the rows RUNNING, commit. In `practice.ts`, with plain `FOR UPDATE` two of three workers block on job 1. With `SKIP LOCKED` all three get 3 different jobs at once.
5. **A→B and B→A deadlock?** Lock both rows in a fixed order, lowest id first (`WHERE id IN (a, b) ORDER BY id FOR UPDATE`). Retry on `40P01` anyway.
6. **Does `FOR UPDATE` stop two overlapping hotel bookings?** No. The clashing row doesn't exist yet, so there is nothing to lock (a phantom). `practice.ts` shows 0 rows locked and room 101 double-booked. Fix: an exclusion constraint on `(room, daterange)` (rejects with `23P01`), a lock on the parent room row, or SERIALIZABLE.
7. **Why not SERIALIZABLE everywhere?** Under contention it aborts a lot, every caller needs retry code, and throughput drops. Use Read Committed plus atomic updates, constraints and targeted locks for the few rules that matter.
8. **Optimistic or pessimistic for a hot ticket sale?** Contention is very high, so optimistic retries pile up. Use a conditional update, or `FOR UPDATE SKIP LOCKED` for "any seat", or a short Redis hold with a TTL in front of the DB. Keep the unique constraint as the final guard.

## Easy-to-miss points

- `FOR UPDATE` only locks rows that exist. Any rule about "no other row like this" (no overlap, max N per user) needs a constraint, a parent-row lock, or SERIALIZABLE.
- A single hot row under `FOR UPDATE` is serial: the rate is about 1 / (statement time + commit fsync). That is ~1.2k/s on a local SSD and ~400/s on a slower cloud disk (`practice.ts` part 4). Past that, shard the counter or batch through a queue.
- The retry wrapper must wrap the **whole** transaction, including the reads, because the reads came from a snapshot that is now stale.

## Interview line to practise out loud

"For the job queue I use `FOR UPDATE SKIP LOCKED`, so workers never wait on each other. For hotel rooms, `FOR UPDATE` can't help because the clashing booking doesn't exist yet, so I put an exclusion constraint on room and date range and let the database reject the second one. Anything at SERIALIZABLE goes through a retry wrapper that retries 40001 and 40P01 and nothing else."
