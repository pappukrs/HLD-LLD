# H35 · Bloom filter, HyperLogLog, Count-Min sketch

> **Time:** ~55 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/6-building-blocks/H35-probabilistic-ds/demo.ts`) · **Labs:** [lab-bloom-filter](lab-bloom-filter/README.md) · [lab-count-min](lab-count-min/README.md) · **Hands-on:** [hands-on](hands-on/README.md)
> **Builds on:** [H09 Caching](../../2-scaling/H09-caching/README.md) · [H11 Indexing](../../3-databases/H11-indexing/README.md) · [H26 Rate limiting](../../5-reliability/H26-rate-limiting/README.md) · **Used in:** Web crawler, URL shortener, Ad click aggregation, Search autocomplete, Metrics monitoring, Key-value store

## The idea in one line

When an exact answer needs too much memory, use a small structure with a known, one-sided error: "definitely not / maybe yes" (Bloom), "about how many times, never less" (Count-Min), "about how many distinct" (HyperLogLog).

## Why it matters (the problem it solves)

- A crawler has seen 10 billion URLs. A hash set of them needs hundreds of GB of RAM.
- "Unique visitors today" per page, per country, per hour: one set of user ids per bucket explodes.
- "Top 100 hashtags in the last hour" over millions of distinct tags: one counter per tag is too much.
- Cache penetration: attackers request ids that do not exist, so every request misses Redis and hits the DB.

In all of these, 1% error is fine, and memory drops 100-1000×. Interviewers expect you to name the right sketch, size it, and say which direction it can be wrong.

## How it works

### 1. Bloom filter: set membership

A bit array of `m` bits (all 0) and `k` hash functions.

```
m = 16 bits, k = 3
add "cat"   -> h1,h2,h3 = 2, 7, 11   -> set bits 2, 7, 11
add "dog"   -> 4, 7, 14              -> bit 7 is now shared
check "fox" -> 3, 9, 14  bit 3 is 0  -> DEFINITELY NOT (always right)
check "owl" -> 2, 4, 11  all 1       -> MAYBE (never added: false positive)

 idx: 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15
 bit: 0 0 1 0 1 0 0 1 0 0 0  1  0  0  1  0
```

- **Add**: set the `k` bits to 1. **Check**: any bit 0 -> definitely not; all 1 -> maybe.
- **No false negatives.** An added item has all its bits set, and bits never go back to 0.
- **False positives** grow as the array fills.
- **No delete.** Clearing a shared bit creates false negatives. Need deletes? A **counting Bloom filter** (4-bit counters, ~4× memory) or a **cuckoo filter**.
- **No resize.** Rebuild a bigger one, or use a scalable Bloom filter (a chain of filters).
- You do not need `k` real hash functions: **double hashing** `h1 + i·h2` works as well.

Sizing (n items, target false-positive rate p):

```
m = -n · ln(p) / (ln 2)^2        bits
k = (m / n) · ln 2               hash functions
p ≈ (1 - e^(-k·n/m))^k

p = 1%   -> 9.6 bits per item, k = 7
p = 0.1% -> 14.4 bits per item, k = 10
```

**Where it sits:** in front of something expensive.

```
GET /user/123 --> Bloom filter (in memory)
                   | "definitely not" --> 404, no cache or DB read
                   | "maybe"           --> cache --> DB (rarely a wasted read)
```

### 2. Count-Min sketch: frequency

A table of `d` rows × `w` counters. Each row has its own hash.

```
          col: 0  1  2  3  4  5  6  7
  row h1:      0  5  1  0  2  0  4  0       add x: +1 at h_r(x) in EVERY row
  row h2:      0  0  0  8  0  2  0  2       estimate x: MIN of its d counters
  row h3:      0  3  0  1  7  1  0  0
#cat -> h1:2, h2:5, h3:5 -> min(1, 2, 1) = 1   (the 2 is a collision with #exam)
```

- Each counter = true count + whatever collided with it. Collisions only add.
- So the estimate **never undercounts**; it may overcount. The minimum row is the tightest.
- Guarantee: `true ≤ estimate ≤ true + ε·N` with probability `1 − δ`, where `w = ⌈e/ε⌉`, `d = ⌈ln(1/δ)⌉`, `N` = total events.
- **Top-k heavy hitters:** sketch + a min-heap of size k. On each event, update the sketch, read the estimate, and replace the heap's smallest if the new estimate is bigger.
- **Time windows:** one sketch per minute; sum the last 60 (same hashes -> add counter by counter); drop old ones.
- Sketches with the same hashes **merge by adding**, so each Kafka partition or Flink task keeps its own and you combine them.

### 3. HyperLogLog: count distinct

```
hash("user42") = 1001 | 0001 0110 1110 ...
                 ^^^^   ^^^ 3 leading zeros -> rank 4
                 bucket 9 of 16

register[9] = max(register[9], 4)
```

- A hash that starts with `r` zeros shows up once in `2^r` items. Seeing a long run suggests many distinct items.
- One register is noisy (one lucky hash ruins it). So split into `m` buckets by the first bits, keep the max per bucket, and combine with a **harmonic mean**: `E = α·m² / Σ 2^(−R[j])`.
- Standard error **≈ 1.04 / √m**. Redis uses m = 16,384 -> **0.81%**, in **12 KB** per key.
- Duplicates change nothing: the same user always gives the same hash.
- **Mergeable:** union of two HLLs = max per register. One HLL per hour, merge 24 for the day, no double counting. You cannot do that with plain counts.
- Redis: `PFADD key item`, `PFCOUNT key`, `PFMERGE dest k1 k2`.

### 4. Pick by the question

| Question | Structure | Wrong in which direction |
|---|---|---|
| "Have I seen x?" | Bloom / cuckoo filter | Says "maybe" for some new items |
| "How often x?" / "top k" | Count-Min sketch (+ heap) | Says more than the truth |
| "How many distinct?" | HyperLogLog | ± ~1%, both ways |
| Exact answer needed (money, billing, legal) | Hash set, DB count, batch job | Not allowed to be wrong |

## In TypeScript

```ts
class BloomFilter {
  private bits: Uint8Array;
  constructor(readonly m: number, readonly k: number) { this.bits = new Uint8Array(Math.ceil(m / 8)); }
  private *positions(x: string) {
    const h1 = hash32(x, 1), h2 = (hash32(x, 2) | 1) >>> 0;     // double hashing
    for (let i = 0; i < this.k; i++) yield (h1 + i * h2) % this.m;
  }
  add(x: string) { for (const b of this.positions(x)) this.bits[b >> 3] |= 1 << (b & 7); }
  mightContain(x: string) {
    for (const b of this.positions(x)) if (!(this.bits[b >> 3] & (1 << (b & 7)))) return false; // definitely not
    return true;                                                                              // maybe
  }
}

class CountMin {
  private rows: Uint32Array[];
  constructor(readonly w: number, readonly d: number) { this.rows = Array.from({ length: d }, () => new Uint32Array(w)); }
  add(x: string) { this.rows.forEach((row, r) => row[hash32(x, 100 + r) % this.w]++); }
  estimate(x: string) { return Math.min(...this.rows.map((row, r) => row[hash32(x, 100 + r) % this.w])); }
}
```

[demo.ts](demo.ts) measures all three: a Bloom filter sized for 1% gives 0 false negatives and ~1% false positives in 117 KB for 100k names; a Count-Min sketch never undercounts and stays inside `ε·N`; two HyperLogLogs (hour A, hour B) merge into the exact union within 1%.

Watch the `>>> 0`: in JavaScript `x | 1` returns a **signed** 32-bit number, so `h1 + i·h2` can go negative and `% m` gives a negative index. The first version of the demo had exactly this bug, and it showed up as "false negatives", which a Bloom filter must never have.

## Trade-offs / when NOT to use it

| Structure | Use when | Not when |
|---|---|---|
| Hash set / DB unique index | It fits in memory, or the answer must be exact | Billions of keys in RAM |
| Bloom filter | Skip costly lookups (SSTables, cache penetration, crawler URLs, "username taken?" pre-check) | You need delete, listing, or a false positive is harmful without a fallback check |
| Cuckoo filter | Same, plus delete | Very high fill rates (inserts start failing) |
| Count-Min sketch | Trending, heavy hitters, abuse detection, approximate per-key counters | Exact per-key counts, billing; very rare items (relative error is huge for them) |
| HyperLogLog | Unique visitors, DAU, distinct counts in dashboards | You need the actual list of users, or an exact count |

Rule: **approximate for dashboards, filters and hints; exact for money.** Keep the exact numbers in the batch path ([H36 Batch and stream](../H36-batch-stream/README.md)).

## Common mistakes

- **Treating "maybe" as "yes".** A Bloom "maybe" means "go check the real store". Rejecting a sign-up on "maybe" blocks real users (the [hands-on](hands-on/README.md) app has this bug).
- **Saying Bloom has false negatives.** It has none. Only false positives.
- **Undersizing.** A filter sized for 1M items with 10M inserted is nearly all 1s and says "maybe" to everything. Size for expected n, monitor the fill ratio, rebuild.
- **Deleting from a plain Bloom filter.**
- **Count-Min "estimate is wrong both ways".** It only overcounts. And taking the average instead of the minimum.
- **Adding two HLL counts** instead of merging registers.
- **Using a sketch for billing** or anything a customer can dispute.
- Forgetting that the filter must be **updated on every insert** (and rebuilt after a restart, or persisted, e.g. RedisBloom).

## Say this in the interview

> "For the crawler's URL-seen check I'll keep a Bloom filter sized for 5 billion URLs at 1% false positives, about 10 bits per URL, so roughly 6 GB, sharded by URL hash. 'Definitely not' means new, so we enqueue it. 'Maybe' means we skip it; losing 1% of new URLs is fine for a crawler. A Bloom filter never gives a false 'no', so we never crawl a page twice because of it."

> "For trending hashtags I'll use a Count-Min sketch per minute plus a min-heap of size k. The sketch can only overcount, by at most ε times the total, so heavy hitters stay correct. For unique visitors I keep one HyperLogLog per page per hour in Redis, 12 KB each with 0.81% error, and PFMERGE them into daily numbers. Billing counts stay exact in the batch pipeline."

## Your experience hook

- **Redis cache-aside (Chesa):** "I built cache-aside with Redis and cut response time ~60%. The next risk is cache penetration: requests for ids that do not exist always miss and hit MySQL. I would put a Bloom filter of existing ids in front, so 'definitely not' returns 404 from memory."
- **IoT platform (10k+ devices):** duplicate MQTT messages were a real problem. A Bloom filter of recent message ids (one per minute window, rotated) is a cheap first-pass dedupe; the exact check stays on the DB write (unique key).
- **API gateway rate limiting:** a Count-Min sketch per minute finds the top abusive IPs or API keys without one counter per IP.

## Numbers to remember

- Bloom: **~10 bits per item for 1%** (k = 7), ~14.4 bits for 0.1%. 1 billion keys ≈ **1.2 GB** vs tens of GB for the strings.
- HyperLogLog (Redis): **12 KB per key, 0.81%** error, counts into the billions.
- Count-Min: ε = 0.1%, δ = 0.1% -> w ≈ 2,719, d = 7 -> ~19k counters ≈ **76 KB**.
- Cassandra/RocksDB: one Bloom filter per SSTable; default false-positive chance ~1% (Cassandra `bloom_filter_fp_chance` 0.01).

## Self-test

<details><summary>1. A Bloom filter says "not present". Can it be wrong?</summary>

No. If the item had been added, all its k bits would be 1. One 0 bit proves it was never added.
</details>

<details><summary>2. Why can't you delete from a Bloom filter? What do you use instead?</summary>

A bit can be shared by several items. Clearing it to remove one item makes another item check as "no": a false negative. Use a counting Bloom filter (counters instead of bits) or a cuckoo filter.
</details>

<details><summary>3. Size a Bloom filter for 100M items at 1%.</summary>

About 9.6 bits per item -> ~960M bits ≈ 120 MB, with k = 7 hash functions (or double hashing with 2 real hashes).
</details>

<details><summary>4. Count-Min says #ipl appeared 10,500 times. What do you know about the true count?</summary>

It is at most 10,500. It may be lower because of collisions, never higher. With probability 1 − δ, it is at least 10,500 − ε·N.
</details>

<details><summary>5. Why take the minimum across rows, not the average?</summary>

Every counter is the true count plus collisions, and collisions only add. The smallest counter has the fewest collisions, so it is the tightest upper bound. An average mixes in the noisy rows.
</details>

<details><summary>6. Why can you merge two HyperLogLogs but not add two distinct counts?</summary>

Adding counts double-counts users seen in both sets. HLL merge takes the max per register, which equals the HLL you would get from the union of both streams.
</details>

<details><summary>7. How do you get "top trending in the last hour", not "since the start"?</summary>

Keep one sketch per minute. Sum the last 60 (same hash functions, add counter by counter) and expire older ones. Rebuild the top-k heap from the windowed sketch.
</details>

<details><summary>8. How does a Bloom filter stop cache penetration?</summary>

Load all existing keys into it and update it on every insert. A request for a key the filter says "definitely not" returns 404 before touching Redis or the DB, so fake ids cannot hammer the database.
</details>

## Go deeper

- Labs: [lab-bloom-filter](lab-bloom-filter/README.md) (sizing, double hashing, tests) · [lab-count-min](lab-count-min/README.md) (sketch + top-k heap)
- Hands-on: [hands-on](hands-on/README.md) (Express sign-up with a Bloom filter; find the bug)
- Case studies: [Web crawler](../../case-studies/13-web-crawler/README.md) · [Ad click aggregation](../../case-studies/20-ad-click-aggregation/README.md) · [URL shortener](../../case-studies/01-url-shortener/README.md) · [Key-value store](../../case-studies/04-key-value-store/README.md) · [Search autocomplete](../../case-studies/12-search-autocomplete/README.md)
- Archive notes: [hld-parts/part6a.md](../../../archive/notes/hld-parts/part6a.md) (Bloom filters for IDs and short URLs) · [hld-parts/part6b.md](../../../archive/notes/hld-parts/part6b.md) (crawler dedupe, "3.3 Top-K Algorithm (Count-Min Sketch)")
- Papers: Bloom (1970); Flajolet et al., "HyperLogLog" (2007); Cormode and Muthukrishnan, "Count-Min Sketch" (2005). Redis docs: HyperLogLog, RedisBloom.
