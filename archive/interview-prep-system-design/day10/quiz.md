# SD Day 10 — Quiz: Consistency Models

*Answer each OUT LOUD, in your own words, before expanding. If you fumble, re-read that section.
Target: walk the spectrum strong→eventual and name what each session guarantee fixes (Q1–Q4).*

---

**Q1. What is a "consistency model" in one sentence, and how is it different from yesterday's CAP choice?**

<details><summary>answer</summary>

A consistency model is the **promise about what a read is allowed to return** — from "always the
latest write" (strong) to "some past value that converges eventually." CAP/AP-vs-CP was the
**failure-mode** choice (what happens *during a partition*); consistency models are the
**steady-state dial** (how fresh reads are when the network is healthy). Day 9 = binary at partition
time; Day 10 = the fine-grained menu the rest of the time.
</details>

---

**Q2. Define linearizable (strong) and eventual consistency. What does each cost / buy you?**

<details><summary>answer</summary>

- **Linearizable/strong:** behaves as if there's **one single copy** — every read returns the latest
  committed write. Costs **latency** (wait for leader/quorum); buys **correctness**. (etcd, Spanner,
  sync RDBMS.)
- **Eventual:** replicas may disagree now but **converge** once writes stop. Costs **freshness** (you
  can read stale); buys **low latency + high availability**. (DynamoDB default, Cassandra, DNS.)
</details>

---

**Q3. Pure eventual consistency allows two specific user-visible glitches. Name them and the guarantee that fixes each.**

<details><summary>answer</summary>

- **You post something and on refresh it's gone** (read hit a lagging replica) → fixed by
  **read-your-writes**.
- **A value/feed jumps backwards** (you saw X=5, then a later read shows X=4) → fixed by
  **monotonic reads**.

Both are patched cheaply *on top of* eventual — no need to jump to full strong consistency.
</details>

---

**Q4. How do you actually implement read-your-writes? Give two concrete tricks.**

<details><summary>answer</summary>

- After a user writes, **route that user's reads to the leader** for a few seconds.
- **Pin the user to the replica that received their write**, or track "user's last write at timestamp
  T" and only read from a replica caught up past T.

Key point: it's a guarantee about **your own** writes only — everyone else may still see the old
state for a moment, which is cheap.
</details>

---

**Q5. What is causal consistency, and why is it the popular "sweet spot"?**

<details><summary>answer</summary>

Causal consistency preserves every **cause→effect** relationship — if B was written after seeing A,
no one can see B without also seeing A (e.g. a reply never appears before the message it answers) —
but it **doesn't bother ordering unrelated writes**. That makes it **strong enough to feel correct**
to users yet **cheap enough to scale**, because you skip the expensive global total-ordering that
linearizability demands. It's basically the session guarantees (read-your-writes, monotonic
reads/writes, writes-follow-reads) stitched together globally.
</details>

---

**Q6. Monotonic reads vs monotonic writes — one sentence each.**

<details><summary>answer</summary>

- **Monotonic reads:** once you've seen a value, you'll **never see an older one** later — time
  doesn't go backwards for your session.
- **Monotonic writes:** your own writes are applied **in the order you issued them** (set-name then
  set-avatar won't reorder).
</details>

---

**Q7. For each of YOUR systems pick a level and defend it in one sentence: (a) payments ledger, (b) chat, (c) IoT "last seen" dashboard.**

<details><summary>answer</summary>

- **(a) Ledger → linearizable/strong:** a balance read must reflect every committed transaction; no
  session shortcut is enough.
- **(b) Chat → causal + read-your-writes:** a reply must not appear before its message (causal), and
  you must always see the message you just sent (read-your-writes); global strong ordering would be
  needless latency.
- **(c) IoT dashboard → eventual + monotonic reads:** stale status is fine, but the device's state
  shouldn't flicker newer→older→newer.
</details>

---

**Q8. How do quorums (`R + W > N`) relate to consistency models?**

<details><summary>answer</summary>

Quorums are the **knob**; consistency models are the **names for what the knob produces.** Large
`R`/`W` so they overlap (`R + W > N`) → a read sees the latest write → strong-ish. Small `R`/`W` →
faster but staler → eventual. Because you set R/W **per query**, you can choose the consistency level
**per request**, not once for the whole system.
</details>

---

**Q9 (interview close). In 30 seconds: how do you decide a consistency level for a new feature?**

<details><summary>answer</summary>

"Ask: does a stale or out-of-order read actually hurt? If a wrong value is dangerous — money,
inventory, locks — go **linearizable**. If staleness is harmless — feeds, counts, telemetry — go
**eventual**, then add the cheapest session guarantees that remove the obvious glitches:
**read-your-writes** so users see their own edits, **monotonic reads** so things don't go backwards,
and **causal** where cause/effect matters like replies. It's per-subsystem, and with quorums I can
even tune it per request."
</details>

---

> Tomorrow (Day 11): **Message queues deep — RabbitMQ vs Kafka.** Same ordering/delivery ideas
> (in what order do consumers see events? can they see one twice?) applied to event streams instead
> of reads — your RabbitMQ experience meets Kafka's log model, consumer groups, exactly-once.
