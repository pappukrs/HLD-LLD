# LLD track (TypeScript)

```
lld/
├── concepts/              OOP, SOLID, UML, the machine-coding framework, TS for LLD, concurrency
│   └── patterns/          18 patterns: each has a card (.md) and a runnable example (.ts)
└── problems/
    ├── _template/         copy this to add your own problem
    └── NN-name/
        ├── README.md      prompt, clarifying questions, API, hidden hints, follow-ups
        ├── starter.ts     YOUR code goes here (types given, bodies are TODO)
        ├── reference.ts   a reference solution: open it only after your attempt
        ├── *.test.ts      the tests act as the interviewer's demo
        └── v1-attempt.js  (some problems) your old attempt, reviewed in the README
```

## Working on a problem

```bash
npx vitest run lld/problems/01-parking-lot          # test YOUR starter.ts
npx vitest lld/problems/01-parking-lot              # watch mode while you code
REF=1 npx vitest run lld/problems/01-parking-lot    # check the reference solution
npx tsx lld/concepts/patterns/p10-strategy.ts       # run a pattern example
npm run typecheck                                   # strict type check of everything
```

Each problem moves through the same steps as a real round: clarify → API → entities → implement → extensions. The tests encode the "assumed answers" from Step 1. If you disagree with one, change the test and say why. That's a good interview habit too.

## Rules that make this practice count

1. **Time-box it.** Saturdays are 90 minutes on a real timer. Stop when it rings, then compare.
2. **Design before code.** Write the entity list and relationships on paper first.
3. **Reference last.** Open `reference.ts` only after your tests pass, or after the time box ends. Then write down 3 differences.
4. **Redo from scratch.** The plan brings each problem back weeks later. Use an empty file, not your old code.

Problem list: [CATALOG.md](../CATALOG.md#lld-problems-lldproblemsslug-readme-startertsreferencets-testts).
