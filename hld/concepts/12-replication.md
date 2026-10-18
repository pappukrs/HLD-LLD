# 12 · Replication

> **Read time:** 35 min · **Visual:** [v05 leader-follower replication](../../visuals/v05-replication.html) · **Code it:** [hld/code/08-quorum-kv](../code/08-quorum-kv/README.md) (leaderless variant)
> **Shows up in:** every design with a database: read scaling, failover, multi-region, payment system durability, distributed cache, key-value store

## The idea in one line

Keep copies of the same data on several machines, so you survive a machine loss and can serve more reads. The hard part is keeping the copies in step and deciding what readers see while they are not.

## The problem it solves

- **Availability**: one DB server dies → you have another with the data.
- **Durability**: a disk dies → the data still exists elsewhere.
- **Read scale**: spread reads over many copies.
- **Latency**: a copy near users in another region.

Replication does **not** scale writes in the leader-follower model: every write still goes to one leader. For write scale you need partitioning (see [13](./13-partitioning-sharding.md)).

## How it works

### Three models

| Model | Writes go to | Examples |
|---|---|---|
| **Single leader** (primary-replica) | One leader; followers apply its log | Postgres, MySQL, MongoDB replica set, Redis, Kafka partitions |
| **Multi-leader** | Several leaders (often one per region), which sync with each other | MySQL/Postgres multi-primary setups, CouchDB, collaborative editors |
| **Leaderless** | Any replica; client writes to W of N, reads from R of N | Dynamo, Cassandra, Riak (see [16](./16-quorum-leaderless.md)) |

### Single leader: the default

```
          writes
client ──────────▶ LEADER ──WAL/binlog stream──▶ follower 1 (AZ-b)
   │                                       └───▶ follower 2 (AZ-c)
   └── reads ──▶ followers (may be slightly behind)
```

The leader writes to its log (Postgres WAL, MySQL binlog) and ships it to followers, which replay it.

### Sync vs async

| Mode | Leader commits when | Good | Bad |
|---|---|---|---|
| **Synchronous** | Follower confirms it has the write | No data loss on leader failure | Write latency up; a slow follower blocks writes |
| **Asynchronous** | Leader's own disk has it | Fast writes | Leader dies → last writes may be lost |
| **Semi-sync** (one sync follower, rest async) | At least one follower confirms | No loss with one failure, OK latency | Still more latency than async |

Postgres: `synchronous_standby_names` + `synchronous_commit`. MySQL: semi-sync plugin. Managed: AWS RDS Multi-AZ keeps a synchronous standby; Aurora writes to a quorum of storage nodes (4 of 6 copies across 3 AZs).

### Replication lag and its anomalies

Async followers are behind by milliseconds normally, and by seconds or minutes under load. Readers then see:

| Problem | Example | Fix |
|---|---|---|
| **Read-your-writes** | User updates profile, refreshes, sees the old name | Read from the leader for that user for a few seconds after a write; or wait until the replica reaches the write's log position |
| **Monotonic reads** | Two refreshes hit different replicas; a comment appears then disappears | Pin a user's reads to one replica (hash user id) |
| **Consistent prefix** | A reply shows up before the question | Keep causally related writes in the same partition / ordered log |

### Failover

1. **Detect**: the leader misses heartbeats for some timeout (e.g. 10–30 s).
2. **Choose**: promote the most up-to-date follower (by log position).
3. **Reconfigure**: clients and other followers point to the new leader (DNS / proxy / service discovery update).

Risks:

- **Lost writes**: with async replication, writes the old leader had not shipped are gone. GitHub's 2012 MySQL incident is a known example where a stale replica's promotion caused data problems.
- **Split brain**: the old leader comes back and still accepts writes. Two leaders → conflicting data. Fix: fencing (STONITH, epoch/term numbers that the storage rejects if old), or consensus-based election (Raft in etcd, Patroni using etcd/Consul for Postgres).
- **Timeout tuning**: too short → needless failovers on a slow network; too long → long outage.

### Multi-leader and conflicts

Two regions accept writes to the same row → conflict. Strategies:

- **Avoid**: route all writes for a given user to one "home" region.
- **Last write wins (LWW)** by timestamp: simple, silently drops data; clock skew makes it worse.
- **Merge**: CRDTs (counters, sets), or app logic (keep both, ask the user).

### How the log is shipped

- **Physical / WAL shipping**: byte-level page changes. Fast, but replicas must run the same DB version.
- **Logical (row-based)**: "row X changed to Y". Works across versions and powers **CDC** (Debezium reads the binlog/WAL into Kafka).
- **Statement-based**: replays SQL. Breaks with `NOW()`, `RAND()`; mostly obsolete.

## Numbers to remember

- Typical async lag in one region: under 1 s, often milliseconds. Under heavy writes or big transactions: seconds to minutes.
- Cross-region sync replication adds a full round trip per commit: Mumbai ↔ Singapore ~60–70 ms, India ↔ US ~200+ ms.
- Common setup: 1 leader + 2 followers across 3 AZs. Survives one AZ failure.
- Read replicas scale reads roughly linearly until replication itself (leader log shipping, replay) becomes the bottleneck. A handful (up to ~5–15 depending on engine) is common.

## Trade-offs and when not to use it

| Option | Use when | Weakness |
|---|---|---|
| Single leader, async | Default for most apps | Possible loss of last writes on failover; stale replica reads |
| Single leader, semi-sync / sync standby | Payments, ledgers (RPO ≈ 0) | Higher write latency |
| Multi-leader | Multi-region writes, offline clients | Conflict resolution is hard; avoid for money |
| Leaderless quorum | High availability for writes, multi-DC | Eventual consistency, read repair, more complex reasoning |
| Consensus-replicated (Raft/Paxos: Spanner, CockroachDB, etcd) | Strong consistency + automatic failover | Majority must be reachable; write latency = quorum RTT |

## In real systems

- **AWS RDS Multi-AZ**: synchronous standby in another AZ, automatic failover in about a minute or two; read replicas are async.
- **Aurora**: storage-level quorum (6 copies, write quorum 4, read quorum 3) across 3 AZs.
- **Patroni** for Postgres: leader election through etcd/Consul, avoids split brain.
- **Kafka**: each partition has a leader and followers; the ISR decides what counts as committed (see [18](./18-kafka-deep-dive.md)).
- **Redis**: async replication with Sentinel or Cluster failover; acknowledged writes can be lost during failover.

## What to say in the interview

"The payments DB is Postgres with one primary and two replicas in three AZs. One replica is synchronous, so a committed payment survives losing the primary; the other is async and serves reads. Failover uses Patroni with etcd, so we don't get split brain. Reads that must see the user's own write, like 'payment status right after paying', go to the primary for a short window; dashboards and history read from replicas and can be a second behind."

## Common follow-ups

<details><summary>How do you detect and handle replication lag?</summary>

Measure it: Postgres `pg_stat_replication` (replay lag), MySQL `Seconds_Behind_Source`. Alert on it. Route reads away from a replica that is too far behind. For read-your-writes, store the leader's log position (LSN) after a write and only read from a replica that has reached it, or read from the leader.
</details>

<details><summary>What is split brain and how do you prevent it?</summary>

Two nodes both think they are the leader and both accept writes. Prevent with a majority-based election (Raft, ZooKeeper, etcd), fencing tokens (a growing epoch number that storage checks), and cutting off the old leader (STONITH) before promotion.
</details>

<details><summary>Replication vs backups: do you need both?</summary>

Yes. Replication copies mistakes too: a bad `DELETE` is applied on every replica within milliseconds. Backups and point-in-time recovery (base backup + archived WAL) let you go back in time.
</details>

<details><summary>Multi-region active-active for a payment system?</summary>

Avoid multi-leader writes on the same account. Give each account a home region and route writes there, or use a consensus-replicated DB and accept cross-region write latency. Reads can be served locally.
</details>

## Self-test (answer before opening)

<details><summary>1. Does adding read replicas help a write-heavy system?</summary>

No. Every write still goes to the leader, and every replica must replay all writes. You need partitioning for write scale.
</details>

<details><summary>2. A user changes their name and the next page shows the old name. Name the problem and one fix.</summary>

Read-your-writes violation due to replication lag. Read that user's profile from the leader for a few seconds after a write, or wait for the replica to reach the write's LSN.
</details>

<details><summary>3. Why can async replication lose committed data on failover?</summary>

The leader acknowledged the commit after writing only to its own disk. If it dies before shipping the change, the promoted follower never had it.
</details>

<details><summary>4. What is the main risk of last-write-wins?</summary>

Concurrent writes are silently dropped, and clock skew between nodes can make an older write "win".
</details>

## Go deeper

- Concepts: [13 partitioning and sharding](./13-partitioning-sharding.md), [15 CAP, PACELC and consistency](./15-cap-pacelc-consistency.md), [16 quorum and leaderless](./16-quorum-leaderless.md), [30 consensus and coordination](./30-consensus-coordination.md), [36 deployment and multi-region](./36-deployment-multi-region.md)
- Visuals: [v07 CAP under a partition](../../visuals/v07-cap-partition.html), [v18 Raft leader election](../../visuals/v18-raft-leader-election.html)
- DDIA, chapter 5 (Replication): "Leaders and Followers", "Problems with Replication Lag", "Multi-Leader Replication"
- Amazon Aurora paper (SIGMOD 2017)
- Older notes in this repo: `archive/notes/hld-parts/part2.md`, "Module 2.3: Database Replication" ("Replication Modes", "Replication Lag", "Failover & Promotion", "Multi-Region Replication"); `archive/notes/DB/shardening_partitioning_replication.md`
