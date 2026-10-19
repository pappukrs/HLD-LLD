# Redis Crash Course (interview-focused reference)

## What it is, really
A single-threaded, in-memory key-value server. All data lives in RAM → reads/writes
are ~0.1ms (vs ~10ms+ disk DB). Single-threaded = every command is ATOMIC by
nature — no locks needed for INCR, no race between two app servers. That
atomicity is why half of distributed-systems patterns are "just use Redis."

~100k+ ops/sec on one node. It's fast because: RAM + no locks + simple data
structures + everything is O(1) or O(log n) by design.

## Data structures = use cases (THE interview table)

| Structure | Commands | Classic use case |
|-----------|----------|------------------|
| String | GET/SET/INCR/SETEX | cache, counters, rate limiting (INCR + TTL), distributed locks (SET NX EX) |
| Hash | HSET/HGET/HGETALL | object cache (user profile = one hash), session data |
| List | LPUSH/RPOP/BRPOP | simple queues (BullMQ sits on this), latest-N feeds |
| Set | SADD/SISMEMBER/SINTER | unique visitors, tags, mutual friends (SINTER) |
| Sorted Set (ZSET) | ZADD/ZRANGE/ZRANK | **leaderboards, ranking, sliding-window rate limiter, delayed jobs** (score = timestamp) |
| Streams | XADD/XREADGROUP | Kafka-lite: consumer groups, at-least-once delivery |
| Pub/Sub | PUBLISH/SUBSCRIBE | fire-and-forget fan-out — Socket.io adapter (NO persistence: offline subscriber = message lost) |

Interview gold: "leaderboard" → ZSET. "rate limit" → INCR+TTL or ZSET window.
"queue" → List/Streams. "who's online" → Set with TTL keys.

## TTL & eviction
- Any key can expire: `SET k v EX 3600`. Expiry is lazy + active background sweep.
- RAM full → eviction policy: `noeviction` (errors), `allkeys-lru` (cache mode ✅),
  `volatile-lru` (only keys WITH TTL). Cache → allkeys-lru. Session store → don't
  let it evict silently; size it properly.

## Persistence (it's RAM — what if it restarts?)
- **RDB**: snapshot every N min. Fast restart, loses last minutes.
- **AOF**: append every write to a log (fsync every sec). Slower restart, loses ≤1s.
- Common prod: both, or RDB-only for pure caches (losing a cache is fine).
- Interview line: "Redis persistence is for faster warm-up, not durability
  guarantees — if data MUST survive, the source of truth is the database."

## High availability & scaling
- **Replication**: leader → replicas (async). Replicas serve reads.
- **Sentinel**: watches the leader, auto-promotes a replica on failure (HA for one shard).
- **Cluster**: data SHARDED across nodes by key-hash (16384 slots). Horizontal
  scaling. Gotcha: multi-key ops (SINTER, MULTI) only work if keys are on the
  same node → hash tags `{user:1}:profile`, `{user:1}:cart` force co-location.
- Async replication ⇒ failover can lose the last writes — Redis is CP-ish for
  speed, not a strongly consistent store.

## The 4 patterns you'll draw in interviews

**1. Cache-aside (the default)**
```
read:  GET key → hit? return : (query DB → SETEX key ttl val → return)
write: update DB → DEL key       (delete, don't update — avoids races)
```

**2. Atomic rate limiter**
```
n = INCR user:123:minute ;  if n == 1: EXPIRE key 60 ;  allow if n <= 100
```

**3. Distributed lock**
```
SET lock:job42 myId NX EX 30   → got it? do work. Release: check-id-then-DEL (Lua).
```
(NX = only if not exists; EX = auto-release if holder crashes. Redlock exists
for multi-node but is debated — say "for critical correctness I'd use the DB,
locks in Redis are for efficiency.")

**4. Pub/sub fan-out across instances** — what the Socket.io Redis adapter does:
every app instance subscribes; any instance publishes; all instances forward to
their connected clients. Solves "WebSocket = state pinned to one server."

## Failure modes (senior-level talking points)
- **Cache stampede**: hot key expires → 1000 requests hit DB simultaneously.
  Fixes: per-key mutex lock ("one rebuilds, rest wait"), stale-while-revalidate,
  jittered TTLs so keys don't expire together.
- **Hot key**: one celebrity key takes all traffic on one shard → replicate hot
  keys to N copies (`key:1..N`, read random), or local in-process L1 cache.
- **Big key**: a 50MB list — single-threaded Redis blocks everyone while reading
  it. Never store blobs; split big collections.
- **Cache/DB inconsistency**: there is no transaction across Redis+DB. Accept
  brief staleness (TTL bounds it), or CDC (DB change events update cache).
- **KEYS * in prod** blocks the whole server (single thread!) → use SCAN.

## One-liner summary
> Redis = shared, atomic, in-memory data structures over the network. Fast
> because RAM + single thread; useful because atomic; dangerous because RAM is
> finite, replication is async, and one slow command blocks everything.
