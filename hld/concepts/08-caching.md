# 08 · Caching

> **Read time:** 40 min · **Visual:** [v03 caching patterns](../../visuals/v03-caching-patterns.html), [v29 LRU cache internals](../../visuals/v29-lru-cache.html) · **Code it:** [hld/code/03-bloom-filter](../code/03-bloom-filter/README.md) (stops cache penetration)
> **Shows up in:** URL shortener, news feed, distributed cache, leaderboard, product catalog, session store, almost every read-heavy design

## The idea in one line

Keep a copy of hot data in fast memory close to the reader, so most reads skip the slow source. You pay for it with staleness and extra failure modes.

## The problem it solves

- A DB read from disk or over the network takes about 1–10 ms. A Redis read takes about 0.2–1 ms on the same network. An in-process read takes nanoseconds to microseconds.
- Most traffic is skewed: a small share of keys gets most reads.
- The DB is usually the first thing to fall over. A cache with a 95% hit rate cuts DB reads by 20×.

## How it works

### Where caches live

```
browser cache → CDN → API gateway → app in-process cache → Redis/Memcached → DB buffer pool
```

Each level is faster and smaller than the next one.

### Read and write patterns

| Pattern | Read path | Write path | Notes |
|---|---|---|---|
| **Cache-aside** (lazy) | App checks cache; on miss reads DB and fills cache | App writes DB, then **deletes** the cache key | Most common. Cache failure = slower, not broken |
| Read-through | Cache library loads from DB on miss | Same as cache-aside | Loading logic lives in the cache layer |
| Write-through | Like read-through | Write cache and DB together, synchronously | Cache always fresh; every write is slower |
| Write-behind (write-back) | From cache | Write cache; flush to DB later in batches | Fast writes; data loss if cache dies |
| Write-around | Cache-aside | Write DB only; cache fills on next read | Good when written data is rarely read soon |

**Delete, don't update, on write.** Two concurrent writers that each `SET` the cache can leave the older value in cache. Deleting is safer. Small race left: a slow reader can put an old value back after the delete. Fixes: short TTL, or "delete, then delete again after ~1 s" (delayed double delete), or update the cache from the DB change stream (CDC).

### Eviction

- **LRU**: evict the least recently used. Good default. Implemented with a hash map + doubly linked list (see v29).
- **LFU**: evict the least frequently used. Better for stable popularity; slower to adapt.
- **TTL**: every key expires. Always set one; it limits how wrong the cache can be.
- Redis: `maxmemory-policy` such as `allkeys-lru`, `allkeys-lfu`, `volatile-ttl`. Redis uses approximate LRU (samples a few keys).

### The three classic failures

| Failure | What happens | Fix |
|---|---|---|
| **Stampede** (thundering herd, dog-pile) | A hot key expires; 10k requests miss at once and all hit the DB | A lock or single-flight per key (one loader, others wait); serve stale while refreshing; refresh early with jitter |
| **Penetration** | Requests for keys that do not exist always miss and hit the DB (often an attack) | Cache the "not found" with a short TTL; Bloom filter of valid ids in front |
| **Avalanche** | Many keys expire at the same moment, or the cache cluster restarts | Add random jitter to TTLs; warm the cache before traffic; replicas; circuit breaker to protect DB |

### Distributed cache

- Shard keys across nodes with consistent hashing (Memcached clients) or hash slots (Redis Cluster, 16384 slots).
- Replicate for availability (Redis primary + replica, Sentinel or Cluster failover). Replication is async, so a failover can lose recent writes. A cache is allowed to lose data. A source of truth is not.
- **Hot key**: one key on one node. Fix with a local in-process cache (a few seconds TTL), or copies `key#1..key#N` read at random.

## Numbers to remember

- Redis single node: ~100k simple ops/s per core-bound instance; GET latency ~0.2–1 ms inside a data center.
- Hit rate math: DB load = total reads × (1 − hit rate). 90% → 10% load. 99% → 1% load. Going from 90% to 99% is a 10× drop.
- Memory sizing: hot set × object size × ~1.3 overhead. 20M keys × 500 B ≈ 10 GB → ~13 GB with overhead.
- 80/20 rule: caching the top 20% of objects often serves ~80% of reads. Use it as a starting assumption, not a fact.

## Trade-offs and when not to use it

| Option | Use when | Weakness |
|---|---|---|
| In-process cache (LRU map, Caffeine, `lru-cache` in Node) | Tiny, very hot, rarely changing data (config, feature flags) | Each instance has its own copy; invalidation across instances is hard; uses heap |
| Redis | Shared cache, rich types (sorted sets, counters), TTLs | Network hop; one more cluster to run |
| Memcached | Simple key-value at very high throughput, multi-threaded | No persistence, no rich types, no replication built in |
| No cache | Write-heavy data, data that must be exact (balances), low traffic | — |

**Do not cache the source of truth for money.** For a wallet balance, read from the DB (or cache with a very short TTL for display only) and always check the DB inside the transaction that debits.

## In real systems

- **Facebook**: Memcached at huge scale with leases to stop stampedes and stale sets ("Scaling Memcache at Facebook", NSDI 2013).
- **Twitter**: Redis for timelines (precomputed home feeds).
- **Swiggy/Zomato-style apps**: restaurant menus and catalog in Redis; availability and prices with short TTLs.
- **Razorpay-style payments**: Redis for idempotency keys, rate limits and sessions; never as the ledger.

## What to say in the interview

"Reads are about 100× writes, so I'll put Redis in front of the DB with cache-aside. On a write I update the DB and delete the key. Every key gets a TTL of a few minutes with random jitter, so they don't all expire together. For hot keys I'll use single-flight loading so only one request rebuilds a key, and a small in-process cache for the top few keys. I expect a hit rate above 90%, so the DB sees under 10% of reads. If Redis is down, we fall back to the DB behind a circuit breaker and rate limit."

## Common follow-ups

<details><summary>How do you keep the cache consistent with the DB?</summary>

You can't make it perfectly consistent cheaply. Options, from simple to strong: TTL only; delete on write (cache-aside); delayed double delete; update or delete from CDC (Debezium reading the DB log), which catches writes from every service. Pick based on how much staleness the product can accept.
</details>

<details><summary>Cache-aside vs write-through: which one?</summary>

Cache-aside is the default: simple, and the cache only holds what is read. Write-through fits when data is read right after it is written and you can accept slower writes. Write-behind only when you can lose recent writes, or when the cache itself is durable.
</details>

<details><summary>Redis is down. What happens to the system?</summary>

With cache-aside, reads go to the DB. The DB may not survive full traffic. Protect it: a circuit breaker on the cache client, request coalescing, rate limits, and serving degraded data. Plan DB capacity for some cache-miss traffic.
</details>

<details><summary>How would you cache a user's news feed?</summary>

Store a list of post ids per user (a Redis list or sorted set, capped at a few hundred) and hydrate the posts from a separate post cache. Ids change often; post bodies are shared by many users.
</details>

## Self-test (answer before opening)

<details><summary>1. Why delete the key on write instead of setting the new value?</summary>

Two concurrent writers can set values in the wrong order and leave an old value in cache. Delete makes the next read load the current DB value.
</details>

<details><summary>2. A popular product key expires and the DB CPU spikes to 100%. Name the problem and two fixes.</summary>

Cache stampede. Fixes: single-flight lock per key; serve stale while one worker refreshes; early probabilistic refresh before the TTL ends.
</details>

<details><summary>3. Attackers request random product ids that don't exist. What happens and how do you stop it?</summary>

Cache penetration: every request misses and hits the DB. Cache negative results with a short TTL, put a Bloom filter of valid ids in front, and rate limit.
</details>

<details><summary>4. Hit rate goes from 95% to 90%. What happens to DB load?</summary>

It doubles: from 5% of reads to 10%.
</details>

## Go deeper

- Concepts: [09 CDN](./09-cdn.md), [14 consistent hashing](./14-consistent-hashing.md), [29 probabilistic data structures](./29-probabilistic-data-structures.md), [34 data modelling at scale](./34-data-modeling-at-scale.md)
- Problems: [17 distributed cache](../problems/17-distributed-cache/README.md), [01 URL shortener](../problems/01-url-shortener/README.md)
- LLD practice: [02 LRU / LFU cache](../../lld/problems/02-lru-cache/README.md)
- "Scaling Memcache at Facebook" (NSDI 2013)
- Older notes in this repo: `archive/notes/hld-parts/part1.md`, "Module 1.3: Caching Strategies" ("Caching Patterns (Deep Dive)", "Eviction Policies (Deep Dive)", "Cache Invalidation (The Hardest Problem!)", "Cache Stampede Prevention"); `archive/notes/hld-parts/part8.md`, "Module 8.2: Advanced Caching Strategies"
