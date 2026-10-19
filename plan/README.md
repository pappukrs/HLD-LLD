# The 6-month system design plan

**19 Oct 2026 → 18 Apr 2027 · 182 days · LLD + HLD every day · TypeScript**

This plan is the system design part of your career plan (`~/career-agent/plan.md`). DSA, applications and referrals stay in that plan. This one covers only LLD and HLD, and it is sized to fit next to them.

## How to use it every day

```bash
npm run today        # today's two tasks, with file paths
npm run week         # the whole week
```

Or open [`index.html`](../index.html) in the browser. It shows today's tasks with tick boxes, and ticking a concept day marks the concept as learned in the library.

1. Do the **LLD** task (25 min), then the **HLD** task (35 min). LLD first: it's more active, so do it while you're fresh.
2. Tick the boxes in this week's file under [`weeks/`](weeks/README.md) (or in the hub).
3. Log the day with `/daily` (hours, plus the HLD/LLD you did).

**Missed a day?** Don't stack two days into one. Keep the problem tasks, and catch up the missed concept in the Sunday review.

## Time budget

| Day | Minutes | Split |
|---|---|---|
| Mon–Fri | 60 | LLD 25 + HLD 35 |
| Saturday | 150 | LLD timed machine-coding 90 + HLD lab or hands-on 60 |
| Sunday | 120 | HLD full design 75 + weekly review 45 |
| **Week** | **~9–10 h** | Leaves ~10 h for DSA inside your 20 h/week target |

"Stretch" tasks (extra labs) are optional. Do them only when you have energy left, never instead of DSA or sleep.

## The four phases (same as the career plan)

| Phase | Weeks | Dates | What happens | Gate |
|---|---|---|---|---|
| **1 · Foundations** | 1–3 | 19 Oct – 8 Nov | One LLD + one HLD concept every weekday: L01–L15 (OOP, SOLID, UML, principles, creational, first structural) and H01–H15 (framework, estimation, networking, APIs, gateway, scaling, LB, caching, CDN, indexes, transactions, modelling, SQL vs NoSQL, replication). A timed LLD every Saturday, a full HLD every Sunday. | [Week 3](weeks/week-03.md) |
| **2 · Core problems** | 4–10 | 9 Nov – 27 Dec | Concepts Mon–Wed (L16–L34, H16–H36). Thu–Sat: one LLD problem a week. Thu–Fri + Sunday: two HLD case studies a week. Labs on Saturdays. | [Week 10](weeks/week-10.md) |
| **3 · Interview loop** | 11–18 | 28 Dec – 21 Feb | Last concepts (H37–H39), the hard case studies, advanced problems, refreshes, and a **debrief fix** every Wednesday for what real interviews exposed. Mocks on Saturdays. | [Week 18](weeks/week-18.md) |
| **4 · Offers** | 19–26 | 22 Feb – 18 Apr | Short redo sprints of the hot problems, concept refreshes, mocks. Most energy goes to interviews and negotiation. | Offer signed |

## How it makes you better every day

- **Watch → read → run → recall.** Every concept day starts with the animation, then the notes, then the code, then a closed-book self-test. Recall is where the learning happens.
- **Spaced review.** The Sunday review re-tests that week's concepts and the concepts from 3 weeks earlier.
- **Redo sprints.** Hot LLD problems and HLD case studies come back from memory on a blank page.
- **Gates.** At weeks 3, 10 and 18 you check yourself before moving on.

## The SDE-2 bar

**HLD (45–60 min):** you drive and ask about scale first. The numbers change your design. A clear diagram, API and data model. 2–3 deep dives done well, chosen for the problem (payments: idempotency and the ledger; chat: delivery and fan-out). Trade-offs and failure modes named without being asked.

**LLD / machine coding (90–120 min):** working code with a demo or tests (non-negotiable in Indian product-company rounds). Clean separation, no god class. When a requirement is added, one class changes, not ten. Edge cases, errors and concurrency (double booking, idempotency) handled explicitly.

## Files

- [`concepts.ts`](concepts.ts): the 73 concepts and their folders.
- [`curriculum.ts`](curriculum.ts): builds the day plan from the concepts, problems and case studies. Change it, then run `npm run plan`.
- [`weeks/`](weeks/README.md): one file per week with tick boxes (generated).
- [`notes.md`](notes.md): your weak list and interview feedback.
