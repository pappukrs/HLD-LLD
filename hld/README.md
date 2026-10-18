# HLD track

```
hld/
├── concepts/          36 concept cards: idea, mechanism, numbers, trade-offs, what to say, self-test
├── problems/
│   ├── _template/     my-design.md, the 7-step worksheet
│   ├── NN-name/       README.md (prompt + hidden hints) + my-design.md (YOUR answer)
│   └── advanced-37.md senior-level list for phase 3, with a mapping to the base problems
└── code/              10 building blocks to implement in TS (consistent hashing, Bloom filter, …)
```

## Doing an HLD problem

1. Set a timer for 45 minutes. Open `my-design.md` and work through the 7 steps **without** opening the README hints.
2. Talk out loud as if an interviewer were listening. In the real round, explaining your thinking counts as much as the design.
3. Open the hints one at a time and compare. Fill in the **Review** section: what you missed, a score for each area.
4. Redo it from memory when the plan brings it back. Compare against your Review notes, not the hints.

Diagrams: use the mermaid block in the template (it renders on GitHub and in VS Code with a mermaid extension), or draw on paper or Excalidraw and paste a photo link.

## Code exercises

```bash
npx vitest run hld/code/01-consistent-hashing          # your starter.ts
REF=1 npx vitest run hld/code/01-consistent-hashing    # the reference
```

Implementing a building block once (a hash ring, a token bucket, a Bloom filter) makes it much easier to explain in an interview.

Full list: [CATALOG.md](../CATALOG.md).
