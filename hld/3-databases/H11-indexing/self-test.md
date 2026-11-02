# H11 Indexes: self-test answers (Day 15, Mon 2 Nov 2026)

Written answers to the README self-test, checked against its `<details>` blocks. Q1 and Q2 are also worked out in code in `practice.ts`.

1. **Binary tree is O(log n) too. Why B+tree?** The disk reads whole pages (8 KB in Postgres, 16 KB in InnoDB). A binary tree uses one page read per key compared: ~24 reads for 10M rows. A B+tree puts hundreds of keys in one page, so 3–4 levels cover 100M+ rows, and the top levels stay in memory. The leaves are linked, so a range query is one seek and then a walk along the leaves.
2. **Index (a, b, c):** `a=1` seeks. `b=2` can't seek because the leading column is missing (at best a full index scan). `a=1 AND c=3` seeks on `a`, then filters `c` inside the index. `a=1 AND b=2 ORDER BY c` seeks on `a, b` and reads `c` already in order, so there is no sort.
3. **Postgres equivalent of InnoDB's clustered PK?** There isn't one. A Postgres table is an unordered heap, and every index (PK too) is secondary, pointing to a ctid (page, slot). InnoDB stores the rows inside the PK B+tree, and its secondary indexes store the PK value, so a secondary lookup walks two trees.
4. **Boolean index, still Seq Scan. Bug?** No. Half the rows match, and jumping to random heap pages for each one costs more than one sequential read. If you only query the rare value, use a partial index (`WHERE is_premium`). Otherwise use a composite that starts with a selective column.
5. **Why are these slow on an `email` index?** `lower(email) = ?`: a function on the column, so the index can't be used (fix: expression index on `lower(email)`). `LIKE '%@gmail.com'`: a leading wildcard has no prefix to seek (fix: trigram GIN, or store the domain in its own column). `email = 90000`: the type mismatch forces a cast on every row (fix: pass a string). Check each with `EXPLAIN ANALYZE`.
6. **Writes dropped 30% after 5 analytics indexes?** Each insert now updates 5 more B+trees: more random page writes, page splits, WAL and replication lag. Move analytics to a read replica or warehouse with its own indexes, and keep the OLTP table lean.
7. **Index-only scan, and why Postgres may still read the heap?** Every column the query reads must be in the index (keys plus `INCLUDE`). Postgres still checks the heap for row visibility unless the visibility map marks the page all-visible, which VACUUM keeps up to date. Look at `Heap Fetches` in EXPLAIN ANALYZE.
8. **2B rows, append-only, queried by time range?** BRIN on the timestamp. It stores min/max per block range, so it is a few MB instead of tens of GB, and it works because rows are physically in time order. Add time-based partitioning on top so old partitions can be dropped.

## Easy-to-miss points

- A range column stops the seek. Every key after it can only filter, never seek. That is why the rule is "equality first, then range or sort".
- `ORDER BY c` is free only if every key before `c` is fixed by equality. `a = 1 ORDER BY c` on `(a, b, c)` still needs a sort.
- Random UUID v4 as an InnoDB PK scatters inserts across the tree. Use a time-ordered id (UUID v7, Snowflake).

## Interview line to practise out loud

"For `WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 20`, I'd index `(merchant_id, created_at DESC)`: equality first, then the sort column, so it's one seek and 20 entries read in order. If it's hot I'd `INCLUDE` amount and status for an index-only scan. I don't index everything, because each index taxes every write."
