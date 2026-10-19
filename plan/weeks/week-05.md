# Week 5 · Structural patterns · Behavioral patterns · Databases and data distribution · Async systems and messaging

> Mon 16 Nov – Sun 22 Nov · Phase 2: Core problems · ~10 h this week
> **Goal:** Finish the concepts and do 2 HLD designs + 1 LLD problem every week. Explain every concept from its visual, out loud.

[← Week 4](week-04.md) · [All weeks](README.md) · [Week 6 →](week-06.md)

## Mon 16 Nov · Day 29 · 60 min

- [ ] **LLD · 25 min**: L19 Flyweight  
  [L19-flyweight/README.md](../../lld/3-structural/L19-flyweight/README.md) · [visual](../../lld/3-structural/L19-flyweight/visual.html) · [demo.ts](../../lld/3-structural/L19-flyweight/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H19 Quorums, leaderless replication and Merkle trees  
  [H19-quorum-merkle/README.md](../../hld/3-databases/H19-quorum-merkle/README.md) · [visual](../../hld/3-databases/H19-quorum-merkle/visual.html) · [demo.ts](../../hld/3-databases/H19-quorum-merkle/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Tue 17 Nov · Day 30 · 60 min

- [ ] **LLD · 25 min**: L20 Strategy  
  [L20-strategy/README.md](../../lld/4-behavioral/L20-strategy/README.md) · [visual](../../lld/4-behavioral/L20-strategy/visual.html) · [demo.ts](../../lld/4-behavioral/L20-strategy/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H20 Message queues and pub-sub (RabbitMQ, SQS, Redis)  
  [H20-message-queues/README.md](../../hld/4-async/H20-message-queues/README.md) · [visual](../../hld/4-async/H20-message-queues/visual.html) · [demo.ts](../../hld/4-async/H20-message-queues/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Wed 18 Nov · Day 31 · 60 min

- [ ] **LLD · 25 min**: L21 Observer and pub-sub  
  [L21-observer/README.md](../../lld/4-behavioral/L21-observer/README.md) · [visual](../../lld/4-behavioral/L21-observer/visual.html) · [demo.ts](../../lld/4-behavioral/L21-observer/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H21 Kafka deep dive  
  [H21-kafka/README.md](../../hld/4-async/H21-kafka/README.md) · [visual](../../hld/4-async/H21-kafka/visual.html) · [demo.ts](../../hld/4-async/H21-kafka/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Thu 19 Nov · Day 32 · 60 min

- [ ] **LLD · 25 min**: LRU / LFU Cache: requirements + class diagram  
  [02-lru-cache/README.md](../../lld/problems/02-lru-cache/README.md) · [L30-machine-coding-framework/README.md](../../lld/5-machine-coding/L30-machine-coding-framework/README.md)  
  _Steps 1–3 on paper: clarify, list entities, draw the class diagram, name the patterns. No code yet._
- [ ] **HLD · 35 min**: Notification System: part 1 (requirements → diagram)  
  [05-notification-system/README.md](../../hld/case-studies/05-notification-system/README.md) · [05-notification-system/my-design.md](../../hld/case-studies/05-notification-system/my-design.md)  
  _In my-design.md: requirements, estimates, API, data model, high-level diagram. Don't open the hints._

## Fri 20 Nov · Day 33 · 60 min

- [ ] **LLD · 25 min**: LRU / LFU Cache: build the core  
  [02-lru-cache/README.md](../../lld/problems/02-lru-cache/README.md)  
  _Code the main flow in starter.ts. Run `npx vitest run lld/problems/02-lru-cache` and get the first tests green._
- [ ] **HLD · 35 min**: Notification System: part 2 (deep dives + compare)  
  [05-notification-system/README.md](../../hld/case-studies/05-notification-system/README.md) · [05-notification-system/my-design.md](../../hld/case-studies/05-notification-system/my-design.md)  
  _Write 2–3 deep dives and the trade-offs. Then open every hint, compare, and fill in the Review section._

## Sat 21 Nov · Day 34 · 150 min

- [ ] **LLD · 90 min**: LRU / LFU Cache: finish + timed redo  
  [02-lru-cache/README.md](../../lld/problems/02-lru-cache/README.md)  
  _Finish starter.ts until all tests pass (40 min). Then answer the extension questions out loud. Only now open reference.ts and write down 3 differences._
- [ ] **HLD · 60 min**: Hands-on: H14 SQL vs NoSQL and choosing a database  
  [hands-on/README.md](../../hld/3-databases/H14-sql-vs-nosql/hands-on/README.md) · [H14-sql-vs-nosql/README.md](../../hld/3-databases/H14-sql-vs-nosql/README.md)  
  _Pick one folder in hands-on/, run it with Docker or Node, and watch the behaviour the README describes. Write 3 lines on what you saw._
- [ ] **Stretch · 45 min**: Lab: H17 hash-ring  
  [lab-hash-ring/README.md](../../hld/3-databases/H17-consistent-hashing/lab-hash-ring/README.md) · [H17-consistent-hashing/README.md](../../hld/3-databases/H17-consistent-hashing/README.md)  
  _Implement starter.ts until `npx vitest run hld/3-databases/H17-consistent-hashing/lab-hash-ring` passes. Then compare with reference.ts._

## Sun 22 Nov · Day 35 · 120 min

- [ ] **HLD · 75 min**: Chat System (WhatsApp): full design  
  [06-chat-system/README.md](../../hld/case-studies/06-chat-system/README.md) · [06-chat-system/my-design.md](../../hld/case-studies/06-chat-system/my-design.md) · [H01-approach-hld-round/README.md](../../hld/1-basics/H01-approach-hld-round/README.md)  
  _45 min on a timer in my-design.md, talking out loud as if to an interviewer (do it as a mock if someone is free). Then 30 min comparing with the hints and filling in the Review._
- [ ] **REV · 45 min**: Weekly review  
  [L19-flyweight/README.md](../../lld/3-structural/L19-flyweight/README.md) · [H19-quorum-merkle/README.md](../../hld/3-databases/H19-quorum-merkle/README.md) · [L20-strategy/README.md](../../lld/4-behavioral/L20-strategy/README.md) · [H20-message-queues/README.md](../../hld/4-async/H20-message-queues/README.md) · [L21-observer/README.md](../../lld/4-behavioral/L21-observer/README.md) · [H21-kafka/README.md](../../hld/4-async/H21-kafka/README.md) · [L06-uml-relationships/README.md](../../lld/1-foundations/L06-uml-relationships/README.md) · [H06-proxies-api-gateway/README.md](../../hld/1-basics/H06-proxies-api-gateway/README.md) · [L07-design-principles/README.md](../../lld/1-foundations/L07-design-principles/README.md) · [H07-scaling-stateless/README.md](../../hld/2-scaling/H07-scaling-stateless/README.md) · [L08-singleton/README.md](../../lld/2-creational/L08-singleton/README.md) · [H08-load-balancing/README.md](../../hld/2-scaling/H08-load-balancing/README.md)  
  _Self-test every concept from this week (L19, H19, L20, H20, L21, H21) and the spaced review from 3 weeks ago (L06, H06, L07, H07, L08, H08, L09, H09, L10, H10). Replay any visual you couldn't explain. Write 5 flashcards for what you got wrong. Then run /daily week._

## Notes

_Write what was hard this week, what to repeat, and anything from interviews._
