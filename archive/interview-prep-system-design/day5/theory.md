# SD Day 5 — Database Indexing Internals (B-trees, Postgres)
*(Jun 10, 2026 · ~1 hr · my thinner area — going from the metal up; this is what separates mid from senior DB answers)*

---

## 1. The problem an index solves

`SELECT * FROM users WHERE email = ?` on 10M rows, no index = **seq scan**: read every
row, O(n), gigabytes off disk for one match. Index = ~**4 page reads**, O(log n). That's
the whole value prop.

Why not "keep the table sorted by email"? (1) you can only physically order a table **one**
way (what about id, created_at, phone?); (2) mid-table insert shifts millions of rows. So:
a **separate sorted side-structure pointing back to the rows** = the index.

## 2. Why B-tree (really B+tree), not a binary tree

Data lives on disk; disk reads come in fixed **pages (~8KB in Postgres)**. Reading 1 byte
or 8KB costs the same — one seek. A binary tree holds 1 key/node → 10M rows = log₂(10M) ≈
**23 seeks**. A B+tree is **wide, not tall**: each node = one page = hundreds of keys.

```
fan-out ~500:  depth 1 → 500   depth 2 → 250k   depth 3 → 125M keys
```
**3 levels = 125M rows, lookup = 3 page reads.** *B-trees are wide & shallow because disk
seeks are the expensive thing.*

**B+tree specifics (the "+"):**
- All data/row-pointers live in **leaf** nodes; internal nodes are pure signposts (keys +
  child pointers) → higher fan-out.
- **Leaves are linked in a sorted chain** → `BETWEEN` / `ORDER BY` / range scans = walk the
  leaf chain. **Range scan = follow linked leaves.**

## 3. A lookup, step by step
```
Root page   → which branch        (read 1)
Branch page → narrow down         (read 2)
Leaf page   → sorted key + row pointer (read 3)
Follow pointer → real row in table (read 4)   ← the "heap hop", matters in §5
```

## 4. Clustered vs secondary — the big Postgres ≠ MySQL fact ⚠️

**Clustered index** = rows physically stored **in the index leaves, in key order**. The index
IS the table. One per table (data can only be ordered one way).
- **MySQL/InnoDB:** primary key **is** a clustered index — rows live sorted by PK.
- **Postgres:** **NO clustered index.** Rows live in an unordered **heap**; *every* index
  (incl. the PK) is **secondary** — its leaves hold value + **`ctid`** (page+slot pointer)
  into the heap.

**Secondary index lookup = two hops:** index → pointer → heap fetch (the read-4 above).

⚠️ **Postgres MVCC wrinkle:** Postgres keeps multiple row versions; an index entry may point
to a version invisible to your txn, so it must **visit the heap to check visibility** —
unless the page is all-visible (visibility map). This is why "index-only scan" isn't always
purely index-only in Postgres.

## 5. The features that win interviews

**Composite index + leftmost-prefix rule.** Index `(last_name, first_name)`:
- ✅ `WHERE last_name=?` · ✅ `last_name=? AND first_name=?` · ❌ `first_name=?` alone
- Phone book sorted by (last, first): finding all "Pappu" regardless of last = full scan.
- **Column order is a design choice:** most-filtered first; **equality before range**.

**Covering index / index-only scan.** If the index holds every column the query needs, skip
the heap hop. `INDEX ON orders(user_id) INCLUDE (status)` + `SELECT status WHERE user_id=?`
→ **index-only scan**. Big win on hot paths.

**Selectivity / cardinality — why an index gets ignored.** Index on `boolean is_active` (2
values) is useless: random-accessing half the table is slower than a seq scan, so the planner
**ignores it on purpose**. High-cardinality (email, user_id) = great targets. *Selectivity =
how well the index narrows results.*

## 6. Indexes are NOT free — the write tax

Every `INSERT/UPDATE/DELETE` must update **every** index (each a B-tree to rebalance) + disk
+ RAM. 8 indexes = 8× write maintenance.

> **Trade-off:** an index buys read speed with write speed + storage. Index what you
> filter/join/sort on; don't index everything.

## 7. When a good index is skipped (debugging gold)

- **Function on column:** `WHERE lower(email)=?` → needs a **functional index** `ON (lower(email))`
- **Leading wildcard:** `LIKE '%kumar'` can't use B-tree; `'kumar%'` can
- **Type mismatch:** text column compared to a number → implicit cast kills it
- **Low selectivity / tiny table:** planner picks seq scan (correct, not a bug)

**Tool: `EXPLAIN ANALYZE`.** Read four plan lines:
- `Seq Scan` — whole table (bad if big + you expected an index)
- `Index Scan` — used index, heap hop per row
- `Index Only Scan` — answered from index alone (covering — best)
- `Bitmap Heap Scan` — gather matches from index, then batch-fetch heap pages (medium selectivity)

## 8. Beyond B-tree (know they exist)

- **Hash** — equality only, no ranges
- **GIN** — inverted index: full-text, `jsonb`, arrays (same idea as Elasticsearch, Day 20)
- **GiST** — geometric / nearest-neighbor (PostGIS)
- **BRIN** — tiny, coarse index for huge append-only/time-series (min/max per block range)

## 9. The interview line

> "An index is a B+tree side-structure — wide & shallow so a lookup is ~4 page reads, not a
> table scan. Postgres tables are heaps with secondary indexes pointing in via ctid — no
> clustered index like InnoDB's PK. Equality column first in composite indexes (leftmost
> prefix), covering indexes for hot reads (index-only scan), and I don't over-index because
> every index taxes writes. Slow query → read `EXPLAIN ANALYZE`; if it's a seq scan, check
> selectivity, a function on the column, or a leading wildcard."

---

### Half-page summary (the version to remember)

> Index = sorted B+tree side-structure turning O(n) table scans into ~O(log n) ≈ 4 page
> reads. B+tree beats binary tree because disk reads are page-sized: wide & shallow nodes
> (hundreds of keys each) → 3 levels hold 100M+ rows in ~3 seeks; leaves are linked for
> range scans. Clustered (InnoDB PK = rows stored in index order) vs secondary (separate
> structure, pointer back to row). **Postgres has no clustered index** — heap + secondary
> indexes pointing via ctid, and MVCC means it often re-checks the heap for visibility.
> Composite indexes obey the leftmost-prefix rule (equality col first); covering indexes
> give index-only scans; low-cardinality columns get ignored by the planner. Indexes tax
> every write, so don't over-index. Killers of index usage: function on the column, leading
> `%` wildcard, type mismatch — diagnose with `EXPLAIN ANALYZE` (Seq vs Index vs Index-Only
> vs Bitmap Heap Scan). B-tree is default; GIN for full-text/jsonb, BRIN for time-series.
