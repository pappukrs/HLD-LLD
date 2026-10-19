# 05 · Base62 encoding and an ID-range allocator

> Time box: **45 min**
> Concept: [Unique ID generation](../README.md)

## What it is

A URL shortener turns a long URL into a short code like `bit.ly/3xK9a`. A clean way to make the code:

1. Get a **unique integer id** for the new URL.
2. Write it in **base62** (`0-9`, `a-z`, `A-Z`). 7 characters give `62^7 ≈ 3.5 trillion` codes.

Step 1 needs care when many app servers create URLs at once. Asking the database or Redis for every single id is slow and makes it a bottleneck. Instead, each server **leases a block** of ids (for example 1000) from a shared counter and hands them out locally. The shared counter is hit once per 1000 URLs.

You build both parts: `encode`/`decode`, and an `IdRangeAllocator` that leases blocks from an injected coordinator.

## Where it is used

- **bit.ly, TinyURL, YouTube video ids, Instagram post codes**: base62 or base64 codes from integer ids.
- **Block leasing ("hi/lo", ticket servers)**: Flickr ticket servers, Hibernate's hi/lo generator, Twitter's early ids, many sharded MySQL setups.
- The coordinator is often **Redis `INCRBY key 1000`**, a DB row (`UPDATE counters SET next = next + 1000 RETURNING next`), or a ZooKeeper/etcd node.

## API to implement (`starter.ts`)

```ts
ALPHABET;                      // '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
encode(125);                   // → '21'
decode('21');                  // → 125

interface RangeCoordinator {
  reserve(size: number): Promise<number>;    // atomic; resolves to the first id of the block
}

const alloc = new IdRangeAllocator(coordinator, 1000);  // block size
await alloc.nextId();          // → number, unique across all allocators on this coordinator
await alloc.nextCode();        // → encode(await nextId())
alloc.leaseCount;              // → blocks leased so far
```

Rules the tests check:

| Rule | Detail |
|---|---|
| Alphabet | The character at index `i` has value `i`. So `'a'` is 10 and `'A'` is 36. Case matters. |
| `encode(0)` | `'0'` |
| `encode` input | Non-negative safe integer. Otherwise throw. |
| `decode` input | Throw on `''`, on a character not in the alphabet, or if the value is above `Number.MAX_SAFE_INTEGER`. |
| Block | A lease that returns `start` owns `[start, start + blockSize)`. Ids come out in order. |
| Lease count | Lease only when the current block is used up. |
| Concurrency | 25 concurrent `nextId()` calls with block size 10 → exactly 3 leases, 25 unique ids. |
| Failure | If `reserve` rejects, `nextId` rejects. The next call tries a new lease. |

## Complexity

| Operation | Time |
|---|---|
| `encode`, `decode` | `O(L)`, `L` = code length = `O(log62 n)` |
| `nextId` | `O(1)` local; one coordinator call every `blockSize` ids |

## Hints

<details>
<summary>Hint 1: encode</summary>

Repeat: take `n % 62` as the last character, then `n = Math.floor(n / 62)`. Build the string from the right. Handle `0` before the loop.

</details>

<details>
<summary>Hint 2: decode</summary>

Build a `Map` from character to value once. Then `n = n * 62 + value` for each character, left to right.

</details>

<details>
<summary>Hint 3: one lease for many waiters</summary>

Keep a field `leasing: Promise<void> | null`. When the block is empty: if `leasing` is null, start a lease and store the promise; then `await` it. Clear it in `.finally()`. Wrap this in a `while (next >= end)` loop: after the lease, another caller may already have used the last ids.

</details>

<details>
<summary>Hint 4: what you lose on a crash</summary>

If a server dies with 600 unused ids in its block, those ids are never used. That is fine. Gaps are cheap; duplicates are not.

</details>

## Extensions interviewers ask

1. **Codes are guessable.** Sequential ids give `abc1`, `abc2`, ... How do you hide this? Shuffle the bits with a reversible permutation, or encrypt the id (a Feistel network), then base62.
2. **Hash instead?** `base62(md5(url))[0..7]` needs a collision check and retry. Compare with counter + base62.
3. **Custom aliases.** User picks `/my-sale`. You need a uniqueness check on a separate path.
4. **Fixed length.** Start the counter at `62^6` so every code has 7 characters.
5. **Coordinator down.** Each server still has its current block. How long can it run? Should you lease the next block early, at 80% use?

## Related

- HLD problem: [URL shortener](../../../case-studies/01-url-shortener/README.md)
- Previous: [Snowflake id](../lab-snowflake/README.md)
