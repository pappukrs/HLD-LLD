# H15 · Replication

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/3-databases/H15-replication/demo.ts`)
> **Builds on:** [H07 Scaling and stateless services](../../2-scaling/H07-scaling-stateless/README.md) · [H12 Transactions and isolation](../H12-transactions-isolation/README.md) · [H14 SQL vs NoSQL](../H14-sql-vs-nosql/README.md) · **Used in:** Payment system, Digital wallet, Key-value store, Distributed cache, Chat system, News feed

## The idea in one line

Keep copies of the same data on several machines so you survive a machine loss and can serve more reads; the hard part is keeping the copies in step and deciding what readers see while they are not.

## Why it matters (the problem it solves)

One database server is one failure away from an outage, and one disk is one failure away from data loss. Replication gives you:

| Goal | How replication helps |
|---|---|
| **High availability** | A node dies, a copy takes over (failover). |
| **Durability** | A disk dies, the data still exists on other machines. |
| **Read scaling** | Spread reads across many copies. Most apps read 10–100x more than they write. |
| **Latency / geo** | Put a copy near the users (Mumbai, Frankfurt, Virginia). |

What it does **not** do: scale writes in the leader-follower model. Every write still goes to one leader, and every follower must replay every write. For write scale you partition ([H16](../H16-partitioning-sharding/README.md)).

Replication vs sharding, one line each:
- **Replication** copies the *same* data to many nodes.
- **Sharding** splits *different* data across nodes. Real systems do both: each shard is a small replica set.

## How it works

### 1. Three models

| Model | Writes go to | Examples | Main pain |
|---|---|---|---|
| **Single leader** (primary-replica) | One leader; followers replay its log | Postgres, MySQL, MongoDB replica set, Redis, Kafka partitions | Leader is a write bottleneck; failover is tricky |
| **Multi-leader** | Several leaders (often one per region) that sync with each other | MySQL/Postgres multi-primary (BDR), CouchDB, offline-first apps, collaborative editors | Write-write conflicts |
| **Leaderless** | Any replica; client writes to W of N, reads from R of N | Dynamo, Cassandra, Riak, ScyllaDB | Eventual consistency, read repair ([H19](../H19-quorum-merkle/README.md)) |

Single leader is the default and covers ~90% of interview answers. Learn it cold.

### 2. Single leader: the log is the whole trick

```
            writes
 client ───────────────▶ LEADER (AZ-a) ── WAL / binlog stream ──▶ follower 1 (AZ-b)
   │                        │                                └──▶ follower 2 (AZ-c)
   │                        └─ each entry has a position: LSN 41, 42, 43 ...
   └── reads ─────────────▶ followers (may be a little behind)
```

1. The leader appends every change to its log (Postgres **WAL**, MySQL **binlog**, MongoDB **oplog**).
2. It ships log entries to each follower over a long-lived connection.
3. Each follower replays the entries **in order** and records how far it got (its log position).
4. **Replication lag** = leader position minus follower position (in entries, bytes, or seconds).

Because followers replay the same ordered log, they always go through the same states as the leader, just later.

### 3. Sync vs async vs semi-sync (the core trade-off)

When the leader commits a write, does it wait for followers before telling the client "done"?

| Mode | Leader acks after | Write latency | Data loss if leader dies | Availability |
|---|---|---|---|---|
| **Async** | Its own disk has it | Lowest | Last few acked writes can be lost | High: slow followers do not block writes |
| **Semi-sync** | At least 1 follower has the entry | +1 network round trip (~0.5–2 ms in one region) | None, if that follower is promoted | MySQL falls back to async if the follower is too slow |
| **Fully sync** (all followers) | Every follower has it | Slowest follower decides | None | One slow or dead follower blocks every write |

The line to remember: **"Fully sync to all followers is impractical, because one slow follower halts every write. Fully async can lose the last writes on failover. So semi-sync, wait for one follower, is the usual production compromise."**

Config names:
- Postgres: `synchronous_standby_names = 'ANY 1 (s1, s2)'` + `synchronous_commit = on`.
- MySQL: semi-sync plugin, `rpl_semi_sync_source_wait_for_replica_count = 1`.
- AWS RDS Multi-AZ: synchronous standby in another AZ (not readable); read replicas are async.
- Aurora: storage-level quorum, 6 copies across 3 AZs, write quorum 4, read quorum 3.

Which data needs what:
- Money, orders, ledger entries: semi-sync or consensus. An acked payment must survive a crash.
- Likes, views, session data, analytics: async is fine.

### 4. Replication lag and the three anomalies

Async followers are usually milliseconds behind. Under heavy writes, a long query on the follower, or a big transaction, lag grows to seconds or minutes. Readers then see these problems:

| Anomaly | What the user sees | Fix |
|---|---|---|
| **Read-your-writes** violated | Updates profile, refreshes, sees the old name | Read from the leader for ~10 s after a write, or carry the write's LSN and read only from a replica that has reached it |
| **Monotonic reads** violated | Refresh twice; a comment appears, then disappears | Pin each user to one replica (`hash(userId) % replicas`) |
| **Consistent prefix** violated | A reply shows up before its question | Keep causally related writes in one partition / one ordered log |

LSN-based read-your-writes, step by step:

```
1. POST /profile      → leader commits at LSN 43 → returns LSN 43 to the app
2. app stores minLsn=43 in the user's session (cookie or Redis)
3. GET /profile       → router asks replicas: "replayed >= 43?"
       replica-2 at 43 → serve       replica-3 at 42 → skip
       none ready      → read from leader
```

Postgres gives you `pg_current_wal_lsn()` on the leader and `pg_last_wal_replay_lsn()` on a replica. MongoDB has this built in as "causal consistency" sessions.

### 5. Failover: when the leader dies

```
 detect                      choose                        reconfigure
 missed heartbeats  ──▶  most up-to-date follower  ──▶  point app + other followers
 for 10–30 s             (highest log position)          to the new leader; bump the term
```

1. **Detect.** The leader misses heartbeats for a timeout. Too short gives false failovers on a slow network. Too long means a longer write outage. This is a real trade-off, not a set-once config.
2. **Choose.** Promote the follower with the highest log position. Ideally use a majority-based election (Patroni on etcd/Consul, MongoDB's built-in Raft-like election, Redis Sentinel quorum).
3. **Reconfigure.** Update DNS, a proxy (PgBouncer, HAProxy, ProxySQL) or service discovery. The old leader must rejoin as a follower.

What goes wrong:

| Risk | What happens | Guard |
|---|---|---|
| **Lost writes** | With async, writes the old leader acked but never shipped are gone | Semi-sync; promote only a follower that has every acked write |
| **Split brain** | Old leader comes back, still thinks it is leader, accepts writes. Two leaders, divergent data | **Fencing**: every leader gets a higher term/epoch; storage and followers reject an older term. STONITH (shut the other node down) |
| **Divergent log** | Old leader had entries the new leader never got | On rejoin, it truncates entries past the common point and replays from the new leader |
| **Reused IDs** | Old leader's lost auto-increment IDs get handed out again by the new leader, clashing with IDs already copied into Redis or another system (GitHub's 2012 MySQL incident) | Do not use DB auto-increment as a global ID; see [H28](../../5-reliability/H28-unique-ids/README.md) |

### 6. Multi-leader and conflicts

Two regions accept a write to the same row at the same time. Who wins?

| Strategy | How | Cost |
|---|---|---|
| **Avoid** | Each user/account has a home region; all its writes go there | Cross-region latency for travellers |
| **Last write wins (LWW)** | Highest timestamp wins | Silently drops a write; clock skew can let an older write win |
| **Merge** | CRDTs (counters, sets, text), or app logic (keep both, ask the user) | More complex data types |

Rule for interviews: **never multi-leader writes on money.** Use a home region per account or a consensus database.

### 7. How the log is shipped

| Method | What is sent | Notes |
|---|---|---|
| **Physical / WAL shipping** | Byte-level page changes | Fast. Replicas must run the same DB major version. Postgres streaming replication. |
| **Logical (row-based)** | "Row id=7 changed to {...}" | Works across versions; powers **CDC** (Debezium reads the WAL/binlog into Kafka). MySQL row-based binlog, Postgres logical replication. |
| **Statement-based** | The SQL text | Breaks with `NOW()`, `RAND()`, triggers. Mostly obsolete. |

### 8. Consensus-replicated databases

Spanner, CockroachDB, TiDB, YugabyteDB, etcd and Kafka KRaft replicate each log entry with Raft or Paxos. A write commits once a **majority** has it. You get strong consistency and automatic, split-brain-free failover. The cost: write latency is a majority round trip, and a minority side of a partition cannot write ([H29](../../5-reliability/H29-consensus-locks/README.md)).

### 9. Replication is not a backup

A bad `DELETE FROM payments` is replayed on every follower within milliseconds. Replication copies mistakes too. Keep backups with **point-in-time recovery (PITR)**: a nightly base backup plus archived WAL, so you can restore to "one second before the bad statement". Optionally keep a **delayed replica** (MySQL `SOURCE_DELAY = 3600`) as a 1-hour safety net.

## In TypeScript

A read router that gives read-your-writes using log positions (full simulation in [demo.ts](demo.ts)):

```ts
type Replica = { name: string; appliedLsn: number };

class ReadRouter {
  constructor(private leader: Replica, private replicas: Replica[]) {}

  // After a write, the app stores the leader's LSN in the user's session.
  pick(minLsn: number, userId: string): Replica {
    // Monotonic reads: start from the user's "home" replica.
    const start = hash(userId) % this.replicas.length;
    for (let i = 0; i < this.replicas.length; i++) {
      const r = this.replicas[(start + i) % this.replicas.length];
      if (r.appliedLsn >= minLsn) return r;   // caught up: safe to read
    }
    return this.leader;                      // nobody caught up: read the leader
  }
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
```

Semi-sync commit, in one function:

```ts
async function commit(entry: LogEntry): Promise<void> {
  leader.append(entry);                          // 1. leader's own log
  const acks = followers.map((f) => f.ship(entry));
  if (mode === 'semi-sync') await Promise.any(acks); // 2. wait for ONE follower
  // async: do not wait at all; fully sync would be Promise.all(acks)
}
```

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Single leader, async | Default for most apps, read scaling | May lose last writes on failover; stale replica reads |
| Single leader, semi-sync | Payments, orders, ledgers (RPO ≈ 0) | +1 RTT per commit; falls back to async under stress (MySQL) |
| Multi-leader | Multi-region writes, offline clients, collaborative editing | Conflict resolution; never for balances |
| Leaderless quorum | Very high write availability, multi-DC, tunable consistency | Eventual consistency, read repair, hinted handoff, harder reasoning |
| Consensus (Raft/Paxos) | Strong consistency + automatic failover | Majority must be reachable; write latency = quorum RTT |

When NOT to reach for more replicas:
- **Write-heavy load.** Replicas do not add write capacity. Shard instead.
- **Strong read-after-write everywhere.** If every read must be fresh, replicas buy little; read from the leader or use a consensus DB.
- **Too many replicas.** Each one costs leader CPU and network for log shipping. A handful (2–5, up to ~15 on Aurora) is normal.
- **Cross-region sync replication** on a hot write path: 60–200 ms on every commit.

## Common mistakes

- Saying "add read replicas" to fix a **write** bottleneck.
- Ignoring replication lag, then having the UI show stale data right after a save.
- Calling async replication "safe" for payments. An acked write can vanish on failover.
- Describing failover without **split brain** and **fencing**.
- Picking a failover timeout without explaining the trade-off (false alarms vs downtime).
- Using LWW for conflicts without mentioning that it drops data and depends on clocks.
- Treating replicas as backups. They replicate the bad `DELETE` too.
- Mixing up replication and sharding, or forgetting that each shard is itself replicated.

## Say this in the interview

> "Replication keeps the same data on several nodes for availability, durability and read scale. It is different from sharding, which splits different data. My default is single leader: one primary takes writes and streams its WAL to two replicas in other AZs. Replicas serve reads, so reads scale, but writes still go through one node."

> "The core choice is sync vs async. Async is fast but can lose the last acked writes if the leader dies. Fully sync stalls on the slowest follower. For the payments database I use semi-sync: a commit waits for one replica, so an acked payment is on two machines. Analytics and feeds can stay async."

> "Async means lag. For read-your-writes, I return the commit LSN, keep it in the session, and only read from a replica that has replayed it, else the primary. I pin users to one replica for monotonic reads. On failover, Patroni with etcd promotes the most up-to-date replica and bumps the term, so the old primary is fenced and cannot cause split brain. And replication is not a backup: we keep PITR from base backups plus archived WAL."

## Your experience hook

- **Read replicas at work:** moved dashboards, reports and list views to replicas to take load off the primary; writes and read-after-write paths stayed on the primary. Hit the classic lag bug: a user saved a record and the immediate re-fetch from a replica showed old data. Fixed it by routing read-after-write to the primary for that request, which is **read-your-writes**.
- **Redis primary-replica:** Redis replication is async by default, so on failover the last writes can be lost. That decided what Redis could hold as a source of truth (idempotency keys, locks) vs what was only a cache.
- **MongoDB replica sets:** automatic primary election, and `readPreference: secondaryPreferred` to send analytics reads to secondaries. Same leader-follower model, different names.

## Numbers to remember

| Fact | Number |
|---|---|
| Async lag in one region, normal load | < 1 s, often a few ms |
| Async lag under heavy writes / long queries | seconds to minutes |
| Semi-sync cost in one region | +0.5–2 ms per commit (one AZ-to-AZ round trip) |
| Cross-region sync cost | Mumbai ↔ Singapore ~60–70 ms, India ↔ US East ~200+ ms per commit |
| Failure detection timeout | typically 10–30 s; RDS Multi-AZ failover ~60–120 s |
| Common setup | 1 leader + 2 followers across 3 AZs (survives losing 1 AZ) |
| Aurora storage | 6 copies over 3 AZs, write quorum 4, read quorum 3 |
| Read replicas per primary | 5 on RDS MySQL/Postgres, 15 on Aurora |

## Self-test

<details><summary>1. Does adding read replicas help a write-heavy system?</summary>

No. All writes still go to one leader, and every replica must replay every write. You need partitioning for write scale.
</details>

<details><summary>2. A user changes their name and the next page shows the old name. Name the problem and two fixes.</summary>

Read-your-writes is violated because the read hit a lagging async replica. Fix 1: read that user's data from the leader for a few seconds after a write. Fix 2: return the write's LSN, keep it in the session, and only read from a replica whose replayed LSN is at least that.
</details>

<details><summary>3. Why can async replication lose a write the client was told succeeded?</summary>

The leader acked after writing only to its own disk. If it crashes before shipping the entry, the promoted follower never had it, so the write is gone.
</details>

<details><summary>4. Why not make replication fully synchronous to all followers?</summary>

The slowest follower then decides write latency, and one dead or slow follower blocks every write. Semi-sync (wait for one follower) gives no loss with one failure and keeps latency low.
</details>

<details><summary>5. What is split brain, and how do you prevent it?</summary>

Two nodes both act as leader and accept writes, so the data diverges. Prevent it with a majority-based election (Raft, etcd, ZooKeeper) and fencing: each new leader gets a higher term, and followers or storage reject anything with an older term. STONITH kills the old node outright.
</details>

<details><summary>6. What is monotonic reads, and how do you get it?</summary>

A user never sees data go backwards in time between two reads. It breaks when consecutive reads hit replicas with different lag. Pin each user to one replica, for example by hashing the user id.
</details>

<details><summary>7. Someone ran a bad DELETE on production. Can a replica save you?</summary>

No. The delete is replayed on every replica within milliseconds. You need backups with point-in-time recovery (base backup + archived WAL), or a delayed replica.
</details>

<details><summary>8. Multi-region active-active for a wallet. How do you handle writes?</summary>

Avoid multi-leader writes on the same account. Give each account a home region and send all its writes there, or use a consensus database (Spanner, CockroachDB) and accept cross-region commit latency. Reads can be served locally.
</details>

## Go deeper

- Next: [H16 Partitioning and sharding](../H16-partitioning-sharding/README.md), [H18 CAP, PACELC and consistency](../H18-cap-pacelc-consistency/README.md), [H19 Quorums and leaderless replication](../H19-quorum-merkle/README.md), [H29 Consensus and leader election](../../5-reliability/H29-consensus-locks/README.md)
- Labs: [lab-quorum-kv](../H19-quorum-merkle/lab-quorum-kv/README.md) (the leaderless variant, in code)
- Case studies: [Payment system](../../case-studies/08-payment-system/README.md), [Digital wallet](../../case-studies/28-digital-wallet/README.md), [Key-value store](../../case-studies/04-key-value-store/README.md), [Distributed cache](../../case-studies/17-distributed-cache/README.md)
- Archive notes: [hld-parts/part2.md](../../../archive/notes/hld-parts/part2.md) (Module 2.3: Database Replication), [DB/shardening_partitioning_replication.md](../../../archive/notes/DB/shardening_partitioning_replication.md)
- DDIA chapter 5 (Replication); Amazon Aurora paper (SIGMOD 2017); GitHub's 2012 MySQL failover post-mortem
