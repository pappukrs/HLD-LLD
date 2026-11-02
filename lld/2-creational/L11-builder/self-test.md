# L11 Builder: self-test answers (Day 15, Mon 2 Nov 2026)

Written answers to the README self-test, checked against its `<details>` blocks. Cover them and try again before the Sunday review.

1. **Why freeze the built object?** So nothing can change it after `build()` checked it. The rules that were true at build time stay true for the object's whole life. `Object.freeze` is shallow, so nested objects (headers, notes) need their own copy and freeze.
2. **Why validate in `build()` and not in each setter?** Some rules involve more than one field ("one cell cannot have a snake and a ladder", "GET cannot have a body"). A setter only sees its own field. `build()` is the one point where every field is known.
3. **Snake and Ladder: how does a builder help?** `new BoardBuilder(100).snake(99, 7).ladder(3, 38).build()` reads like the problem statement, and `build()` checks that snakes go down, ladders go up, no cell has two jumps, nothing is off the board, and nothing starts on the last cell. Done in `practice.ts`.
4. **When is an options object better?** When the fields don't depend on each other and there are no steps. TypeScript already gives named fields and checks required ones, so a builder would only add code.
5. **Required fields as a compile-time check?** A step builder. Each step returns an interface that only has the next method (`NeedsMethod` → `NeedsUrl` → `Optional`), so `build()` doesn't exist until the required steps are done. Done in `practice.ts`.
6. **Reusable after `build()`?** It can be, but `build()` must copy everything (`practice.ts` makes a fresh Map per build). Otherwise a later `.snake()` would change a board that was already returned. `practice.ts` checks this.
7. **Builder vs Factory in one line each?** Factory decides *which class* to create, in one call. Builder assembles *one object* step by step over many calls. A factory can hand back a pre-filled builder.

## Easy-to-miss points

- It is easy to forget that a Map inside a frozen object can still be changed with `set()`. Freeze only stops reassigning the property. For full safety, expose `ReadonlyMap` in the type (as `practice.ts` does) or copy it into a plain frozen object.
- In the step builder, `build()` still needs runtime checks for value rules (url format, GET + body). The step types only prove the field was *set*, not that it is *valid*.

## Interview line to practise out loud

"A board has many snakes and ladders and rules between them, so I use a builder with named methods and validate once in `build()`. The result is frozen. For a public SDK I'd make it a step builder so missing required fields fail at compile time."
