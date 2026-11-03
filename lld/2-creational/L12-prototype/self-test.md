# L12 Prototype: self-test answers (Day 16, Tue 3 Nov 2026)

Written answers to the README self-test, checked against its `<details>` blocks. Q1, Q2, Q3, Q5, Q6 and Q7 are also checked in code in `practice.ts`.

1. **`const b = { ...a }; b.items.push(x)`. What happens to `a`?** `a.items` gets `x` too. Spread copies only the top level, so `a.items` and `b.items` are the same array. `practice.ts` shows this with a board template's `jumps` array.
2. **What does `structuredClone(new Money(100, 'INR'))` return?** A plain object with the same data. It is not a `Money`, so `format()` and other methods are gone. `practice.ts` checks this with `Rules`.
3. **When is a shallow copy enough?** When the nested values are immutable (strings, numbers, frozen value objects) or are meant to be shared and nobody changes them. In `practice.ts` the frozen `Rules` object is shared between all boards, while `jumps` and `positions` are copied.
4. **Chess: why clone the board to check a move?** Apply the move on a copy and ask "is my king in check now?" without touching the real board. If the move is illegal, throw the copy away.
5. **Prototype vs Memento?** Both copy state. Memento keeps a copy to restore later (undo, snapshot). Prototype copies to make a new, independent object. `KvStore.snapshot()` in `practice.ts` uses `clone()` to make the memento, and `restore()` clones again so one snapshot can be restored many times.
6. **Why does the registry return clones?** If it returned the stored object, every caller would share it and could change the template for everyone. `create()` returns `proto.clone()`, so the template stays clean.
7. **Two things `JSON.parse(JSON.stringify(x))` gets wrong?** `Date` becomes a string and `Map`/`Set` become `{}`. Also: `undefined` fields are dropped and `BigInt` throws.

## Easy-to-miss points

- `new Map(old)` is shallow too. It copies the keys and values, but if the values are objects, both maps point to the same objects. `KvStore.clone()` copies each entry for this reason.
- `restore(snap)` must copy the snapshot, not adopt it. Otherwise the next write after a restore changes the snapshot, and restoring it a second time gives the wrong state.
- Every new mutable field needs a line in `clone()`. A unit test like "change the clone, the original stays the same" catches a forgotten field.

## Interview line to practise out loud

"For Snake and Ladder I keep board layouts in a registry, and `create('classic')` returns a clone. The clone copies the jumps map and the player positions, since a game changes those, and shares the frozen rules object. For a KV store snapshot I use the same `clone()`, and restore from a copy so one snapshot can be used again."
