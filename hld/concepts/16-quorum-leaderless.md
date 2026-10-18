# 16 · Quorums and Leaderless Replication

> **Read time:** 30 min · **Visual:** [v08 quorum reads and writes](../../visuals/v08-quorum.html) · **Code it:** [hld/code/08-quorum-kv](../code/08-quorum-kv/README.md)
> **Shows up in:** key-value store, Cassandra/DynamoDB-style designs, distributed cache, shopping cart, metrics storage

## The idea in one line

There is no leader. The client writes to `W` of `N` replicas and reads from `R` of them. If `R + W > N`, every read set overlaps every write set, so at least one replica in the read has the latest write.

## The problem it solves

A single leader is a bottleneck for writes and a single point of failure until failover finishes. Leaderless replication (the Dynamo model) lets **any replica accept writes**, so the system stays available when some nodes are slow or down, and you can tune consistency per request.

## How it works

1. Each key has `N` replicas (its *preference list*, usually the next N distinct nodes on a [consistent hash ring](./14-consistent-hashing.md)).
2. **Write**: a coordinator sends the write to all N replicas and returns success after `W` acks.
3. **Read**: the coordinator asks the replicas (often all N, waiting for `R`) and returns the value with the **newest version**.
4. Versions come from timestamps (last-write-wins) or **version vectors** (detect concurrent writes).

```
N = 3, W = 2, R = 2          write v2            read
   A  ●  v2   <───────────── ack ✓        ───>  v2  ✓
   B  ●  v2   <───────────── ack ✓
   C  ●  v1   (slow, missed)               ───>  v1
                                    newest wins → return v2, repair C
```

### Keeping replicas in sync

- **Read repair**: the read sees C has an old version and writes v2 back to it.
- **Hinted handoff**: if C is down during the write, another node keeps a *hint* and replays it when C returns.
- **Anti-entropy**: a background job compares replicas using **Merkle trees** and copies only the ranges that differ.

### Sloppy quorum

If some of the N "home" nodes are unreachable, Dynamo writes to other healthy nodes instead (with hints). This keeps writes available, but **`R + W > N` no longer guarantees overlap**, because the W nodes may not be the home nodes. It improves availability, not consistency.

### Common settings

| N, W, R | Behaviour |
|---|---|
| 3, 2, 2 | Balanced; tolerates 1 slow/dead node for reads and writes. The usual default. |
| 3, 3, 1 | Fast reads; writes fail if any replica is down |
| 3, 1, 3 | Fast writes; reads fail if any replica is down |
| 3, 1, 1 | Fastest, highest availability, **no overlap**: eventual consistency only |

In Cassandra, `QUORUM` = `floor(RF/2) + 1`; `LOCAL_QUORUM` counts only replicas in the local data centre, so a write does not wait for another region.

### Conflicts

Two clients write the same key at the same time on different replicas. Options:

- **Last-write-wins (LWW)**: keep the highest timestamp. Simple. Silently drops one write; clock skew makes it worse. Cassandra does this.
- **Version vectors + siblings**: keep both values and let the app merge (Dynamo's shopping cart merged items).
- **CRDTs**: data types that merge without conflict (G-counter, OR-set). Riak, Redis Enterprise active-active.

## Numbers to remember

- Overlap rule: **`R + W > N`**. Fault tolerance for writes: `N − W` nodes can be down; for reads: `N − R`.
- `N = 3` with `W = R = 2` is the standard answer. Tolerates 1 failure on each path.
- Latency of a quorum op = the **W-th (or R-th) fastest replica**, so one slow node does not hurt; with `W = N` it does.
- With `RF = 3` across 3 AZs, `LOCAL_QUORUM` writes cost about one cross-AZ round trip (~1–2 ms).

## Trade-offs and when not to use it

| Option | Use when | Weakness |
|---|---|---|
| **Leaderless quorum** (Cassandra, DynamoDB internals, Riak, ScyllaDB) | High write throughput, always-writable, multi-AZ, simple key access | Conflicts, LWW data loss, no multi-key transactions, weaker guarantees than they look |
| Single leader + followers | Need transactions, strong reads from leader, simple model | Write bottleneck; failover window |
| Consensus (Raft/Paxos: etcd, CockroachDB, Spanner) | Need linearizability with automatic failover | Majority round trip on every write; leader per range |

**Quorum is not linearizability.** Even with `R + W > N`, a read that runs at the same time as a write can see the new value on one read and the old value on the next. Sloppy quorums and LWW also break it. For locks, unique allocation or money, use consensus or a single leader.

## In real systems

- **Amazon Dynamo (2007 paper)**: consistent hashing, N/R/W, sloppy quorum, hinted handoff, vector clocks, Merkle trees. The base of this whole card.
- **Cassandra / ScyllaDB**: per-query consistency level, LWW with cell timestamps, read repair, `nodetool repair` for anti-entropy.
- **DynamoDB** (the AWS service) is *not* the 2007 Dynamo; it uses Multi-Paxos leaders per partition. Good trap to know.
- **Riak**: siblings and CRDT data types.

## What to say in the interview

"For the key-value store I'll use leaderless replication with N = 3 replicas across 3 AZs, placed on a consistent hash ring. Writes and reads use quorum: W = 2, R = 2, so R + W > N and a read overlaps the latest write. One slow node doesn't block us. Missed writes are fixed by hinted handoff, read repair and a Merkle-tree anti-entropy job. Conflicts use last-write-wins for simple values; for a cart I'd keep version vectors and merge. If the interviewer needs strict linearizable reads, I'd move that data to a Raft-based store."

## Common follow-ups

<details><summary>Why not just use W = N for safety?</summary>

Then a single slow or dead replica blocks every write, and latency equals the slowest replica. You lose the main benefit of leaderless replication.
</details>

<details><summary>How does read repair know which value is newer?</summary>

Each value carries a version: a timestamp (LWW) or a version vector. With vectors, if one dominates the other it is newer; if neither dominates, they are concurrent and both are kept as siblings.
</details>

<details><summary>What does a Merkle tree save during anti-entropy?</summary>

Each replica hashes its key ranges into a tree. Two replicas compare root hashes, then walk down only the branches that differ. They transfer only the out-of-sync ranges instead of the whole dataset.
</details>

<details><summary>Multi-region: how do you avoid waiting for another region?</summary>

Use `LOCAL_QUORUM` for reads and writes and replicate to the other region asynchronously. You get local latency but cross-region reads can be stale, and concurrent writes in two regions are resolved by LWW.
</details>

## Self-test (answer before opening)

<details><summary>1. N = 5. Pick W and R so that reads see the latest write and 2 nodes can be down for both.</summary>

W = 3, R = 3. R + W = 6 > 5, and N − W = N − R = 2.
</details>

<details><summary>2. N = 3, W = 1, R = 1. What guarantee do you have?</summary>

Only eventual consistency. The read may hit a replica the write has not reached.
</details>

<details><summary>3. Why does a sloppy quorum weaken the R + W > N guarantee?</summary>

The W acks may come from fallback nodes outside the key's home N, so a read from R home nodes might not include any of them.
</details>

<details><summary>4. Two concurrent writes, LWW, clocks skewed by 50 ms. What can happen?</summary>

The write that really happened later can lose, because the other node's clock is ahead. The later write is silently dropped.
</details>

## Go deeper

- DDIA, chapter 5 (Replication): "Leaderless Replication", "Quorums for reading and writing", "Sloppy Quorums and Hinted Handoff", "Detecting Concurrent Writes"
- Amazon's Dynamo paper (2007), sections 4.5–4.8
- Older notes in this repo: `archive/notes/hld-parts/part1.md`, "Quorum Reads/Writes"; `archive/notes/hld-parts/part6b.md`, "1.2 Data Replication & Quorum"; `archive/notes/hld-parts/part8.md`, "2. Vector Clocks & Conflict Resolution", "3. Gossip Protocol for Membership"
- Practice: [Key-value store](../problems/04-key-value-store/README.md)
