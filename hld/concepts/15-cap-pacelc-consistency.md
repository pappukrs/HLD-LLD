# 15 · CAP, PACELC and Consistency Models

> **Read time:** 35 min · **Visual:** [v07 CAP under a network partition](../../visuals/v07-cap-partition.html) · **Code it:** [hld/code/08-quorum-kv](../code/08-quorum-kv/README.md)
> **Shows up in:** every design with replicas: payments, wallets, booking, chat, key-value store, distributed cache, multi-region

## The idea in one line

When the network splits, a replicated system must choose between answering (availability) and answering correctly (consistency). When the network is fine, it still chooses between low latency and consistency.

## The problem it solves

As soon as data has more than one copy, two clients can see different values. You need words to say **how stale** a read may be and **what happens during a failure**. CAP and PACELC give the failure-time and normal-time choice. Consistency models give the exact promise to the client.

## How it works

### CAP (Brewer, proved by Gilbert and Lynch, 2002)

- **C (consistency)** here means **linearizability**: every read sees the latest completed write, as if there is one copy.
- **A (availability)**: every request to a non-failed node gets a non-error response.
- **P (partition tolerance)**: the system keeps working when messages between nodes are lost.

Partitions happen in any real network, so P is not optional. The real choice is **during a partition: C or A**.

- **CP**: the minority side refuses writes (or reads) to stay correct. Examples: ZooKeeper, etcd, HBase, Spanner, a single-leader DB with synchronous failover.
- **AP**: every side keeps accepting requests and reconciles later. Examples: Cassandra / DynamoDB at low consistency levels, Riak, DNS, CDN caches.

### PACELC (Abadi, 2010)

"If **P**artition, choose **A** or **C**; **E**lse (normal operation), choose **L**atency or **C**onsistency."

| System | P: A or C | E: L or C |
|---|---|---|
| Cassandra, DynamoDB (default) | A | L |
| MongoDB (majority writes) | C | C |
| Spanner, CockroachDB | C | C (pays with commit wait / consensus latency) |
| Postgres + async replicas, read from replicas | A-ish | L |

PACELC is more useful in interviews, because partitions are rare but latency is always there.

### Consistency models (strongest to weakest)

| Model | Promise | Typical way to get it |
|---|---|---|
| **Linearizable** | Behaves like one copy; a read after a write completes sees it, for everyone | Single leader + consensus (Raft/Paxos), quorum with `R+W>N` plus read repair* |
| **Sequential** | All see the same order, but not tied to real time | Total-order broadcast |
| **Causal** | If A caused B, everyone sees A before B | Version vectors, session tracking |
| **Read-your-writes** | You always see your own writes | Read from leader after a write; sticky sessions; version token |
| **Monotonic reads** | You never see time go backwards | Pin a user to one replica |
| **Eventual** | If writes stop, replicas converge | Async replication, anti-entropy |

*Quorums alone are not always linearizable (sloppy quorums, concurrent writes). See [16 quorums](./16-quorum-leaderless.md).

**Two different "C"s.** ACID's C means "invariants hold" (an application property). CAP's C means linearizability. Say this if the interviewer mixes them.

### Choosing per feature, not per system

| Data | Need | Choice |
|---|---|---|
| Wallet balance, payment status, seat booking | No double spend / double booking | Strong (CP), single leader or consensus |
| Inventory count shown on a page | Approximate is fine | Eventual, cached |
| Chat message order in one chat | Causal per conversation | Per-chat ordering (partition by `chat_id`) |
| Likes, view counts | Eventually right | AP, batched counters |
| User profile after edit | User sees own change | Read-your-writes |

## Numbers to remember

- A consensus write needs a **majority**: 3 nodes tolerate 1 failure, 5 tolerate 2.
- Cross-region round trip: roughly **50–250 ms** (e.g. Mumbai ↔ Singapore ~60 ms, Mumbai ↔ US East ~200 ms). A strongly consistent multi-region write pays at least one of these.
- In-region (cross-AZ) round trip: about **1–2 ms**. Synchronous replication inside a region is cheap; across regions it is not.
- Async replica lag: usually **milliseconds to seconds**; can grow to minutes under load.

## Trade-offs and when not to use it

| Option | Use when | Weakness |
|---|---|---|
| Strong (linearizable) | Money, locks, unique allocation, leader election | Higher latency; unavailable on the minority side of a partition |
| Read-your-writes / session | User-facing edits | Needs routing or version tokens |
| Causal | Comments, chat, collaborative apps | More metadata (vector clocks) |
| Eventual | Feeds, counters, caches, search indexes, analytics | Users see stale or out-of-order data; conflicts must be merged |

Common traps: "We use NoSQL so we are AP" (depends on settings), "CA system" (not real for distributed systems), "CAP means pick 2 of 3 always" (only during a partition).

## In real systems

- **DynamoDB**: eventually consistent reads by default; `ConsistentRead=true` for strong reads on the base table (not on GSIs).
- **Cassandra**: per-query consistency level (`ONE`, `QUORUM`, `LOCAL_QUORUM`, `ALL`).
- **MongoDB**: write concern + read concern (`majority`, `linearizable`).
- **Spanner**: external consistency using TrueTime and commit wait.
- **Payments companies**: the ledger is strongly consistent in one primary region; dashboards and analytics read eventually consistent copies.

## What to say in the interview

"I'll pick consistency per data type. The wallet balance and the payment state machine need strong consistency, so they live in a single-leader Postgres with synchronous replication to a standby in another AZ. During a partition I'd rather fail a payment than double-charge. The transaction history page and analytics can be eventually consistent, so they read from replicas and a cache. For the user's own last payment I'll give read-your-writes by reading from the leader for a few seconds after a write."

## Common follow-ups

<details><summary>Is a single-node Postgres CA?</summary>

There is no partition inside one node, so CAP doesn't really apply. Once you add a replica and fail over, you are choosing: async failover can lose writes (favours A), sync replication blocks if the standby is gone (favours C).
</details>

<details><summary>How do you give read-your-writes with read replicas?</summary>

After a write, read from the leader for a short time (e.g. 5 s), or return the write's LSN/version to the client and only read from a replica that has reached it, or keep the user sticky to one replica. See [12 replication](./12-replication.md).
</details>

<details><summary>How do AP systems resolve conflicts?</summary>

Last-write-wins by timestamp (simple, can lose data), version vectors with sibling merge in the app (Dynamo, Riak), or CRDTs that merge automatically (counters, sets, text editors).
</details>

## Self-test (answer before opening)

<details><summary>1. Why is "choose 2 of C, A, P" misleading?</summary>

P is not a choice; networks fail. The choice between C and A is only made during a partition. Most of the time, the real trade-off is latency vs consistency (PACELC).
</details>

<details><summary>2. A user updates their name and refreshes; the old name shows. Which guarantee is missing?</summary>

Read-your-writes. The read went to a lagging replica.
</details>

<details><summary>3. A 5-node Raft cluster splits 3 / 2. What happens on each side?</summary>

The 3-node side has a majority, elects or keeps a leader and keeps working. The 2-node side cannot commit writes. That is a CP choice.
</details>

<details><summary>4. Which needs strong consistency: seat booking or "people viewing this hotel"?</summary>

Seat booking (no double booking). The viewer count can be eventual and approximate.
</details>

## Go deeper

- DDIA, chapter 9 (Consistency and Consensus): "Linearizability", "Ordering Guarantees"; chapter 5: "Problems with Replication Lag"
- Gilbert and Lynch, "Brewer's Conjecture and the Feasibility of Consistent, Available, Partition-Tolerant Web Services" (2002); Abadi, "Consistency Tradeoffs in Modern Distributed Database System Design" (2012)
- Older notes in this repo: `archive/notes/hld-parts/part1.md`, "Module 1.5: CAP Theorem Deep Dive", "Consistency Levels (The Spectrum)"; `archive/notes/hld-parts/part8.md`, "5. Consistency Models"
- Related: [30 consensus](./30-consensus-coordination.md), visual [v18 Raft leader election](../../visuals/v18-raft-leader-election.html)
