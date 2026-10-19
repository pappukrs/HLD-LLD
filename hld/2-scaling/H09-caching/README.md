# H09 · Caching patterns, eviction and failures

> **Time:** ~50 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/2-scaling/H09-caching/demo.ts`) · **Hands-on:** [hands-on/](hands-on/README.md) (Express + Redis cache-aside)
> **Builds on:** [H02 Back-of-envelope](../../1-basics/H02-back-of-envelope/) · [H07 Scaling and stateless services](../H07-scaling-stateless/) · **Used in:** [URL shortener](../../case-studies/01-url-shortener/README.md), [News feed](../../case-studies/07-news-feed/README.md), [Distributed cache](../../case-studies/17-distributed-cache/README.md), [Leaderboard](../../case-studies/21-leaderboard/README.md), [Search autocomplete](../../case-studies/12-search-autocomplete/README.md), LLD [LRU cache](../../../lld/problems/02-lru-cache/README.md)

## The idea in one line

Keep a copy of hot data in fast memory close to the reader so most reads skip the slow source; you pay for it with staleness, extra failure modes (stampede, penetration, avalanche) and one more system to run.

## Why it matters (the problem it solves)

- A database read costs ~1 to 10 ms and real CPU on the DB. A Redis read in the same zone costs ~0.2 to 1 ms. An in-process read costs nanoseconds.
- Traffic is skewed: a small set of keys (today's top products, a celebrity's profile) gets most of the reads.
- The database is usually the first thing to fall over. A 95% hit rate cuts DB reads by 20x.

So in almost every read-heavy design (reads 10x to 100x writes), the second box you add after the load balancer is a cache. The interviewer then probes: which pattern, how do you invalidate, and what happens when it fails?

## How it works

### 1. Where caches live

```
browser ─▶ CDN edge ─▶ API gateway ─▶ app (in-process LRU) ─▶ Redis / Memcached ─▶ DB buffer pool ─▶ disk
  ~0 ms     ~10-30 ms                    ~µs                    ~0.5-1 ms             ~ms             ~ms+
```

Each level is faster and smaller than the next. HTTP caching and the CDN are covered in [H10](../H10-cdn/); this page is about the application cache.

### 2. Read and write patterns

| Pattern | Read path | Write path | Good | Risk |
|---|---|---|---|---|
| **Cache-aside** (lazy loading) | App reads cache; on miss reads DB, then `SET` with TTL | App writes DB, then **deletes** the key | Simple; caches only what is read; cache down = slower, not broken | First read is slow; stale until delete or TTL |
| Read-through | Cache library loads from DB on miss | Usually paired with write-through | App code stays simple | Needs a loader-aware cache |
| Write-through | Always hot | Write cache and DB together; ack after both | Never stale for these keys | Every write pays both; caches data nobody reads |
| Write-behind (write-back) | Always hot | Write cache, ack; flush to DB later in batches | Very fast writes, absorbs bursts | Cache crash before flush = lost writes |
| Write-around | Like cache-aside | Write DB only | No churn for write-once data (logs) | Next read is a miss |

Cache-aside is the default answer. Write-behind fits counters where losing a few increments is fine (views, likes), never money.

```
cache-aside read                         cache-aside write
app ─GET k─▶ Redis  hit? return          app ─UPDATE─▶ DB
        miss ↓                           app ─DEL k──▶ Redis   (next read refills)
app ─SELECT─▶ DB
app ─SET k v EX 300─▶ Redis
```

### 3. Invalidation (the hard part)

- **Delete, do not update, on write.** Two writers can update the DB in order A, B but the cache in order B, A, leaving the older value cached until TTL. Deleting avoids that.
- A small race remains: a slow reader loads the old row, the writer updates and deletes, then the slow reader `SET`s the old value back. Bound it with a **TTL**, or **delete twice** (now and again ~1 s later), or drive deletes from the DB change stream (**CDC**, e.g. Debezium), which also catches writes from other services.
- **Always set a TTL.** It is your upper bound on how wrong the cache can be. Pick it from the product: prices 30 to 60 s, profile 5 to 15 min, static config hours.
- Never cache the source of truth for money. A wallet balance shown on screen may be cached for a second; the debit always reads and locks the DB row.

### 4. Eviction and TTL

| Policy | Evicts | Good for |
|---|---|---|
| LRU | Least recently used | Good default; recency predicts reuse |
| LFU | Least frequently used | Stable popularity (top products); slow to adapt |
| TTL / volatile-ttl | Soonest to expire | When TTLs reflect value |
| FIFO / random | Oldest / any | Simple, cheap |

- Redis: set `maxmemory` and `maxmemory-policy allkeys-lru` (or `allkeys-lfu`) for a pure cache. `noeviction` returns errors when full: right for a queue or primary store, wrong for a cache. Redis LRU is approximate: it samples a few keys (default 5) and evicts the oldest of them.
- An exact LRU is a **hash map + doubly linked list**: the map finds the node in O(1), the list keeps recency order, get moves a node to the front, put on a full cache drops `tail.prev`. This is the classic LLD question ([LRU cache](../../../lld/problems/02-lru-cache/README.md)).

### 5. The four classic failures

| Failure | What happens | Fix |
|---|---|---|
| **Stampede** (thundering herd, dog-pile) | A hot key expires; thousands of requests miss in the same ms and all run the same DB query | Single-flight per key (in-process `Map<key, Promise>`), a Redis lock `SET lock:k 1 NX PX 3000` across instances, serve stale while one refreshes, early probabilistic refresh |
| **Penetration** | Requests for keys that do not exist always miss and hit the DB (often scrapers or attacks) | Cache the miss (`null`) with a short TTL; Bloom filter of valid ids in front ([H35](../../6-building-blocks/H35-probabilistic-ds/)); rate limit |
| **Avalanche** | Many keys expire at the same moment, or the cache cluster restarts cold | Random TTL jitter (300 s ± 10%); warm the cache before traffic; replicas; circuit breaker to protect the DB |
| **Hot key** | One key gets so many reads that its one Redis shard maxes out | Small in-process L1 cache with a few seconds TTL; replicate the key as `k#1..k#N` and read a random copy |

Single-flight inside one Node process only merges misses on that process. With 50 instances you can still send 50 queries; a Redis lock or a "serve stale and refresh in background" approach covers the fleet.

### 6. Distributed cache

- **Sharding:** Redis Cluster splits keys into 16,384 hash slots spread over primaries; Memcached clients use consistent hashing ([H17](../../3-databases/H17-consistent-hashing/)). Multi-key commands only work when keys share a slot (use hash tags like `{user:7}:cart`).
- **Replication:** primary plus replica with Sentinel or Cluster failover. Replication is async, so a failover can lose the last writes. Fine for a cache, not for a source of truth.
- **When Redis is down:** cache-aside falls back to the DB, which may not survive full traffic. Protect it with a circuit breaker on the cache client, request coalescing and rate limits, and size the DB for some miss traffic.

### 7. Sizing and hit-rate math

```
DB reads      = total reads × (1 − hit rate)
90% hit → 10% of reads reach the DB;  99% → 1%   (going from 90% to 99% is 10x less DB load)
avg latency   = hit × t_cache + (1 − hit) × (t_cache + t_db)
memory        = hot keys × avg value size × ~1.3 overhead
              = 20 M keys × 500 B × 1.3 ≈ 13 GB  → 2 shards of 8 GB + replicas
```

## In TypeScript

Cache-aside with TTL jitter, negative caching and single-flight:

```ts
const inflight = new Map<string, Promise<Product | null>>();

async function getProduct(id: string): Promise<Product | null> {
  const key = `product:${id}`;
  const hit = await redis.get(key);
  if (hit !== null) return hit === 'null' ? null : JSON.parse(hit);    // negative cache too

  if (!inflight.has(key)) {                                           // single-flight per key
    inflight.set(key, (async () => {
      const row = await db.findProduct(id);
      const ttl = row ? 300 + Math.floor(Math.random() * 60) : 30;    // jitter; short TTL for misses
      await redis.set(key, row ? JSON.stringify(row) : 'null', { EX: ttl });
      return row;
    })().finally(() => inflight.delete(key)));
  }
  return inflight.get(key)!;
}

async function updatePrice(id: string, price: number) {
  await db.updatePrice(id, price);
  await redis.del(`product:${id}`);                                    // delete, don't set
}
```

[demo.ts](demo.ts) simulates Zipf-skewed traffic through an LRU cache at different sizes (hit rate and DB load), then a stampede with and without single-flight, penetration with and without negative caching, and TTL jitter vs synchronized expiry.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| In-process cache (`lru-cache`, a `Map`) | Tiny, very hot, rarely changing data (config, flags) | One copy per instance; invalidation across instances is hard; uses heap |
| Redis | Shared cache, rich types (sorted sets, counters, streams), TTLs | Network hop; another cluster to run and make HA |
| Memcached | Plain key-value at very high throughput, multi-threaded | No persistence, no rich types, no built-in replication |
| No cache | Write-heavy data, low traffic, data that must be exact (balances, inventory at checkout) | — |

Do not add a cache to hide a missing index or an N+1 query. Fix the query first; cache what is still hot.

## Common mistakes

- Updating the cache on write instead of deleting (the ordering race).
- No TTL, so a missed invalidation means stale data forever.
- All keys with the same TTL, set at the same time (avalanche at exactly +1 h).
- Ignoring the stampede on the hottest key, which is exactly the key that matters.
- Saying "single-flight" without noticing it is per process.
- Caching balances or stock counts and then deciding on the cached value.
- `noeviction` on a cache, then writes fail when memory fills.
- Forgetting what happens when Redis is down: the DB must survive, or degrade gracefully.

## Say this in the interview

> "Reads are about 100 times writes, so I'll put Redis in front of the database with cache-aside. On a read I check Redis, on a miss I load from the DB and set the key with a TTL of a few minutes plus random jitter. On a write I update the DB and then delete the key. With a 95% hit rate the DB sees only 1 in 20 reads."

> "For the hottest keys I protect the DB from a stampede: one request takes a short Redis lock and rebuilds, the others wait a few milliseconds or get the stale value. Ids that don't exist are cached as null for 30 seconds, and a Bloom filter rejects obviously bogus ids. Redis runs with `allkeys-lru`, sharded with Redis Cluster and a replica per shard."

> "If Redis goes down, reads fall back to the DB behind a circuit breaker and rate limits, so we degrade instead of collapsing. Anything involving money is read from the DB inside the transaction, never trusted from cache."

## Your experience hook

- **Chesa dashboards:** you added Redis cache-aside to high-traffic dashboard endpoints and cut average response time by ~60% (~400 ms to ~160 ms). Say the hit path, the miss path, the TTL, and how you invalidated on writes.
- **Express API gateway:** you added an LRU response cache in the gateway. Good example of an in-process L1 cache and its limit (one copy per instance).
- **IoT platform:** Redis also held queues and pub/sub there; be ready to say which Redis use was cache (can lose data) and which was not.

## Numbers to remember

| Thing | Number |
|---|---|
| Redis GET in the same zone | ~0.2 to 1 ms |
| Redis single node throughput | ~100k+ simple ops/s |
| DB read | ~1 to 10 ms |
| Hit rate → DB load | 90% → 10%, 95% → 5%, 99% → 1% |
| Memory sizing | keys × value size × ~1.3 |
| Redis Cluster hash slots | 16,384 |
| TTL jitter | ±10 to 20% |
| Negative-cache TTL | ~30 to 60 s |
| Lock for rebuild | `SET lock:k 1 NX PX 3000` |

## Self-test

<details><summary>1. Why delete the key on write instead of setting the new value?</summary>

Two concurrent writers can update the DB in one order and the cache in the other, leaving the older value cached. Deleting makes the next reader load the current row. A smaller race remains; the TTL bounds it, or delete twice, or use CDC.
</details>

<details><summary>2. A hot product key expires and DB CPU jumps to 100%. Name it and give three fixes.</summary>

Cache stampede. Fixes: one rebuild via single-flight or a Redis `SET NX` lock; serve the stale value while one request refreshes; refresh early (probabilistically, before TTL) and add TTL jitter.
</details>

<details><summary>3. Attackers request random product ids that do not exist. What happens and how do you stop it?</summary>

Cache penetration: every request misses and hits the DB. Cache the miss as null with a short TTL, put a Bloom filter of valid ids in front, and rate limit by client.
</details>

<details><summary>4. Hit rate drops from 95% to 90%. What happens to DB load?</summary>

It doubles: from 5% of reads to 10%.
</details>

<details><summary>5. Cache-aside vs write-through vs write-behind: which for a product page, a likes counter, a bank balance?</summary>

Product page: cache-aside with delete on write. Likes counter: write-behind (INCR in Redis, flush in batches; losing a few is fine). Bank balance: no cache on the write path; the DB is the source of truth.
</details>

<details><summary>6. How does an LRU cache get O(1) get and put?</summary>

A hash map from key to node, plus a doubly linked list in recency order with dummy head and tail. Get: look up the node, move it to the front. Put on a full cache: remove `tail.prev` from both list and map, insert the new node at the front.
</details>

<details><summary>7. Redis is down. What happens to your system?</summary>

With cache-aside, reads go to the DB, which may not handle 20x the load. Protect it with a circuit breaker, request coalescing, rate limits and degraded responses, and plan DB headroom for a cold cache.
</details>

<details><summary>8. One celebrity profile key gets 500k reads/s and its Redis shard is at 100% CPU. Fix?</summary>

Hot key. Add an in-process L1 cache with a 1 to 5 s TTL on each app server, and/or store N copies (`profile:7#1..#8`) on different shards and read a random one. Invalidate all copies on write.
</details>

## Go deeper

- Hands-on: [hands-on/README.md](hands-on/README.md).
- Next: [H10 CDN and static content](../H10-cdn/) (the same idea at the edge).
- Related: [H17 Consistent hashing](../../3-databases/H17-consistent-hashing/), [H35 Bloom filters](../../6-building-blocks/H35-probabilistic-ds/), [H37 Data at scale](../../6-building-blocks/H37-data-at-scale/) (hot keys, feeds).
- Case study: [Distributed cache](../../case-studies/17-distributed-cache/README.md). LLD: [LRU cache](../../../lld/problems/02-lru-cache/README.md).
- Archive notes: [hld-parts/part1.md](../../../archive/notes/hld-parts/part1.md) ("Module 1.3: Caching Strategies"), [hld-parts/part8.md](../../../archive/notes/hld-parts/part8.md) ("Advanced Caching Strategies").
- Paper: "Scaling Memcache at Facebook" (NSDI 2013): leases against stampedes and stale sets.
