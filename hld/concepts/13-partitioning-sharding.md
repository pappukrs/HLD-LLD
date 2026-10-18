# 13 · Partitioning and Sharding

> **Read time:** 35 min · **Visual:** [v06 sharding strategies](../../visuals/v06-sharding.html) · **Code it:** [hld/code/01-consistent-hashing](../code/01-consistent-hashing/README.md)
> **Shows up in:** URL shortener, chat, news feed, payment system, key-value store, metrics, any "billions of rows" question

## The idea in one line

Split one big dataset into smaller pieces (shards), each on its own machine, so that writes, storage and reads all scale out. The partition key decides everything.

## The problem it solves

One database machine has limits:

- **Writes.** Read replicas scale reads, but every write still goes to one leader.
- **Storage.** A single Postgres node gets painful in the low tens of TB (backups, vacuum, index rebuilds, restore time).
- **Working set.** When hot data no longer fits in RAM, every query starts hitting disk.

Sharding gives each machine only `1/N` of the rows and `1/N` of the writes.

**Words.** *Partitioning* usually means splitting a table (it can be inside one machine, like Postgres declarative partitioning). *Sharding* means the partitions live on different machines. In interviews people use them as the same thing; say which one you mean.

## How it works

1. Pick a **partition key** (shard key), e.g. `user_id`, `merchant_id`, `chat_id`.
2. Map the key to a shard with a **strategy**.
3. A **router** (client library, proxy like Vitess / ProxySQL, or the DB itself) sends each query to the right shard.
4. Queries that include the key hit one shard. Queries without it **scatter-gather** across all shards.

### Strategies

| Strategy | Mapping | Good at | Bad at |
|---|---|---|---|
| **Range** | `A–F → s1`, or `ts in Jan → s1` | Range scans, ordered reads | Hot spots on sequential keys (time, auto-increment) |
| **Hash** | `hash(key) % N` or a ring | Even spread | Range queries; resharding with plain `% N` |
| **Consistent hash / fixed slots** | ring with vnodes, or 1024 logical shards → node map | Adding nodes moves little data | Needs shared metadata |
| **Directory (lookup)** | table `tenant → shard` | Full control, move one tenant at a time | Directory is a dependency; must be cached and highly available |
| **Geo** | `country → region` | Data residency, latency | Uneven regions; cross-region users |

The common production answer: **hash the key into a fixed number of logical shards (say 1024 or 4096), then map logical shards to physical nodes.** Rebalancing moves whole logical shards, never re-hashes rows.

### Choosing the partition key

A good key:

1. Has **high cardinality** (many distinct values).
2. Spreads **load**, not only data (one big merchant can be 30% of traffic).
3. Matches the **main access pattern**, so most queries hit one shard.
4. Keeps **things that change together** on one shard, so transactions stay local.

Examples: chat messages by `chat_id` (whole conversation on one shard); payments by `merchant_id` (merchant dashboards are single-shard); feed by `user_id`.

### Secondary indexes

If you shard orders by `user_id` but need "orders by merchant":

- **Local index** (per shard): writes are cheap, reads scatter to all shards.
- **Global index** (partitioned by the indexed field): reads hit one place, but each write updates another shard, usually async (DynamoDB GSIs are eventually consistent).

### Rebalancing

- Never use `hash % N` with physical N. Changing N moves almost everything (see [14 consistent hashing](./14-consistent-hashing.md)).
- **Fixed many partitions** (Kafka, Elasticsearch, Riak, Redis Cluster's 16384 slots): move whole partitions to new nodes.
- **Dynamic splitting** (HBase regions, MongoDB chunks, DynamoDB): split a partition when it grows too big or too hot.
- Moving data live: copy a snapshot, stream changes (CDC), catch up, flip routing, then delete from the old shard.

## Numbers to remember

- Plan shards so each holds **a few hundred GB to ~1–2 TB**. Smaller shards move faster.
- Start with **more logical shards than you need** (e.g. 1024 on 8 machines). Splitting later is the hard part.
- Scatter-gather latency = the **slowest** shard. With 100 shards, the p99 of one shard becomes close to your median.
- DynamoDB per-partition limit: about **3,000 RCU and 1,000 WCU** per second. A hot key cannot go above this.

## Trade-offs and when not to use it

| Choice | Use when | Cost |
|---|---|---|
| No sharding (vertical scale + replicas) | Data < a few TB, writes < ~10k/s on good hardware | Single write leader |
| Partition inside one DB (Postgres partitions) | Big time-series tables; drop old data by dropping a partition | Doesn't add machines |
| Application-level sharding | You need control, cheap infra | Router, resharding and cross-shard logic are yours |
| Vitess / Citus / a distributed SQL DB (CockroachDB, Spanner, TiDB) | You want SQL and transactions across shards | Operational or licence cost; cross-shard transactions are slower |
| Managed NoSQL (DynamoDB, Cassandra) | Access patterns are known and key-based | Limited queries; design around the key |

**Do not shard early.** It makes joins, transactions, unique constraints and schema changes harder. Say what metric would make you shard.

## In real systems

- **Instagram**: thousands of logical shards mapped to fewer Postgres servers; IDs carry the shard id.
- **Slack**: moved to Vitess, sharded by workspace and later by channel.
- **Discord**: messages in Cassandra (later ScyllaDB), partitioned by `(channel_id, time bucket)` so one partition never grows forever.
- **Razorpay / Stripe-style payments**: shard by merchant; very large merchants may get dedicated shards (directory-based).
- **Kafka**: a topic is split into partitions; the key decides the partition (see [18 Kafka](./18-kafka-deep-dive.md)).

## What to say in the interview

"Writes are about 20k per second and data grows by 5 TB a year, so one leader won't hold. I'll shard by `merchant_id`, because almost every query is scoped to a merchant and payment transactions stay on one shard. I'll hash into 1024 logical shards and map them to physical nodes in a small config service, so I can rebalance by moving logical shards. For the few huge merchants I'll keep a directory override that gives them their own shard. Cross-merchant reporting goes to an analytics store through CDC, not scatter-gather on the OLTP shards."

## Common follow-ups

<details><summary>How do you handle a hot shard or a celebrity key?</summary>

First find whether it is a hot **key** or a hot **range**. For a hot range, split the shard. For a hot key: cache reads in front, add replicas for reads, and for write-heavy counters split the key (`key#0..key#9`) and sum on read. A directory lets you move one big tenant to its own shard.
</details>

<details><summary>How do you do a transaction across two shards?</summary>

Avoid it by choosing the key so related rows live together. If you can't: a Saga with compensations, or a transactional outbox, or 2PC if the store supports it (cost: latency and blocking on coordinator failure). See [20 distributed transactions](./20-distributed-transactions.md).
</details>

<details><summary>How do you keep a column unique across shards (e.g. email)?</summary>

Make a separate lookup table sharded by that column (`email → user_id`) and write to it first with a conditional insert. Or generate the value so it is unique by design (Snowflake IDs, see [25 unique IDs](./25-unique-id-generation.md)).
</details>

<details><summary>How do you add shards with zero downtime?</summary>

Double-write or CDC: copy a snapshot to the new shard, stream changes until lag is near zero, briefly pause writes for the moved range (or use a version check), flip the routing map, then clean up the old copy.
</details>

## Self-test (answer before opening)

<details><summary>1. You shard a messages table by `message_id`. What goes wrong?</summary>

"Load the last 50 messages of a chat" must ask every shard. Shard by `chat_id` (plus a time bucket for very big chats) so one chat is on one shard.
</details>

<details><summary>2. Range-sharding orders by `created_at`. What is the problem?</summary>

All new writes go to the latest range, so one shard is hot and the rest are idle. Use hash of a key, or a compound key such as `(hash(merchant_id), created_at)`.
</details>

<details><summary>3. Why have 1024 logical shards on 8 machines instead of 8 shards?</summary>

To add machines you move whole logical shards (about 1024/N each) without re-hashing rows. With 8 physical shards, going to 9 moves most data.
</details>

<details><summary>4. Local vs global secondary index: which makes writes slower?</summary>

Global. A write may have to update an index entry on another shard. Local indexes keep writes local but make reads by that field scatter to every shard.
</details>

## Go deeper

- DDIA, chapter 6 (Partitioning): "Partitioning of Key-Value Data", "Partitioning and Secondary Indexes", "Rebalancing Partitions"
- Older notes in this repo: `archive/notes/hld-parts/part2.md`, "Module 2.2: Database Sharding & Partitioning", "Resharding & Rebalancing Challenges", "Handling Hotspots", "Cross-Shard Queries & Joins"
- `archive/notes/DB/shardening_partitioning_replication.md`, "THE THREE CORE CONCEPTS"
- Practice: [Key-value store](../problems/04-key-value-store/README.md), [URL shortener](../problems/01-url-shortener/README.md)
