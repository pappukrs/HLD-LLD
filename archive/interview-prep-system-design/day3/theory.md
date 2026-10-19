# SD Day 3 — Caching: Patterns, Eviction, Stampede
*(Jun 6, 2026 · ~1 hr · I run Redis in prod — this turns that into defensible decisions)*

---

## 1. Why cache — TWO wins, say both

1. **Latency**: Redis GET ~0.2ms vs DB indexed read ~5–10ms vs fat join ~50–500ms
2. **Load shedding** (the real reason): 95% hit ratio → DB sees **1/20th** of traffic.
   The DB is the hardest thing to scale; the cache is its bodyguard.

Anchor sentence: **cache = derived, disposable data; DB = source of truth.**
Every failure mode below is someone forgetting half of that sentence.

## 2. The five patterns

| Pattern | Flow | Wins | Bites |
|---|---|---|---|
| **Cache-aside** ⭐ (lazy) | app: miss → DB → SETEX · write: DB then **DEL** | default 90% case; only-requested data cached; cache death = slow, not down | miss penalty; staleness window |
| Read-through | cache layer itself loads from DB on miss | app code stays clean | needs smart cache/lib (plain Redis can't); CDNs ARE this |
| Write-through | write → cache + DB synchronously | never stale; read-after-write hits | double write latency; caches the never-read |
| **Write-behind** ⚠️ | write → cache only, async batch-flush to DB | huge write throughput (10k INCR → 1 UPDATE) | **cache dies pre-flush = data GONE** — only for losable data (views, likes, last-seen). NEVER money |
| Write-around | write → DB only; cache fills on read | write-heavy, rarely re-read (logs, audit) | first read always misses |

Cache-aside vs read-through one-liner: *same data flow, different owner — app loads vs cache loads.*

Judgment test they'll run: "write-behind for payments?" → **No. The ack must mean durable.**

## 3. Why DEL, not SET (the invalidation race)

Two concurrent writes can land their cache-SETs **out of order**:
DB ends at v2, cache stuck at v1 → **stale forever** (until next deploy).
DEL is idempotent — any ordering of DELs leaves the key empty; next read repopulates.

Senior honesty: even DEL has a rare race (slow read-miss SETs an old value back
after a write's DEL). Mitigations in order of practicality:
1. **TTL on everything** — staleness bounded even when all tricks fail
2. Delayed double-delete (DEL again ~500ms post-write)
3. CDC invalidation (Debezium tails the binlog → invalidates) — the "we got serious" tier

## 4. Eviction ≠ Expiry

- **Expiry (TTL)** = *I* chose the deadline. Removed lazily on access + active background sweep.
- **Eviction (maxmemory)** = *Redis* chooses under RAM pressure, per `maxmemory-policy`:

| Policy | Meaning | Use |
|---|---|---|
| `noeviction` | writes error when full | Redis as store/queue, never for cache |
| `allkeys-lru` | evict least-recently-used, any key | **cache mode** ⭐ |
| `volatile-lru` | LRU only among TTL'd keys | mixed store+cache (smell — separate instances) |
| `allkeys-lfu` | least-frequently-used (≥4.0) | survives scan pollution |
| `volatile-ttl` | soonest-expiring first | rare |

- **LRU vs LFU nugget**: a one-off batch scan touches 1M cold keys → LRU evicts your
  genuinely hot keys (**scan pollution**); LFU survives (one touch ≠ frequent).
- Redis LRU is **approximated** — samples ~5 random keys, evicts best candidate (true LRU too costly).
- ⚠️ Prod trap: sessions + cache in ONE Redis with `allkeys-lru` → users **randomly logged
  out** under memory pressure, looks like an auth bug. Separate instances.

## 5. The three horsemen — separated by WHAT misses

| | Trigger | Blast | Fixes |
|---|---|---|---|
| **Stampede** (dogpile) | ONE hot key expires | every in-flight request runs the same fat query | ① per-key mutex (`SET lock NX EX 5`, one rebuilds, rest wait/serve stale) ② **stale-while-revalidate** (serve old, refresh in bg) ③ jittered TTL ④ never-expire + cron refresh |
| **Avalanche** | MANY keys expire together, or the cache node dies | DB takes ~full traffic instantly | jittered TTL (`3600+rand(300)`); Redis HA (Sentinel/Cluster); **circuit breaker before the DB** — "serve some 503s rather than melt the DB" |
| **Penetration** | keys that exist NOWHERE (attack/bug) | nothing ever caches → every request reaches DB | ① negative caching (`SET k "NULL" EX 60`) ② Bloom filter of valid IDs ③ validate ID shape upfront |

> **Stampede = one hot key. Avalanche = many keys / whole cache. Penetration = keys that never existed.**

## 6. The cache ladder (caching is layered, not a box)

```
Browser → CDN → Nginx proxy_cache → in-process L1 (Node Map/LRU)
        → Redis L2 (shared) → DB buffer pool
```

L1+L2 = the hot-key fix: a 1-second in-process Map absorbs celebrity-key traffic
before it touches Redis. (Hot key / big key details: see redis-crash-course.md.)

## 7. My deep-dive ammo ⚠️

- I run **cache-aside with Redis in prod** (Node.js API gateway): DB-then-DEL, TTL on
  every key, JSON values under stable key conventions (`entity:id`).
- **Rate limiting** is also a cache-shaped problem I've done: INCR + EXPIRE (fixed
  window) — and I can sketch the ZSET sliding window upgrade.
- Stampede story to tell: "hot key + 300ms rebuild at 5k req/s = 1,500 identical
  queries hit the DB in the gap. Per-key `SET NX` lock or stale-while-revalidate."
- Eviction opinion: caches run `allkeys-lru` (or LFU if scans pollute); anything that
  must NOT vanish (sessions, queues) lives in a **separate** Redis with `noeviction`.

## 8. The diagram sentence

> "Cache-aside Redis in front of the DB — write to DB then **DEL** (not SET — ordering
> races), TTL with jitter as the staleness bound, `allkeys-lru`, per-key lock +
> stale-while-revalidate so hot-key expiry can't stampede the DB, negative caching
> for missing IDs."

---

### Half-page summary (the version to remember)

> Cache = derived disposable data, DB = source of truth. Default pattern: cache-aside —
> read: miss→DB→SETEX; write: DB then DEL (DEL not SET — concurrent SETs land out of
> order = stale forever; DEL is idempotent, TTL bounds the residual race).
> Write-through = sync both, never stale, slow writes. Write-behind = cache first +
> async flush, huge throughput, loses data if cache dies — counters yes, money never.
> Eviction: cache → allkeys-lru (LFU beats scan pollution; Redis LRU is sampled, not
> exact); expired ≠ evicted. Three horsemen: stampede = ONE hot key expires (per-key
> mutex / stale-while-revalidate), avalanche = MANY at once or cache death (TTL jitter,
> HA, circuit-break the DB), penetration = nonexistent keys (negative cache, Bloom
> filter). Caching is a ladder: CDN → Nginx → in-process L1 → Redis L2 → DB buffer pool.
