# SD Day 18 — Distributed Locking: Redis Redlock and Its Criticisms

*(~1 hr · building-blocks block. A lock in one process is a `mutex` your OS guarantees. A lock
**across machines** is a different animal — the "holder" can pause, its clock can drift, the network
can lie, and the thing you're protecting doesn't know about your lock. Today is about the honest
version: how a single-node Redis lock works, why **Redlock** was invented, **Kleppmann's famous
critique**, the **fencing-token** fix, and — the senior move — knowing that most of the time **you
shouldn't be taking a distributed lock at all.** Pairs with Day 3 (Redis), Day 9 (CAP — a lock is a
tiny consensus problem), Day 10 (consistency models), Day 12 (idempotency — the pattern that
*replaces* most locks), and feeds Day 19 (Snowflake IDs, where fencing tokens reappear).)*

---

## 1. What a distributed lock is actually for

A distributed lock lets **at most one node at a time** do something across a fleet: run a cron job
once (not once-per-replica), be the single writer to an external resource, elect a leader, prevent
two workers from processing the same job.

The hard part: the lock lives in **one place** (Redis, ZooKeeper, etcd, a DB row) but the **holder**
is a *different* process on a *different* machine. Between "I hold the lock" and "I use it" there is a
network, a GC pause, and a clock — any of which can make the holder **wrong about whether it still
holds the lock**. That gap is the entire subject.

> **One line:** *"A distributed lock is a lease held remotely — the danger isn't acquiring it, it's
> that the holder can believe it still owns the lock after it has actually expired or been lost."*

Two very different reasons you might want one — **decide which you're in, out loud**:

- **Efficiency** — "don't do this expensive work twice" (e.g. don't recompute the same cache entry
  on two nodes). If the lock occasionally fails and work runs twice: **you waste money, nothing
  breaks.** A single-node Redis lock is totally fine here.
- **Correctness** — "if two nodes do this, data corrupts / money is double-spent." Here a lock that
  *occasionally* lets two holders in is **worse than useless** — it gives you false confidence. This
  is where Redlock's critics live, and where you should ask whether a lock is even the right tool.

---

## 2. The single-node Redis lock (get this exactly right)

The canonical Redis lock is one atomic command:

```
SET lock:resource <random-token> NX PX 30000
```

- `NX` — set **only if not exists** → this *is* the "acquire": only one client wins.
- `PX 30000` — **auto-expire after 30s**. Non-negotiable: if the holder crashes, the lock must
  release itself or it's a **deadlock forever**. The lock is a **lease**, not a permanent grant.
- `<random-token>` — a unique value **per acquisition** (UUID). This is the part beginners drop, and
  it's a real bug.

**Release must be atomic and ownership-checked** — a Lua script, never `GET` then `DEL`:

```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
```

**Why the token matters (the classic bug):** client A acquires, then **stalls** (GC pause) past the
30s TTL. The lock **auto-expires**. Client B acquires it — legitimately. Now A wakes up and calls
`DEL lock:resource`. **Without the token check, A deletes B's lock** — and now C can acquire too, so
you have two holders. The token means "only delete the lock **if it's still mine**." (It does *not*
fix A believing it still holds the lock — see §4. It only stops A from stomping B's.)

> **Hook:** *"`SET key uuid NX PX ttl` to acquire, a Lua compare-and-delete to release. The TTL
> stops a crashed holder from deadlocking; the UUID stops a slow holder from releasing someone
> else's lock."*

The weakness of this simple version: **it's a single Redis node.** If that node dies, the lock is
gone (availability), and if you add a **replica for failover**, replication is **asynchronous** — so:

---

## 3. Why Redlock exists: the failover race

Single Redis + one replica, `SET NX` on the master:

1. Client A acquires the lock on the **master**.
2. Master **crashes before replicating** the lock key to the replica.
3. Replica is promoted to master. The lock key **isn't there.**
4. Client B does `SET NX` → **succeeds.** Now **A and B both hold the lock.**

Async replication broke mutual exclusion. **Redlock** (Antirez/Redis) is the proposed fix: don't
rely on one node — use **N independent Redis masters** (typically **5**, no replication between them)
and require a **majority**.

**Redlock algorithm:**
1. Client records start time, then tries to `SET NX PX` the **same key+token** on **all N** nodes
   sequentially, each with a **short per-node timeout** (so a dead node can't stall you).
2. The lock is **acquired only if**: (a) the client got it on **≥ ⌈N/2⌉+1** nodes (3 of 5), **and**
   (b) total elapsed time is **less than the TTL** (otherwise the lock may already be expiring).
3. **Effective validity = TTL − elapsed − clock-drift margin.** You get *less* usable time than the
   TTL — you paid for the round trips.
4. If the client **fails** to get a majority (or ran out of time), it **releases on all nodes**
   (best-effort `DEL` everywhere) and retries after a random delay.

The pitch: no single point of failure, no reliance on replication — a minority of Redis nodes can die
and mutual exclusion still holds.

> **Hook:** *"Redlock swaps one Redis node for five independent ones and a majority quorum, so a
> failover on any single node can't hand the same lock to two clients — it's quorum instead of
> replication."*

---

## 4. Kleppmann's critique (the part interviewers want)

Martin Kleppmann (DDIA author) wrote the famous rebuttal. The argument is **not** "Redis is buggy" —
it's that **no lock service with a TTL can guarantee correctness by itself**, because of two things
timeouts can't defeat:

### (a) Process pauses break TTLs — regardless of quorum
The killer scenario, and it has **nothing to do with how many Redis nodes** you use:

1. Client A acquires the lock (single node or Redlock — doesn't matter). Validity 30s.
2. A starts its work, then hits a **stop-the-world GC pause** (or gets descheduled by the OS, or a VM
   live-migration freeze) for **> 30s**. A is frozen but *does not know it*.
3. The lock **expires.** Client B legitimately acquires it and starts writing.
4. A **wakes up**, still believing it holds the lock (it has no way to know time passed), and
   **also writes.** → **Two writers. Corruption.**

Quorum doesn't help: the pause happens **after** acquisition, on the client, entirely outside Redis's
view. **A TTL assumes the holder notices the clock — a paused process doesn't.**

### (b) Redlock leans on clocks it shouldn't trust
Redlock's safety depends on **bounded clock drift** across the 5 nodes (TTL expiry is per-node wall
time). But clocks **jump**: NTP steps, a bad admin, a VM migration, leap-second handling. If node
3's clock jumps forward, its key expires early — and the majority math that "proved" you held the
lock can silently become false. Kleppmann's point: Redlock is presented as safe but its safety rests
on **timing assumptions a real distributed system doesn't give you**, so it's neither a good
efficiency lock (overkill) nor a sound correctness lock (unsafe).

### (c) The actual fix: fencing tokens
The insight that dissolves the pause problem: **stop trying to make the lock perfect; make the
protected resource reject stale holders.** Every time the lock is granted, the lock service returns a
**monotonically increasing number** — a **fencing token** (1, 2, 3, …). The client **passes the
token to the resource** on every write. The resource **remembers the highest token it has seen and
rejects anything lower.**

Replay the pause with fencing:
1. A acquires lock, gets token **33**.
2. A pauses > TTL; lock expires; B acquires, gets token **34**.
3. B writes to storage with token 34 → storage records "highest seen = 34."
4. A wakes, writes with token **33** → storage sees 33 < 34 → **rejects.** Corruption prevented.

The lock no longer has to be perfect, because the **resource** is the final arbiter of "who's
current." Note the requirement it pushes onto you: **the protected resource must support fencing**
(check-and-set on a version number). If it can't (a dumb file, an external API with no version
param), fencing tokens don't apply — which is itself a signal the lock can't be made truly safe.

> **Hook:** *"Kleppmann's real lesson isn't 'don't use Redlock' — it's that any TTL lock can be held
> by a paused process past expiry, so for correctness you need **fencing tokens** that let the
> **storage layer** reject a stale writer. The lock becomes an optimization; the fence is the
> guarantee."*

**Antirez's rebuttal (fairness — mention it):** he argued the fencing-token requirement applies to
*any* lock system equally (ZooKeeper too), and that Redlock's clock assumptions are acceptable for
many real deployments. The honest interview take: **both are right about different things** — Redlock
is a reasonable *efficiency* lock; for *correctness* you need fencing, and a **consensus system
(ZooKeeper/etcd) gives you the monotonic token more naturally** than Redis does.

---

## 5. The alternative: consensus-based locks (ZooKeeper / etcd)

ZooKeeper (and etcd, via Raft) is the "correctness camp" answer. It's a **consensus** system (ZAB /
Raft), so it doesn't have Redlock's async-failover hole, and it gives you two things Redis locks
fake:

- **Ephemeral znodes** — a key tied to the client's **session**. If the client dies or its session
  **heartbeat** lapses, ZK **deletes the node automatically.** The lock release is driven by *session
  liveness*, not a blind wall-clock TTL you guessed.
- **A natural fencing token** — ZooKeeper's `zxid` (or an etcd key's `mod_revision`) is a
  **monotonically increasing** number you hand straight to the resource as the fence.
- **Watches** — waiters subscribe to the lock node and are **notified** when it frees, instead of
  spinning/polling (the "sequential ephemeral + watch the node just ahead of you" recipe avoids
  a herd).

The cost: ZK/etcd is **slower, CP (sacrifices availability under partition — Day 9), and one more
stateful cluster to run.** Redis is faster and simpler. That's the trade you're choosing between.

| | Redis single-node | Redlock (5 nodes) | ZooKeeper / etcd |
|---|---|---|---|
| Model | one node, TTL | quorum, TTL | consensus (Raft/ZAB) |
| Failover safety | ❌ async-repl race | ⚠️ better, clock-dependent | ✅ consensus |
| Release on crash | TTL expiry (guessed) | TTL expiry | **session death** (ephemeral) |
| Fencing token | roll your own | roll your own | ✅ native (zxid/revision) |
| Speed | fastest | fast | slower |
| Good for | efficiency locks | efficiency at scale | correctness locks |

---

## 6. The senior move: usually, don't take the lock

The strongest answer often **refuses the premise.** Distributed locks are a **serialization
bottleneck and a liveness risk**; before reaching for one, ask if the problem dissolves:

- **Idempotency instead of mutual exclusion (Day 12).** If the operation is safe to run twice — dedup
  key, `INSERT … ON CONFLICT`, upsert by natural id — you don't need "only one runs," you need "twice
  is harmless." This kills a huge fraction of "we need a lock" requests. (Your payments work: an
  **idempotency key** on the charge, not a lock around it.)
- **Optimistic concurrency / CAS.** A **version column** (`UPDATE … WHERE version = 42`) or a
  compare-and-swap lets both nodes try; the loser's update affects 0 rows and retries. No lock held
  across the network, no TTL, and the DB is the arbiter — this *is* fencing, built into your
  database.
- **Single-writer by partitioning.** Route all work for `key` to **one** consumer via **partitioning**
  (Kafka partition key, consistent hashing — Days 11, 15). If only one worker can *ever* touch a key,
  mutual exclusion is structural — no lock needed. This is how most "process each user's events in
  order" problems are actually solved.
- **A queue with a visibility timeout** (SQS) gives you "one worker at a time per message" without a
  named lock.
- **DB-native locks** (`SELECT … FOR UPDATE`, Postgres **advisory locks**) when the work is already
  in a transaction against that DB — simpler and safer than a second lock system, and it releases on
  transaction end.

> **Rule of thumb:** *"Efficiency lock? Single-node Redis lease is fine. Correctness? First try to
> remove the need — idempotency, optimistic version checks, or single-writer partitioning. If I
> truly need a lock for correctness, I want a consensus store (ZK/etcd) **and** fencing tokens,
> because a bare TTL lock can be held by a paused process."*

---

## 7. Map it to YOUR systems (interview gold)

- **Fintech payment orchestration:** the textbook place people *think* they need a lock ("don't
  double-charge"), and the textbook place you **use idempotency instead** — an **idempotency key**
  per payment intent + an **outbox** so a retry/duplicate webhook is a no-op, not a race. Say it
  exactly: *"I didn't lock the charge; I made the charge idempotent — a retry hits the same key and
  returns the same result."* That's the senior signal from §6.
- **Reconciliation / cron that must run once:** a scheduled job across N replicas → a **single-node
  Redis lease** (`SET NX PX`) is the pragmatic efficiency lock; if it double-fires occasionally the
  reconciliation is idempotent anyway. Name it as an *efficiency* lock deliberately.
- **10k+ IoT / per-device ordering:** you want "one worker owns device X's stream" — that's
  **single-writer via partitioning**, not a lock per device. Keyed routing (device id → partition)
  gives structural mutual exclusion.
- **NestJS/Redis stack:** you already run Redis, so a distributed lock is one `SET NX` away — which is
  exactly why the discipline matters: *"having Redis makes the lock cheap to reach for, so I ask
  first whether idempotency or a version check removes the need."*

---

## 8. The traps that catch people

1. **`GET` then `DEL` to release.** Race: the lock can expire and be re-acquired between your GET and
   DEL, so you delete someone else's lock. Must be an **atomic, token-checked Lua** compare-and-delete.
2. **No TTL.** A crashed holder deadlocks the resource **forever.** Every distributed lock is a
   **lease** with an expiry.
3. **TTL too short.** Work outlives the lease → the lock expires mid-work → second holder enters.
   Either size the TTL safely **or** run a **watchdog** that extends the lease while work continues
   (Redisson does this) — and even then, fencing is the real safety net.
4. **Thinking Redlock makes it correct.** It fixes the *async-failover* hole, **not** the
   *process-pause* hole. For correctness you still need **fencing tokens** — quorum ≠ safety.
5. **Fencing token the resource ignores.** A token only protects you if the **storage rejects lower
   tokens.** A token you generate but never check does nothing.
6. **Reaching for a lock when idempotency/CAS/partitioning would remove it.** The most common
   over-engineering; the strongest answers dodge the lock entirely.
7. **Ignoring clock assumptions.** Redlock's safety depends on bounded clock drift — NTP steps and VM
   migrations violate that. If you *must* trust a clock, at least know you're doing it.
8. **Lock held across a slow external call.** Holding a lock while you await a third-party API means
   its latency spike becomes *your* deadlock/timeout. Keep critical sections tiny, or use fencing so
   you don't have to hold at all.

---

## 9. The whole day on one page (say it out loud)

> *"A distributed lock is a **lease held remotely** — the risk isn't acquiring it, it's that the
> holder can *believe* it still owns the lock after the lock has expired or moved. The single-node
> Redis lock is `SET key <uuid> NX PX ttl` to acquire and an **atomic token-checked Lua delete** to
> release — the TTL stops a crashed holder from deadlocking, the UUID stops a slow holder from
> deleting someone else's lock. Its weakness is one node; add a replica and **async replication**
> can hand the same lock to two clients across a failover. **Redlock** answers that with **5
> independent nodes and a majority quorum** so no single failover breaks mutual exclusion. But
> **Kleppmann's critique** is the real lesson: **quorum doesn't stop a GC pause** — a client can
> stall past the TTL, the lock expires, a second client legitimately takes it, and the first wakes
> up and writes anyway. No TTL lock survives a paused holder. The fix isn't a better lock, it's
> **fencing tokens** — the lock hands out a monotonically increasing number and the **storage layer
> rejects any write with a lower token**, so a stale holder is refused at the resource. That's why
> for **correctness** I lean toward a **consensus store — ZooKeeper/etcd** — which releases on
> **session death** (ephemeral nodes) instead of a guessed TTL and gives a **native monotonic
> token**, accepting that it's slower and CP. And the senior move is to **not take the lock at all**:
> most 'we need a lock' problems are really **idempotency** (safe to run twice), **optimistic version
> checks** (CAS in the DB), or **single-writer partitioning** — which is exactly how I handled
> payments: an **idempotency key**, not a lock around the charge. So: **efficiency lock → single-node
> Redis lease is fine; correctness → remove the need first, and if you truly can't, use a consensus
> store plus fencing tokens.**"*

**Why it matters next:** fencing tokens are just **monotonic, unique numbers** — which is exactly the
next building block: **unique ID generation (Snowflake)** — minting IDs that are unique,
**time-sortable**, and shard-friendly across many machines without a central bottleneck.
