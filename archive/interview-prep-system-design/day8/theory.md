# SD Day 8 — Sharding / Partitioning: hash vs range, hot keys, resharding

*(Jun 16, 2026 · ~1 hr · the twin of Day 7 — replication copies the **same** data; sharding splits **different** data. The thing everyone reaches for too early; the senior move is knowing when NOT to. Hooks Day 15 (consistent hashing) and Day 9 (CAP).)*

---

## 1. What sharding is — and the one line that frames it

**Sharding = splitting one logical dataset across multiple machines, each holding a
*different* subset.** ("Partitioning" = the same idea; "shard" usually implies the partitions
live on separate nodes.) You do it for **one reason that the others can't solve**:

> Replication scales **reads** and gives HA, but **every node still holds all the data and takes
> all the writes**. When the dataset no longer fits on one machine, or the **write volume**
> exceeds what one leader can handle, copies don't help — you must **split**. That's sharding.

So the honest framing: **shard only when a single node can't hold the data or absorb the
writes.** It's the last lever, not the first.

```
                 ┌─ shard A (users 0–33%)  ── + its own replicas
all writes ─────▶├─ shard B (users 34–66%) ── + its own replicas
   (split by    └─ shard C (users 67–100%) ── + its own replicas
    a key)
```

Note: **sharding and replication compose** — each shard is itself a leader-follower group
(Day 7). Real systems do both.

## 2. The partition key is THE decision

Everything rides on **what key you split by** (a.k.a. shard key / partition key). Pick wrong
and you can't easily change it later. Two strategies:

### Range partitioning
Split by **contiguous ranges** of the key (users A–F, G–M…; or by date Jan / Feb / Mar).
- ✅ **Range scans are cheap** — "all orders in March" hits one shard. Keeps order.
- ❌ **Hotspots** — sequential/time keys all pile onto the **newest** shard (today's writes all
  hit the "current month" partition). Classic with timestamp or auto-increment keys.

### Hash partitioning
Hash the key, assign by hash (`hash(key) % N`, or a hash range).
- ✅ **Even spread** — load distributes uniformly, kills the sequential hotspot.
- ❌ **Range queries die** — adjacent keys scatter across all shards, so "orders in March"
  fans out to every shard. You traded scan-ability for balance.

> The exam line: **"Range keeps locality but risks hotspots on sequential keys; hash spreads
> load evenly but destroys range queries. I pick based on whether the access pattern is
> range-scan-heavy or point-lookup-heavy."**

## 3. Hot keys / hot shards — the failure mode they'll probe

Even with hashing, load can concentrate:
- **Hot key** — one value is wildly popular (a celebrity's user_id, one viral product). Hashing
  spreads *keys* evenly but **all traffic for that single key still lands on one shard**.
- **Hot shard** — a bad range split or skewed data puts disproportionate load on one node.

Mitigations — name them:
1. **Compound / salted key** — append a suffix (`celebrity_id:bucket_0..9`) to split one hot
   key across N sub-partitions; reads fan-out-and-merge. Trades simplicity for spread.
2. **Cache the hot key** — a celebrity's data is read-heavy → Redis in front absorbs it (Day 3).
3. **Pick a higher-cardinality key** — sometimes the real fix is choosing a key that doesn't
   concentrate in the first place.

> "Hashing fixes *even* distribution, not *hot keys* — a single viral key still hammers one
> shard, so I salt it or cache it." ← strong signal you've actually run this.

## 4. The pain of cross-shard operations (what you give up)

This mirrors Day 6 (joins are the enemy of sharding):
- **Cross-shard joins / queries** — data you want to join now lives on different machines →
  app-side scatter-gather, slow. Mitigate by **co-locating** related data under the same key
  (orders sharded by `user_id` so a user + their orders sit together).
- **Cross-shard transactions** — ACID across shards needs distributed commit (2PC) or a **saga**
  (Day 12). Expensive and slow → designs work hard to keep a transaction inside one shard.
- **Secondary indexes** — an index on a non-shard-key field must either live per-shard (query
  fans out) or be a separate global index. No free lunch.

> So you shard by the key most queries and transactions are scoped to — minimize cross-shard
> work by design.

## 5. Resharding — why `hash % N` is a trap

Naive `hash(key) % N`: add or remove one node → **N changes → almost every key remaps** →
massive data movement + cache misses while it rebalances. Solutions:

1. **Consistent hashing** (Day 15 — flag it here) — keys + nodes on a ring; adding a node moves
   only ~1/N of keys, not all of them. The standard answer.
2. **Fixed virtual buckets / pre-sharding** — hash into a large fixed count (e.g. 1024 logical
   shards), then *map buckets → nodes*. Rebalancing = reassign whole buckets between nodes; the
   key→bucket mapping never changes. (Redis Cluster's 16384 hash slots; this is what most
   systems actually do.)

> "I never use plain `mod N` in production — adding a node remaps everything. Either consistent
> hashing or a fixed set of virtual buckets I reassign between nodes."

## 6. The senior move: don't shard yet

The most credible answer is often **resisting** sharding:
- It adds huge operational complexity: cross-shard queries, rebalancing, hot-key handling,
  multi-shard transactions, harder ops.
- Exhaust the cheaper levers first: **read replicas** (Day 7), **caching** (Day 3), a **bigger
  box** (vertical), better indexes (Day 5), archiving cold data.
- A single Postgres handles far more than people assume (Day 6 echo).

> "Sharding is the lever I pull when one node genuinely can't hold the data or take the write
> volume — after replicas, caching, and vertical scaling are exhausted. It's a one-way door:
> the shard key is hard to change, so I'd rather not pay that complexity until forced."

## 7. Where I've touched this in prod (war stories)

> **IoT / 10k+ devices.** "High-volume device telemetry is naturally time-series + write-heavy
> — the textbook hotspot trap: shard/partition by timestamp and *all* writes hammer the current
> partition. The fix is partitioning by **device_id (hash)** so writes spread, or a compound
> key, rather than by raw time."

> **Redis at scale.** "Redis Cluster shards across **16384 hash slots** mapped to nodes — adding
> a node moves slots, not a full remap. That's the virtual-bucket pattern in the wild." (ties
> Day 3 + Day 7.)

> **Mongo → MySQL era.** "Mongo's sharding also forces the shard-key decision up front, and a
> bad shard key is painful to undo — reinforced that the partition key is the call you can't
> easily walk back."

## 8. The interview line

> "Sharding splits different data across nodes — distinct from replication, which copies the
> same data. I reach for it only when one node can't hold the dataset or absorb the writes,
> after replicas, caching, and vertical scaling are spent, because the shard key is a one-way
> door. The key choice is the whole game: range partitioning keeps locality for scans but
> hotspots on sequential keys; hash spreads load evenly but kills range queries. Hashing fixes
> *even* distribution, not *hot keys* — a viral key still lands on one shard, so I salt or cache
> it. I shard by the key transactions are scoped to, to avoid cross-shard joins and distributed
> commits. And never `mod N` — consistent hashing or fixed virtual buckets, so adding a node
> moves ~1/N of data, not all of it. I lived the time-series hotspot trap on IoT telemetry —
> partition by device_id, not timestamp."

---

### Half-page summary (the version to remember)

> Sharding = split **different** data across nodes (≠ replication = copy **same** data). The one
> reason: a single node can't hold the data or take the write volume — replicas/caching/vertical
> only scale reads + HA. Shard + replicate compose (each shard is a leader-follower group). The
> **partition key is the decision** (one-way door). **Range** = locality, cheap scans, but
> sequential/time keys **hotspot** the newest shard; **hash** = even spread, but range queries
> fan out to all shards. **Hot key** = one viral value hammers one shard even with hashing →
> salt the key (sub-partition) or cache it. Sharding kills cross-shard joins + ACID
> transactions (need scatter-gather / 2PC / saga) → shard by the key ops are scoped to, co-locate
> related data. **Never `hash % N`** (adding a node remaps everything) → consistent hashing
> (Day 15) or fixed virtual buckets (Redis 16384 slots). Senior move: **resist sharding** until
> forced — it's the last lever, not the first. War story: IoT telemetry — partition by device_id
> (hash), not timestamp, to dodge the time hotspot.
