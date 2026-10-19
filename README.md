# System Design Lab: LLD + HLD in TypeScript

The one place for system design prep, aimed at SDE-2 rounds for the 24 LPA goal. **19 Oct 2026 → 18 Apr 2027**, one LLD and one HLD task every day.

```bash
npm install
npm run today              # today's two tasks
xdg-open index.html        # the hub: today's tasks, progress, every concept by track
npm run open -- H17        # one concept: list its files, run its demo, open its animation
```

## Two tracks, one shape

Every concept is a folder with the same three files: **`visual.html`** (an animation you step through), **`README.md`** (the notes) and **`demo.ts`** (runnable TypeScript).

| Track | Concepts | Then practise on | Where |
|---|---|---|---|
| **LLD** | 34 (L01–L34) in 5 modules: foundations → creational → structural → behavioral → machine-coding | 24 machine-coding problems with tests | [`lld/`](lld/README.md) |
| **HLD** | 39 (H01–H39) in 6 modules: basics → scaling → databases → async → reliability → building blocks | 28 case studies + 37 advanced, 10 code labs, 8 Docker hands-on labs | [`hld/`](hld/README.md) |

Every concept, problem and lab with its path: [CATALOG.md](CATALOG.md). Terms: [GLOSSARY.md](GLOSSARY.md). Your real work stories as interview answers: [TALKING-POINTS.md](TALKING-POINTS.md).

## How one concept day works (25–35 min)

1. **Watch:** open `visual.html` and play it. Use Space to play/pause, ← → to step, R to reset. Try the controls.
2. **Read:** `README.md`. How it works, trade-offs, common mistakes.
3. **Run:** `npx tsx <folder>/demo.ts`. For LLD, close it and rewrite the core from memory.
4. **Test yourself:** answer the self-test without peeking, then say the "Say this in the interview" part out loud.
5. Tick it in the hub or in `plan/weeks/week-NN.md`, then log the day with `/daily`.

The plan ([plan/README.md](plan/README.md)) brings each concept back in the Sunday review three weeks later, and hot problems come back as redo sprints. That spacing is what makes you better day by day.

## Layout

```
index.html     the hub (opens from disk; no server needed)
lld/           1-foundations … 5-machine-coding / LNN-slug/{README.md, visual.html, demo.ts} · problems/
hld/           1-basics … 6-building-blocks / HNN-slug/{README.md, visual.html, demo.ts, lab-*/, hands-on/} · case-studies/
plan/          concepts.ts (the concept list) + curriculum.ts (the day plan) → weeks/week-01..26.md
shared/        kit.css + kit.js (the animation player) and plan-data.js (generated)
scripts/       today.ts, gen-plan.ts, open.ts
archive/       older long-form notes, plus the raw notes from the old 35-day and interview-prep folders
```

## Commands

```bash
npm run today [-- 2026-11-03]                  # tasks for a date
npm run week                                   # the whole week
npm run open -- L20                            # a concept's files + demo + visual
npm run plan                                   # rebuild plan/weeks, shared/plan-data.js and CATALOG.md
npx vitest run lld/problems/01-parking-lot     # test your solution (REF=1 to test the reference)
npm run test:ref                               # every reference solution and lab (should be all green)
npm run typecheck                              # strict TypeScript check
```
