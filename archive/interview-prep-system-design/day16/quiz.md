# SD Day 16 — Quiz: Bloom Filters & Count-Min Sketch

*Answer each OUT LOUD, in your own words, before expanding. If you fumble, re-read that section.
Target: state each structure's **one-sided error direction** cold (Q2, Q6), and give a real place you'd
use each (Q4, Q7). Getting the error direction right *is* the senior answer.*

---

**Q1. Why do probabilistic data structures exist — what's the trade?**

<details><summary>answer</summary>

Exact membership/counts require storing **every element** → gigabytes of RAM at scale. Probabilistic
structures answer the same question in **tiny, fixed** memory by allowing a **bounded, one-sided
error**. You size them for a target error rate, not for the data volume, so memory stays flat as data
grows. The safety comes from the error only going in **one direction** — the direction that's cheap to
be wrong about.
</details>

---

**Q2. How does a bloom filter add and query, and what's its one-sided guarantee?**

<details><summary>answer</summary>

**Add(x):** hash `x` with `k` functions → `k` positions in an `m`-bit array → set those bits to 1.
**Query(x):** hash the same way; if **any** of those `k` bits is **0** → `x` is **definitely NOT**
present; if **all** are 1 → **probably** present. Guarantee: **no false negatives** ("no" is always
true), but **false positives** are possible (shared bits set by other elements). So it can lie "yes" but
never "no."
</details>

---

**Q3. Why can't you delete from a plain bloom filter, and what's the fix?**

<details><summary>answer</summary>

A set bit may be **shared** by multiple elements. Clearing it to "remove" one element could flip a bit
that another element relies on → a **false negative**, which breaks the core guarantee. Fix: a
**counting bloom filter** — each slot is a small **counter** you increment on add and decrement on
delete, instead of a single bit.
</details>

---

**Q4. Give a concrete use where a bloom filter saves an expensive operation.**

<details><summary>answer</summary>

Front an expensive lookup so it only runs when the answer might be "yes." Examples: **DB guard against
cache penetration** — check "have we ever seen this key?" before hitting the DB; a "definitely not"
skips it (Day 3). **LSM-tree / Cassandra / RocksDB** — each SSTable has a bloom filter, so "definitely
not" **skips a disk read**. **Crawler** — already-visited URLs. A rare false positive just costs one
normal lookup that comes back empty.
</details>

---

**Q5. How should you size a bloom filter, and what happens if you overfill it?**

<details><summary>answer</summary>

Size `m` (bits) and `k` (hashes) up front for your expected `n` and target false-positive rate; optimal
`k ≈ (m/n)·ln2`. Rule of thumb: **~10 bits/element ≈ 1%** false positives; ~15 bits/element ≈ 0.1%.
Overfill it (add far more than `n`) and too many bits get set → the false-positive rate climbs toward
useless. For unknown `n`, use a **scalable/partitioned** bloom filter that chains sub-filters.
</details>

---

**Q6. How does a count-min sketch increment and estimate, and why the minimum?**

<details><summary>answer</summary>

Structure: `d` rows × `w` columns of counters, one hash per row. **Increment(x):** for each row, hash
`x` → a column → `+1` (touches `d` counters). **Estimate(x):** read the `d` counters for `x`, return the
**minimum**. Why min: each counter = `true_count + collisions`, and collisions only **add**, so every
counter is an **over-estimate**; the **smallest** one suffered the fewest collisions → tightest bound.
Guarantee: **never under-counts** (estimate ≥ truth), may over-count.
</details>

---

**Q7. Where would you use a count-min sketch, and why is its error direction acceptable there?**

<details><summary>answer</summary>

**Heavy-hitters / top-K** (trending hashtags, most-viewed items — CMS for frequencies + a small heap
for candidates), **distributed rate limiting** (approximate per-key counts without a row per user), and
**streaming analytics**. The over-count error is the **safe** direction: over-counting a heavy hitter
throttles/flags slightly early (fine), whereas **under**-counting would let an abuser slip through. Pick
the structure whose error points **away** from the failure you fear.
</details>

---

**Q8. Bloom filter vs count-min sketch — the one-line difference on question and error.**

<details><summary>answer</summary>

**Bloom** answers **membership** ("is `x` present?") with error = possible **false positive**, never a
false negative; combine bits with **OR**. **Count-min** answers **frequency** ("how many times `x`?")
with error = possible **over-count**, never under; combine rows with **min**. Both hash into a **shared
fixed array** so keys collide, and both make the collision error **one-sided** in the safe direction.
Neither can delete cleanly or enumerate its keys.
</details>

---

**Q9. What's the danger case — when should you NOT use a bloom filter?**

<details><summary>answer</summary>

When a **false positive is both catastrophic and not cheaply verifiable**. The pattern only works
because the "maybe yes" is double-checked by the real lookup behind it (the DB returns empty on a false
positive). If there's no cheap verification and a wrong "yes" causes real harm, don't use it. Also don't
use it where you need to **enumerate members** or get **exact** counts — it can't do either.
</details>

---

**Q10 (interview close). In 30 seconds: what are these two structures and when do you reach for them?**

<details><summary>answer</summary>

"When exact membership or counts would cost too much RAM, I use probabilistic structures with a
one-sided error. A **bloom filter** answers membership in a bit array with `k` hashes — 'definitely not'
or 'maybe', **never a false negative** — so I front expensive lookups with it (DB or SSTable reads
short-circuit on 'definitely not'; a rare false positive just costs one normal read). A **count-min
sketch** estimates frequency in a `d×w` counter grid, taking the **min** across rows — it **never
under-counts** — so I use it for top-K/heavy-hitters and approximate rate limiting where over-counting
is the safe error. I size both for a target error rate, so memory stays constant as data grows."
</details>

---

> Next (building blocks): **unique ID generation (Snowflake)** — minting IDs that are unique,
> **time-sortable**, and **shard-friendly** across many nodes without a central bottleneck — the keys
> that get placed by Day 15's ring and counted by today's sketches. Then **WebSockets vs SSE vs
> long-polling at scale** (your real-time domain).
