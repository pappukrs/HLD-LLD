# H19 · Quorums, leaderless replication and Merkle trees

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/3-databases/H19-quorum-merkle/demo.ts`) · **Lab:** [lab-quorum-kv](lab-quorum-kv/README.md)
> **Builds on:** [H15 Replication](../H15-replication/README.md) · [H17 Consistent hashing](../H17-consistent-hashing/README.md) · [H18 CAP, PACELC and consistency](../H18-cap-pacelc-consistency/README.md) · **Used in:** Key-value store, Distributed cache, Metrics monitoring, Chat system (message store on Cassandra)

## The idea in one line

There is no leader: the client writes to `W` of `N` replicas and reads from `R` of them, and if `R + W > N` every read set overlaps every write set, so at least one replica in the read has the latest write.

## Why it matters (the problem it solves)

A single leader is a write bottleneck and a single point of failure until failover finishes (often 10–30 s). The Dynamo model (Amazon, 2007) lets **any replica accept a write**. You get:

- **Always-writable:** one slow or dead node does not block reads or writes.
- **Tunable consistency per request:** pick `R` and `W` per query (Cassandra `ONE`, `QUORUM`, `ALL`).
- **Low tail latency:** the request waits only for the W-th (or R-th) fastest replica, not the slowest.

The cost: replicas drift apart. So leaderless systems need three repair tools: **read repair**, **hinted handoff**, and **anti-entropy with Merkle trees**. Interviewers expect all three in a key-value store design.

## How it works

### 1. Placement: the preference list

Each key is hashed onto a [consistent hash ring](../H17-consistent-hashing/README.md). Its `N` replicas are the next `N` **distinct physical nodes** clockwise. That list is the key's *preference list*. Any node can act as **coordinator** for a request (often the client library picks one, or the first node in the list).

### 2. Quorum write and read

```
N = 3, W = 2, R = 2            write v2                 read (R = 2)
   R1  v2   <── ack ✓                          R2 ──► v2  ✓ newest
   R2  v2   <── ack ✓   → coordinator: "ok"    R3 ──► v1  (stale)
   R3  v1   (slow, missed it)                  coordinator returns v2,
                                               writes v2 back to R3 (read repair)
```

- **Write:** coordinator sends to all N, returns success after `W` acks.
- **Read:** coordinator asks R (or all N, waits for R) and returns the value with the **highest version**.
- **Overlap rule:** `R + W > N` means the read set and the last write set share at least one replica.
- **Fault tolerance:** writes survive `N − W` nodes down; reads survive `N − R`.

| N, W, R | R+W>N? | Good at | Cost |
|---|---|---|---|
| 3, 2, 2 | Yes | Balanced. Survives 1 node down on both paths. **The default answer.** | Wait for 2 on each side |
| 3, 3, 1 | Yes | Fast reads | Any node down → writes fail |
| 3, 1, 3 | Yes | Fast writes | Any node down → reads fail; a crash after 1 ack can lose the write |
| 3, 1, 1 | No | Lowest latency | Stale reads are normal: eventual only |
| 5, 3, 3 | Yes | Survives 2 down on both paths | More replicas to store |

Cassandra: `QUORUM = floor(RF/2) + 1` counted across all DCs. `LOCAL_QUORUM` counts only the local DC, so writes never wait on another region (other regions get it async).

### 3. Versions and conflicts

Every value carries a version so the coordinator can pick "newest":

| Versioning | How it decides | Risk |
|---|---|---|
| Timestamp, last-write-wins (Cassandra) | Highest timestamp wins | Concurrent writes: one is silently dropped. Clock skew can let an older write win |
| Version vectors (Dynamo, Riak) | `{R1:3, R2:1}` dominates `{R1:2, R2:1}`; if neither dominates, they are **concurrent** | App must merge siblings (Dynamo merged cart items) |
| CRDTs (Riak, Redis Enterprise) | Data types that merge by math (G-counter, OR-set) | Limited types, more metadata |

### 4. Three ways replicas heal

| Tool | When it runs | What it fixes |
|---|---|---|
| **Read repair** | During a read that sees an old version | Hot keys, fast |
| **Hinted handoff** | A home replica was down during a write; a stand-in kept a *hint* | Short outages (minutes to hours) |
| **Anti-entropy (Merkle trees)** | Background job, e.g. `nodetool repair` weekly | Cold keys nobody reads; long outages; lost hints |

### 5. Merkle trees: find the difference without shipping the data

Each replica splits its key range into buckets and hashes each bucket. Parents hash their children. Two replicas compare **root hashes** first, then walk down only the branches that differ.

```
          R1 root 7c1e                       R2 root 40aa        ← differ: go down
         /            \                     /            \
    L 3b90           R d2f4            L 9e07          R d2f4     ← right equal: skip whole half
    /     \          /    \            /     \
 [a-f]  [g-m]     [n-s]  [t-z]      [a-f]  [g-m]                  ← only [a-f] differs
  51c0   e8a2                        0f6d   e8a2
                → stream only keys in [a-f] from R1 to R2
```

- Cost of finding the difference: `O(d · log B)` hash comparisons for `d` differing buckets out of `B`, instead of comparing every key.
- Example: 1 billion keys in 2^20 buckets (~1k keys each). One stale key → about 20 levels × 2 hashes = **~40 hash compares**, then ship ~1k keys, not 1 billion.
- Same idea in Git (tree objects), Bitcoin (transactions in a block), IPFS, ZFS, and certificate transparency logs.

### 6. Sloppy quorum

If home replicas are down, Dynamo writes to other healthy nodes (with hints) to stay writable. Now the W acks may come from nodes **outside** the key's home N, so **`R + W > N` no longer guarantees overlap** until the hints are handed back. It buys availability, not consistency. Cassandra does **not** do sloppy quorums (it uses hints only when a strict quorum is already met); Riak and Dynamo do.

### 7. Quorum is not linearizability

Even with `R + W > N`:

- A read concurrent with a write can return new, and the next read old (the write reached 1 of 3 so far).
- A failed write (fewer than W acks) is **not rolled back**: the value may sit on some replicas and appear later.
- LWW with clock skew drops writes.

For locks, unique allocation or money, use consensus (Raft) or a single leader. Note: **DynamoDB the AWS service is not the 2007 Dynamo**; it uses a Paxos-elected leader per partition. Good trap to know.

## In TypeScript

Coordinator read with read repair (full simulation in `demo.ts`, build your own in the lab):

```ts
type Versioned = { value: string; version: number };

function quorumRead(replicas: Map<string, Versioned>[], up: boolean[], key: string, r: number): Versioned | undefined {
  const asked = replicas.filter((_, i) => up[i]).slice(0, r);
  if (asked.length < r) throw new Error(`only ${asked.length} replicas up, need R=${r}`);
  const answers = asked.map((rep) => rep.get(key));
  const newest = answers.reduce<Versioned | undefined>((a, b) => (!a || (b && b.version > a.version) ? b : a), undefined);
  if (newest) asked.forEach((rep) => { if ((rep.get(key)?.version ?? 0) < newest.version) rep.set(key, newest); }); // read repair
  return newest;
}
```

Merkle root over sorted buckets:

```ts
import { createHash } from 'node:crypto';
const h = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 8);

function merkleLevels(leaves: string[]): string[][] {
  const levels = [leaves.map(h)];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    levels.push(prev.reduce<string[]>((acc, _, i) => (i % 2 ? acc : [...acc, h(prev[i] + (prev[i + 1] ?? ''))]), []));
  }
  return levels; // levels.at(-1)[0] is the root
}
```

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Leaderless quorum (Cassandra, ScyllaDB, Riak) | Huge write throughput, always-writable, multi-AZ, simple key access (time series, messages, carts) | Conflicts, LWW data loss, no multi-key transactions, weaker than it looks |
| Single leader + followers (Postgres, MySQL) | Transactions, joins, strong reads from the leader | Write bottleneck, failover window |
| Consensus per range (etcd, CockroachDB, Spanner, DynamoDB) | Linearizable with automatic failover | Majority round trip on every write |

Do **not** use leaderless quorums for: account balances, inventory decrements, unique usernames, distributed locks, anything with read-modify-write that must not lose updates.

## Common mistakes

- Saying `R + W > N` means "strongly consistent". It gives overlap, not linearizability (see section 7).
- Picking `W = N` "for safety". One slow node now blocks every write and sets your p99.
- Forgetting that a failed quorum write can still be visible later.
- Treating hinted handoff as enough. Hints expire (Cassandra default 3 h); after that only anti-entropy repairs the replica.
- Calling DynamoDB (the service) leaderless.
- Not explaining how "newest" is decided. Always name the versioning: LWW timestamps or version vectors.
- Explaining Merkle trees as "a hash of everything". The point is the **tree**: you descend only into differing branches.

## Say this in the interview

> "For the key-value store I'll use leaderless replication: N = 3 replicas across 3 AZs, chosen from the consistent hash ring. Writes and reads use W = 2 and R = 2, so R + W > N and a read always overlaps the last successful write. One slow or dead replica doesn't block anything, and latency is the second-fastest replica, not the slowest."

> "Replicas drift, so I'll use three repair paths: read repair for hot keys, hinted handoff for short outages, and a background anti-entropy job that compares Merkle trees per key range. Two replicas compare root hashes, walk down only the branches that differ, and stream only those ranges. That turns a billion-key comparison into a few dozen hash checks."

> "Conflicts: last-write-wins for simple values, version vectors with a merge for things like a cart. If any data needs linearizable reads, like a lock or a balance, I'd keep that in a Raft-based store instead."

## Your experience hook

- **IoT telemetry (10k+ devices):** high-frequency writes from many devices are the classic leaderless workload. At 10× you'd move the firehose to Cassandra or ScyllaDB with `LOCAL_QUORUM` writes, partition key `(device_id, day)`, and accept LWW for readings.
- **Payments:** explain why the idempotency table and ledger are **not** on a leaderless store. A read-modify-write on a balance can lose updates under LWW; you used a single-leader SQL DB with a unique constraint.

## Numbers to remember

| Thing | Number |
|---|---|
| Overlap rule | `R + W > N` |
| Standard setting | `N = 3, W = 2, R = 2`: tolerates 1 failure on each path |
| `N = 5, W = 3, R = 3` | Tolerates 2 failures on each path |
| Quorum latency | The W-th / R-th fastest replica; cross-AZ ~1–2 ms |
| Cassandra hint window | `max_hint_window` default 3 hours |
| Merkle diff cost | ~2 · log2(buckets) hash compares per differing bucket (2^20 buckets → ~40) |
| Full repair cadence | Within `gc_grace_seconds` (default 10 days) or deleted data can come back |

## Self-test

<details><summary>1. N = 5. Pick W and R so reads see the latest write and 2 nodes can be down on both paths.</summary>

W = 3, R = 3. R + W = 6 > 5, and N − W = N − R = 2.
</details>

<details><summary>2. N = 3, W = 1, R = 1. What do you get?</summary>

Only eventual consistency. A read can hit a replica the write has not reached. You get the lowest latency and highest availability.
</details>

<details><summary>3. Why does a sloppy quorum break the R + W > N guarantee?</summary>

The W acks may come from stand-in nodes outside the key's home replicas. A read from R home replicas may include none of them until hinted handoff copies the write back.
</details>

<details><summary>4. Two replicas each hold 100M keys and differ in 3 keys. How does anti-entropy find them cheaply?</summary>

Both build Merkle trees over the same key-range buckets. Compare roots; if different, compare children and descend only into differing subtrees. Cost is about 3 × depth hash compares, then only the 3 buckets are streamed.
</details>

<details><summary>5. A write got 1 ack with W = 2 and the client saw an error. Is the value gone?</summary>

No. It stays on the replica that acked it and is not rolled back. A later read or repair can spread it, so the "failed" write may appear. Clients must retry idempotently.
</details>

<details><summary>6. Two concurrent writes, LWW, clocks skewed by 50 ms. What can happen?</summary>

The write that really happened later can lose because the other node's clock is ahead. It is silently dropped. Version vectors would detect the conflict instead.
</details>

<details><summary>7. Cassandra QUORUM vs LOCAL_QUORUM in a 2-region cluster?</summary>

QUORUM counts replicas across both regions, so every request pays cross-region latency. LOCAL_QUORUM counts only the local DC: fast and fresh within the region, but the other region may be behind.
</details>

<details><summary>8. Is DynamoDB (the AWS service) leaderless?</summary>

No. Each partition has a leader elected with Paxos; strongly consistent reads go to it. The 2007 Dynamo paper described a leaderless design, which Cassandra and Riak follow.
</details>

## Go deeper

- Lab: [lab-quorum-kv](lab-quorum-kv/README.md): build an N/R/W store with fail/recover and read repair, with tests
- Previous: [H18 CAP, PACELC and consistency](../H18-cap-pacelc-consistency/README.md) · Related: [H29 Consensus, leader election and locks](../../5-reliability/H29-consensus-locks/README.md)
- Case studies: [Key-value store](../../case-studies/04-key-value-store/README.md), [Distributed cache](../../case-studies/17-distributed-cache/README.md), [Metrics monitoring](../../case-studies/19-metrics-monitoring/README.md)
- Archive notes: [hld-parts/part1.md](../../../archive/notes/hld-parts/part1.md) ("Quorum Reads/Writes"), [hld-parts/part6b.md](../../../archive/notes/hld-parts/part6b.md) ("Data Replication & Quorum"), [hld-parts/part8.md](../../../archive/notes/hld-parts/part8.md) ("Vector Clocks", "Gossip Protocol")
- DDIA chapter 5: "Leaderless Replication", "Sloppy Quorums and Hinted Handoff", "Detecting Concurrent Writes"; Amazon Dynamo paper (2007), sections 4.5–4.8
