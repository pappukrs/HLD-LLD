# LLD track: low-level design in TypeScript

34 concepts in 5 modules, then 24 machine-coding problems with tests. Concepts come first in the plan; problems start in week 1 and run one a week.

```
lld/
├── 1-foundations/       L01–L07  classes and interfaces in TS, OOP pillars, composition, SOLID, UML, design principles
├── 2-creational/        L08–L12  Singleton, Factory Method, Abstract Factory, Builder, Prototype
├── 3-structural/        L13–L19  Adapter, Decorator, Facade, Proxy, Composite, Bridge, Flyweight
├── 4-behavioral/        L20–L29  Strategy, Observer, State, Command, Memento, Chain, Template Method, Iterator, Mediator, Visitor
├── 5-machine-coding/    L30–L34  the round framework, repository + DI, concurrency in Node, domain modelling, testing
└── problems/
    ├── _template/       copy this to add your own problem
    └── NN-name/         README (prompt, hints, follow-ups) · starter.ts (yours) · reference.ts · *.test.ts
```

Every concept folder (`LNN-slug/`) has the same three files:

| File | What you do with it |
|---|---|
| `visual.html` | Open it in the browser first. Play, step with ← →, reset with R. It shows the objects moving at runtime. |
| `README.md` | Bad code → pattern code, class diagram, when not to use it, what to say, self-test. |
| `demo.ts` | `npx tsx lld/<module>/<folder>/demo.ts` (or `npm run open -- L20`). Then close it and rewrite it from memory. |

## Working on a problem

```bash
npx vitest run lld/problems/01-parking-lot          # test YOUR starter.ts
REF=1 npx vitest run lld/problems/01-parking-lot    # test the reference solution
```

1. **Clarify and design (paper):** requirements, entities, class diagram, patterns. Use [L30 the machine-coding framework](5-machine-coding/L30-machine-coding-framework/README.md).
2. **Build:** code `starter.ts` until the tests go green. The tests play the interviewer's demo.
3. **Compare:** only then open `reference.ts` and write down three differences.
4. **Redo:** the plan brings hot problems back as 25-minute redo sprints. That's what makes them stick.

The full list with paths is in [CATALOG.md](../CATALOG.md).
