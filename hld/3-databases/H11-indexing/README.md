# H11 · Indexes: B-tree, hash, composite, covering

> **Time:** ~50 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/3-databases/H11-indexing/demo.ts`)
> **Builds on:** [H02 Back-of-envelope](../../1-basics/H02-back-of-envelope/) (page and disk numbers) · **Used in:** [URL shortener](../../case-studies/01-url-shortener/README.md), [Payment system](../../case-studies/08-payment-system/README.md), [Ticket booking](../../case-studies/09-ticket-booking/README.md), [Digital wallet](../../case-studies/28-digital-wallet/README.md), [Metrics monitoring](../../case-studies/19-metrics-monitoring/README.md)

## The idea in one line

An index is a separate, sorted structure (usually a B+tree) that points back to the rows, so `WHERE email = ?` costs ~4 page reads instead of reading the whole table.

## Why it matters (the problem it solves)

- Without an index, `SELECT * FROM users WHERE email = ?` on 10M rows is a **sequential scan**: read every page, O(n), gigabytes from disk for one row. With a B+tree it is O(log n), about 3–4 pages.
- You can only store a table physically sorted **one way**. But you query by `id`, by `email`, by `(merchant_id, created_at)`. An index is a second sorted copy of just the columns you search on, plus a pointer to the row.
- In every HLD round, the "data model" step ends with "and these are the indexes". The follow-up is always: "Why that column order? What does it cost on writes? Why is the planner ignoring it?" This card answers those.

## How it works

### 1. Pages: why disks like wide trees

Databases read and write in fixed **pages**: 8 KB in Postgres, 16 KB in MySQL InnoDB. Reading 1 byte or a whole page costs the same: one I/O.

A binary search tree holds 1 key per node. For 10M rows, that is log₂(10M) ≈ **23 node reads**, and each could be a separate page.

A B+tree node is **one page holding hundreds of keys** (fan-out ~300–500). It is wide and short:

```
fan-out 500:   depth 1 → 500 keys
               depth 2 → 250,000 keys
               depth 3 → 125,000,000 keys      ← 3 page reads for 125M rows
```

The top 1–2 levels are tiny and stay in RAM (buffer pool). So a point lookup is usually **1–2 real disk reads**.

### 2. B+tree shape

```
                    [  root:   40 | 80  ]                     ← internal: keys + child pointers only
                  /           |          \
        [10 | 25]        [50 | 65]        [90 | 120]          ← internal
        /   |   \        /   |   \        /    |    \
     [1..9][10..24][25..39] [40..] ...   ...  [120..]         ← leaves: key + row pointer
        └──────►──────►──────►──────►──────►────┘             ← leaves are linked in order
```

The "+" in B+tree:

- **All keys and row pointers live in the leaves.** Internal nodes only hold signposts, so they fit more keys and the tree stays shorter.
- **Leaves are linked in sorted order.** A range query (`BETWEEN`, `>`, `ORDER BY`) finds the first leaf, then walks the chain. No going back up the tree.

### 3. A lookup, step by step

```
WHERE email = 'pappu@x.com'
  read 1: root page         → pick the child whose range holds the key
  read 2: internal page     → narrow down
  read 3: leaf page         → find 'pappu@x.com' → row pointer (ctid / PK)
  read 4: table (heap) page → fetch the real row            ← the "heap hop"
```

Insert: walk down to the right leaf and add the key. If the leaf is full, **split** it into two and push one key up to the parent. Splits can go up to the root; that is the only way the tree grows taller, so it always stays balanced.

### 4. Clustered vs secondary (Postgres is not MySQL)

| | MySQL InnoDB | Postgres |
|---|---|---|
| Table storage | **Clustered** on the primary key: rows live inside the PK B+tree leaves, sorted by PK | **Heap**: rows in no particular order |
| Secondary index leaf holds | key + **primary key value** | key + **ctid** (page, slot) |
| Secondary lookup | index → PK → walk the PK tree again | index → ctid → heap page |
| Random UUID v4 PK | Hurts: inserts land on random pages, many splits | Hurts less, but index still bloats |

**Postgres has no clustered index.** Every index, including the primary key, is secondary. (`CLUSTER` reorders once; it does not stay sorted.)

**MVCC wrinkle:** Postgres keeps several versions of a row. An index entry may point to a version your transaction cannot see, so Postgres checks the heap for visibility. It can skip that only when the page is marked all-visible in the **visibility map** (kept up to date by VACUUM).

### 5. Composite indexes and the leftmost-prefix rule

An index on `(merchant_id, status, created_at)` is sorted by merchant, then by status inside each merchant, then by time. Think of a phone book sorted by (last name, first name).

| Query | Uses the index? |
|---|---|
| `merchant_id = ?` | Yes, seek on the first column |
| `merchant_id = ? AND status = ?` | Yes, seek on both |
| `merchant_id = ? AND status = ? ORDER BY created_at DESC LIMIT 20` | Yes, fully: seek, then read 20 entries in order. No sort |
| `status = ?` | No seek: the leading column is missing (like finding every "Pappu" in a phone book) |
| `merchant_id = ? AND created_at > ?` | Seeks on merchant, then **filters** rows by time (status is skipped) |

Rules:

- **The order of conditions in `WHERE` does not matter. The order of columns in the index does.**
- **Equality columns first, then the range or sort column.** A range on a column stops the seek; columns after it can only filter.
- One index on `(a, b)` also serves queries on `a` alone. You do not need a separate index on `a`.

### 6. Covering indexes (index-only scan)

If the index holds **every column the query needs**, the DB never visits the table.

```sql
CREATE INDEX idx_pay_merchant_time
  ON payments (merchant_id, created_at DESC) INCLUDE (amount, status);

SELECT created_at, amount, status
FROM payments
WHERE merchant_id = 42
ORDER BY created_at DESC LIMIT 20;    -- Index Only Scan: no heap hops
```

`INCLUDE` columns are stored in the leaves but not in the sort order, so they make the index cover a query without changing how it seeks. MySQL shows this as `Using index` in `EXPLAIN`.

### 7. Selectivity: why the planner ignores your index

**Selectivity** = what fraction of rows a condition matches. An index on a boolean `is_active` (50% true) is useless: fetching half the table one random page at a time is slower than reading it straight through. The planner chooses a seq scan **on purpose**. Rough rule: an index helps when it returns a small fraction of rows (a few percent or less). For the middle ground, Postgres uses a **Bitmap Heap Scan**: collect matching pointers from the index, sort them by page, then read each page once.

For "few rows match a flag" use a **partial index**: `CREATE INDEX ON orders (created_at) WHERE status = 'PENDING'`.

### 8. When a good index cannot be used

| Query | Why it breaks | Fix |
|---|---|---|
| `WHERE lower(email) = ?` | Index is on `email`, not `lower(email)` | Expression index `ON users (lower(email))` |
| `WHERE email LIKE '%@gmail.com'` | Leading wildcard: no sorted prefix to seek | Store reversed domain, or trigram (GIN `pg_trgm`), or a search engine |
| `WHERE phone = 98765` (phone is text) | Implicit cast on the column | Pass the right type |
| `WHERE created_at::date = '2026-10-19'` | Function on the column | `created_at >= '2026-10-19' AND created_at < '2026-10-20'` |
| `WHERE a = 1 OR b = 2` | One index cannot seek both | Two indexes (bitmap OR), or `UNION` |
| Tiny table / stale stats | Seq scan is cheaper or estimates are wrong | Fine / run `ANALYZE` |

### 9. Reading EXPLAIN ANALYZE

| Plan node | Meaning |
|---|---|
| `Seq Scan` | Whole table. Bad on a big table if you expected an index |
| `Index Scan` | Seek in index, then one heap hop per row |
| `Index Only Scan` | Answered from the index (covering). Check `Heap Fetches: 0` |
| `Bitmap Index Scan` + `Bitmap Heap Scan` | Medium selectivity; pages fetched in order |
| `Sort` above a scan | Index order did not match `ORDER BY` |
| `rows=10 (actual rows=90000)` | Stale statistics: run `ANALYZE` |

MySQL `EXPLAIN`: column `type` (`ALL` = full scan, `ref`/`range`/`const` = index) and `Extra` (`Using filesort`, `Using temporary` = extra work, `Using index` = covering).

### 10. Index types beyond B-tree

| Type | Good for | Not for |
|---|---|---|
| **B-tree** (default) | `=`, `<`, `>`, `BETWEEN`, `ORDER BY`, `LIKE 'abc%'` | Leading wildcards, full text |
| **Hash** | `=` only, O(1) | Ranges, sorting, prefix |
| **GIN** (inverted) | Full-text, `jsonb @>`, arrays | Write-heavy tables (slow updates) |
| **GiST / SP-GiST** | Geo (PostGIS), nearest neighbour, ranges | Plain equality |
| **BRIN** | Huge append-only time-series: stores min/max per block range, tiny | Random data order |
| **LSM-tree** (Cassandra, RocksDB) | Write-heavy: memtable + sorted files, compaction | Read-heavy point lookups (may check several files; Bloom filters help) |

### 11. The write tax

Every `INSERT` updates **every** index on the table. `UPDATE` of an indexed column updates that index too (Postgres can do a cheaper "HOT" update only when no indexed column changes). Each index costs:

- more disk writes and more WAL (so replication lag grows),
- RAM in the buffer pool (pushing hot table pages out),
- page splits and bloat over time (needs `REINDEX` or VACUUM).

5 indexes on a hot write table can cut write throughput by tens of percent. Index what you filter, join and sort on. Drop indexes nobody uses (`pg_stat_user_indexes.idx_scan = 0`).

## In TypeScript

A composite index is just a sorted array of tuples. Leftmost-prefix falls out of how comparison works:

```ts
type Key = [merchantId: number, createdAt: number];
const cmp = (a: Key, b: Key) => a[0] - b[0] || a[1] - b[1];

// Seek: binary search for the first entry >= [merchantId, -Infinity]
function lowerBound(idx: { key: Key }[], target: Key): number {
  let lo = 0, hi = idx.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cmp(idx[mid].key, target) < 0) lo = mid + 1; else hi = mid;
  }
  return lo;
}

// merchant 42, newest 20: seek once, then walk the sorted run (no sort needed)
// createdAt-only query: no prefix to seek on → must scan every entry
```

Full version with a seq scan vs B-tree vs composite vs covering comparison, counting "page reads": [demo.ts](demo.ts).

## Trade-offs / when NOT to use it

| Choice | Gain | Cost |
|---|---|---|
| Add an index | Fast reads on that pattern | Slower writes, more disk and RAM |
| Composite `(a, b, c)` | Serves `a`, `a+b`, `a+b+c`, and sort by c | Useless for `b` or `c` alone |
| Covering / `INCLUDE` | No heap hops on hot reads | Bigger index, more write cost |
| Partial index | Small, fast for a hot subset | Only helps queries with the same `WHERE` |
| Hash index | O(1) equality | No ranges, no sorting |

Do **not** index:

- Low-cardinality columns alone (boolean, gender, status with 3 values), unless partial.
- Tiny tables (a few thousand rows fit in a few pages; a scan is fine).
- Write-heavy log or event tables that are rarely read by that column. Ship them to a warehouse instead.
- "Just in case". Every index needs a query that uses it.

## Common mistakes

- Saying "B-tree is a binary tree". It is a **wide** tree, one page per node, hundreds of keys.
- Saying "the Postgres primary key is clustered". It is not; tables are heaps.
- Creating `(a)`, `(a, b)` and `(a, b, c)` separately. `(a, b, c)` already serves the first two.
- Putting the range column first: `(created_at, merchant_id)` for `merchant_id = ? AND created_at > ?`. Equality first.
- Wrapping the indexed column in a function (`lower()`, `::date`, `DATE()`), then wondering why it is slow.
- Indexing a boolean and calling the planner "broken" for ignoring it.
- Forgetting the write tax when the interviewer says "10k writes/s".
- Using random UUID v4 as the InnoDB primary key on a huge table. Use a time-ordered id (UUID v7, Snowflake) so inserts append to the right edge.
- Never checking `EXPLAIN ANALYZE`. Guessing is not tuning.

## Say this in the interview

> "An index is a B+tree side-structure. It is wide and shallow: each node is one 8 KB page with hundreds of keys, so even 100 million rows is three or four levels, and the top levels sit in memory. A point lookup is a few page reads instead of a full scan, and range queries walk the linked leaves."

> "For this query, `WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 20`, I'd create a composite index on `(merchant_id, created_at DESC)`: equality column first, then the sort column, so the database seeks once and reads 20 entries in order with no sort. If it's a hot path I'd `INCLUDE` amount and status so it's an index-only scan."

> "I don't index everything. Each index taxes every insert, adds WAL and replication lag, and uses buffer-pool memory. If a query is slow I start with `EXPLAIN ANALYZE`: a seq scan usually means low selectivity, a function on the column, a leading wildcard, or stale statistics."

## Your experience hook

- In the IoT platform (10k+ devices) I led a **MongoDB to MySQL migration with indexing**. I designed composite indexes like `(device_id, recorded_at)` so "latest readings for a device" became a seek plus a short range scan instead of a scan over millions of telemetry rows.
- High-frequency device writes were batched through a Redis queue into fewer, bigger DB writes. That matters for indexing too: fewer round trips, and index pages are updated in bulk, so the write tax per row drops.
- Payment orchestration: transactions table queried by `(merchant_id, created_at)` for dashboards and by a **unique index on the idempotency key** to reject duplicate requests. A unique index is both a lookup path and a correctness guard.

## Numbers to remember

| Thing | Number |
|---|---|
| Page size | Postgres 8 KB, InnoDB 16 KB |
| B+tree fan-out | ~300–500 keys per internal page |
| Depth for 100M–1B rows | 3–4 levels |
| Point lookup | 3–4 page reads, top levels cached → ~1–2 disk reads (~0.1 ms each on SSD) |
| Seq scan of 10M rows × 200 B | ~2 GB read, seconds |
| Index size | Roughly (key bytes + ~8–16 B pointer) × rows, plus ~30% slack. 10M × 40 B ≈ 500 MB |
| "Useful" selectivity | Returns a few percent of rows or less |

## Self-test

<details><summary>1. A balanced binary tree is also O(log n). Why does every database use a B+tree?</summary>

Disk reads come in pages. A binary tree reads one key per node: ~23 reads for 10M rows. A B+tree fits hundreds of keys per page, so 3 levels hold over 100M keys: ~3 reads. The linked leaves also make range scans cheap.
</details>

<details><summary>2. Index on (a, b, c). Which seek: `a=1`, `b=2`, `a=1 AND c=3`, `a=1 AND b=2 ORDER BY c`?</summary>

`a=1`: yes. `b=2`: no (no leading column). `a=1 AND c=3`: seeks on `a`, filters `c`. `a=1 AND b=2 ORDER BY c`: full seek and no sort.
</details>

<details><summary>3. "What is the Postgres equivalent of InnoDB's clustered primary key?"</summary>

There is none. Postgres stores rows in an unordered heap. Every index, including the PK, is secondary and its leaves hold a ctid (page, slot). A non-PK lookup is two hops: index, then heap. InnoDB secondary indexes store the PK value instead and walk the PK tree.
</details>

<details><summary>4. You indexed `is_premium` (boolean). EXPLAIN still shows Seq Scan. Bug?</summary>

No. Low selectivity: half the rows match, and fetching them one random page at a time is slower than a sequential read. Use a partial index if you query the rare value, or a composite index that starts with a selective column.
</details>

<details><summary>5. Index on `email`. Why are these slow: `lower(email) = ?`, `email LIKE '%@gmail.com'`, `email = 90000`?</summary>

Function on the column (fix: expression index on `lower(email)`); leading wildcard (fix: trigram GIN or store the domain separately); type mismatch causing a cast (fix: pass a string). Diagnose all with `EXPLAIN ANALYZE`.
</details>

<details><summary>6. Write throughput dropped 30% after adding 5 analytics indexes. Why, and what do you do?</summary>

Every insert now updates 5 more B+trees: more random page writes, splits, WAL and replication traffic. Move analytics queries to a read replica or warehouse with its own indexes, and keep the OLTP table lean.
</details>

<details><summary>7. What makes a query an "index-only scan", and why may Postgres still touch the heap?</summary>

The index contains every column the query reads (key columns plus `INCLUDE`). Postgres still checks the heap for row visibility unless the page is all-visible in the visibility map, which VACUUM maintains. Watch `Heap Fetches` in EXPLAIN ANALYZE.
</details>

<details><summary>8. Time-series table, 2 billion rows, only appended, queried by time range. Which index?</summary>

BRIN on the timestamp: it stores min/max per block range, so it is a few MB instead of tens of GB, and works because the data is physically in time order. Usually combined with time-based partitioning.
</details>

## Go deeper

- Visual: [visual.html](visual.html): seq scan vs B+tree seek, range walk, composite and covering indexes, with a "Try it" query picker.
- Next: [H12 Transactions and isolation](../H12-transactions-isolation/) (what happens when two writers touch the same indexed row), [H13 Data modelling](../H13-data-modeling/), [H14 SQL vs NoSQL](../H14-sql-vs-nosql/) (LSM-trees vs B-trees), [H16 Partitioning](../H16-partitioning-sharding/).
- Inverted indexes for text search: [H33 Search and typeahead](../../6-building-blocks/H33-search-typeahead/).
- Long-form notes: [archive/notes/HLD-guide.md](../../../archive/notes/HLD-guide.md).
