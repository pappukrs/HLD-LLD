# SD Day 19 — Quiz: Unique ID Generation (Snowflake)

*Answer each OUT LOUD before expanding. The signal here is precision: you should recite the bit
layout cold (Q3), do the capacity math (Q4), name the clock-backwards mitigation (Q5), and know
that Snowflake is **k-sorted, not strictly ordered** (Q6) — that nuance separates "read a blog post"
from "understands it."*

---

**Q1. State the requirements for a distributed ID scheme before naming any solution. Which one is
non-negotiable?**

<details><summary>answer</summary>

(1) **Globally unique** — non-negotiable; two machines must never mint the same ID. (2) **No
central bottleneck/SPOF** — generation must be local; a single ID service caps fleet-wide write
throughput and is a single point of failure. (3) **Roughly time-sortable (k-sorted)** — `ORDER BY
id` ≈ `ORDER BY created_at`; makes pagination, recency queries, and B-tree appends cheap. (4)
**Compact** — 64 bits fits a `BIGINT`, keeps indexes and foreign keys small. (5) **High
throughput** — thousands/sec per node without a network call.
</details>

---

**Q2. Why does DB auto-increment fail at scale, and why is UUIDv4 not the fix? Include the B-tree
argument.**

<details><summary>answer</summary>

**Auto-increment:** one sequence on one node → every write in the fleet waits on it (throughput
ceiling + SPOF), and sharding breaks it outright — shard A and shard B both mint "1001." **UUIDv4:**
coordination-free but 128 **random** bits — no time signal, so not sortable, and twice the index/FK
size. The killer (Day 5): random primary keys land at **random positions in the B-tree** instead of
appending to the rightmost leaf → constant page splits, cold-cache reads, write amplification.
Sequential-ish keys append; random keys **spray**. UUIDv7/ULID fix exactly this by putting a
timestamp in the high bits.
</details>

---

**Q3. Draw the Snowflake 64-bit layout from memory and justify each field.**

<details><summary>answer</summary>

`1 sign | 41 timestamp | 10 machine | 12 sequence`.
- **1 sign bit = 0** — keeps it positive as a signed 64-bit int (BIGINT-safe).
- **41 bits** — milliseconds since a **custom epoch** (your launch date, not Unix epoch) → ~**69
  years** of range; high-bit placement is what makes IDs sortable.
- **10 bits machine id** (Twitter: 5 datacenter + 5 worker) → **1024 generators**; uniqueness across
  machines without communication.
- **12 bits sequence** — per-machine counter resetting each millisecond → **4096 IDs/ms/machine**.
Uniqueness = (timestamp, machine, sequence) can never repeat: time moves forward per machine,
machine ids are distinct, sequence disambiguates within one machine-millisecond. Bonus: `id >> 22`
recovers the creation time.
</details>

---

**Q4. Capacity math: how many IDs per second can one machine mint, and the whole fleet? What happens
when a machine exhausts the sequence within a millisecond?**

<details><summary>answer</summary>

4096 per ms → ~**4.1M IDs/sec per machine**; × 1024 machines → ~**4.2B IDs/sec** fleet-wide
theoretical. On exhaustion the generator **spins (busy-waits) until the next millisecond** and
resets the sequence to 0 — it never re-mints within the same ms. In practice one machine rarely
sustains 4M/s, so the spin is a rare micro-stall, not a real bottleneck.
</details>

---

**Q5. The clock-backwards problem: what causes it, why is it dangerous, and what are the
mitigations?**

<details><summary>answer</summary>

**NTP corrections can step the wall clock backwards** (also VM migrations, manual changes). Danger:
the machine re-mints timestamps it already used → **duplicate IDs** — the one absolute sin.
Mitigations: (1) track `lastTimestamp` and **refuse to go backwards** — if the drift is a few ms,
**wait it out**; if large, **throw and alert**, never silently mint; (2) run NTP in **slew mode**
(gradual skew, never step) on generator hosts; (3) keep minting on the last timestamp, **burning
leftover sequence numbers** until real time catches up.
</details>

---

**Q6. "Snowflake IDs are sorted" — correct this statement precisely. Why can't a Snowflake ID be
used as a fencing token (Day 18)?**

<details><summary>answer</summary>

They are **k-sorted**: strictly monotonic **per machine**, only approximately ordered globally —
clock skew between machines means machine A can mint a *smaller* ID *after* machine B minted a
larger one. Fine for feeds, pagination, range scans. A **fencing token** requires **strict global
monotonicity from a single arbiter** — the resource compares tokens to reject stale holders, and
"approximately increasing" can wrongly accept a stale writer. Snowflake deliberately traded strict
ordering away to get coordination-free generation; fencing needs the opposite trade (consensus
store, e.g. ZooKeeper's zxid).
</details>

---

**Q7. How do the 10 machine-id bits get assigned safely? What's the zombie trap?**

<details><summary>answer</summary>

Options: **static config** (small stable fleets), **ephemeral registration in ZooKeeper/etcd at
boot** — the session lease frees the id when the node dies; coordination happens **once at startup,
never on the minting path** — or **Kubernetes StatefulSet ordinal** (pod `gen-3` → worker 3). The
trap: **reusing a worker id while the old holder is paused-not-dead** (Day 18's zombie) — two live
generators share machine bits → duplicate IDs. Ephemeral-session leases prevent this; "pick a
random id at boot" does not.
</details>

---

**Q8. Explain the ticket-server and segment-allocation alternatives. When does each make sense?**

<details><summary>answer</summary>

**Ticket server (Flickr):** two MySQL boxes doing `REPLACE INTO` on auto-increment counters, one
minting **odd** IDs, one **even** (`auto_increment_offset` 1/2, increment 2). Redundant and dead
simple, but a network hop per fetch and only rough ordering — the "simplest thing that works"
answer for modest scale. **Segment/range (Meituan Leaf):** each node leases a **block** (e.g. 100k
IDs) via one DB update (`max_id = max_id + 100000`), then mints **in memory**; one DB write per
100k IDs amortizes the bottleneck away; double-buffer the next segment to avoid stalls. Restarts
burn unused ranges (gaps — acceptable). Choose it when you want DB-simple infrastructure and can
accept per-node-only ordering.
</details>

---

**Q9. When would you pick UUIDv7/ULID over Snowflake, and vice versa? And where does Mongo's
ObjectId sit?**

<details><summary>answer</summary>

**UUIDv7/ULID:** timestamp in the high bits + randomness in the low bits → k-sorted **and**
coordination-free with **zero infrastructure** (no worker-id registry, no epoch to manage). Pick it
when **128 bits is acceptable**. **Snowflake:** pick when you need **64-bit** IDs (BIGINT columns,
tight indexes, FK-heavy schemas) or explicit control of the bit budget — the price is running
worker-id assignment. **ObjectId:** 96 bits — 4B seconds-timestamp + 5B machine/process + 3B
counter — the same timestamp+machine+counter idea, coordination-free, k-sorted; if you've shipped
Mongo you've been using Snowflake's cousin all along.
</details>

---

**Q10 (senior aside). What do time-ordered IDs leak, and what's the historical name for it?**

<details><summary>answer</summary>

Sequential/time-ordered IDs let outsiders **estimate creation time and production volume** by ID
arithmetic — the **German tank problem**: Allied statisticians estimated tank production from
captured serial numbers. Public-facing IDs therefore sometimes add deliberate randomness (UUIDv7's
random low bits) or get encoded/obfuscated, keeping the sortable internal ID private.
</details>

---

**Q11 (interview close). In 30 seconds: distributed ID generation, Snowflake, and your production
bridge?**

<details><summary>answer</summary>

"IDs at scale must be **unique, k-sorted, compact, and minted locally** — no central service on the
write path. Auto-increment centralizes and dies under sharding; UUIDv4 is coordination-free but
random — unsortable and it sprays B-tree inserts. **Snowflake** packs 41 bits of milliseconds, 10
bits of machine id, and a 12-bit per-ms sequence into a BIGINT: 4096 IDs/ms/machine, no network
call, `id >> 22` gives you the timestamp free. Operationally you guard **clock-backwards** (track
last timestamp, wait or alert) and **lease worker ids** via ephemeral ZK/etcd sessions or
StatefulSet ordinals. It's **k-sorted, not strict** — great for feeds, not a fencing token. I've
effectively shipped this for years: Mongo's ObjectId is the same timestamp+machine+counter design,
and in fintech our k-sorted transaction IDs made reconciliation an ID-range scan. If 128 bits is
fine and you want zero infra, **UUIDv7** is the modern default."
</details>

---

> Next (building blocks): **Elasticsearch internals — the inverted index.** IDs name billions of
> documents; search is how you find them — flipping "document → words" into "word → documents."
