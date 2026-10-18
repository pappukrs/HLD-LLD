# The 6-month system design plan

**19 Oct 2026 → 18 Apr 2027 · 182 days · LLD + HLD every day · TypeScript**

This plan is the system design part of your career plan (`~/career-agent/plan.md`). DSA, applications and referrals stay in that plan. This one only covers LLD and HLD, and it is sized to fit next to them.

## How to use it every day

```bash
npm run today        # today's two tasks, with file paths
npm run week         # the whole week
```

Or open [`visuals/index.html`](../visuals/index.html) in the browser. It shows today's tasks with tick boxes and links to the animated visuals.

1. Do the **LLD** task (25 min), then the **HLD** task (35 min). Keep that order: the LLD task is more active, so do it while you're fresh.
2. Tick the boxes in this week's file under [`weeks/`](weeks/README.md).
3. Log the day with `/daily` (hours, plus the HLD/LLD you did).

**Missed a day?** Don't stack two days into one. Skip the concept card from the missed day, keep the problem tasks, and catch up the card on Sunday during the weekly review.

## Time budget

| Day | Minutes | Split |
|---|---|---|
| Mon–Fri | 60 | LLD 25 + HLD 35 |
| Saturday | 150 | LLD machine-coding 90 + HLD 60 |
| Sunday | 120 | HLD full design 75 + weekly review 45 |
| **Week** | **~9–10 h** | Leaves ~10 h for DSA inside your 20 h/week target |

"Stretch" tasks are optional extra code exercises. Do them only when you have energy left, never instead of DSA or sleep.

## The four phases

| Phase | Weeks | Dates | What you build | Exit gate |
|---|---|---|---|---|
| **1 · Foundations** | 1–3 | 19 Oct – 8 Nov | OOP, SOLID, UML, 14 patterns. HLD fundamentals: estimation, APIs, LB, caching, SQL/NoSQL, replication, sharding, consistent hashing, CAP, quorums, rate limiting. First 3 LLDs + 4 HLDs | [Week 3 gate](weeks/week-03.md) |
| **2 · Core problems** | 4–10 | 9 Nov – 27 Dec | The 15 most-asked LLD problems + 16 HLD designs. Queues, Kafka, idempotency, sagas, payments, locks, consensus, geo, search, observability, security, multi-region. Spaced repeats. Mock week | [Week 10 gate](weeks/week-10.md) |
| **3 · Interview loop** | 11–18 | 28 Dec – 21 Feb | The last LLD problems, the hard HLDs, 16 senior-level problems from [advanced-37](../hld/problems/advanced-37.md). **Friday = fix what interviews exposed.** A mock every Saturday | [Week 18 gate](weeks/week-18.md) |
| **4 · Offers** | 19–26 | 22 Feb – 18 Apr | 20–25 min redo sprints that rotate through all 52 problems, plus mocks. Most of your energy goes to interviews and negotiation | Offer signed |

This matches the career plan: you start interviewing in week 4 (early rounds are practice), and you have done most of the common questions before the hard targets in weeks 11–18.

## What "industry standard" means here (the SDE-2 bar)

Interviewers at the companies you're targeting score roughly this:

**HLD (45–60 min)**
- You drive. You ask about scale and scope before drawing anything.
- The numbers change your design: "300k reads/s, so a cache is required, not optional."
- A clear diagram, plus an API and data model that match it.
- 2–3 deep dives done well. You pick the right ones (for payments, idempotency and the ledger; for chat, delivery and fan-out).
- You name trade-offs and failure modes without being asked.

**LLD / machine coding (90–120 min)**
- **Working code** with a demo or tests. This is non-negotiable in Indian product-company rounds.
- Clean separation: entities, services, strategies. No god class.
- Extensible where it matters. When the interviewer adds a requirement, you change one class, not ten.
- Edge cases and errors handled explicitly, plus concurrency awareness (double booking, idempotency).

The problems here are built around that bar. Each LLD problem has tests that act as the "demo", and each HLD problem has hidden hints you open only after your own attempt.

## Weekly rhythm

- **Mon–Tue:** new concepts (cards + visuals)
- **Wed–Fri:** an LLD problem across 3 days (design → build → finish); an HLD problem across 2 days (part 1 → part 2)
- **Sat:** a timed machine-coding round + one more HLD concept
- **Sun:** one full 45-min HLD design + the weekly review (+ `/daily week`)
- **Spaced repeats:** every problem comes back 3–6 weeks later as a "redo from memory". Don't skip these. Redoing a problem from memory is what makes it stick for the interview.

## Files

- [`curriculum.ts`](curriculum.ts): the plan as data. Change it, then run `npm run plan`.
- [`weeks/`](weeks/README.md): one file per week with tick boxes (generated).
- [`notes.md`](notes.md): your weak list and interview feedback.
