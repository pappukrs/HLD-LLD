# 10 · Count-Min sketch + top-k heavy hitters

> Time box: **45 min**
> Concept: [Bloom filter, HyperLogLog, Count-Min sketch](../../concepts/29-probabilistic-data-structures.md)

## What it is

A Count-Min sketch counts how often each item appears in a huge stream, using a **fixed, small** amount of memory. It never stores the items.

It is a table of `depth` rows × `width` counters. Each row has its own hash function.

- `add(x)`: in every row `r`, add 1 to the counter at column `h_r(x)`.
- `estimate(x)`: read the `depth` counters for `x` and return the **minimum**.

Other items can land in the same counter (a collision), so a counter can only be **too high, never too low**. Taking the minimum over rows picks the counter with the fewest collisions.

The guarantee, with `N` = total count added:

```
true(x) <= estimate(x) <= true(x) + ε·N      with probability at least 1 - δ

width = ceil(e / ε)        depth = ceil(ln(1 / δ))
```

Example: `ε = 0.01, δ = 0.01` gives `272 × 5` counters. That is 1360 counters for any number of distinct items.

**Heavy hitters** ("top-k"): keep the sketch, plus a small map of the k items with the highest estimates so far. On each `add`, check the item's estimate and, if it beats the weakest candidate, replace it.

## Where it is used

- **Trending hashtags / top searches** (Twitter, Google Trends style): top-k over a sliding window.
- **Network monitoring**: find the IPs sending the most traffic (DDoS detection) in routers and switches.
- **Ad click aggregation, metrics systems**: approximate counts per key before the exact batch job finishes.
- **Redis** (`CMS.INCRBY`, `CMS.QUERY` in RedisBloom), **Apache Spark** (`countMinSketch`), **Apache DataSketches**.
- **Caches**: TinyLFU (used in Caffeine) uses a Count-Min sketch to estimate key frequency.

## API to implement (`starter.ts`)

```ts
dimensions(0.01, 0.01);                       // → { width: 272, depth: 5 }
hashPair('x');                                // → [h1, h2], unsigned 32-bit, h2 odd

const cms = CountMinSketch.fromError(0.01, 0.01);   // or new CountMinSketch(width, depth)
cms.add('#worldcup');                         // count default 1
cms.add('#worldcup', 5);
cms.estimate('#worldcup');                    // → 6 (or a bit more, never less)
cms.total;                                    // → 6
cms.merge(otherSketch);                       // same width and depth only

const hh = new HeavyHitters(10, cms);
hh.add('#worldcup');
hh.top();                                     // → [{ item, count }, ...] at most 10
```

Rules the tests check:

| Rule | Detail |
|---|---|
| Sizes | `width = ceil(e / ε)`, `depth = ceil(ln(1 / δ))`. `ε` and `δ` must be in `(0, 1)`. |
| Hashing | Row `r` uses column `(h1 + r·h2) mod width` (double hashing, as in [03 · Bloom filter](../03-bloom-filter/README.md)). |
| Never under | `estimate(x) >= true count`, always. |
| Error bound | At least `1 - δ` of the items are within `ε × total`. |
| `merge` | Adds the tables cell by cell. Result equals the sketch of the combined stream. Shapes must match. |
| Validation | Width, depth, `count`, `k` must be positive integers. |
| `top()` | At most `k` items. Highest count first. Ties: lexicographic by item. |

## Complexity

| Operation | Time | Memory |
|---|---|---|
| `add`, `estimate` | `O(depth)` | — |
| `merge` | `O(width × depth)` | — |
| Sketch | — | `width × depth` counters = `O((1/ε) · ln(1/δ))` |
| `HeavyHitters.add` | `O(depth + k)` with a scan, `O(depth + log k)` with a heap | `O(k)` extra |

## Hints

<details>
<summary>Hint 1: the table</summary>

Use one flat `Float64Array(width * depth)` (or `Uint32Array` if counts stay small). Row `r`, column `c` is at index `r * width + c`.

</details>

<details>
<summary>Hint 2: d hash functions from two</summary>

Same trick as the Bloom filter: compute `[h1, h2]` once, and row `r` uses `(h1 + r * h2) % width`. Make `h2` odd and unsigned (`(x | 1) >>> 0`).

</details>

<details>
<summary>Hint 3: why the minimum</summary>

Every counter for `x` holds `true(x) + (counts of other items that collided there)`. The extra part is never negative. So every counter is an upper bound, and the smallest one is the best upper bound.

</details>

<details>
<summary>Hint 4: heavy hitters</summary>

Keep a `Map<item, estimate>`. On `add`: update the sketch and get the new estimate. If the item is already in the map, or the map has fewer than k items, set it. Otherwise find the item with the smallest estimate; if the new estimate is bigger, delete that one and add the new item.

</details>

## Extensions interviewers ask

1. **Top-k in the last 5 minutes.** Keep one sketch per minute in a ring of 5. Merge them to answer, and drop the oldest each minute.
2. **Many servers.** Each server keeps its own sketch. A central job merges them. This works because sketches with the same hashes add up.
3. **Exact vs approximate.** Use the sketch for a fast live dashboard. Run an exact batch job (Spark, Flink) later for billing. This is the Lambda architecture idea.
4. **Count-Min vs HyperLogLog.** CMS answers "how many times did x appear?". HLL answers "how many distinct items?". They solve different problems.
5. **Conservative update.** On `add`, only raise counters that equal the current minimum. It lowers the error, but `merge` no longer gives the exact sketch of the combined stream.

## Related

- HLD problems: [Ad click aggregation](../../problems/20-ad-click-aggregation/README.md) · [Metrics and monitoring](../../problems/19-metrics-monitoring/README.md) · [Search autocomplete](../../problems/12-search-autocomplete/README.md)
- [Batch and stream processing](../../concepts/33-batch-stream-processing.md)
