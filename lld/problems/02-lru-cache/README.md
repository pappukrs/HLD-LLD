# 02 · LRU / LFU Cache

> Asked at: Flipkart, Swiggy, PhonePe, Atlassian, Amazon, and often as a warm-up in machine-coding rounds.
> Time box: **60 min** (10 min design, 40 min code, 10 min tests and extensions)
> Patterns you should reach for: **HashMap + doubly linked list** (O(1) LRU), **Strategy** (the eviction policy)

## Problem statement (as the interviewer says it)

"Design an in-memory cache with a fixed capacity. `get` and `put` must be O(1).
When the cache is full, evict the least recently used key. Then make the eviction policy pluggable so we can switch to LFU.
Bonus: support a time-to-live per entry."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| What does `get` return for a missing key? | `undefined`. No error |
| Does `get` count as a use? | Yes. It updates recency (LRU) and frequency (LFU) |
| Does `put` on an existing key count as a use? | Yes. It replaces the value and counts as a use. No eviction |
| Does `has` count as a use? | No. It is a peek |
| Invalid capacity (0, negative, 1.5)? | Throw in the constructor |
| LFU tie (two keys with the same count)? | Evict the least recently used of them |
| TTL? | Optional default TTL for the cache, and an optional TTL per `put`. TTL must be > 0 |
| When is an expired entry removed? | Lazily, when someone reads it. `size` can include expired entries nobody touched yet |
| Thread safety, distributed cache, persistence? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const cache = new Cache<string, number>({
  capacity: 100,
  policy: new LRUPolicy(),      // or new LFUPolicy(), or your own EvictionPolicy
  defaultTtlMs: 60_000,         // optional
  clock: () => Date.now(),      // injectable, so tests control time
});

cache.put('a', 1);              // uses defaultTtlMs
cache.put('b', 2, 5_000);       // per-entry TTL
cache.get('a');                 // → 1 | undefined
cache.has('a');                 // → boolean, does not count as a use
cache.delete('a');              // → true if it existed
cache.size;                     // → number

interface EvictionPolicy<K> {
  onInsert(key: K): void;       // new key stored
  onAccess(key: K): void;       // get hit, or put on an existing key
  onRemove(key: K): void;       // delete or expiry
  evict(): K | undefined;       // pick a victim and forget it
}
```

The cache stores values. The policy only tracks keys and decides who leaves. That split is the main design idea.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `Cache<K, V>`: owns `Map<K, { value, expiresAt }>`, the capacity, the clock and the policy. It never decides who to evict
- `EvictionPolicy<K>` (interface): the Strategy. Gets told about inserts, uses and removals
- `LRUPolicy`: `Map<K, Node>` + a doubly linked list. Head = most recent, tail = victim. Move to head on use
- `LFUPolicy`: `Map<K, freq>` + `Map<freq, Set<K>>` + `minFreq`. A JS `Set` keeps insertion order, so the first key in a bucket is the LRU one at that frequency
- `ListNode`, `KeyList`: internal to LRU

Why a doubly linked list and not an array? Removing a node from the middle is O(1) only if you have `prev` and `next` pointers. An array splice is O(n).

Why not just use a JS `Map` for LRU (delete and re-insert to move a key to the end)? It works and is O(1) in practice. Say so. Most interviewers still want to see the linked list, because it shows you know how it works.

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/02-lru-cache` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 60 minutes.

## Step 5: extensions interviewers ask after you finish

1. **The cache is full of expired entries.** Lazy expiry evicts a live key while dead ones stay. Fix: a min-heap by `expiresAt`, or a periodic sweep that samples some keys. Redis uses lazy expiry plus a periodic sampling sweep.
2. **Make it safe with concurrent access.** In one Node process, synchronous `get`/`put` cannot interleave. In Java or Go you need a lock, or striped locks (one per segment of keys).
3. **Get-or-load.** `getOrLoad(key, loader)`. If 100 requests miss the same key at once, call the loader only once: store the pending `Promise` in a map (request coalescing). This prevents a cache stampede.
4. **Size in bytes, not count.** Capacity becomes a byte budget, and `put` may evict several keys.
5. **Distributed cache.** Shard keys across nodes with consistent hashing. See the HLD problem on distributed caches.
6. **Why LFU can be bad.** A key that was hot yesterday keeps a high count forever. Fix: decay counts over time, or use a variant like W-TinyLFU (used by Caffeine).

## Self-check before you call it done

- [ ] `get`, `put` and `delete` are O(1). No array `indexOf`, `splice` or scan on the hot path.
- [ ] The cache has no `if (policy === 'LRU')`. Policies are swapped by injection.
- [ ] Time is injected (`clock`), not read with `Date.now()` all over the code.
- [ ] You can explain why `has` must not change the eviction order.

## Concepts used

- [Strategy pattern](../../concepts/patterns/p10-strategy.md) · [TypeScript for LLD](../../concepts/05-ts-for-lld.md) · [Machine-coding framework](../../concepts/04-lld-interview-framework.md)
- HLD links: [Caching](../../../hld/concepts/08-caching.md) · [Distributed Cache (Redis)](../../../hld/problems/17-distributed-cache/)
- Visuals: [LRU cache internals](../../../visuals/v29-lru-cache.html) · [Caching patterns](../../../visuals/v03-caching-patterns.html)
