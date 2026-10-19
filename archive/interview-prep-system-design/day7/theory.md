# SD Day 7 — Replication: leader-follower, sync vs async, read replicas

*(Jun 15, 2026 · ~1 hr · the first "distributed data" topic — replication is the foundation under read-scaling, HA, and the consistency tradeoffs you'll hit in CAP (Day 9). My war story: read replicas + the replication-lag bug.)*

---

## 1. What replication is — and the two reasons you do it

**Replication = keeping a copy of the same data on multiple machines.** That's it. Don't
confuse it with **sharding** (Day 8) — sharding splits *different* data across machines;
replication copies the *same* data. Real systems do both.

You replicate for exactly **three** reasons — say them out loud:

1. **High availability** — a node dies, a copy takes over. No single point of failure.
2. **Read scaling** — fan reads out across many copies (the one most apps actually need).
3. **Latency / geo** — put a copy near the user (replica in Mumbai, replica in Frankfurt).

> The hard part is never "make a copy." It's **keeping copies in sync** when writes happen,
> machines fail, and the network drops. Everything below is about that.

## 2. Leader-follower (primary-replica) — the default model

- **One leader** (primary/master) takes **all writes**.
- **N followers** (replicas/secondaries) get a stream of those writes and serve **reads only**.
- Writes go leader → followers via a **replication log** (Postgres: WAL; MySQL: binlog).

This is the model behind Postgres streaming replication, MySQL replication, MongoDB replica
sets, Redis primary-replica. Learn this cold — it's ~90% of interview answers.

```
        writes
clients ──────▶ [ LEADER ] ──repl log──▶ [ follower 1 ] ◀── reads
                    │                  └─▶ [ follower 2 ] ◀── reads
                    └─ reads (optional)    [ follower 3 ] ◀── reads
```

Other topologies exist — flag them, don't dwell:
- **Multi-leader** — multiple nodes accept writes (multi-datacenter, offline editing). Power:
  write availability everywhere. Pain: **write-write conflicts** need resolution.
- **Leaderless** (Dynamo/Cassandra) — any node takes writes, **quorum** reads/writes (R + W > N)
  reconcile. Day 9/15 territory; just name it.

## 3. Sync vs async vs semi-sync — THE tradeoff (this is the topic)

When the leader commits a write, does it wait for followers?

| | Leader waits for follower ack? | Durability | Write latency | Risk |
|---|---|---|---|---|
| **Synchronous** | Yes, before confirming to client | Strong — no data loss on leader death | High (bounded by slowest follower) | One slow/dead follower **stalls all writes** |
| **Asynchronous** | No — confirms immediately, ships later | **Can lose recent writes** if leader dies before shipping | Low (fast) | Default in most systems; you accept tiny data-loss window |
| **Semi-sync** | Waits for **at least one** follower | Good middle | Medium | The common production pick |

> The exam line: **"Fully synchronous to all followers is impractical — one slow follower
> halts every write. Fully async risks losing the last few writes on failover. So semi-sync —
> wait for one follower — is the usual production compromise."**

Concrete: leader confirms a payment async, then crashes before the write reached any follower
→ that payment is **gone** on failover. That's why money paths lean sync/semi-sync; "like
counts" stay async.

## 4. Replication lag — the bug that bites everyone

Async replication means followers are **behind** the leader by some delay (ms → seconds under
load). This breaks **read-your-own-writes**:

> User updates their profile (write → leader), immediately reloads (read → a follower that
> hasn't caught up) → **sees the old data**. "I saved it but it didn't save!"

This is the single most common replication bug in interviews **and** in prod. Fixes — know
the names:

1. **Read-your-writes consistency** — after a user writes, route *that user's* reads to the
   leader (or to a replica known caught-up) for a short window. Most common fix.
2. **Monotonic reads** — pin a user to one replica so they never see time go backwards
   (replica A is fresh, replica B is stale → bouncing between them shows data flip-flopping).
3. **Track a write position** (LSN/log offset) and only read from a replica that's reached it.

> Naming "read-your-writes" and "monotonic reads" unprompted is a strong senior signal.

## 5. Failover — what happens when the leader dies

1. **Detect** — leader stops heartbeating (timeout-based; too short = false alarms, too long =
   downtime).
2. **Elect** — pick a new leader, ideally the **most up-to-date** follower (smallest lag).
3. **Reconfigure** — point writes + other followers at the new leader; old leader rejoins as a
   follower when it returns.

The three things that go wrong (mention these — they show you've felt the pain):
- **Lost writes** — async writes not yet shipped die with the old leader (worse if those LSNs
  were already used elsewhere, e.g. an auto-increment ID handed to Redis).
- **Split-brain** — old leader comes back thinking it's still leader, two leaders take writes →
  divergent data. Guard: **fencing** (STONITH / a fence token) so only one can win.
- **Timeout tuning** — the detect window is a genuine tradeoff, not a config you set once.

## 6. Where I've touched this in prod (war stories)

> **Read replicas for scale.** "We pushed reads to replicas to take load off the primary —
> dashboards, reports, list views hit replicas; writes and read-after-write paths hit the
> primary. Cut primary load substantially. The catch we hit: **replication lag** — a user
> updated a record and the immediate re-fetch from a replica showed stale data. Fixed it by
> routing read-after-write to the primary for that request, classic **read-your-writes**."

> **Redis primary-replica.** "Redis replication is async by default — on failover you can lose
> the last writes. For anything that had to survive (vs pure cache) that informed whether we
> leaned on it as source of truth." (Ties to Day 3 caching + Redis crash course.)

> **MongoDB replica sets** (pre-migration) — automatic primary election + `readPreference` to
> send analytics reads to secondaries. Same leader-follower model under a different name.

## 7. The interview line

> "Replication = same data on multiple nodes, for availability, read-scaling, and geo-latency
> — distinct from sharding, which splits different data. Default model is leader-follower: one
> node takes writes, streams a log to read-only followers. The core tradeoff is sync vs async:
> sync is durable but one slow follower stalls writes; async is fast but loses recent writes on
> failover — so semi-sync (wait for one) is the usual compromise. Async means replication lag,
> which breaks read-your-own-writes — I fix that by routing a user's post-write reads to the
> primary. On failover you worry about lost async writes and split-brain, which fencing guards
> against. I lived this scaling reads onto replicas and hitting the lag bug."

---

### Half-page summary (the version to remember)

> Replication = same data copied to multiple nodes (≠ sharding = different data split across
> nodes). Three reasons: HA, read-scaling, geo-latency. Default model = **leader-follower**:
> one leader takes all writes + streams a replication log (WAL/binlog) to read-only followers.
> Also multi-leader (write anywhere, conflict resolution) and leaderless/quorum (Cassandra).
> **The tradeoff = sync vs async**: sync = durable, no data loss, but a slow follower stalls
> all writes; async = fast, but loses recent writes on leader death → **semi-sync (wait for
> one)** is the production compromise. Async → **replication lag** → breaks read-your-writes
> (save then reload shows stale data); fixes = read-your-writes (post-write reads to leader),
> monotonic reads (pin to one replica), track LSN. Failover = detect (heartbeat timeout) →
> elect most-current follower → reconfigure; risks = lost async writes, **split-brain** (guard
> with fencing), timeout tuning. War story: pushed reads to replicas for scale, hit the lag
> bug, fixed with read-your-writes to primary; Redis/Mongo replication are the same model.
