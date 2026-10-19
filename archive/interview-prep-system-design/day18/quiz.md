# SD Day 18 — Quiz: Distributed Locking (Redis Redlock and Its Criticisms)

*Answer each OUT LOUD, in your own words, before expanding. The signal here is nuance: you should be
able to say the exact `SET NX` command (Q2), name **which** hole Redlock fixes vs doesn't (Q4, Q5),
explain fencing tokens cold (Q6), and — the senior move — argue for **not** taking a lock at all
(Q9). "Efficiency vs correctness" is the framework; "a paused holder breaks any TTL" is the punchline.*

---

**Q1. What makes a distributed lock fundamentally harder than an in-process mutex? And what's the
first thing to decide when someone asks for one?**

<details><summary>answer</summary>

An in-process mutex is guaranteed by the OS; a distributed lock lives in **one place** (Redis/ZK/DB)
while the **holder** is a different process on a different machine. Between "I hold it" and "I use it"
sit a network, a **GC/OS pause**, and a **clock** — any can make the holder **wrong about still
owning the lock**. First decision: **efficiency or correctness?** Efficiency = "don't do the work
twice" (double-run just wastes money → a simple lock is fine). Correctness = "two holders corrupt
data / double-spend" (a lock that occasionally admits two is worse than none — false confidence).
</details>

---

**Q2. Write the single-node Redis lock — acquire and release — and justify every piece.**

<details><summary>answer</summary>

Acquire: `SET lock:res <uuid> NX PX 30000`. `NX` = set only if absent (that's the mutual exclusion);
`PX 30000` = **auto-expire** so a crashed holder doesn't deadlock forever (it's a **lease**);
`<uuid>` = unique per acquisition so release can prove ownership. Release must be an **atomic Lua
compare-and-delete**: `if GET key == uuid then DEL key`. Never plain `GET` then `DEL` — the lock
could expire and be re-acquired between the two calls, so you'd delete **someone else's** lock.
</details>

---

**Q3. Why is the random UUID token necessary? Give the exact bug it prevents — and the bug it does
NOT prevent.**

<details><summary>answer</summary>

**Prevents:** A acquires, then stalls past the TTL; the lock auto-expires; B acquires it
legitimately; A wakes and calls `DEL`. **Without the token, A deletes B's lock** → then C can acquire
too → two holders. The token means "delete only if it's still mine." **Does NOT prevent:** A **still
believing it holds the lock** after expiry and going on to **write** to the protected resource. The
token stops A from releasing B's lock; it does **not** stop A from acting as a stale holder — that
needs **fencing tokens** (Q6).
</details>

---

**Q4. What specific failure of single-node Redis does Redlock exist to fix, and how does the
algorithm work?**

<details><summary>answer</summary>

The **async-replication failover race**: A acquires on the master; the master crashes **before
replicating** the key; a replica is promoted **without** the lock key; B acquires → **two holders.**
Redlock avoids relying on replication: use **N independent Redis masters** (typically **5**, no
replication between them). Client `SET NX PX` the **same key+token** on all N with a short per-node
timeout; the lock is held **only if** it got a **majority (3/5)** **and** total elapsed < TTL.
Effective validity = TTL − elapsed − clock-drift margin. On failure, release everywhere and retry
after a random delay.
</details>

---

**Q5. Kleppmann's critique: describe the scenario that breaks Redlock even with a perfect 5-node
quorum. Why doesn't the quorum help?**

<details><summary>answer</summary>

The **process-pause** scenario: A acquires the lock (validity 30s), then hits a **stop-the-world GC
pause / OS deschedule / VM freeze** for **> 30s**. A is frozen and *doesn't know it*. The lock
**expires**; B legitimately acquires and writes; A **wakes up still believing it holds the lock** and
also writes → **two writers, corruption.** Quorum doesn't help because the pause happens **on the
client, after acquisition**, entirely outside Redis's view — **a TTL assumes the holder notices the
clock, and a paused process doesn't.** (Secondary critique: Redlock's expiry relies on **bounded
clock drift**, which NTP steps / VM migrations violate.)
</details>

---

**Q6. What is a fencing token, and how does it actually prevent the paused-holder corruption? What
does it require of the resource?**

<details><summary>answer</summary>

A **fencing token** is a **monotonically increasing number** the lock service returns on every grant
(33, 34, …). The client passes it to the **protected resource** on every write; the resource
**remembers the highest token seen and rejects anything lower.** Replay Q5: A gets 33, pauses; B gets
**34** and writes → storage records "highest = 34"; A wakes and writes with **33** → 33 < 34 →
**rejected.** The lock stops needing to be perfect because the **resource is the arbiter of who's
current.** Requirement: the resource must **support fencing** (a check-and-set on a version). If it
can't (dumb file, versionless external API), fencing can't apply — a sign the lock can't be made
truly safe.
</details>

---

**Q7. Why do ZooKeeper/etcd get called the "correctness camp," and what two things do they give you
that a Redis TTL lock fakes?**

<details><summary>answer</summary>

They're **consensus** systems (ZAB/Raft), so they don't have Redlock's async-failover hole. (1)
**Ephemeral nodes tied to a session:** the lock is released automatically when the client's
**session/heartbeat dies**, not on a **guessed wall-clock TTL** — release is driven by *liveness*,
not timing. (2) A **native monotonic token** (`zxid` / etcd `mod_revision`) you hand straight to the
resource as the fence. Plus **watches** so waiters are notified instead of polling. Cost: **slower,
CP (drops availability under partition), one more stateful cluster** to run.
</details>

---

**Q8. Redlock's answer to Kleppmann's clock argument — and the fair conclusion?**

<details><summary>answer</summary>

Antirez argued the **fencing-token requirement applies to any lock system equally** (ZooKeeper
included), and that Redlock's clock assumptions are acceptable for many real deployments. Fair
conclusion: **both are right about different things.** Redlock is a reasonable **efficiency** lock;
for **correctness** you need **fencing tokens**, and a **consensus store gives the monotonic token
more naturally** than Redis does. It's not "Redis bad" — it's "know which guarantee you're buying."
</details>

---

**Q9 (the senior move). Before taking any distributed lock, what should you try instead — and which
fits which problem?**

<details><summary>answer</summary>

Distributed locks are a **serialization bottleneck + liveness risk** — try to **remove the need**:
- **Idempotency (Day 12):** if running twice is harmless (dedup key, upsert, `ON CONFLICT`), you
  don't need "only once." Kills most "we need a lock" asks.
- **Optimistic concurrency / CAS:** a **version column** (`UPDATE … WHERE version = 42`) — the loser
  updates 0 rows and retries. The DB is the arbiter; this **is** fencing built in.
- **Single-writer via partitioning (Days 11, 15):** route all work for a key to **one** consumer
  (Kafka partition / consistent hashing) → mutual exclusion is **structural**, no lock.
- **Queue visibility timeout** (SQS) or **DB-native locks** (`SELECT … FOR UPDATE`, Postgres advisory
  locks) when already in a transaction.

Rule: **efficiency → single-node Redis lease is fine; correctness → remove the need first; if you
truly can't, consensus store + fencing tokens.**
</details>

---

**Q10 (interview close). In 30 seconds: distributed locks, Redlock, the critique, and what you did in
production?**

<details><summary>answer</summary>

"A distributed lock is a **remote lease** — the danger is a holder that thinks it still owns the lock
after expiry. Single-node Redis is `SET key uuid NX PX ttl` + an **atomic token-checked Lua delete**;
its hole is that **async replication** can duplicate the lock on failover. **Redlock** fixes that
with **5 nodes and majority quorum** — but **Kleppmann** showed quorum can't stop a **GC pause** past
the TTL, so a stale holder still writes. The real fix is **fencing tokens**: a monotonic number the
**storage layer** checks to reject stale writers. So for **correctness** I'd use a **consensus store
(ZK/etcd)** — session-based release plus native tokens — over a bare TTL lock. But the move I
actually made in fintech was to **not lock at all**: payments used an **idempotency key**, not a lock
around the charge, so a retry or duplicate webhook is a harmless no-op. Locks for efficiency; for
correctness, prefer idempotency, CAS, or single-writer partitioning."
</details>

---

> Next (building blocks): **unique ID generation (Snowflake)** — fencing tokens are just monotonic
> unique numbers; now generate IDs that are **unique, time-sortable, and shard-friendly** across many
> machines without a central bottleneck.
