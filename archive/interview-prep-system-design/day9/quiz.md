# SD Day 9 — Quiz: CAP + PACELC

*Answer each OUT LOUD, in full sentences, before expanding the answer. If you can't say it in your
own words, re-read that section. Target: explain CAP to a peer in 60 seconds (Q1–Q3).*

---

**Q1. Why is "CAP = pick 2 of 3" misleading? What's the correct framing?**

<details><summary>answer</summary>

Because in a distributed system **P is not optional** — networks drop messages, so partitions will
happen. You can't choose to not be partition-tolerant; you'd just be a single node (CA). So the real
choice is binary and only triggers **during a partition**: **CP** (refuse/err to stay correct) or
**AP** (answer but possibly stale). When there's no partition, you get both C and A.
</details>

---

**Q2. Define C, A, and P precisely. Which "C" is it — and which C is it NOT?**

<details><summary>answer</summary>

- **C (consistency / linearizability):** every read returns the most recent write or an error; all
  nodes agree on the latest value.
- **A (availability):** every request gets a non-error response (maybe stale).
- **P (partition tolerance):** keeps operating despite dropped/delayed inter-node messages.

It is **not** the C in ACID. ACID-C = database invariants/constraints hold. CAP-C = all replicas
agree on the latest value. Same letter, different concept.
</details>

---

**Q3. During a partition, describe exactly what a CP system does vs an AP system.**

<details><summary>answer</summary>

- **CP:** the side that can't guarantee it has the latest data **rejects/blocks** writes (and often
  reads) — errors rather than risks wrong data. (RDBMS sync, etcd/ZooKeeper, HBase, Mongo majority.)
- **AP:** both sides keep serving reads/writes and **reconcile later** (LWW, vector clocks, CRDTs).
  (Cassandra, DynamoDB, Riak.)

Hook: *CP would rather say "try later" than lie; AP would rather be slightly old than go down.*
</details>

---

**Q4. Say "CA system" is a red flag. Why?**

<details><summary>answer</summary>

CA only exists on a **single node**. The moment data is on ≥2 networked nodes, the link can fail, so
P is forced and you must pick C or A during that failure. Claiming "we built a CA distributed system"
means you haven't internalized that partitions are unavoidable.
</details>

---

**Q5. State PACELC. What does the "Else" half capture that CAP ignores?**

<details><summary>answer</summary>

**if Partition → A or C; Else → Latency or Consistency.** The "Else" half covers the **normal,
healthy-network case** (99.9% of the time), which CAP says nothing about: even with no partition,
**strong consistency costs latency** (wait for quorum/leader). So you trade freshness for speed. This
is the knob you actually turn far more often than you hit a partition.
</details>

---

**Q6. Classify these and justify: DynamoDB (default), a sync single-leader Postgres, Cassandra, etcd.**

<details><summary>answer</summary>

- **DynamoDB default / Cassandra → PA/EL:** stay available during partitions; favor low latency
  (eventual consistency) normally. (DynamoDB lets you opt into a consistent read for extra latency.)
- **Sync single-leader Postgres / etcd → PC/EC:** stay consistent during partitions; favor
  consistency (pay latency) normally.
</details>

---

**Q7. For each of YOUR systems, pick CP or AP and defend it in one sentence: (a) payments ledger,
(b) IoT device "last seen" for 10k+ devices, (c) chat message delivery/presence.**

<details><summary>answer</summary>

- **(a) Payments ledger → CP/EC:** correctness is non-negotiable; reject and retry rather than risk a
  double-spend during a partition.
- **(b) IoT last-seen → AP/EL:** keep ingesting and show slightly-stale status rather than reject a
  whole region; reconcile on heal.
- **(c) Chat → mostly AP** for delivery/presence (show it, fix ordering later), but you may want **CP**
  on the "message durably persisted" acknowledgment. Good nuance: *per-subsystem, not whole-system.*
</details>

---

**Q8. What does `R + W > N` give you, and why does it make CAP/PACELC a per-request choice?**

<details><summary>answer</summary>

In a quorum store with N replicas, requiring read-replicas `R` + write-replicas `W` to overlap
(`R + W > N`) guarantees a read sees the latest write → strong-ish consistency. Smaller R/W → faster
but staler. Because you set R/W **per query**, the consistency↔latency tradeoff (PACELC's EL/EC) can
be chosen **per request**, not just once at architecture time.
</details>

---

**Q9 (interview close). In 30 seconds: how do you decide C vs A for a new feature?**

<details><summary>answer</summary>

"Ask: if the network splits, is a wrong/conflicting answer worse than no answer? If yes (money,
inventory, bookings) → CP. If no, and downtime is worse than staleness (feeds, presence, telemetry)
→ AP. Then for the normal case, decide via PACELC whether this path can pay latency for strong
consistency or needs low latency with eventual — and remember I can often choose per operation or
per query, not for the whole system."
</details>

---

> Tomorrow (Day 10): **consistency models** — strong, eventual, read-your-writes, monotonic reads.
> That's the zoom-in on the "C" you chose today: *exactly how* eventual, and which guarantee each
> use case needs.
