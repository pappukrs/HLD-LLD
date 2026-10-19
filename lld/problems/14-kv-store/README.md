# 14 · In-memory KV Store (TTL + transactions)

> Asked at: Razorpay, Juspay, Atlassian, Rippling, Uber, and many startup machine-coding rounds (often as "build a mini Redis").
> Time box: **75 min** (10 min design, 50 min code, 15 min tests and extensions)
> Patterns you should reach for: **Memento** (save the old value before a write), **Command** (each write as an undoable change)

## Problem statement (as the interviewer says it)

"Build an in-memory key-value store. It supports get, set and delete. A key can have a time-to-live.
It also supports transactions: BEGIN, COMMIT and ROLLBACK, and transactions can be nested."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Value type? | Generic `V`, default `string` |
| `delete` on a missing key? | Returns `false`. No error |
| TTL unit and meaning? | `ttlMs` from now. Stored as an **absolute** `expiresAt` |
| Exactly at the deadline? | Expired (`now >= expiresAt`) |
| `set` without a TTL on a key that had one? | The old expiry is removed |
| TTL of 0 or negative? | Throw |
| How is expiry done? | Lazily, on read. Time comes from an injected clock. No timers |
| Do reads inside a transaction see its own writes? | Yes |
| What does `COMMIT` commit with nested transactions? | Only the innermost one, into its parent. Data is final when the outermost commits |
| `ROLLBACK` with nested transactions? | Only the innermost one |
| `COMMIT`/`ROLLBACK` with no open transaction? | Throw |
| A key's TTL passes during a transaction, then we roll back? | The restored entry keeps its original deadline, so it may already be expired |
| Concurrency between clients, persistence, eviction? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const kv = new KVStore({ clock: () => now });   // KVStore<V = string>

kv.set('otp', '4821', { ttlMs: 1000 });
kv.get('otp');            // → '4821' | undefined
kv.has('otp');
kv.delete('otp');         // → boolean
kv.size();                // live keys only

kv.begin();
kv.set('a', '1');
kv.begin();               // nested
kv.rollback();            // undo the inner one only
kv.commit();              // commit the outer one
kv.transactionDepth;      // → 0
```

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good design</summary>

- `Entry<V>`: `{ value, expiresAt: number | null }`. Immutable
- `KVStore`: one `Map<string, Entry>` for data and a **stack of undo logs**, one per open transaction
- Undo log: `Map<key, Entry | undefined>`. The first time a transaction writes a key, save what was there before (a memento; `undefined` means "the key didn't exist")

The rules:

| Operation | What happens |
|---|---|
| write (set/delete) in a transaction | If the top log has no entry for the key, save the current entry. Then write to `data` |
| `rollback` | Pop the top log. Put every saved entry back (or delete the key if it was `undefined`) |
| `commit` | Pop the top log. For each key, copy the saved entry to the parent log **only if the parent doesn't have one**. The parent's older memento wins |
| `commit` of the outermost | Pop and drop the log. Data is already in `data` |

The other common design is an **overlay**: each transaction holds its own map of changes (with a tombstone for deletes), and `get` looks from the top layer down to the base. Both are fine. Compare them out loud:

| | Undo log (this reference) | Overlay |
|---|---|---|
| `get` | O(1) | O(depth) |
| `commit` | O(keys changed) | O(keys changed) |
| `rollback` | O(keys changed) | O(1): drop the layer |
| Deletes | Normal delete | Needs a tombstone |

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/14-kv-store` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 75 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Active expiry.** Lazy expiry leaves expired keys in memory if nobody reads them. Redis also samples keys with a TTL in the background and deletes expired ones. Keep a min-heap of `(expiresAt, key)` and pop expired keys on each operation, or on a timer.
2. **Memory limit and eviction.** Add an LRU eviction policy (see [LRU / LFU Cache](../02-lru-cache)). Make it a strategy so LFU can replace it.
3. **`count(value)`** (how many keys hold this value) in O(1). Keep a second map `value → count` and update it on every write and every undo.
4. **Many clients.** Each client gets its own transaction stack. Now you need isolation: two clients writing the same key in open transactions. Options: a lock per key, or optimistic checks at commit (like Redis `WATCH`).
5. **Persistence.** Append each committed write to a log file (like Redis AOF). On restart, replay the log. Snapshots make the replay shorter.

## Self-check before you call it done

- [ ] `get` doesn't scan the transaction stack. (Or, with an overlay, you can say why O(depth) is fine.)
- [ ] An inner commit followed by an outer rollback restores the state before the outer `begin`.
- [ ] Expiry is stored as an absolute time and uses the injected clock.
- [ ] Deleting a key inside a transaction can be rolled back.
- [ ] No `Date.now()` and no `setTimeout` in the store.

## Concepts used

- [Command (and Memento)](../../4-behavioral/L23-command/README.md) · [TypeScript for LLD (generics)](../../1-foundations/L01-classes-and-interfaces/README.md)
- HLD link: [Distributed Key-Value Store](../../../hld/case-studies/04-key-value-store) · [Distributed Cache (Redis)](../../../hld/case-studies/17-distributed-cache)
- Visual: [Command: undo and redo](../../4-behavioral/L23-command/visual.html)
