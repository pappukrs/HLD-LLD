# Week 6 · Behavioral patterns · Async systems and messaging

> Mon 23 Nov – Sun 29 Nov · Phase 2: Core problems · ~10 h this week
> **Goal:** Finish the concepts and do 2 HLD designs + 1 LLD problem every week. Explain every concept from its visual, out loud.

[← Week 5](week-05.md) · [All weeks](README.md) · [Week 7 →](week-07.md)

## Mon 23 Nov · Day 36 · 60 min

- [ ] **LLD · 25 min**: L22 State  
  [L22-state/README.md](../../lld/4-behavioral/L22-state/README.md) · [visual](../../lld/4-behavioral/L22-state/visual.html) · [demo.ts](../../lld/4-behavioral/L22-state/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H22 Delivery semantics and idempotency  
  [H22-delivery-semantics/README.md](../../hld/4-async/H22-delivery-semantics/README.md) · [visual](../../hld/4-async/H22-delivery-semantics/visual.html) · [demo.ts](../../hld/4-async/H22-delivery-semantics/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Tue 24 Nov · Day 37 · 60 min

- [ ] **LLD · 25 min**: L23 Command (undo and redo)  
  [L23-command/README.md](../../lld/4-behavioral/L23-command/README.md) · [visual](../../lld/4-behavioral/L23-command/visual.html) · [demo.ts](../../lld/4-behavioral/L23-command/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H23 Distributed transactions: 2PC, Saga, Outbox  
  [H23-distributed-transactions/README.md](../../hld/4-async/H23-distributed-transactions/README.md) · [visual](../../hld/4-async/H23-distributed-transactions/visual.html) · [demo.ts](../../hld/4-async/H23-distributed-transactions/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Wed 25 Nov · Day 38 · 60 min

- [ ] **LLD · 25 min**: L24 Memento  
  [L24-memento/README.md](../../lld/4-behavioral/L24-memento/README.md) · [visual](../../lld/4-behavioral/L24-memento/visual.html) · [demo.ts](../../lld/4-behavioral/L24-memento/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H24 Event-driven architecture, CQRS, event sourcing  
  [H24-event-driven-cqrs/README.md](../../hld/4-async/H24-event-driven-cqrs/README.md) · [visual](../../hld/4-async/H24-event-driven-cqrs/visual.html) · [demo.ts](../../hld/4-async/H24-event-driven-cqrs/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Thu 26 Nov · Day 39 · 60 min

- [ ] **LLD · 25 min**: Vending Machine: requirements + class diagram  
  [06-vending-machine/README.md](../../lld/problems/06-vending-machine/README.md) · [L30-machine-coding-framework/README.md](../../lld/5-machine-coding/L30-machine-coding-framework/README.md)  
  _Steps 1–3 on paper: clarify, list entities, draw the class diagram, name the patterns. No code yet._
- [ ] **HLD · 35 min**: News Feed: part 1 (requirements → diagram)  
  [07-news-feed/README.md](../../hld/case-studies/07-news-feed/README.md) · [07-news-feed/my-design.md](../../hld/case-studies/07-news-feed/my-design.md)  
  _In my-design.md: requirements, estimates, API, data model, high-level diagram. Don't open the hints._

## Fri 27 Nov · Day 40 · 60 min

- [ ] **LLD · 25 min**: Vending Machine: build the core  
  [06-vending-machine/README.md](../../lld/problems/06-vending-machine/README.md)  
  _Code the main flow in starter.ts. Run `npx vitest run lld/problems/06-vending-machine` and get the first tests green._
- [ ] **HLD · 35 min**: News Feed: part 2 (deep dives + compare)  
  [07-news-feed/README.md](../../hld/case-studies/07-news-feed/README.md) · [07-news-feed/my-design.md](../../hld/case-studies/07-news-feed/my-design.md)  
  _Write 2–3 deep dives and the trade-offs. Then open every hint, compare, and fill in the Review section._

## Sat 28 Nov · Day 41 · 150 min

- [ ] **LLD · 90 min**: Vending Machine: finish + timed redo  
  [06-vending-machine/README.md](../../lld/problems/06-vending-machine/README.md)  
  _Finish starter.ts until all tests pass (40 min). Then answer the extension questions out loud. Only now open reference.ts and write down 3 differences._
- [ ] **HLD · 60 min**: Lab: H19 quorum-kv  
  [lab-quorum-kv/README.md](../../hld/3-databases/H19-quorum-merkle/lab-quorum-kv/README.md) · [H19-quorum-merkle/README.md](../../hld/3-databases/H19-quorum-merkle/README.md)  
  _Implement starter.ts until `npx vitest run hld/3-databases/H19-quorum-merkle/lab-quorum-kv` passes. Then compare with reference.ts._
- [ ] **Stretch · 45 min**: Hands-on: H20 Message queues and pub-sub (RabbitMQ, SQS, Redis)  
  [hands-on/README.md](../../hld/4-async/H20-message-queues/hands-on/README.md) · [H20-message-queues/README.md](../../hld/4-async/H20-message-queues/README.md)  
  _Pick one folder in hands-on/, run it with Docker or Node, and watch the behaviour the README describes. Write 3 lines on what you saw._

## Sun 29 Nov · Day 42 · 120 min

- [ ] **HLD · 75 min**: Payment System: full design  
  [08-payment-system/README.md](../../hld/case-studies/08-payment-system/README.md) · [08-payment-system/my-design.md](../../hld/case-studies/08-payment-system/my-design.md) · [H01-approach-hld-round/README.md](../../hld/1-basics/H01-approach-hld-round/README.md)  
  _45 min on a timer in my-design.md, talking out loud as if to an interviewer (do it as a mock if someone is free). Then 30 min comparing with the hints and filling in the Review._
- [ ] **REV · 45 min**: Weekly review  
  [L22-state/README.md](../../lld/4-behavioral/L22-state/README.md) · [H22-delivery-semantics/README.md](../../hld/4-async/H22-delivery-semantics/README.md) · [L23-command/README.md](../../lld/4-behavioral/L23-command/README.md) · [H23-distributed-transactions/README.md](../../hld/4-async/H23-distributed-transactions/README.md) · [L24-memento/README.md](../../lld/4-behavioral/L24-memento/README.md) · [H24-event-driven-cqrs/README.md](../../hld/4-async/H24-event-driven-cqrs/README.md) · [L11-builder/README.md](../../lld/2-creational/L11-builder/README.md) · [H11-indexing/README.md](../../hld/3-databases/H11-indexing/README.md) · [L12-prototype/README.md](../../lld/2-creational/L12-prototype/README.md) · [H12-transactions-isolation/README.md](../../hld/3-databases/H12-transactions-isolation/README.md) · [L13-adapter/README.md](../../lld/3-structural/L13-adapter/README.md) · [H13-data-modeling/README.md](../../hld/3-databases/H13-data-modeling/README.md)  
  _Self-test every concept from this week (L22, H22, L23, H23, L24, H24) and the spaced review from 3 weeks ago (L11, H11, L12, H12, L13, H13, L14, H14, L15, H15). Replay any visual you couldn't explain. Write 5 flashcards for what you got wrong. Then run /daily week._

## Notes

_Write what was hard this week, what to repeat, and anything from interviews._
