# H29 · Consensus, leader election and distributed locks

> **Time:** ~55 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/5-reliability/H29-consensus-locks/demo.ts`)
> **Builds on:** [H15 Replication](../../3-databases/H15-replication/README.md) · [H18 CAP, PACELC and consistency](../../3-databases/H18-cap-pacelc-consistency/README.md) · [H19 Quorum and Merkle trees](../../3-databases/H19-quorum-merkle/README.md) · **Used in:** [Job scheduler](../../case-studies/24-job-scheduler/README.md), [Key-value store](../../case-studies/04-key-value-store/README.md), [Distributed message queue](../../case-studies/18-distributed-message-queue/README.md), [Ticket booking](../../case-studies/09-ticket-booking/README.md), [Hotel booking](../../case-studies/23-hotel-booking/README.md)

## The idea in one line

Consensus lets a group of machines agree on one value or one ordered log even when some crash, as long as a **majority** is alive; you use it through etcd or ZooKeeper for leader election, config and locks, and you make locks safe with **fencing tokens**.

## Why it matters (the problem it solves)

- Two scheduler instances both think they are the leader and both run the daily payout job. Merchants get paid twice.
- A worker holds a lock, pauses for 15 s (GC, VM freeze), its lock expires, another worker takes it, and then the first one wakes up and writes anyway.
- Five config servers must agree "feature X is ON" without a split brain during a network partition.

"I think I am the leader" plus a timeout cannot solve these. Networks delay messages, clocks drift, processes pause. You need a source of truth that only changes when a majority agrees, and a resource that rejects stale holders.

## How it works

### Why a majority

```
5 nodes, majority = 3.  Any two majorities overlap in at least one node.

  {S1 S2 S3}      elected leader in term 4
        {S3 S4 S5}  cannot elect a different leader in term 4: S3 already voted
```

- `2f + 1` nodes tolerate `f` failures. 3 nodes → 1 failure, 5 → 2.
- 4 nodes still tolerate only 1 (majority is 3). Use **odd** sizes.
- A minority side of a partition cannot elect a leader or commit. That is how split brain is prevented, and it is why consensus systems are **CP**: the minority side stops taking writes.

### Raft in five rules

```
              election timeout,              votes from
              no heartbeat                   a majority
 ┌──────────┐ ─────────────► ┌───────────┐ ─────────────► ┌────────┐
 │ Follower │                │ Candidate │                │ Leader │
 └──────────┘ ◄───────────── └───────────┘                └────────┘
      ▲      sees a leader or a higher term     split vote: new term │
      └──────────────────────────────────────────────────────────────┘
                          sees a higher term → step down
```

1. **Terms.** Time is split into numbered terms. At most one leader per term. A node that sees a higher term adopts it and becomes a follower.
2. **Election.** A follower that hears no heartbeat for a **random** timeout (paper: 150–300 ms) becomes a candidate, increments the term, votes for itself and sends `RequestVote`. Each node votes **once per term**, and only for a candidate whose log is **at least as up to date** as its own. A majority wins. Random timeouts make split votes rare.
3. **Replication.** Clients write to the leader. It appends to its log and sends `AppendEntries` to followers (an empty one is a heartbeat, ~every 50–100 ms).
4. **Commit.** An entry is committed once stored on a **majority**. Then it is applied and the client gets success. A committed entry is never lost, because any future leader must have it (rule 2's log check).
5. **Repair.** A new leader forces followers' logs to match its own, filling gaps and overwriting uncommitted conflicting entries.

```
 index:    1        2        3
 S1:    [t1 x=1] [t2 x=5] [t4 noop]   ← leader term 4
 S2:    [t1 x=1] [t2 x=5] [t4 noop]
 S3:    [t1 x=1] [t2 x=5]             ← lagging, will be filled
 S4:    [t1 x=1]                      ← missed #2 while partitioned
 #2 was committed when S1, S2, S3 had it (3 of 5)
```

**Paxos** (Lamport) solves the same problem and came first; Multi-Paxos is what Spanner and Chubby use. **ZAB** is ZooKeeper's protocol. In interviews, explain Raft and say "or Paxos/ZAB, same majority idea".

**Reads.** A leader can be stale if it was cut off and a new leader exists. Linearizable reads go through the log, or use **ReadIndex** (confirm leadership with a heartbeat round first) or **lease reads** (trust a leader lease, needs bounded clock drift).

### What you actually use: etcd, ZooKeeper, Consul

| Use | etcd (Raft) | ZooKeeper (ZAB) |
|---|---|---|
| Leader election | Lease + `concurrency.Election` (lowest create revision wins) | Ephemeral sequential znodes; lowest number is leader, others watch the one before them |
| Liveness | Lease with TTL, kept alive by the client | Session; ephemeral nodes vanish when it ends |
| Notifications | Watch a key or prefix | Watch a znode |
| Fencing number | Key revision / lease id | Znode sequence number, `zxid` |
| Known users | Kubernetes (all cluster state) | Older Kafka, HBase, Hadoop, Solr |

Use them for **small, critical metadata**: who is leader, which shard lives where, config, membership. Not for application data. Every write goes through one leader and a majority fsync, so throughput is thousands to low tens of thousands of writes/s.

You almost never implement Raft yourself. You say "the scheduler instances elect a leader through an etcd lease", or use a **Kubernetes Lease** object (built on etcd) for a singleton controller.

### Distributed locks and fencing tokens

A lock with a lease (TTL) is safe only if the protected resource **rejects stale holders**:

```
Worker A        Lock service           Worker B          Storage (max token seen)
   │ acquire ──────►│                      │                    │  (none)
   │◄── ok, token 33│                      │                    │
   │ ...GC pause 15 s... lease expires     │                    │
   │                │◄────────── acquire ──│                    │
   │                │── ok, token 34 ─────►│                    │
   │                │                      │── write, token 34 ►│  max = 34, OK
   │── write, token 33 ──────────────────────────────────────────►│  33 < 34 → REJECTED
```

- The lock service hands out a **monotonically increasing token** with each grant (etcd: revision; ZooKeeper: sequence number or `zxid`).
- The storage remembers the highest token and rejects lower ones. In SQL:
  `UPDATE payouts SET status='PAID', fence=:t WHERE batch_id=:b AND fence < :t`
- Without fencing, a paused process can always wake up after its lease ended and write. **No TTL value fixes that**: pauses can be longer than any TTL.

### Redis locks and the Redlock debate

- **Single Redis lock:** `SET lock:job123 <random-id> NX PX 30000`. Release with a Lua script that deletes only if the value is still your id (never delete someone else's lock). Good for **efficiency** locks: avoid doing the same work twice where a rare duplicate is OK. On failover an async replica may not have the lock, so two holders are possible.
- **Redlock:** take the same lock on a majority of N (usually 5) **independent** Redis masters within a time limit.
- **The debate:** Martin Kleppmann ("How to do distributed locking", 2016) showed Redlock depends on bounded clock drift, network delay and pauses, and gives no fencing token, so it is unsafe for **correctness**. Antirez ("Is Redlock safe?") replied the assumptions are fine in practice. Interview takeaway: **correctness → etcd/ZooKeeper + fencing, or a DB constraint. Efficiency → a single Redis lock is fine.**

### Often the best lock is no lock

- **Conditional update:** `UPDATE seats SET held_by=:u WHERE seat_id=:s AND held_by IS NULL` (1 row = you won).
- **Unique constraint:** `INSERT INTO payout_runs(date) VALUES ('2026-10-19')` fails for the second runner.
- **Idempotent operation** keyed by batch id ([H22](../../4-async/H22-delivery-semantics/README.md)).
- **Single owner by partitioning:** route all work for key K to one Kafka partition → one consumer.

## In TypeScript

The storage side of fencing (the part people forget), and a lease-based lock service:

```ts
class LockService {
  private holder: string | null = null;
  private expiresAt = 0;
  private token = 32;
  acquire(who: string, now: number, ttlMs: number): number | null {
    if (this.holder && now < this.expiresAt) return null;   // held and lease still valid
    this.holder = who;
    this.expiresAt = now + ttlMs;
    return ++this.token;                                     // monotonically increasing fence
  }
}

class FencedStore {
  private maxToken = 0;
  write(token: number, value: string): boolean {
    if (token < this.maxToken) return false;                 // stale holder: reject
    this.maxToken = token;
    this.value = value;
    return true;
  }
  value = '';
}
```

[demo.ts](demo.ts) runs a small Raft-style election with votes and log checks, majority math, and the GC-pause scenario with and without fencing.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| etcd / ZooKeeper / Consul | Leader election, config, membership, correctness locks | Small data only; one more cluster to run |
| Kubernetes Lease | Singleton controller or job inside K8s | Same lease caveats; still need fencing for side effects |
| DB row lock / unique constraint / conditional update | The resource already lives in that DB | Ties to DB availability; long-held row locks block others |
| Single Redis `SET NX PX` | Efficiency locks, short tasks | Unsafe on failover; no fencing |
| Redlock | You run several independent Redis nodes and accept its assumptions | Debated safety; no fencing token |
| Idempotent ops + partition ownership | You can design the work to be safe twice | Not always possible |

Do not put consensus on the hot data path of a high-write system (each write = a majority round trip + fsync). Do not run a 5-node etcd across continents unless you accept 100+ ms per write. Do not use a lock to protect money movement without fencing or idempotency underneath.

## Common mistakes

- "We use a Redis lock with a 30 s TTL" for payouts, with no fencing and no idempotency.
- Deleting the lock with plain `DEL` (you may delete the next holder's lock). Compare the value first, atomically.
- Even-sized clusters (4, 6) that add cost but no fault tolerance.
- Thinking a leader is always current. An old leader in a minority partition can serve stale reads.
- Choosing a lock TTL shorter than the task, with no renewal (lease keep-alive).
- Using etcd as a general database.
- Assuming clocks are synchronised (lease logic based on two machines' wall clocks).

## Say this in the interview

> "Only one scheduler may trigger payouts, so the instances elect a leader through an etcd lease. If the leader dies, its lease expires in about 10 seconds and another instance takes over. etcd itself is a 3- or 5-node Raft cluster, so it keeps working as long as a majority is up, and a minority side of a partition can never elect a second leader."

> "A paused old leader could still wake up and act, so every payout run carries the lease revision as a fencing token, and the payouts table rejects writes with a lower token. The payout is also idempotent by batch id. For cheap efficiency locks, like stopping two workers from refreshing the same cache key, a single Redis `SET NX PX` with a compare-and-delete release is enough."

## Your experience hook

- **Video SFU with Consul**: Consul servers are a Raft cluster. Your services registered there and did health checks. You can explain why you ran 3 Consul servers, and what happens to discovery if 2 die (no writes, reads may be stale).
- **IoT platform: duplicate MQTT processing**: you removed duplicate processing with load-sharing. Frame it: either a leader/owner per device group (lease), or idempotent processing by message id, rather than a global lock.
- **Payments**: a reconciliation or webhook-retry job must run once. Leader election via a lease + idempotency by provider event id is the safe combo.

## Numbers to remember

- **3** nodes tolerate 1 failure; **5** tolerate 2; 4 and 6 add nothing over 3 and 5.
- Raft election timeout (paper): **150–300 ms**; etcd defaults: heartbeat **100 ms**, election timeout **1,000 ms**.
- One consensus write = leader → majority round trip + fsync: **~1–10 ms** in one region, **100+ ms** across continents.
- etcd default storage quota **2 GB** (max recommended ~8 GB): metadata only.
- Typical leader lease TTL: **10–15 s**, renewed every few seconds.

## Self-test

<details><summary>1. How many failures does a 5-node Raft cluster tolerate? A 6-node one?</summary>

5 nodes: 2 (majority is 3). 6 nodes: still 2 (majority is 4). The sixth node adds cost and write latency, not fault tolerance.
</details>

<details><summary>2. Why does a 3-node cluster stop accepting writes when 2 nodes fail?</summary>

A commit needs 2 of 3. The lone node cannot know whether the other two formed a majority and committed different entries, so it refuses to stay consistent. That is the CP choice.
</details>

<details><summary>3. Why randomise the election timeout?</summary>

If all followers timed out together they would all become candidates and split the vote again and again. Random timeouts let one start first and usually win before others wake up.
</details>

<details><summary>4. What does a fencing token protect against that a TTL cannot?</summary>

A holder that pauses past its lease (GC, VM freeze, slow network) and then writes. The storage sees an older token than the latest it accepted and rejects the write.
</details>

<details><summary>5. Can two Raft leaders exist at the same time?</summary>

Briefly, in different terms: an old leader cut off in a minority may still think it leads. It cannot commit anything because it cannot reach a majority, and it steps down when it sees the higher term. Its reads can be stale unless it uses ReadIndex or log reads.
</details>

<details><summary>6. Redis lock or etcd for "only one worker sends this month's payouts"?</summary>

etcd (or ZooKeeper) lease plus a fencing token checked by the payouts table, plus idempotency by batch id. A Redis lock can have two holders after a failover and has no fencing, so it is only for efficiency.
</details>

<details><summary>7. Seat booking: do you need a distributed lock?</summary>

Usually not. A conditional update (`WHERE seat_id = ? AND status = 'FREE'`) or a hold row with a unique key and expiry does it inside one database, atomically.
</details>

## Go deeper

- Case studies: [Job scheduler](../../case-studies/24-job-scheduler/README.md) (leader election + fencing), [Key-value store](../../case-studies/04-key-value-store/README.md), [Ticket booking](../../case-studies/09-ticket-booking/README.md) (seat holds without a lock)
- Related: [H19 Quorum](../../3-databases/H19-quorum-merkle/README.md) (leaderless quorums vs consensus), [H28 Unique IDs](../H28-unique-ids/README.md) (leasing worker ids)
- Archive notes: [hld-parts/part8.md](../../../archive/notes/hld-parts/part8.md) ("Consensus Algorithms"), [hld-parts/part6b.md](../../../archive/notes/hld-parts/part6b.md) ("Leader Election (ZooKeeper)", "Consensus Algorithm: Raft Basics")
- Ongaro and Ousterhout, "In Search of an Understandable Consensus Algorithm" (Raft, 2014); DDIA ch. 8 ("The leader and the lock", "Fencing tokens") and ch. 9; Kleppmann, "How to do distributed locking"; antirez, "Is Redlock safe?"
