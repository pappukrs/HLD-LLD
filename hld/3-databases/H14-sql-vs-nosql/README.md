# H14 · SQL vs NoSQL and choosing a database

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/3-databases/H14-sql-vs-nosql/demo.ts`) · **Hands-on:** [hands-on/](hands-on/README.md) (Postgres vs MongoDB in Docker)
> **Builds on:** [H11 Indexes](../H11-indexing/README.md) · [H12 Transactions and isolation](../H12-transactions-isolation/README.md) · [H13 Data modelling](../H13-data-modeling/README.md) · **Used in:** chat system, news feed, URL shortener, key-value store, payment system, metrics monitoring, search autocomplete (the "which database?" step of every HLD round)

## The idea in one line

Pick the database from your **access patterns** and **consistency needs**, not from fashion: Postgres is the default, and you leave it only for a specific pattern (huge key lookups, huge append writes, graph walks, full-text search) that SQL serves badly.

## Why it matters (the problem it solves)

"SQL or NoSQL?" is a trap question. A junior answers "NoSQL, because it scales". That names a winner without knowing the system. The interviewer wants to see you **reason from requirements**.

A single relational primary is fine until one of these is true:

- Writes go beyond what one machine can take (hundreds of thousands of writes/s: chat messages, IoT telemetry, click events).
- The data is so large you must shard, and then cross-shard joins are slow anyway.
- The data shape is nested or different per record (product attributes vary by category).
- The main query is a graph walk ("friends of friends who like X") or a full-text search.

NoSQL databases give up some features (joins, multi-row transactions, a fixed schema) to scale **one access pattern** very well. You need to know which feature you are giving up, and whether this system can live without it.

## How it works

### 1. What relational gives you (and what you lose by leaving)

| Feature | What it buys you | Who needs it most |
|---|---|---|
| **ACID transactions** | Debit and credit both happen or neither does | Payments, wallets, inventory, bookings |
| **Joins** | Store each fact once, assemble at read time | Any domain where entities reference each other |
| **Schema + constraints** | The DB rejects bad data: `NOT NULL`, `UNIQUE`, `FOREIGN KEY`, `CHECK` | Anything where wrong data is expensive |
| **Ad-hoc queries** | Answer questions you did not plan for | Admin panels, analytics, support tools |
| **Maturity** | Query planner, tooling, every engineer knows SQL | Every team |

Default line: **"Start with Postgres unless there is a specific reason to leave."** Postgres with good indexes and read replicas handles far more than people think (tens of thousands of simple queries/s on one box).

### 2. "NoSQL" is not one thing

| Family | Data model | Good at | Examples |
|---|---|---|---|
| **Key-value** | `key → blob` | Get/put by exact key, sub-ms latency, huge scale | Redis, DynamoDB, etcd (small config) |
| **Document** | `key → JSON document`, with secondary indexes | Self-contained nested records read together | MongoDB, Couchbase, Firestore |
| **Wide-column** | Partition key → sorted rows of columns | Massive writes, time-ordered data per key | Cassandra, ScyllaDB, HBase, Bigtable |
| **Graph** | Nodes and edges with properties | Multi-hop relationship queries | Neo4j, Amazon Neptune |
| **Search** | Inverted index | Full-text, fuzzy match, facets, ranking | Elasticsearch, OpenSearch |
| **Time series** | Timestamped points per series | Metrics, IoT, range + downsample | InfluxDB, Prometheus, TimescaleDB |
| **NewSQL** | Relational, sharded, consensus-replicated | SQL + transactions at global scale | Spanner, CockroachDB, YugabyteDB |

So "let's use NoSQL" is an incomplete sentence. The next question is always "**which** one, for **which** query?"

### 3. Why NoSQL scales out more easily: joins vs sharding

This is the mechanism interviewers probe. Say it like this:

```
 SQL, sharded by user_id                 Document store, sharded by user_id
 ------------------------                -----------------------------------
 shard 1: users(1..1M)                   shard 1: { _id: u42,
 shard 2: orders(... any user ...)                   name: "Asha",
                                                     orders: [ {o1}, {o2} ] }
 SELECT * FROM users u
 JOIN orders o ON o.user_id = u.id       db.users.findOne({ _id: "u42" })
 WHERE u.id = 42
   -> needs rows from 2 machines            -> 1 machine, 1 read
   -> network hop, scatter-gather           -> add machines, no cross-shard work
```

- **Joins are the enemy of sharding.** Once rows of two tables live on different machines, a join needs a network hop and often a scatter-gather.
- **Denormalising** (embedding the orders inside the user document, or writing one table per query) makes each read hit one partition. Then you can add machines almost linearly.
- **The price:** duplicated data that you must keep in sync, and (often) weaker consistency. Classic NoSQL is **BASE** (Basically Available, Soft state, Eventually consistent) instead of **ACID**.

Note: you can also shard SQL well if every query includes the shard key (Vitess at YouTube/Slack, Citus). The point is not "SQL cannot scale". The point is "joins across shards are what hurts".

### 4. Design by query, not by entity (Cassandra / DynamoDB)

In SQL you normalise and join at read time. In wide-column and key-value stores you **write one table per query**, denormalised, and pay at write time.

```
Query: "last 50 messages in a chat, newest first"

CREATE TABLE messages_by_chat (
  chat_id    text,
  bucket     int,        -- e.g. yyyymm, keeps a partition bounded
  message_id timeuuid,   -- time-ordered id
  sender_id  text,
  body       text,
  PRIMARY KEY ((chat_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
```

- **Partition key** `(chat_id, bucket)` decides which node holds the data. One chat-month lives together.
- **Clustering key** `message_id DESC` sorts rows inside the partition. "Latest 50" is one sequential read.
- Keep partitions bounded (rule of thumb: under ~100 MB). That is why the bucket is in the key.
- A new query ("messages by sender") means a **new table**, written at the same time. Cassandra secondary indexes on high-cardinality columns hit many nodes and are a poor fit.

DynamoDB is the same idea: partition key + sort key, plus global secondary indexes (asynchronous, eventually consistent). "Single-table design" packs many entity types into one table using key prefixes like `USER#42` / `ORDER#2026-10-19#o9`.

### 5. Storage engines: B-tree vs LSM-tree

The engine under the database explains a lot of its write/read behaviour.

| | B-tree (Postgres, MySQL InnoDB, MongoDB WiredTiger) | LSM-tree (Cassandra, ScyllaDB, RocksDB, HBase) |
|---|---|---|
| Write path | Find the page, update it in place (random I/O) + WAL | Append to commit log + in-memory memtable; flush sorted files (SSTables) in bulk (sequential I/O) |
| Read path | One tree walk, 3-4 page reads | Check memtable + several SSTables; Bloom filters skip files that cannot have the key |
| Background work | Page splits, vacuum (Postgres) | Compaction merges SSTables |
| Best for | Read-heavy and mixed workloads | Write-heavy workloads |

```
LSM write:  client -> commit log (append) -> memtable (RAM, sorted)
                                               | full (~64 MB)
                                               v
                                    SSTable L0 (immutable, sorted on disk)
                                               | compaction
                                               v
                                    SSTable L1, L2 ... (bigger, merged)
```

### 6. The decision framework (say these axes out loud)

1. **Access patterns** (the main one). Always fetch by a known key? KV or document. Varied ad-hoc queries with joins? Relational.
2. **Relationships.** Many-to-many with lots of joins: SQL. Self-contained aggregates: document. A real network you traverse many hops: graph.
3. **Consistency.** Money, inventory, seat booking need ACID: SQL (or NewSQL). "Like count off by a few for a second" is fine with BASE.
4. **Scale and write volume.** Beyond one well-tuned cluster's writes: wide-column. Otherwise Postgres goes further than you think.
5. **Schema stability.** Fields change weekly or differ per record: document (or Postgres `JSONB`). A stable domain: a relational schema is a safety net.
6. **Operations and team.** Who runs it at 3 am? A managed service (RDS, DynamoDB, Atlas) often beats the "best" engine.

Quick map:

| Need | Pick | Why |
|---|---|---|
| Orders, payments, ledger | Postgres / MySQL | Transactions, unique constraints, joins |
| Sessions, cache, rate-limit counters | Redis | Sub-ms get/set by key; fine to lose on restart (or use AOF) |
| Shopping cart, user profile at huge scale | DynamoDB | Get/put by key, single-digit ms at any scale |
| Chat messages, events, IoT telemetry | Cassandra / ScyllaDB | Huge append writes, read by key + time range |
| Product catalog with per-category attributes | MongoDB or Postgres `JSONB` | Flexible nested documents |
| Full-text product search | Elasticsearch (fed by CDC) | Inverted index; never the source of truth |
| "People you may know", fraud rings | Neo4j / Neptune | Multi-hop traversal |
| Metrics dashboards | Prometheus / TimescaleDB | Append, range scan, downsample |
| Global SQL with strong consistency | Spanner / CockroachDB | Consensus per range; higher write latency |

### 7. Polyglot persistence: the real answer

Most real systems use several stores, each for one access pattern:

```
             +------------------+    CDC / events    +----------------+
 writes ---> |  Postgres (truth)| -----------------> | Elasticsearch  |  search
             +------------------+                    +----------------+
                 |        ^
     cache-aside |        | miss                     +----------------+
                 v        |                          | S3             |  images, files
             +------------------+                    +----------------+
 reads ----> |  Redis (cache)   |
             +------------------+                    +----------------+
                                         events ---> | Cassandra      |  activity log
                                                     +----------------+
```

The line between SQL and NoSQL also blurs: Postgres `JSONB` + GIN indexes gives document flexibility inside a transactional DB; DynamoDB and MongoDB added multi-item transactions; NewSQL gives SQL with horizontal scale.

## In TypeScript

The same "user with orders" read, two ways. Full runnable version (with a sharded cluster and a write-cost comparison) is in [demo.ts](demo.ts).

```ts
// Relational: normalised, join at read time. Each order row stores user_id once.
function readUserSql(userId: string) {
  const user = usersShard(userId).get(userId);              // hop 1
  const orders = allShards().flatMap((s) =>                  // scatter-gather if orders
    s.orders.filter((o) => o.userId === userId));            // are not sharded by user_id
  return { ...user, orders };
}

// Document: denormalised, one self-contained record per user.
function readUserDoc(userId: string) {
  return usersShard(userId).get(userId);                     // 1 hop, orders embedded
}

// The cost moves to writes: renaming a product touches every document that embeds it.
function renameProductDoc(productId: string, name: string) {
  for (const doc of allDocs())                               // fan-out update, no FK to help
    for (const o of doc.orders) if (o.productId === productId) o.productName = name;
}
```

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Postgres / MySQL | Default: transactions, joins, ad-hoc queries | Write scaling needs sharding work (Vitess, Citus, app-level) |
| DynamoDB | Known access patterns, any scale, serverless | New query = new index or table; hot partitions; cost at high volume; 400 KB item limit |
| Cassandra / Scylla | Write-heavy, multi-DC, always-on | No joins, weak secondary indexes, read-before-write is expensive, eventual by default |
| MongoDB | Flexible documents, fast iteration | Cross-document invariants need transactions; schema drift if undisciplined |
| Redis | Hot data, counters, sessions | Bounded by RAM; durability is optional, not default |
| Elasticsearch | Search, log analytics | Not a primary store; near real-time (1 s refresh); heavy to run |
| Graph DB | Multi-hop traversal is the core query | Hard to shard; niche skills |
| Spanner / CockroachDB | Global SQL with strong consistency | Higher write latency (consensus round trips), cost |

When NOT to pick NoSQL: you do not know the queries yet (early product), you need multi-entity invariants (money), or your scale fits one Postgres primary with replicas. "We don't have the scale to justify NoSQL's complexity" is itself a strong answer.

## Common mistakes

- **Naming a winner before asking questions.** Ask about access patterns, consistency and scale first.
- **"NoSQL because it scales"** for a payments ledger. You end up rebuilding transactions, idempotency and constraints in app code.
- **"Schemaless means no design."** The schema moves from the DB into your app code. You still design hard, around queries instead of normalisation.
- **Faking joins in the app** on top of a document store because the domain turned relational. That is the sign to move back to SQL.
- **Using Elasticsearch or Redis as the source of truth.** Keep truth in a durable primary; rebuild the index or cache from it.
- **Unbounded partitions** in Cassandra/DynamoDB (`PRIMARY KEY (chat_id)` for a chat that lives forever). Add a time bucket.
- **Hot keys.** A celebrity or a big merchant on one partition. Fix with key suffixes (`merchant#0..9`), caching, or smaller buckets.
- **Treating CAP labels as fixed.** "MongoDB is AP, Postgres is CP" is a simplification: MongoDB with `w: majority` behaves CP-like; single-node Postgres is not a distributed system at all. Talk about the configuration, not the brand.

## Say this in the interview

> "I pick the store by access pattern, not by hype. My default is Postgres: ACID, joins, constraints, and JSONB for the flexible bits, and it scales further than people assume with indexes and read replicas. I leave relational only for a specific reason: huge key-value traffic goes to DynamoDB or Redis, write volume beyond one cluster goes to Cassandra, a real graph goes to Neo4j, and search goes to Elasticsearch fed by CDC."

> "NoSQL scales out because denormalised, self-contained records avoid cross-shard joins. The price is duplicated data and usually eventual consistency. So for this design, orders and payments stay in Postgres; chat messages go to Cassandra partitioned by `(chat_id, month)` and clustered by message id descending, so 'latest 50' is one partition read; images go to S3."

> "I've lived the reverse migration: we started on MongoDB for schema flexibility, then the domain turned relational and we were faking joins in app code, so we moved to MySQL. NoSQL flexibility is a loan you repay once the access patterns settle."

## Your experience hook

- **MongoDB to MySQL migration (Matriot IoT platform):** started on Mongo while fields changed weekly; as entities began to reference each other you were doing app-side joins with no FK integrity, so you moved to MySQL and added proper indexes. Use it for "tell me about a database decision you reversed".
- **10k+ IoT devices:** high-frequency telemetry was batched through a Redis queue into fewer, bigger DB writes. At 10x you would move telemetry to a time-series or wide-column store and keep device metadata in SQL: a clean polyglot answer.
- **Redis cache-aside at Chesa (~400 ms to ~160 ms):** Redis as a cache in front of the relational source of truth, never as the truth itself.

## Numbers to remember

| Store | Number |
|---|---|
| Redis | ~0.2-1 ms per op; ~100k+ ops/s per node; bounded by RAM |
| Postgres (one good box) | ~10k-50k simple indexed queries/s; a few TB comfortable |
| DynamoDB | single-digit ms; per partition ~3,000 reads/s and ~1,000 writes/s; item max 400 KB |
| Cassandra | ~10k+ writes/s per node; scales roughly linearly with nodes |
| MongoDB | document max 16 MB |
| Elasticsearch | searchable after refresh interval (default 1 s) |
| Spanner / CockroachDB | write latency includes a consensus round trip (~5-15 ms in-region, more cross-region) |

## Self-test

<details><summary>1. Interviewer asks "SQL or NoSQL?" before describing the system. What do you do?</summary>

Do not name a winner. Ask about access patterns (by key or ad-hoc?), consistency needs (is there money or inventory?), and scale (reads/writes per second, data size). State the default: Postgres unless a specific need pushes you out, because it gives ACID, joins and constraints and scales further than people assume.
</details>

<details><summary>2. Why, mechanically, does NoSQL scale horizontally more easily?</summary>

Joins need rows from several tables; after sharding those rows live on different machines, so joins become network hops and scatter-gather. Denormalised, self-contained records (one document, or one table per query) make each read hit one partition. You pay with duplicated data that must be kept in sync and often eventual consistency.
</details>

<details><summary>3. Pick the store family and the deciding axis: (a) sessions by session-id, fine to lose on restart; (b) bank ledger; (c) 50k IoT readings/s; (d) "people you may know"; (e) catalog with per-category attributes.</summary>

(a) Key-value (Redis): access by exact key, latency. (b) SQL: ACID consistency. (c) Wide-column or time series (Cassandra / TimescaleDB): write volume. (d) Graph DB: multi-hop relationships. (e) Document (MongoDB) or Postgres JSONB: schema flexibility. JSONB lets you keep it relational.
</details>

<details><summary>4. Why are LSM-tree stores fast for writes, and what do they pay for it?</summary>

Writes go to an append-only commit log and an in-memory memtable, then are flushed as sorted immutable files in bulk: sequential I/O, no in-place page updates. They pay on reads (check several files, helped by Bloom filters) and in background compaction.
</details>

<details><summary>5. Design a Cassandra table for "a user's orders, newest first".</summary>

`PRIMARY KEY ((user_id, year), order_time DESC)` or with a time-ordered order id as the clustering key. Partition key groups one user's orders on one node; the year bucket keeps partitions bounded; the clustering order makes "latest N" one sequential read.
</details>

<details><summary>6. Should Elasticsearch be the source of truth for products?</summary>

No. Keep products in the primary DB and index them into Elasticsearch through CDC (Debezium) or events. The index is near real-time and can be rebuilt from the DB at any time.
</details>

<details><summary>7. Postgres JSONB vs MongoDB: when do you pick each?</summary>

JSONB with GIN indexes covers many document needs while keeping transactions, joins and constraints in one DB. Pick MongoDB when you want built-in sharding of documents at large scale, a document-first developer workflow, or very fluid schemas, and you can live without cross-document joins.
</details>

<details><summary>8. What is a hot partition and how do you fix it?</summary>

One partition key gets far more traffic than the rest (a celebrity, a big merchant), so one node melts while others idle. Fix: add a suffix to spread the key (`merchant#0..9` and merge on read), cache hot reads, or use smaller time buckets.
</details>

## Go deeper

- Hands-on: [hands-on/postgres-vs-mongo](hands-on/README.md): run both in Docker and compare the same data in each.
- Next concepts: [H15 Replication](../H15-replication/README.md), [H16 Partitioning and sharding](../H16-partitioning-sharding/README.md), [H18 CAP and PACELC](../H18-cap-pacelc-consistency/README.md), [H19 Quorum and Merkle trees](../H19-quorum-merkle/README.md)
- Related: [H33 Search and typeahead](../../6-building-blocks/H33-search-typeahead/README.md), [H37 Data at scale](../../6-building-blocks/H37-data-at-scale/README.md)
- Case studies: [06 Chat system](../../case-studies/06-chat-system/README.md) (Cassandra messages), [04 Key-value store](../../case-studies/04-key-value-store/README.md) (Dynamo-style), [08 Payment system](../../case-studies/08-payment-system/README.md) (why SQL for money), [07 News feed](../../case-studies/07-news-feed/README.md), [19 Metrics monitoring](../../case-studies/19-metrics-monitoring/README.md) (time series)
- Archive notes: [hld-parts/part1.md](../../../archive/notes/hld-parts/part1.md) ("SQL vs NoSQL: The Complete Decision Tree"), [hld-parts/part3.md](../../../archive/notes/hld-parts/part3.md) ("Data storage patterns")
- Reading: DDIA chapter 2 (data models) and chapter 3 (storage and retrieval: SSTables, LSM-trees, B-trees); the Dynamo paper (2007); the Bigtable paper (2006); Discord's "How Discord stores trillions of messages" (MongoDB to Cassandra to ScyllaDB).
