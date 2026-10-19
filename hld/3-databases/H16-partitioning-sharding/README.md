# H16 · Partitioning and sharding

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/3-databases/H16-partitioning-sharding/demo.ts`)
> **Builds on:** [H11 Indexes](../H11-indexing/) · [H15 Replication](../H15-replication/) · **Used in:** URL shortener, chat system, news feed, payment system, key-value store, metrics monitoring, ad-click aggregation, digital wallet

## The idea in one line

Split one big dataset into smaller pieces (shards), each on its own machine, so writes, storage and the working set all scale out. The **partition key** decides almost everything, and it is very hard to change later.

## Why it matters (the problem it solves)

One database machine has three hard limits:

| Limit | What happens | Does a read replica help? |
|---|---|---|
| **Write throughput** | Every write goes to one leader. A good Postgres box tops out around 10k–30k simple writes/s. | No. Replicas copy every write too. |
| **Storage** | Past ~5–10 TB on one node: backups, `VACUUM`, index builds and restores take hours. | No. Each replica holds the full copy. |
| **Working set** | When the hot data no longer fits in RAM, queries start hitting disk and p99 jumps. | Only for reads. |

Replication copies the **same** data to more machines (scales reads, gives HA). Sharding splits **different** data across machines (scales writes and storage). Real systems do both: each shard is its own leader + followers group.

```
                 ┌──────────── router (knows key → shard) ───────────┐
                 │                    │                     │
           shard 0                shard 1               shard 2
        leader + 2 replicas    leader + 2 replicas    leader + 2 replicas
        users 0..1/3           users 1/3..2/3         users 2/3..1
```

**Words.** *Partitioning* usually means splitting a table, possibly inside one machine (Postgres declarative partitioning). *Sharding* means the partitions live on different machines. Interviewers often use them as the same word. Say which one you mean.

## How it works

Four moving parts:

1. A **partition key** (shard key) on every row: `user_id`, `merchant_id`, `chat_id`, `device_id`.
2. A **strategy** that maps a key to a partition.
3. A **map** from partition to physical node (config service, ZooKeeper/etcd, or gossip).
4. A **router** that reads the key and sends the query: a client library, a proxy (Vitess VTGate, ProxySQL, mongos), or the database itself (Cassandra, DynamoDB, CockroachDB).

Queries that carry the key hit **one shard**. Queries without it must **scatter-gather** to all shards and merge.

### Strategy 1: range partitioning

Each shard owns a contiguous range of keys: `A–H → s0, I–P → s1, Q–Z → s2`, or `Jan–Apr → s0`.

- Good: range scans and ordered pagination stay on one shard (`WHERE name BETWEEN 'a' AND 'c'`).
- Good: shards split naturally when they grow (HBase regions, Bigtable tablets, CockroachDB ranges split at ~512 MB).
- Bad: **sequential keys hot-spot**. If the key is `created_at` or an auto-increment id, every new write lands in the last range. One shard at 100%, the rest idle.

### Strategy 2: hash partitioning

`partition = hash(key) mod P`. A good hash (Murmur3, xxHash) scatters neighbouring keys.

- Good: writes and data spread evenly.
- Bad: range queries now **fan out to every shard**.
- Bad: if P is the number of physical machines, adding a machine changes `mod P` for most keys (see the rebalancing section).

### Strategy 3: directory (lookup) partitioning

A small table says `tenant_42 → shard 7`. The router asks it (and caches the answer).

- Good: full control. You can move one big tenant on its own, or give a whale its own shard.
- Bad: the directory is now a critical dependency. It must be replicated, cached and highly available.

### Strategy 4: geo / list partitioning

`country = IN → ap-south-1`. Used for data residency (RBI wants Indian payment data stored in India) and latency. Regions are uneven in size, and users who travel make it messy.

### Compound keys: the real-world answer

Most production keys combine two things: **a hash part for spread, and a range part for order inside the partition**.

| System | Key | Why |
|---|---|---|
| Cassandra / DynamoDB | partition key `chat_id`, sort key `message_ts` | One chat on one node, messages ordered by time |
| Discord messages | `(channel_id, bucket)` where bucket = 10-day window | A busy channel cannot grow one partition forever |
| IoT telemetry | `(device_id, day)` | Writes spread across devices; one day of one device is a single scan |
| Postgres | `PARTITION BY RANGE (created_at)` then `HASH (user_id)` | Drop old months fast, spread the current month |

### Choosing the partition key (the one-way door)

A good key:

1. Has **high cardinality** (millions of `user_id`s, not 30 `country`s).
2. Spreads **traffic**, not only rows. One large merchant can be 30% of payments.
3. Matches the **main access pattern**, so the hot queries hit one shard.
4. Keeps **things that change together** on one shard, so transactions stay local.
5. **Never changes** for a row. Changing it means moving the row.

Ask: "What are the top 3 queries, and does each one include this key?"

### Hot keys vs hot ranges

Hashing spreads **keys**, not **traffic**. A celebrity's profile, a flash-sale product or one huge tenant still lands on one shard.

| Problem | Fix |
|---|---|
| Hot range (sequential keys) | Hash the key, or split the range (auto-split) |
| Hot key, read-heavy | Cache in front (Redis/CDN), add read replicas to that shard |
| Hot key, write-heavy (counters, likes) | **Key salting**: write to `key#0..key#9` at random, sum on read |
| One huge tenant | Directory override: move that tenant to a dedicated shard |

### Secondary indexes on a sharded table

Orders are sharded by `user_id`. Now you need "orders by `merchant_id`".

```
LOCAL index (per shard)               GLOBAL index (sharded by merchant_id)
write: 1 shard, cheap                 write: base shard + index shard (usually async)
read:  scatter to ALL shards          read:  1 index shard, then fetch rows
e.g. Cassandra secondary index,       e.g. DynamoDB GSI (eventually consistent),
     MongoDB, Elasticsearch                a separate "orders_by_merchant" table
```

### Rebalancing: never `hash % N` on physical nodes

With `hash(key) % N`, going from N to N+1 moves about `N/(N+1)` of all keys. From 3 to 4 shards, ~75% of the data moves. Three real solutions:

| Approach | What moves when you add a node | Used by |
|---|---|---|
| **Fixed logical partitions** (many more than nodes) | Whole partitions, ~1/(N+1) of data. Key → partition never changes. | Redis Cluster (16384 slots), Kafka, Elasticsearch, Riak, Couchbase (1024 vBuckets) |
| **Consistent hashing** with virtual nodes | Keys in the arcs the new node takes, ~1/(N+1) | Cassandra, DynamoDB, Memcached clients (see [H17](../H17-consistent-hashing/)) |
| **Dynamic splitting** | A partition splits when it is too big or too hot, then one half moves | HBase, MongoDB chunks, DynamoDB, CockroachDB, Spanner |

The common interview answer: **hash the key into 1024 (or 4096) logical shards, keep a small map of logical shard → physical node, and move whole logical shards.**

```
key ──hash──▶ logical shard 0..1023 ──map──▶ physical node
  (never changes)                  (changes when you rebalance)
```

### Moving data live (zero downtime)

1. Copy a snapshot of the logical shard to the new node.
2. Stream changes (CDC from the binlog/WAL, or dual-write) until lag is near zero.
3. Pause writes for that one logical shard for a few hundred ms (or use a version check).
4. Flip the routing map. Routers pick it up (watch on etcd, or version in each response).
5. Verify, then delete the old copy.

### Cross-shard pain

- **Joins**: do them in the app, or denormalise so a single shard has what the query needs.
- **Transactions**: avoid by choosing the key. Otherwise use a saga or outbox ([H23](../../4-async/H23-distributed-transactions/)), or 2PC if the store supports it (CockroachDB, Spanner, Vitess with 2PC).
- **Unique constraints** (e.g. email): a separate lookup table sharded by email, written first with a conditional insert.
- **Auto-increment ids**: break across shards. Use Snowflake-style ids ([H28](../../5-reliability/H28-unique-ids/)), often with the shard id inside.
- **Analytics across all shards**: send data to a warehouse with CDC. Don't scatter-gather on OLTP shards.

## In TypeScript

A router with fixed logical shards and a directory override for whales:

```ts
const LOGICAL = 1024;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

class ShardRouter {
  private owner: string[] = [];                 // logical shard -> node
  private overrides = new Map<string, string>(); // tenant -> dedicated node

  constructor(nodes: string[]) {
    for (let p = 0; p < LOGICAL; p++) this.owner[p] = nodes[p % nodes.length];
  }
  logical(key: string): number { return fnv1a(key) % LOGICAL; } // never changes
  route(key: string): string {
    return this.overrides.get(key) ?? this.owner[this.logical(key)];
  }
  // Rebalance: hand whole logical shards to the new node. Rows are not re-hashed.
  addNode(node: string, nodesAfter: number): number[] {
    const moved: number[] = [];
    for (let p = 0; p < LOGICAL; p++) if (p % nodesAfter === nodesAfter - 1) { this.owner[p] = node; moved.push(p); }
    return moved;
  }
  pin(tenant: string, node: string) { this.overrides.set(tenant, node); }
}
```

Hot counter with key salting:

```ts
const SALTS = 10;
const writeKey = (k: string) => `${k}#${Math.floor(Math.random() * SALTS)}`;   // spreads writes
const readKeys = (k: string) => Array.from({ length: SALTS }, (_, i) => `${k}#${i}`); // sum these on read
```

The full simulation (range vs hash vs fixed partitions, hot key, scatter-gather) is in [demo.ts](demo.ts).

## Trade-offs / when NOT to use it

| Choice | Use when | Cost |
|---|---|---|
| No sharding: vertical scale + read replicas + cache | Data under a few TB, writes under ~10k/s | Single write leader |
| Partitioning inside one DB (Postgres partitions) | Big time-series tables; drop old months by dropping a partition | Adds no machines |
| Application-level sharding | You need control and cheap infra | Router, resharding, cross-shard logic are all yours |
| Vitess / Citus / distributed SQL (CockroachDB, Spanner, TiDB, YugabyteDB) | You want SQL and cross-shard transactions | Ops or licence cost; cross-shard transactions are slower |
| Managed NoSQL (DynamoDB, Cassandra) | Access patterns are known and key-based | Limited queries; you design around the key |

**Do not shard early.** It makes joins, transactions, unique constraints, schema changes and backups harder, and the key choice is a one-way door. Exhaust the cheaper levers first: indexes, query fixes, caching, read replicas, a bigger box, archiving old data. Then name the metric that forces sharding ("writes pass 15k/s" or "table passes 4 TB").

## Common mistakes

- Sharding by **time or auto-increment id** and creating a hot newest shard.
- Using `hash % number_of_servers`, then discovering that adding one server moves 75% of the data.
- Picking a key the main query does not carry, so every request scatter-gathers. Example: messages sharded by `message_id`.
- Saying "hashing gives even load". It gives even **keys**. Hot keys still exist.
- Forgetting secondary access patterns (orders by merchant) until the end.
- Ignoring the **scatter-gather tail**: a query that hits 100 shards is as slow as the slowest one.
- Planning too few logical shards. Splitting a logical shard later is the hard part; starting with 1024 on 8 nodes is cheap.
- Mixing up replication and sharding, or forgetting that each shard still needs replicas for HA.

## Say this in the interview

> "Writes are around 20k per second and data grows about 5 TB a year, so one leader won't hold. I'll shard by `merchant_id`, because almost every query is scoped to one merchant, and a payment's rows stay on one shard so its transaction stays local. I'll hash into 1024 logical shards and keep a small map of logical shard to node in a config service. Adding a node moves whole logical shards, never re-hashes rows."

> "Hashing spreads keys, not traffic. For the few huge merchants I'll keep a directory override that gives them a dedicated shard. For hot counters I'll salt the key into ten sub-keys and sum on read. Cross-merchant reports go to a warehouse through CDC, not scatter-gather on the OLTP shards."

> "Before any of this I'd exhaust indexes, caching and read replicas. Sharding is a one-way door: once the key is chosen, changing it means migrating every row."

## Your experience hook

- **IoT telemetry, 10k+ devices:** telemetry is write-heavy time-series data, the textbook hotspot trap. Partitioning by timestamp sends every write to the current partition. Partition by `device_id` (hash), or `(device_id, day)`, so writes spread and one device's day is still one scan. You also batched writes through a Redis queue to cut DB load.
- **Redis at scale:** Redis Cluster uses 16384 hash slots mapped to nodes. Adding a node moves slots, not every key. That is the fixed-logical-partitions pattern in production.
- **MongoDB to MySQL migration:** Mongo forces the shard-key choice up front, and a bad key is painful to undo. That is why you treat the partition key as the decision you can't easily walk back.

## Numbers to remember

| Number | Value |
|---|---|
| Target shard size | A few hundred GB to ~1–2 TB (smaller shards move faster) |
| Logical shards to start with | 1024 or 4096, many more than physical nodes |
| Redis Cluster slots | 16384 (`CRC16(key) mod 16384`) |
| Keys moved going 3 → 4 nodes with `% N` | ~75% (`N/(N+1)`) |
| Keys moved with fixed partitions or a ring | ~25% (`1/(N+1)`) |
| DynamoDB per-partition limit | ~3,000 RCU and 1,000 WCU per second, ~10 GB |
| CockroachDB range split size | 512 MB by default |
| Scatter-gather tail | With 100 shards, one shard's p99 becomes close to your median |

## Self-test

<details><summary>1. Replicas scale reads and give HA. What exactly can replication NOT solve that forces sharding?</summary>

Write throughput and total storage. Every replica takes every write and stores the full dataset, so one leader's write limit and one machine's disk are still the ceiling. Sharding gives each machine 1/N of the writes and rows.
</details>

<details><summary>2. You shard a messages table by message_id. What goes wrong?</summary>

"Load the last 50 messages of a chat" has to ask every shard. Shard by `chat_id` (plus a time bucket for very big chats) so one conversation lives on one shard, ordered by a time-sortable message id.
</details>

<details><summary>3. Range-sharding orders by created_at. What is the problem, and the fix?</summary>

All new writes go to the newest range, so one shard is hot and the rest are idle. Hash a high-cardinality key instead, or use a compound key like `(hash(merchant_id), created_at)`.
</details>

<details><summary>4. You hashed the key and data is even. Why is one shard still on fire?</summary>

A hot key: one value (celebrity, flash-sale item, whale tenant) gets a big share of traffic, and hashing sends all of it to one shard. Fixes: cache it, add read replicas on that shard, salt write-heavy keys (`key#0..#9`), or move that tenant to a dedicated shard via a directory.
</details>

<details><summary>5. Why 1024 logical shards on 8 machines instead of 8 shards?</summary>

The key → logical shard mapping never changes. To add machines you move whole logical shards (about 1/N of them). With 8 physical shards and `% 8`, going to 9 moves most of the data.
</details>

<details><summary>6. Local vs global secondary index: which slows writes and which slows reads?</summary>

A global index slows writes: each write may also update an index entry on another shard, usually async (DynamoDB GSIs are eventually consistent). A local index keeps writes on one shard but makes reads by that field scatter to every shard.
</details>

<details><summary>7. How do you keep email unique across user shards?</summary>

Keep a separate `email → user_id` table sharded by email. Insert into it first with a conditional write (fails if it exists), then create the user row. Clean up if the second step fails.
</details>

<details><summary>8. Walk me through adding a shard with zero downtime.</summary>

Copy a snapshot of the logical shards that will move, stream changes with CDC until lag is near zero, briefly pause writes for those shards, flip the routing map, let routers pick up the new version, then delete the old copies.
</details>

## Go deeper

- Visual: [visual.html](visual.html) (range vs hash, hot key, scatter-gather, fixed partitions, directory override)
- Next: [H17 Consistent hashing](../H17-consistent-hashing/) and its [lab-hash-ring](../H17-consistent-hashing/lab-hash-ring/README.md)
- Related: [H15 Replication](../H15-replication/), [H23 Distributed transactions](../../4-async/H23-distributed-transactions/), [H28 Unique IDs](../../5-reliability/H28-unique-ids/), [H37 Data at scale](../../6-building-blocks/H37-data-at-scale/)
- Case studies: [Key-value store](../../case-studies/04-key-value-store/README.md), [Chat system](../../case-studies/06-chat-system/README.md), [URL shortener](../../case-studies/01-url-shortener/README.md), [Payment system](../../case-studies/08-payment-system/README.md), [Metrics monitoring](../../case-studies/19-metrics-monitoring/README.md)
- Archive notes: [hld-parts/part2.md](../../../archive/notes/hld-parts/part2.md) ("Database Sharding & Partitioning", "Resharding", "Handling Hotspots"), [DB/shardening_partitioning_replication.md](../../../archive/notes/DB/shardening_partitioning_replication.md)
- Book: DDIA chapter 6 (Partitioning)
