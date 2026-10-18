# System Design Prep: LLD + HLD in TypeScript

A 6-month practice repo for SDE-2 system design rounds: machine coding, LLD design discussion and HLD.
**19 Oct 2026 → 18 Apr 2027.** Every day: one LLD task and one HLD task.

```bash
npm install
npm run today            # what to do today
npm run week             # this week
open visuals/index.html  # the hub: today's tasks + 30 animated concepts (use xdg-open on Linux)
```

## What's inside

| | Count | Where | How you use it |
|---|---|---|---|
| **Day-wise plan** | 182 days, 4 phases, 3 gates | [`plan/`](plan/README.md) | `npm run today`, tick the boxes in `plan/weeks/` |
| **LLD concepts** | 6 cards + 18 patterns | [`lld/concepts/`](lld/concepts/) | Read the card, run the `.ts`, do the self-test |
| **LLD problems** | 24, each with tests | [`lld/problems/`](lld/README.md) | Code in `starter.ts` until `npx vitest run lld/problems/<name>` passes |
| **HLD concepts** | 36 cards | [`hld/concepts/`](hld/concepts/) | Read, play the visual, do the self-test |
| **HLD problems** | 28 + 37 advanced | [`hld/problems/`](hld/README.md) | 45 min in `my-design.md`, then open the hints |
| **HLD code** | 10 building blocks | [`hld/code/`](hld/code/) | Implement a hash ring, Bloom filter, Snowflake, … |
| **Visuals** | 30 animated pages | [`visuals/`](visuals/index.html) | Play, step, reset. They work offline |
| **Old notes** | long-form guides | [`archive/`](archive/) | Deep reading; the concept cards link to the relevant sections |

Everything is listed with exact paths in [CATALOG.md](CATALOG.md).

## The daily loop

1. `npm run today`: two tasks, about 60 minutes on weekdays.
2. **LLD (25 min):** a concept card or one step of a problem (design → build → finish).
3. **HLD (35 min):** a concept card + visual, or half of a design.
4. Tick the boxes in `plan/weeks/week-NN.md`, then log the day with `/daily`.
5. Weekends: Saturday is a timed machine-coding round; Sunday is a full 45-min HLD + the weekly review.

## Commands

```bash
npm run today [-- 2026-11-03]                        # tasks for a date
npm run plan                                         # rebuild plan/weeks + the hub data from plan/curriculum.ts
npx vitest run lld/problems/01-parking-lot           # test your solution
REF=1 npx vitest run lld/problems/01-parking-lot     # test the reference solution
npm run test:ref                                     # all reference solutions (should be all green)
npm run typecheck                                    # strict TypeScript check
npx tsx lld/concepts/patterns/p10-strategy.ts        # run a pattern demo
```

## Layout

```
plan/        curriculum.ts (the source of truth) → weeks/week-01..26.md
lld/         concepts/, concepts/patterns/, problems/NN-name/{README, starter, reference, test}
hld/         concepts/, problems/NN-name/{README, my-design}, code/NN-name/{…}
visuals/     index.html hub, vNN-*.html pages, assets/kit.{css,js}
archive/     the earlier long-form notes and v1 practice code
scripts/     today.ts, gen-plan.ts
```
