# SD Day 16 — Bloom Filters & Count-Min Sketch

*(~1 hr · building-blocks block. Day 15 was **placement** — the ring that decides *which node* owns a
key. Today is about what each node keeps *about* its keys **without storing the keys themselves**:
probabilistic structures that trade a little accuracy for **huge** memory savings. Pairs with Day 3
(caching — bloom filters guard the cache/DB), Day 5–6 (DB internals — LSM/Cassandra use bloom filters
per SSTable), Day 13 (rate limiting — count-min sketch counts events cheaply), and Day 20 (search).
The theme: **"I don't need the exact answer, I need a cheap 'probably' that's never catastrophically
wrong in the direction that hurts."**)*

---

## 1. Why approximate structures exist

Exact membership ("is `x` in this set?") or exact counts ("how many times have I seen `x`?") normally
mean storing **every element** — a hash set, a `Map`, a DB table. At scale that's **gigabytes of RAM**
you may not have (billions of URLs, keys, events). 

**Probabilistic data structures** answer the same questions in a **tiny, fixed** amount of memory by
allowing a **bounded, one-sided error**. The trick that makes them safe: the error only ever goes in
**one direction**, and you pick which direction based on what's cheap to double-check.

> **One line:** *Trade exactness for memory: get a fast "probably yes / definitely no" (or an
> "over-estimate, never under") answer in kilobytes instead of gigabytes.*

Today's two workhorses: **Bloom filter** (approximate **membership**) and **Count-min sketch**
(approximate **frequency**).

---

## 2. Bloom filter — "definitely not, or maybe yes"

A **bloom filter** answers *"is `x` in the set?"* using a **bit array of `m` bits** and **`k` hash
functions** — and it **stores none of the actual elements**.

**Add(x):** hash `x` with all `k` functions → `k` positions in the bit array → **set those bits to 1**.

**Query(x):** hash `x` the same way → look at those `k` bits.
- If **any** bit is `0` → `x` is **definitely NOT** in the set. (You never cleared a bit, so if it were
  added, all `k` would be 1.)
- If **all** `k` bits are `1` → `x` is **probably** in the set… but maybe those bits were set by
  *other* elements. That's a **false positive**.

```
m = 16 bits, k = 3
add "cat"  → bits {2, 7, 11} = 1
add "dog"  → bits {4, 7, 14} = 1        (bit 7 now shared)
query "cat"→ {2,7,11} all 1  → "maybe"  ✅ (true positive)
query "fox"→ {3, 9, 14}: bit 3 is 0     → "definitely not" ✅
query "owl"→ {2, 4, 11} all 1 by luck   → "maybe"  ❌ (false positive — never actually added)
```

**The guarantee is one-sided:**
- ✅ **No false negatives** — a "definitely not" is *always* true.
- ❌ **False positives possible** — a "maybe" might be wrong; the rate rises as the filter fills.

> **Hook:** *"A bloom filter can lie 'yes' but never lies 'no.' So use it where a wrong 'yes' is cheap
> to verify and a wrong 'no' would be a disaster."*

**No deletes.** You can't clear a bit — it might be shared with another element (clearing it would
create a false *negative*). To support deletes you need a **counting bloom filter** (each slot is a
small counter you increment/decrement instead of a single bit).

### The knobs (know the shape, not the derivation)
- More bits `m` → fewer collisions → **lower** false-positive rate.
- More elements `n` added → more bits set → **higher** false-positive rate.
- There's an **optimal `k`** ≈ `(m/n) · ln 2`. Roughly: sizing for ~**10 bits per element** with the
  optimal `k` (~7) gives a **~1%** false-positive rate. Want 0.1%? ~15 bits/element. Memory grows
  *linearly* as the error target shrinks *geometrically* — very cheap.
- **You must size it up front** for your expected `n`. Overfill it and the false-positive rate
  degrades toward useless. (Scalable/partitioned bloom filters handle unknown `n` by chaining filters.)

---

## 3. Where bloom filters actually earn their keep

The pattern is always the same: **put a cheap bloom filter in front of an expensive lookup, so the
expensive path only runs when the answer might be "yes."**

- **Cache/DB guard against "one-hit-wonders":** before hitting the DB for a key, ask the bloom filter
  "have we ever seen this key?" A "definitely not" skips the DB entirely. This is a real fix for the
  **cache-penetration** problem (Day 3) — floods of requests for keys that *don't exist* would
  otherwise bypass the cache and hammer the DB.
- **LSM-tree / Cassandra / HBase / RocksDB:** each on-disk **SSTable** has a bloom filter. To read a
  key, check each table's filter first — "definitely not" lets you **skip a disk read**. This is why
  LSM reads stay fast despite many files. (Ties to Day 5 DB internals.)
- **"Have I seen this before?" at scale:** web crawlers (already-visited URLs — Day 20), dedup of
  events, "has this user already seen this post," malicious-URL/password blocklists (Chrome's Safe
  Browsing).
- **Networking/CDN:** deciding whether content *might* be cached at an edge before doing the real
  lookup.

> The interview line: *"I'd front the DB with a bloom filter so lookups for non-existent keys short-
> circuit before touching disk — a 'definitely not' is free, and a rare false-positive just costs one
> normal DB read that returns empty."*

---

## 4. Count-min sketch — "count without storing the keys"

A bloom filter says *whether* you've seen something. A **count-min sketch (CMS)** says *how many times*
— frequency estimation in **fixed memory**, again without storing the keys.

**Structure:** a 2-D array of counters — **`d` rows × `w` columns** — with **one hash function per
row** (each maps a key to a column `0…w−1`).

**Increment(x):** for each of the `d` rows, hash `x` → a column → **`+1`** that counter. (So one update
touches `d` counters, one per row.)

**Estimate(x):** hash `x` the same way into each row, read the `d` counters, and return the
**minimum** of them.

```
d = 3 rows, w = 5 cols
inc "cat" → row0[3]++, row1[1]++, row2[4]++
inc "cat" → same three ++     (now those = 2)
estimate "cat" = min(row0[3], row1[1], row2[4]) = 2
```

**Why the minimum?** Every counter for `x` is `true_count(x) + collisions from other keys`. Collisions
only ever **add**, never subtract — so **every** counter is an **over-estimate**. Different rows collide
with *different* other keys, so the **smallest** counter has suffered the fewest collisions and is the
**tightest over-estimate**.

**The guarantee is one-sided the other way:**
- ✅ **Never under-counts** — the estimate is always ≥ the true count.
- ❌ **May over-count** — collisions inflate it (worse for rare keys; heavy hitters dominate their
  counters, so their estimate is nearly exact).

> **Hook:** *"Bloom = one-sided on membership (never says a false 'no'). Count-min = one-sided on
> counts (never under-counts). Both add up collisions and only err in the safe direction — CMS returns
> the **min** row to squeeze the error out."*

Knobs: more columns `w` → less collision → tighter counts; more rows `d` → the min over more independent
estimates → lower chance the answer is badly inflated. Like bloom, it's **fixed-size and can't be
deleted from** cleanly, and it can't enumerate the keys — only estimate a count you already have the key
for.

---

## 5. Where count-min sketch earns its keep

- **Heavy hitters / top-K at scale (Day 26):** trending hashtags, most-viewed products, top talkers on
  a network — count a firehose of events in kilobytes. Pair CMS (frequencies) with a small heap of
  candidate keys to maintain top-K.
- **Distributed rate limiting (Day 13):** approximate per-key request counts without a counter row per
  user — a wrong-high count just throttles a hair early, which is acceptable.
- **Analytics/streaming:** approximate frequency in Spark/Flink/Redis (Redis ships a CMS in RedisBloom)
  where exact counts per key would blow memory.
- **DB query planners:** frequency estimates to pick a plan.

> The reason the over-count direction is chosen: in rate limiting or abuse detection, **over-counting a
> heavy hitter is safe** (you throttle/flag slightly eagerly); under-counting would let an abuser
> through. Pick the structure whose error points away from the failure you fear.

---

## 6. The two, side by side (say this)

| | Bloom filter | Count-min sketch |
|---|---|---|
| Question | "Is `x` in the set?" (membership) | "How often have I seen `x`?" (frequency) |
| Memory | bit array `m` + `k` hashes | `d × w` counter grid, `d` hashes |
| Error direction | false **positive** ("maybe" can be wrong) | **over**-count (never under) |
| Never wrong about | false **negatives** ("no" is truth) | under-counting (estimate ≥ truth) |
| Combine by | OR-ing bits | taking the **min** counter |
| Deletes | no (use counting bloom) | no |
| Can list keys? | no | no |

> **The unifying idea:** both hash into a **shared, fixed** array so different keys **collide**, and
> both make the collision error **one-sided** — you choose the direction (never-false-no /
> never-under-count) so a wrong answer is the *cheap* kind. You size them for a target error, not for
> the data volume, so memory stays flat as data grows.

---

## 7. Map it to YOUR systems (interview gold)

- **IoT / event dedup (10k+ devices):** a bloom filter to answer "have I already processed this device
  event / message id?" cheaply before hitting the store — false positive just means one real lookup
  that finds it already handled.
- **Real-time messaging / feeds:** "has this user already seen this message/post?" — a bloom filter per
  user (or a shared one) avoids a DB read on the hot path.
- **Fintech abuse / velocity checks:** a **count-min sketch** of per-card / per-account event
  frequency to flag anomalies without a per-key counter — and over-counting is the *safe* error for
  fraud throttling.
- **Trending / analytics on a firehose:** CMS + top-K heap for "most active rooms / most-called
  endpoints" when exact counts would be too much state.

> The interview line: *"When exact membership or counts would cost too much RAM, I reach for
> probabilistic structures: a **bloom filter** to short-circuit lookups for keys that are 'definitely
> not there' (it never gives a false negative, so a rare false positive just costs one wasted read),
> and a **count-min sketch** to estimate frequencies for top-K or rate limiting (it never under-counts,
> so over-counting is the safe error). I size both for a target error rate, so memory stays constant as
> the data grows."*

---

## 8. The traps that catch people

1. **Getting the error direction backwards.** Bloom: false **positives**, never false negatives.
   CMS: **over**-counts, never under. Say which one *can't* happen — that's the whole reason the
   structure is safe to use.
2. **Trying to delete from a plain bloom filter.** Clearing a bit can create a false *negative* and
   break the core guarantee. Use a **counting** bloom filter if you need removal.
3. **Not sizing up front / overfilling.** A bloom filter has an optimal `k` and a capacity `n`; blow
   past it and the false-positive rate climbs toward useless. Mention "~10 bits/element ≈ 1%."
4. **Expecting to list the members / exact counts.** Neither structure can enumerate keys or give exact
   answers — they answer a yes/no or a bounded estimate for a key **you already hold**.
5. **Using them where errors are unacceptable.** Don't put a bloom filter where a false positive is
   catastrophic *and* unverifiable. The pattern only works when the "maybe" is **cheaply
   double-checkable** (e.g., by the real DB lookup behind it).
6. **Confusing the two.** Bloom = *presence*; CMS = *frequency*. HyperLogLog (a cousin, not today) =
   *cardinality* ("how many **distinct** items"). Different questions.

---

## 9. The whole day on one page (say it out loud)

> *"When storing every key for exact membership or counts would cost too much RAM, I use probabilistic
> structures that trade a bounded, **one-sided** error for tiny fixed memory. A **bloom filter** answers
> membership with a bit array and `k` hashes: if any of a key's bits is 0 it's **definitely not**
> present; if all are 1 it's **probably** present — so it has **no false negatives**, only false
> positives, which makes it perfect for guarding an expensive lookup (front a DB or an SSTable so
> 'definitely not' skips the read; a rare false positive just costs one normal lookup). It can't delete
> without a counting variant and must be sized up front for a target rate — roughly 10 bits per element
> for ~1%. A **count-min sketch** answers frequency with a `d×w` grid of counters and one hash per row;
> you increment one counter per row and estimate by taking the **minimum**, because collisions only add,
> so it **never under-counts** — ideal for top-K/heavy-hitters and approximate rate limiting where
> over-counting is the safe error. The unifying trick in both: hash into a shared fixed array, let keys
> collide, and make the collision error point in the direction that's cheap to be wrong."*

**Why it matters next:** these structures sit *on* the shards Day 15 placed, and guard the caches/DBs of
Days 3–6. Next building block: **unique ID generation (Snowflake)** — how to mint keys that are unique,
time-sortable, and shard-friendly across a distributed system — then WebSockets/SSE at scale.
