# 11 · NoSQL Types and How to Choose a Database

> **Read time:** 35 min · **Visual:** [v06 sharding strategies](../../visuals/v06-sharding.html) · **Code it:** [hld/code/08-quorum-kv](../code/08-quorum-kv/README.md) (a Dynamo-style KV store)
> **Shows up in:** every HLD round at the "which database?" step: chat (Cassandra), feed (wide-column + Redis), URL shortener (KV), search (Elasticsearch), social graph, metrics (time series)

## The idea in one line

Pick the database from your access patterns and consistency needs, not from fashion. SQL is the default; choose a NoSQL type when a specific pattern (huge write volume, simple key lookups, flexible documents, graph walks) makes SQL hard.

## The problem it solves

A single relational primary is great until:

- Writes exceed what one machine can take (hundreds of thousands of writes/s for chat messages or events).
- The data is so large you must shard, and you lose joins anyway.
- The data shape is flexible or nested (product attributes differ per category).
- The query is a graph walk ("friends of friends who like X") or full-text search.

NoSQL databases give up some features (joins, multi-row transactions, a fixed schema) to scale one access pattern very well.

## How it works

### The main families

| Type | Data model | Good at | Examples |
|---|---|---|---|
| **Key-value** | `key → blob` | Get/put by key, very low latency, huge scale | Redis, DynamoDB, Riak, etcd (small config) |
| **Document** | `key → JSON document` with secondary indexes | Flexible schema, nested data read together | MongoDB, Couchbase, Firestore |
| **Wide-column** | Partition key → sorted rows of columns | Massive writes, time-ordered data per key | Cassandra, ScyllaDB, HBase, Bigtable |
| **Graph** | Nodes and edges with properties | Multi-hop relationship queries | Neo4j, Amazon Neptune, JanusGraph |
| **Search** | Inverted index | Full-text search, filters, facets, ranking | Elasticsearch, OpenSearch, Solr |
| **Time series** | Timestamped points per series | Metrics, IoT, append + range + downsample | InfluxDB, Prometheus, TimescaleDB |
| **NewSQL / distributed SQL** | Relational, sharded, consensus-replicated | SQL + transactions at scale | Spanner, CockroachDB, YugabyteDB, TiDB |

### Storage engine: B-tree vs LSM-tree

| | B-tree (Postgres, MySQL, MongoDB WiredTiger default) | LSM-tree (Cassandra, RocksDB, ScyllaDB, HBase) |
|---|---|---|
| Write | Update a page in place (random I/O) | Append to memtable + log; flush sorted files (sequential I/O) |
| Read | One tree walk | Check memtable + several files; Bloom filters skip files |
| Background work | Page splits, vacuum | Compaction merges files |
| Best for | Read-heavy, mixed | Write-heavy |

### Design by query, not by entity (Cassandra / DynamoDB)

In SQL you normalise and join at read time. In wide-column and KV stores you **write one table per query**, denormalised.

```
Query: "last 50 messages in a chat, newest first"

Cassandra table messages_by_chat
  PRIMARY KEY ((chat_id), message_id)   -- partition key: chat_id
  WITH CLUSTERING ORDER BY (message_id DESC)
  (message_id is a time-based id, e.g. TIMEUUID or Snowflake)
```

- **Partition key** decides the node. All rows for one chat live together.
- **Clustering key** sorts rows inside the partition. "Latest 50" is one sequential read.
- Keep partitions bounded (e.g. under ~100 MB). A chat that never ends needs a bucket in the key: `((chat_id, month), message_id)`.

DynamoDB is the same idea: partition key + sort key, plus global secondary indexes (async, eventually consistent).

### A short decision guide

1. Do you need multi-row transactions, joins or strong invariants (money, inventory)? → **SQL** (Postgres/MySQL), shard later if needed.
2. Is it simple get/put by id at huge scale? → **KV** (DynamoDB, Redis if it fits in memory).
3. Huge append-heavy writes, read by key + time range? → **Wide-column** (Cassandra/Scylla).
4. Flexible nested objects read as a whole? → **Document** (MongoDB), or Postgres `JSONB`.
5. Full-text or fuzzy search? → **Search engine**, fed from the main DB through CDC or events. Never the source of truth.
6. Deep relationship queries? → **Graph DB**. For one-hop "followers", SQL or wide-column is enough.
7. Need SQL and global scale with strong consistency? → **Spanner / CockroachDB**, and accept higher write latency.

Most real systems are **polyglot**: Postgres for orders, Redis for cache, Elasticsearch for search, S3 for blobs, Cassandra for events.

## Numbers to remember

- Redis: ~0.2–1 ms; bounded by RAM.
- DynamoDB: single-digit ms at any scale; a partition supports about 3,000 reads and 1,000 writes per second (per-partition limits), so spread keys.
- Cassandra: a node handles thousands to tens of thousands of writes/s; clusters scale linearly by adding nodes.
- Elasticsearch: near real-time; documents are searchable after the refresh interval (default 1 s).
- MongoDB document size limit: 16 MB.

## Trade-offs and when not to use it

| Option | Use when | Weakness |
|---|---|---|
| Postgres/MySQL | Default; transactions, joins, ad-hoc queries | Write scaling needs sharding work |
| DynamoDB | Known access patterns, serverless, any scale | New query = new index or table; hot partitions; cost at high volume |
| Cassandra | Write-heavy, multi-DC, always-on | No joins, limited secondary indexes, read-before-write is expensive, tunable but eventual by default |
| MongoDB | Flexible documents, quick iteration | Cross-document invariants need transactions; schema chaos if undisciplined |
| Elasticsearch | Search, log analytics | Not a primary store; eventual; heavy to operate |
| Graph DB | Multi-hop traversal is the core query | Hard to shard; niche skills |
| Spanner/Cockroach | Global SQL with strong consistency | Higher write latency (consensus), cost |

**Common mistake:** choosing NoSQL "because it scales" for a payments ledger. You then rebuild transactions in application code. Start with SQL for money.

## In real systems

- **Discord**: moved messages from MongoDB to Cassandra, and later to ScyllaDB, partitioned by channel and time bucket.
- **Uber**: Schemaless (built on MySQL) and Cassandra for trips; Docstore later.
- **Netflix**: Cassandra for viewing history; Elasticsearch for search.
- **Amazon**: DynamoDB for carts and many core services (the Dynamo paper is about the cart).
- **Fintechs (Razorpay, PhonePe)**: MySQL/Postgres for payments; Redis, Kafka, Elasticsearch and Cassandra/HBase-like stores around it.

## What to say in the interview

"Payments and orders go in Postgres, because I need transactions and unique constraints. Chat messages go in Cassandra, partitioned by `(chat_id, bucket)` and clustered by message id descending, so 'latest 50 messages' is one partition read and writes scale by adding nodes. Search uses Elasticsearch fed by CDC from Postgres; it is never the source of truth. Images go to S3. I chose each store from the query it must serve."

## Common follow-ups

<details><summary>Why not MongoDB for everything?</summary>

It is fine for document-shaped data. But invariants across documents need multi-document transactions, which are slower and add limits, and analytics and joins are weaker. Pick per access pattern.
</details>

<details><summary>How do you add a new query to a Cassandra design?</summary>

Usually by a new denormalised table written at the same time (from the app or from a stream). Secondary indexes in Cassandra are a poor fit for high-cardinality columns and hit many nodes.
</details>

<details><summary>Postgres JSONB vs MongoDB?</summary>

JSONB with GIN indexes covers many document needs while keeping transactions and joins. Choose MongoDB when you want its sharding, its document-first tooling, or very flexible schemas at scale.
</details>

<details><summary>What is a hot partition and how do you fix it?</summary>

One partition key gets much more traffic than others (a celebrity, a big merchant). Add a suffix to spread it (`merchant#0..9`), cache reads, or split time buckets smaller.
</details>

## Self-test (answer before opening)

<details><summary>1. Why are LSM-tree stores fast for writes?</summary>

Writes go to an in-memory table and a sequential log; sorted files are written in bulk. No random in-place page updates.
</details>

<details><summary>2. A Cassandra table for "user's orders, newest first". Partition and clustering keys?</summary>

Partition key `user_id` (maybe plus a year bucket); clustering key `order_time DESC` or a time-based order id.
</details>

<details><summary>3. Should Elasticsearch be the source of truth for products?</summary>

No. Keep products in the primary DB and index them into Elasticsearch through CDC or events. Rebuild the index from the DB when needed.
</details>

## Go deeper

- Concepts: [10 SQL deep dive](./10-sql-deep-dive.md), [13 partitioning and sharding](./13-partitioning-sharding.md), [16 quorum and leaderless](./16-quorum-leaderless.md), [27 search indexing](./27-search-indexing.md), [34 data modelling at scale](./34-data-modeling-at-scale.md)
- Problems: [06 chat system](../problems/06-chat-system/README.md), [04 key-value store](../problems/04-key-value-store/README.md)
- DDIA, chapter 2 (Data Models) and chapter 3 (Storage and Retrieval: "SSTables and LSM-Trees", "B-Trees")
- Dynamo paper (2007); Bigtable paper (2006)
- Older notes in this repo: `archive/notes/hld-parts/part1.md`, "SQL vs NoSQL: The Complete Decision Tree"; `archive/notes/hld-parts/part3.md`, "MODULE 3.5: DATA STORAGE PATTERNS"
