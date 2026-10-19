# HLD track: high-level design

39 concepts in 6 modules, 10 build-it-yourself labs, 8 hands-on Docker/Node labs, and 28 case studies plus an advanced list.

```
hld/
├── 1-basics/            H01–H06  the HLD round framework, estimation, networking, API design, real-time, proxies + API gateway
├── 2-scaling/           H07–H10  stateless scaling, load balancing, caching, CDN
├── 3-databases/         H11–H19  indexes, transactions, data modelling, SQL vs NoSQL, replication, sharding, consistent hashing, CAP, quorums
├── 4-async/             H20–H24  queues + pub-sub, Kafka, delivery semantics, sagas + outbox, event-driven + CQRS
├── 5-reliability/       H25–H31  microservices, rate limiting, resilience, unique IDs, consensus + locks, observability, security
├── 6-building-blocks/   H32–H39  blob storage, search, geo, probabilistic structures, batch + stream, data at scale, payments, multi-region
└── case-studies/
    ├── _template/       my-design.md, the 7-step worksheet
    ├── NN-name/         README.md (prompt + hidden hints) + my-design.md (YOUR answer)
    └── advanced-37.md   senior-level list for the interview-loop phase
```

Every concept folder (`HNN-slug/`) has:

| File | What you do with it |
|---|---|
| `visual.html` | The animation. Watch the requests, replicas, partitions or messages move. Most have a "Try it" control. |
| `README.md` | How it works, trade-offs, numbers to remember, what to say, your own experience hook, self-test. |
| `demo.ts` | A small TypeScript simulation: `npx tsx hld/<module>/<folder>/demo.ts` (or `npm run open -- H09`). |
| `lab-*/` | Some concepts: implement it yourself (`starter.ts`) until `npx vitest run <lab folder>` passes. |
| `hands-on/` | Some concepts: real Nginx, HAProxy, Kong, Redis, Kafka, RabbitMQ, Postgres and Mongo setups to run with Docker. |

## Doing a case study

1. Set a timer for 45 minutes. Open `my-design.md` and work through the 7 steps **without** opening the README hints. The steps are in [H01 How to approach an HLD round](1-basics/H01-approach-hld-round/README.md).
2. Talk out loud as if an interviewer were listening. Explaining your thinking counts as much as the design.
3. Open the hints one at a time and compare. Fill in the **Review** section: what you missed, a score for each area.
4. Redo it from memory when the plan brings it back. Compare against your Review notes, not the hints.

Your real work stories, ready to tell, are in [TALKING-POINTS.md](../TALKING-POINTS.md). Terms are in [GLOSSARY.md](../GLOSSARY.md). The full list with paths is in [CATALOG.md](../CATALOG.md).
