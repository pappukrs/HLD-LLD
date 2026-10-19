# H18 · CAP, PACELC and consistency models

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/3-databases/H18-cap-pacelc-consistency/demo.ts`)
> **Builds on:** [H15 Replication](../H15-replication/README.md) · [H16 Partitioning and sharding](../H16-partitioning-sharding/README.md) · **Used in:** Key-value store, Payment system, Digital wallet, Ticket booking, Chat system, Hotel booking

## The idea in one line

When the network splits, a replicated system must pick between answering (availability) and answering correctly (consistency). When the network is fine, it still picks between low latency and consistency.

## Why it matters (the problem it solves)

The moment data has two copies, two clients can see two different values. Two questions follow:

1. **During a failure:** if replicas cannot talk, does a node still answer, or does it refuse?
2. **Normally:** does a read wait for the freshest copy (slow), or return the nearest copy (fast, maybe stale)?

CAP answers the first, PACELC adds the second, and **consistency models** give the exact promise you make to the client ("you always see your own writes", "you never go back in time"). Interviewers use these words to test if you can say *why* a wallet is on Postgres and a like counter is on Cassandra.

## How it works

### CAP (Brewer 2000, proved by Gilbert and Lynch 2002)

| Letter | Exact meaning | Not to confuse with |
|---|---|---|
| **C**onsistency | **Linearizability**: every read sees the latest completed write, as if there were one copy | ACID's C (invariants hold) |
| **A**vailability | Every request to a **non-failed** node gets a non-error answer | "99.99% uptime" (that is an SLA, not CAP's A) |
| **P**artition tolerance | The system keeps running when messages between nodes are lost or delayed | A node crash (that is a different failure) |

Networks do partition (a bad switch, a cut cable, a GC pause that looks like a dead node). So P is not optional. The real rule is:

> **While partitioned, choose C or A. When not partitioned, you can have both.**

```
         west region            |            east region
   Client 1 ──► [A]───[C]       X        [B] ◄── Client 2
                  majority 2/3  |  minority 1/3

   CP: A,C keep committing.  B refuses writes and strong reads (503).
   AP: A,C and B all accept.  They disagree until the link heals, then merge.
```

- **CP systems:** ZooKeeper, etcd, Consul, HBase, Spanner, MongoDB with `w:majority`, a single-leader Postgres with synchronous failover.
- **AP systems:** Cassandra and DynamoDB at low consistency levels, Riak, CouchDB, DNS, CDN caches.

Why 3 or 5 nodes, never 2? With 2 nodes and a broken link, neither side has a majority, so a CP system stops on **both** sides. With 3 nodes, one side always can hold 2.

### PACELC (Abadi, 2010)

> If **P**artition: choose **A** or **C**. **E**lse: choose **L**atency or **C**onsistency.

Partitions are rare. Latency is every request. A strong read must reach the leader or a quorum, which can be in another AZ (1–2 ms) or another region (60–200 ms). A local replica answers in under 1 ms but may lag.

| System | During partition (P) | Normal (E) | Notes |
|---|---|---|---|
| Cassandra, DynamoDB (default) | A | L | Tunable per query |
| MongoDB (`w:majority`, `readConcern: majority`) | C | C | Reads from secondaries become EL |
| Spanner, CockroachDB | C | C | Pays with consensus and commit-wait latency |
| Postgres primary + async read replicas | C on writes | L on replica reads | Replica reads can be stale |
| Redis Cluster | A-ish (async replication can lose acked writes on failover) | L | Not a source of truth for money |

PACELC is the better interview word: it shows you know the cost exists even on a healthy day.

### Consistency models (strongest to weakest)

| Model | The promise | How you get it |
|---|---|---|
| **Linearizable** | Acts like one copy, in real-time order. Once a write is acked, every later read sees it | Single leader + consensus (Raft/Paxos), `SELECT ... FOR UPDATE` on the primary |
| **Sequential** | Everyone sees the same order, but it may lag real time | Total-order broadcast |
| **Causal** | If A caused B (reply after post), everyone sees A before B | Version vectors, session tokens, partition by conversation |
| **Read-your-writes** | You always see your own writes | Read from leader for a few seconds after a write, or pass the write's LSN and read only from a replica past it |
| **Monotonic reads** | You never see time go backwards | Pin a user (session) to one replica |
| **Eventual** | If writes stop, replicas converge | Async replication + anti-entropy |

The middle four are **session guarantees**. They are cheap patches on top of eventual consistency, so you do not need to jump to linearizable to fix "my edit disappeared on refresh".

### Two user-visible glitches and their fixes

```
Read-your-writes broken:            Monotonic reads broken:
 write name="Pappu" → leader         read #1 → replica R1 (lag 0 s)  sees v5
 read          → replica (lag 2 s)   read #2 → replica R2 (lag 3 s)  sees v4  ← time went back
 sees old name  ← "my edit vanished"
 fix: read leader for 5 s after a write   fix: hash user_id to one replica
```

### Choose per feature, not per system

| Data | What goes wrong if stale | Choice |
|---|---|---|
| Wallet balance, ledger, payment state | Double spend, double charge | CP / linearizable on one leader |
| Seat or hotel-room booking | Double booking | CP: conditional write or row lock |
| Unique username, distributed lock, leader | Two owners | CP: consensus store (etcd, ZooKeeper) |
| Chat messages in one chat | Reply shown before the question | Causal: partition by `chat_id`, per-chat sequence |
| User profile after edit | "My change vanished" | Read-your-writes |
| Likes, views, "23 people viewing" | Off by a few | AP / eventual |
| Feed, search index, analytics | A few seconds late | Eventual |

### How AP systems merge after a partition

| Strategy | How | Risk |
|---|---|---|
| Last-write-wins (LWW) | Keep the highest timestamp | Silently drops concurrent writes; clock skew can make an older write win |
| Version vectors + siblings | Detect concurrent writes, return both, app merges | App code must merge (Dynamo cart) |
| CRDTs | Data types that merge by math (G-counter, OR-set) | Limited types, more metadata |

## In TypeScript

A read router that gives read-your-writes on top of async replicas (full version in `demo.ts`):

```ts
type Replica = { name: string; appliedLsn: number };

function pickReplica(replicas: Replica[], leader: Replica, minLsn: number): Replica {
  // Any replica that has applied the user's last write is safe to read from.
  const fresh = replicas.filter((r) => r.appliedLsn >= minLsn);
  return fresh.length ? fresh[Math.floor(Math.random() * fresh.length)] : leader;
}

// After a write, the API returns the commit LSN; the client sends it back on reads
// (cookie or header). No LSN means "eventual is fine".
const target = pickReplica(replicas, leader, session.lastWriteLsn ?? 0);
```

A CP write on a majority:

```ts
function cpWrite(reachable: number, total: number): 'committed' | 'rejected' {
  return reachable >= Math.floor(total / 2) + 1 ? 'committed' : 'rejected';
}
```

## Trade-offs / when NOT to use it

| Option | Use when | Cost |
|---|---|---|
| Linearizable (CP) | Money, inventory, locks, unique allocation | Higher latency; minority side is down during a partition; cross-region writes pay a round trip |
| Session guarantees | User-facing edits, profile, settings | Routing logic or version tokens |
| Causal | Chat, comments, collaborative tools | Extra metadata (vector clocks) |
| Eventual (AP) | Feeds, counters, caches, search, metrics | Stale or conflicting reads; merge logic |

- Do **not** make everything strong "to be safe". A global feed on a consensus store is slow and expensive for no user benefit.
- Do **not** make money eventual "for scale". Shard the ledger by account instead, and keep each shard strong.

## Common mistakes

- Saying "pick 2 of 3". You cannot drop P in a distributed system. The choice is C or A **during** a partition.
- Calling a system "CA". That only exists on one node.
- Mixing up ACID's C (constraints hold) and CAP's C (linearizability).
- Saying "NoSQL is AP, SQL is CP". It depends on settings: Cassandra at `QUORUM`/`QUORUM` is strong-ish; Postgres replica reads are stale.
- Forgetting that CP is still mostly available: only the **minority** side refuses.
- Using LWW for a shopping cart and losing items without noticing.
- Thinking `R + W > N` alone gives linearizability. Sloppy quorums and concurrent writes break it (see [H19](../H19-quorum-merkle/README.md)).

## Say this in the interview

> "Partitions will happen, so the real question is what each piece of data does during one. The wallet balance and payment state are CP: they live on a single-leader Postgres with a synchronous standby in another AZ. If the minority side can't reach the leader, I return an error and the client retries with the same idempotency key. I'd rather fail a payment than charge twice."

> "On a healthy day the trade-off is PACELC's latency versus consistency. Transaction history, dashboards and analytics read from async replicas and a cache, so they are eventual. For the user's own last payment I give read-your-writes: the write returns its LSN, and I only read from a replica that has applied it, else from the leader."

> "For counters and feeds I choose AP and merge later. If two sides write concurrently, I use version vectors or CRDTs, not last-write-wins, because LWW silently drops one of the writes."

## Your experience hook

- **Payment orchestration:** payment state and the idempotency table must be strong (one leader, unique constraint on the key). Webhooks can arrive late or twice, so the status is a state machine that only moves forward. That is CP on the ledger, eventual on the dashboards.
- **10k+ IoT devices:** device "last seen" and telemetry are AP. During a Redis or network blip you keep ingesting and show slightly stale status, rather than rejecting a whole region of devices.
- **Chat / video signaling:** presence and typing indicators are AP. Room membership needs at least causal order per room, which you got by keeping a room's events on one ordered channel.

## Numbers to remember

| Thing | Number |
|---|---|
| Majority of N | `floor(N/2)+1`: 3 nodes survive 1 failure, 5 survive 2 |
| Cross-AZ round trip (same region) | ~1–2 ms: sync replication here is cheap |
| Cross-region round trip | ~60 ms (Mumbai–Singapore) to ~200 ms (Mumbai–US East) |
| Async replica lag | Usually ms to 1 s; minutes under heavy write load |
| Read-your-writes "read from leader" window | 5–10 s after a write is a common default |
| DynamoDB strong read | 2x the read capacity cost of an eventual read |

## Self-test

<details><summary>1. Why is "CAP = pick 2 of 3" misleading?</summary>

P is not a choice: networks drop messages. The choice between C and A is only made during a partition. When the network is fine you get both, and the real trade-off is latency vs consistency (PACELC).
</details>

<details><summary>2. A 5-node Raft cluster splits 3 / 2. What happens on each side?</summary>

The 3-node side has a majority, keeps or elects a leader and keeps committing. The 2-node side cannot commit writes and should refuse strong reads. That is CP.
</details>

<details><summary>3. A user edits their name, refreshes, and sees the old name. Which guarantee is missing and how do you fix it?</summary>

Read-your-writes. The read hit a lagging replica. Read from the leader for a few seconds after a write, or return the write LSN and read only from a replica that has applied it.
</details>

<details><summary>4. A user sees 12 comments, refreshes, and sees 10. What broke?</summary>

Monotonic reads: two reads hit replicas with different lag. Pin the session to one replica (hash user id), or carry the last-seen version and skip replicas behind it.
</details>

<details><summary>5. Classify DynamoDB default, Spanner and a Postgres primary with sync standby using PACELC.</summary>

DynamoDB default: PA/EL. Spanner: PC/EC. Postgres with a synchronous standby: PC/EC for writes (a write waits for the standby, and blocks if the standby is gone unless you fall back to async).
</details>

<details><summary>6. Why does last-write-wins lose data?</summary>

It keeps one of two concurrent writes and throws away the other. With clock skew, an older write can even "win". Version vectors detect the conflict; a merge (union, CRDT) keeps both.
</details>

<details><summary>7. Seat booking vs "23 people are viewing this hotel". Which needs strong consistency?</summary>

Seat booking: a stale read allows a double booking. The viewer count is fine as eventual and approximate.
</details>

<details><summary>8. Is a single Postgres node CA?</summary>

CAP does not really apply to one node: there is no network between copies. Once you add a replica and failover, you choose: async failover can lose acked writes (favours A); sync replication blocks when the standby is gone (favours C).
</details>

## Go deeper

- Next: [H19 Quorums, leaderless replication and Merkle trees](../H19-quorum-merkle/README.md) (tunable consistency with `R + W > N`)
- Consensus behind CP stores: [H29 Consensus, leader election and locks](../../5-reliability/H29-consensus-locks/README.md)
- Case studies: [Key-value store](../../case-studies/04-key-value-store/README.md), [Payment system](../../case-studies/08-payment-system/README.md), [Ticket booking](../../case-studies/09-ticket-booking/README.md), [Digital wallet](../../case-studies/28-digital-wallet/README.md), [Chat system](../../case-studies/06-chat-system/README.md)
- Archive notes: [hld-parts/part1.md](../../../archive/notes/hld-parts/part1.md) ("CAP Theorem Deep Dive", "Consistency Levels"), [hld-parts/part8.md](../../../archive/notes/hld-parts/part8.md) ("Consistency Models")
- DDIA chapter 9 ("Linearizability", "Ordering Guarantees") and chapter 5 ("Problems with Replication Lag")
