# 03 · Bloom filter

> Time box: **45 min**
> Concept: [Bloom filter, HyperLogLog, Count-Min sketch](../README.md) · Visual: [v16 Bloom filter](../visual.html)

## What it is

A Bloom filter answers "have I seen this item?" with very little memory. It is a bit array of `m` bits and `k` hash functions.

- `add(x)`: set the `k` bits `h_1(x) .. h_k(x)` to 1.
- `mightContain(x)`: if any of the `k` bits is 0, `x` was **definitely not** added. If all are 1, `x` was **probably** added.

So it has **no false negatives**, and a tunable false-positive rate `p`. You cannot delete items, and you cannot list them.

For `n` items and target rate `p`:

```
m = ceil( -n · ln(p) / (ln 2)^2 )     bits
k = round( (m / n) · ln 2 )           hash functions (at least 1)
```

Rule of thumb: about **9.6 bits per item for 1%**, 14.4 bits per item for 0.1%. One million items at 1% fit in about 1.2 MB.

## Where it is used

- **Cassandra, HBase, RocksDB, LevelDB**: one filter per SSTable. A read skips files that surely do not have the key. This saves disk seeks.
- **Web crawlers**: "have I already crawled this URL?" for billions of URLs.
- **Chrome Safe Browsing (older versions), CDNs**: quick local check before an expensive remote lookup.
- **Medium, feeds**: "has this user already seen this post?"
- **Username / short-code availability**: a fast "surely free" answer before the DB check.

## API to implement (`starter.ts`)

```ts
optimalBitCount(n, p);              // → m
optimalHashCount(m, n);             // → k
hashPair('hello');                  // → [h1, h2], unsigned 32-bit, h2 odd

const bf = new BloomFilter(10_000, 0.01);   // expected items, target false-positive rate
bf.m; bf.k;                         // sizes chosen from n and p
bf.add('user:1');
bf.mightContain('user:1');          // → true
bf.mightContain('user:2');          // → false (almost always)
bf.count;                           // → how many add() calls
bf.expectedFalsePositiveRate();     // → (1 - e^(-k·count/m))^k
bf.positions('user:1');             // → the k bit indexes: (h1 + i·h2) mod m, i = 0..k-1
```

Rules the tests check:

| Rule | Detail |
|---|---|
| Validation | `n` must be a positive integer. `p` must be in `(0, 1)`. Otherwise throw. |
| `k` | Never 0. |
| Double hashing | `positions(x)[i] === (h1 + i * h2) % m` with `[h1, h2] = hashPair(x)`. |
| Hashes | Both unsigned (`>= 0`). `h2` is odd. Same input, same output. |
| No false negatives | Every added item returns `true`. |
| FP rate | At the design load, the measured rate is below `2p`. |

## Complexity

| Operation | Time | Memory |
|---|---|---|
| `add`, `mightContain` | `O(k)` | — |
| The filter | — | `m` bits, about `1.44 · n · log2(1/p)` |

## Hints

<details>
<summary>Hint 1: a bit array in JavaScript</summary>

Use `new Uint8Array(Math.ceil(m / 8))`. Bit `i` lives in byte `i >>> 3` at position `i & 7`.
Set it: `bytes[i >>> 3] |= 1 << (i & 7)`. Test it: `(bytes[i >>> 3] & (1 << (i & 7))) !== 0`.

</details>

<details>
<summary>Hint 2: you only need two hashes</summary>

Kirsch and Mitzenmacher showed that `g_i(x) = h1(x) + i · h2(x) mod m` works as well as `k` independent hashes. So compute two 32-bit hashes once (for example FNV-1a with two different seeds, then a murmur3 finalizer) and derive the rest.

</details>

<details>
<summary>Hint 3: why h2 must be odd and unsigned</summary>

If `h2` is 0, all `k` positions are the same bit. Making it odd avoids that. In JS, `x | 1` returns a **signed** 32-bit int, which can be negative. A negative index into a `Uint8Array` reads `undefined`, and then you get false negatives. Use `(x | 1) >>> 0`.

</details>

<details>
<summary>Hint 4: precision</summary>

`h1 + i · h2` is below `2^32 + k · 2^32`, far under `2^53`. Normal JS numbers are exact here. You do not need `BigInt`.

</details>

## Extensions interviewers ask

1. **Deletes.** Use a **counting Bloom filter**: small counters instead of bits. Or use a cuckoo filter.
2. **Unknown `n`.** A **scalable Bloom filter** adds a new, larger filter when the current one is full.
3. **Distributed.** Two filters with the same `m`, `k` and hashes can be merged with bitwise OR. Redis has `BF.ADD` / `BF.EXISTS` (RedisBloom).
4. **Where does the filter live?** In the crawler: in memory on each worker, or one shared filter in Redis?
5. **Why a false positive is OK** in the SSTable case: it costs one extra disk read, never a wrong answer.

## Related

- HLD problems: [Web crawler](../../../case-studies/13-web-crawler/README.md) · [URL shortener](../../../case-studies/01-url-shortener/README.md)
- Next: [Count-Min sketch](../lab-count-min/README.md)
