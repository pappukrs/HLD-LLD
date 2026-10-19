# SD Day 9 — CAP theorem + PACELC (the practical version, not the meme)

*(~1 hr · the rule that decides what your system does when the network breaks — and, with PACELC, what it does when the network is fine. Sits on top of Day 7 (replication, sync vs async) and Day 8 (sharding); feeds Day 10 (consistency models). This is the framing senior engineers reach for in the first 5 minutes of a design.)*

---

## 1. The one line that frames it

> **CAP isn't "pick 2 of 3." In a real distributed system partitions WILL happen, so P is not
> optional — the only real choice is: when a partition hits, do you keep answering with possibly
> stale data (AP), or refuse to answer rather than be wrong (CP)?**

That's the whole theorem in one sentence. The "pick 2 of 3" phrasing is the meme version and it
makes people say nonsense like "we chose CA." You don't choose CA — a single-node database is CA,
but the moment you have two nodes talking over a network, the network *can* drop messages, and
you're forced to pick C-or-A *during that window*.

---

## 2. The three letters, said precisely

- **C — Consistency** (here = *linearizability*): every read sees the most recent write, or an
  error. All nodes agree on "the latest value." (Note: this is **not** the C in ACID — same word,
  different meaning. CAP-C is about all replicas agreeing; ACID-C is about DB invariants.)
- **A — Availability:** every request gets a **non-error** response — but not necessarily the
  latest data. The system always answers.
- **P — Partition tolerance:** the system keeps operating even when the network **drops or delays
  messages** between nodes.

**Hook:** *"C = always correct, A = always answers, P = survives a broken network. You can't have
all three the instant a message is lost."*

---

## 3. Why "P is not optional" — the part most people miss

A partition is any time nodes can't talk: a switch dies, a cable is cut, a GC pause makes a node
look dead, a cross-region link gets congested. You **cannot** prevent this — networks are
unreliable by nature. So in any multi-node system, P is a given, and CAP collapses to a binary:

> **During a partition: CP (sacrifice availability) or AP (sacrifice consistency).**

When there's **no** partition (the normal case, 99.9% of the time), you get **both** C and A.
CAP only bites during the partition window. That's the senior insight — CAP is a statement about
**failure-mode behavior**, not steady state.

```
Partition happening?
  ├── NO  → you have both C and A. (CAP says nothing here — that's PACELC's job, §6)
  └── YES → choose:
        CP → return error / block until you can guarantee correctness
        AP → return an answer, accept it might be stale
```

---

## 4. CP vs AP — what each one literally does when the network splits

Imagine a leader–follower setup (your Day 7 muscle) split into two sides that can't reach each other.

- **CP system:** the side that can't confirm it has the latest data **refuses writes (and maybe
  reads)** — it would rather error than risk returning/accepting wrong data. *Banks, inventory,
  bookings.* Example tech: a single-leader RDBMS with synchronous replication, ZooKeeper/etcd
  (quorum), HBase, MongoDB with majority writes.
- **AP system:** **both** sides keep accepting reads and writes; they reconcile later (last-write-
  wins, vector clocks, CRDTs). *Shopping carts, social feeds, device "last seen," DNS.* Example
  tech: Cassandra, DynamoDB (default), Riak.

**Hook:** *"CP would rather say 'sorry, try later' than lie. AP would rather give you a slightly
old answer than go down."*

---

## 5. Map it to YOUR systems (this is what you say in the interview)

- **Payments / fintech ledger (your RabbitMQ/gRPC microservices):** **CP.** You must never
  double-spend or show a wrong balance. Better to reject a transaction and retry than to accept a
  conflicting one during a partition. Pair this with your **outbox/saga** knowledge (Day 12) — that's
  how you stay correct *across* services.
- **10k+ IoT device telemetry / "last seen" status:** **AP.** If a region is partitioned, you'd
  rather keep ingesting device data and showing slightly-stale status than reject everything.
  Reconcile on heal.
- **Real-time messaging (your NestJS/Redis/WS platform):** usually **AP for delivery/presence**
  (show the message, fix ordering later) but you might want **CP for the "has this message been
  persisted" acknowledgment**. Good interview nuance: *different parts of one product pick
  differently.*

> The senior move isn't "we're an AP system." It's **"this subsystem is CP because correctness is
> non-negotiable; that one is AP because availability matters more than freshness."**

---

## 6. PACELC — the upgrade that covers the 99.9% when nothing is broken

CAP only describes the partition case. **PACELC** adds the normal case:

> **if Partition (P) → choose A or C;  Else (E) → choose Latency (L) or Consistency (C).**

The "Else" half is the real day-to-day tradeoff: even with a healthy network, **strong consistency
costs latency** (you must wait for a quorum / the leader to confirm). Want lower latency? Relax
consistency. This is the knob you actually turn far more often than you hit a partition.

**The four buckets (and the tech that lives there):**

| Class | Partition → | Normal → | Examples |
|---|---|---|---|
| **PA/EL** | stay Available | favor Latency | Cassandra, DynamoDB (default), Riak |
| **PC/EC** | stay Consistent | favor Consistency | single-leader RDBMS (sync), HBase, etcd/ZooKeeper, MongoDB (majority) |
| **PA/EC** | stay Available | favor Consistency | rarer — MongoDB can be tuned toward this |
| **PC/EL** | stay Consistent | favor Latency | rarer |

**Hook:** *"CAP is what happens when the network breaks. PACELC adds: even when it's fine, do you
pay latency for consistency, or buy speed with staleness?"*

Most real debates are **PA/EL vs PC/EC** — "fast & eventually consistent" vs "correct & a bit
slower." Dynamo-style stores chose EL on purpose; that's why DynamoDB makes you *opt in* to a
strongly-consistent read (and charges you more latency/cost for it).

---

## 7. The traps that catch people

1. **"We're CA."** No. CA = one node. The instant it's distributed, P is forced. Saying "CA"
   signals you haven't internalized §3.
2. **Conflating CAP-C with ACID-C.** Different things (see §2). An ACID database can still be AP at
   the cluster level, and a CP system isn't automatically ACID.
3. **Treating it as a whole-system label.** Real systems are **per-operation**: DynamoDB is AP by
   default but offers consistent reads; your payments service is CP for the ledger but its
   read-only dashboard can be AP.
4. **Forgetting tunable consistency.** Cassandra/Dynamo let you pick consistency **per query** via
   quorums: `R + W > N` ⇒ strong-ish; smaller ⇒ faster but staler. CAP/PACELC isn't always a
   one-time architecture decision — sometimes it's a request parameter.

---

## 8. The whole day on one page (say it out loud)

> *"Partitions are inevitable, so CAP is really a binary that only triggers when the network splits:
> CP refuses to answer rather than be wrong, AP answers but might be stale. When the network is
> healthy, CAP is silent and PACELC takes over — strong consistency costs latency, so you trade
> freshness for speed. I don't label a whole system; I pick per subsystem: my payments ledger is
> CP/EC because correctness is non-negotiable, my IoT telemetry and feeds are AP/EL because
> availability and speed beat freshness, and stores like DynamoDB and Cassandra even let me choose
> per request with quorums."*

**Why it matters tomorrow:** Day 10 is **consistency models** (strong, eventual, read-your-writes,
monotonic reads). That's the zoom-in on the "C" you just chose here — once you've said "AP/eventual,"
Day 10 is the menu of *exactly how* eventual, and which guarantee each use case actually needs.
