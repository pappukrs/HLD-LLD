# System Design Plan — Pappu Kumar

> Your unfair advantage: you've ALREADY built what most candidates only read about —
> Mediasoup SFU video platform, real-time messaging (NestJS/Redis/WebSockets), fintech
> microservices (RabbitMQ/gRPC), payment orchestration, offline-first PWAs, 10k+ IoT devices.
> The prep here is: (1) fill theory gaps, (2) learn the **interview format**, (3) convert
> your war stories into structured answers.

---

## Part A — Daily 1-hr slot (Jun 4 – Jul 15, during DSA phases) — ~40 hrs

Theory drip. One topic per day, take half-page notes, always ask "where did I touch this in prod?"

### Weeks 1–2 (Jun 4–17): Fundamentals
> ✅ = done · click **theory** to revise, **quiz** to self-test out loud.
1. Scaling vertical vs horizontal, stateless services — ✅ *Jun 5* · [theory](day1/theory.md) · [quiz](day1/quiz.md)
2. Load balancers (L4 vs L7, algorithms) — you know Nginx; go deeper — ✅ *Jun 6* · [theory](day2/theory.md) · [quiz](day2/quiz.md)
3. Caching: cache-aside, write-through, write-behind, eviction, **cache stampede** (you use Redis — learn the failure modes) — ✅ *Jun 6* · [theory](day3/theory.md) · [quiz](day3/quiz.md)
4. CDN + edge — ✅ *Jun 9* · [theory](day4/theory.md) · [quiz](day4/quiz.md)
5. Database indexing internals (B-tree, how Postgres uses them) — ✅ *Jun 9* · [theory](day5/theory.md) · [quiz](day5/quiz.md)
6. SQL vs NoSQL decision framework — ✅ *Jun 9* · [theory](day6/theory.md) · [quiz](day6/quiz.md)
7. Replication: leader-follower, sync vs async, read replicas — ✅ *Jun 15* · [theory](day7/theory.md) · [quiz](day7/quiz.md)
8. Sharding/partitioning: hash vs range, hot keys, resharding — ✅ *Jun 16* · [theory](day8/theory.md) · [quiz](day8/quiz.md)
9. CAP theorem + PACELC (practical version, not the meme version) — ✅ *Jun 17* · [theory](day9/theory.md) · [quiz](day9/quiz.md)
10. Consistency models: strong, eventual, read-your-writes — ✅ *Jun 18* · [theory](day10/theory.md) · [quiz](day10/quiz.md)
11. Message queues deep: RabbitMQ vs Kafka (you know Rabbit — learn Kafka's log model, consumer groups, exactly-once) — ✅ *Jun 19* · [theory](day11/theory.md) · [quiz](day11/quiz.md)
12. Idempotency + distributed transactions: outbox pattern, sagas (you did payments — formalize it) — ✅ *Jun 20* · [theory](day12/theory.md) · [quiz](day12/quiz.md)
13. Rate limiting algorithms: token bucket, sliding window — ✅ *Jun 22* · [theory](day13/theory.md) · [quiz](day13/quiz.md)
14. API design: REST vs gRPC vs GraphQL trade-offs, versioning, pagination — ✅ *Jun 23* · [theory](day14/theory.md) · [quiz](day14/quiz.md)

### Weeks 3–4 (Jun 18 – Jul 1): Building blocks
15. Consistent hashing — the placement layer under caches/shards (fixes Day 8's resharding) — ✅ *Jun 29* · [theory](day15/theory.md) · [quiz](day15/quiz.md)
16. Bloom filters, count-min sketch — cheap approximate membership/frequency in fixed memory — ✅ *Jun 30* · [theory](day16/theory.md) · [quiz](day16/quiz.md)
17. WebSockets vs SSE vs long-polling at scale (formalize what you know) — ✅ *Jul 4* · [theory](day17/theory.md) · [quiz](day17/quiz.md)
18. Distributed locking (Redis Redlock, its criticisms) — ✅ *Jul 6* · [theory](day18/theory.md) · [quiz](day18/quiz.md)
19. Unique ID generation (Snowflake) — ✅ *Jul 7* · [theory](day19/theory.md) · [quiz](day19/quiz.md)
20. Search: Elasticsearch internals — inverted index (you've used ES)
21. Object storage + presigned URLs
22. Observability: metrics/logs/traces (you run Prometheus/Grafana — learn SLI/SLO language)
23. Back-of-envelope estimation drills (QPS, storage, bandwidth) — practice 3 daily this week
24. Microservices patterns: service discovery, circuit breaker, API gateway, BFF
25. Kubernetes basics (your visible gap — pods, deployments, services, HPA; concept level)
26. Kafka deep dive part 2
27. Redis data structures at scale (sorted sets for leaderboards/feeds)
28. Security: authN vs authZ, OAuth2/JWT at scale, API keys

### Jul 2–15: One mini-design per day (30 min sketch + 30 min compare with HelloInterview/Alex Xu)
Rate limiter → URL shortener → Pastebin → Notification service → Web crawler →
News feed → Chat (you built one — do it "interview style") → Typeahead →
Nearby/proximity (geohash) → Ticketmaster → Top-K leaderboard → Distributed job scheduler →
Payment system (your domain!) → Dropbox

---

## Part B — Intensive (Jul 16 – Jul 29, full days, while applying)

**Daily structure (8–10h):** 2 full mock designs (45 min each, talk-aloud, draw on Excalidraw) +
deep-dive reading on what you fumbled + 1 hr behavioral story practice.

### The 45-min framework (drill until automatic)
1. **Requirements** (5 min): functional + non-functional, scale numbers — ASK, don't assume
2. **Estimation** (3 min): QPS, storage, bandwidth — rough is fine
3. **API + data model** (5 min)
4. **High-level design** (10 min): boxes + arrows, get end-to-end flow working first
5. **Deep dives** (15 min): where interviewer steers — DB choice, scaling bottleneck, failure modes
6. **Wrap** (5 min): bottlenecks, monitoring, evolution

### 14-day design list (2/day)
| Day | Design 1 | Design 2 |
|-----|----------|----------|
| Jul 16 | URL Shortener (warm-up, full framework) | Rate Limiter |
| Jul 17 | Chat / WhatsApp ⭐ (your domain — perfect it) | Notification System ⭐ |
| Jul 18 | News Feed (fan-out write vs read) | Twitter/X |
| Jul 19 | YouTube / video pipeline ⭐ (your Mediasoup story) | Live streaming / video conferencing ⭐ |
| Jul 20 | Uber / proximity | Google Maps ETA |
| Jul 21 | Payment system ⭐ (your fintech story) | Digital wallet / ledger |
| Jul 22 | E-commerce / flash sale (inventory, overselling) | Ticketmaster |
| Jul 23 | Search autocomplete | Distributed web crawler |
| Jul 24 | Dropbox / Google Drive | Google Docs (OT/CRDT — links to your whiteboard project!) |
| Jul 25 | Distributed message queue (design Kafka) | Distributed cache (design Redis) |
| Jul 26 | Job scheduler | Distributed counter / Top-K |
| Jul 27 | Hotel/booking (Airbnb) | Stock exchange (if targeting fintech) |
| Jul 28 | MOCK with human (interviewing.io/Pramp) | Review + gap fill |
| Jul 29 | MOCK with human | Final cheat-sheet write-up |

### Your war stories → STAR format (write these out, Jul 16–20, 1/day)
1. Mediasoup SFU video platform — why SFU vs MCU vs mesh, observability you added
2. MongoDB → MySQL migration at Matriot — why, how, zero-downtime?
3. Fintech payment orchestration — idempotency, webhook reliability, reconciliation
4. 10k+ IoT device scaling — connection handling, multi-core workers
5. Offline-first PWA at CHESA — sync conflicts, Workbox strategy, SAP integration

These answer both "tell me about a challenging project" AND become deep-dive ammo in SD interviews. A candidate who says "when I built this in production, X broke, so I…" beats a candidate quoting Alex Xu.

---

## Resources (in priority order)
1. **HelloInterview** (hellointerview.com) — free written guides + practice; closest to real interviews
2. **Alex Xu Vol 1** (read during Part A), **Vol 2** (during Part B)
3. **System Design Primer** (GitHub) — reference, not cover-to-cover
4. Jordan Has No Life / ByteByteGo YouTube for visual explanations
5. **DDIA (Designing Data-Intensive Applications)** — only chapters 1–9, read at night if energy allows; it's the difference between mid and senior answers
