# Week 8 · Behavioral patterns · Machine-coding toolkit · Architecture and reliability

> Mon 7 Dec – Sun 13 Dec · Phase 2: Core problems · ~10 h this week
> **Goal:** Finish the concepts and do 2 HLD designs + 1 LLD problem every week. Explain every concept from its visual, out loud.

[← Week 7](week-07.md) · [All weeks](README.md) · [Week 9 →](week-09.md)

## Mon 7 Dec · Day 50 · 60 min

- [ ] **LLD · 25 min**: L28 Mediator  
  [L28-mediator/README.md](../../lld/4-behavioral/L28-mediator/README.md) · [visual](../../lld/4-behavioral/L28-mediator/visual.html) · [demo.ts](../../lld/4-behavioral/L28-mediator/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H28 Unique ID generation (Snowflake, Base62)  
  [H28-unique-ids/README.md](../../hld/5-reliability/H28-unique-ids/README.md) · [visual](../../hld/5-reliability/H28-unique-ids/visual.html) · [demo.ts](../../hld/5-reliability/H28-unique-ids/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Tue 8 Dec · Day 51 · 60 min

- [ ] **LLD · 25 min**: L29 Visitor  
  [L29-visitor/README.md](../../lld/4-behavioral/L29-visitor/README.md) · [visual](../../lld/4-behavioral/L29-visitor/visual.html) · [demo.ts](../../lld/4-behavioral/L29-visitor/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H29 Consensus, leader election and distributed locks  
  [H29-consensus-locks/README.md](../../hld/5-reliability/H29-consensus-locks/README.md) · [visual](../../hld/5-reliability/H29-consensus-locks/visual.html) · [demo.ts](../../hld/5-reliability/H29-consensus-locks/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Wed 9 Dec · Day 52 · 60 min

- [ ] **LLD · 25 min**: L30 The machine-coding round framework  
  [L30-machine-coding-framework/README.md](../../lld/5-machine-coding/L30-machine-coding-framework/README.md) · [visual](../../lld/5-machine-coding/L30-machine-coding-framework/visual.html) · [demo.ts](../../lld/5-machine-coding/L30-machine-coding-framework/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H30 Observability: logs, metrics, traces, SLOs  
  [H30-observability/README.md](../../hld/5-reliability/H30-observability/README.md) · [visual](../../hld/5-reliability/H30-observability/visual.html) · [demo.ts](../../hld/5-reliability/H30-observability/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Thu 10 Dec · Day 53 · 60 min

- [ ] **LLD · 25 min**: Notification Service: requirements + class diagram  
  [05-notification-service/README.md](../../lld/problems/05-notification-service/README.md) · [L30-machine-coding-framework/README.md](../../lld/5-machine-coding/L30-machine-coding-framework/README.md)  
  _Steps 1–3 on paper: clarify, list entities, draw the class diagram, name the patterns. No code yet._
- [ ] **HLD · 35 min**: Food Delivery: part 1 (requirements → diagram)  
  [11-food-delivery/README.md](../../hld/case-studies/11-food-delivery/README.md) · [11-food-delivery/my-design.md](../../hld/case-studies/11-food-delivery/my-design.md)  
  _In my-design.md: requirements, estimates, API, data model, high-level diagram. Don't open the hints._

## Fri 11 Dec · Day 54 · 60 min

- [ ] **LLD · 25 min**: Notification Service: build the core  
  [05-notification-service/README.md](../../lld/problems/05-notification-service/README.md)  
  _Code the main flow in starter.ts. Run `npx vitest run lld/problems/05-notification-service` and get the first tests green._
- [ ] **HLD · 35 min**: Food Delivery: part 2 (deep dives + compare)  
  [11-food-delivery/README.md](../../hld/case-studies/11-food-delivery/README.md) · [11-food-delivery/my-design.md](../../hld/case-studies/11-food-delivery/my-design.md)  
  _Write 2–3 deep dives and the trade-offs. Then open every hint, compare, and fill in the Review section._

## Sat 12 Dec · Day 55 · 150 min

- [ ] **LLD · 90 min**: Notification Service: finish + timed redo  
  [05-notification-service/README.md](../../lld/problems/05-notification-service/README.md)  
  _Finish starter.ts until all tests pass (40 min). Then answer the extension questions out loud. Only now open reference.ts and write down 3 differences._
- [ ] **HLD · 60 min**: Lab: H27 circuit-breaker  
  [lab-circuit-breaker/README.md](../../hld/5-reliability/H27-resilience/lab-circuit-breaker/README.md) · [H27-resilience/README.md](../../hld/5-reliability/H27-resilience/README.md)  
  _Implement starter.ts until `npx vitest run hld/5-reliability/H27-resilience/lab-circuit-breaker` passes. Then compare with reference.ts._
- [ ] **Stretch · 45 min**: Lab: H28 snowflake  
  [lab-snowflake/README.md](../../hld/5-reliability/H28-unique-ids/lab-snowflake/README.md) · [H28-unique-ids/README.md](../../hld/5-reliability/H28-unique-ids/README.md)  
  _Implement starter.ts until `npx vitest run hld/5-reliability/H28-unique-ids/lab-snowflake` passes. Then compare with reference.ts._

## Sun 13 Dec · Day 56 · 120 min

- [ ] **HLD · 75 min**: Ride Hailing (Uber): full design  
  [10-ride-hailing/README.md](../../hld/case-studies/10-ride-hailing/README.md) · [10-ride-hailing/my-design.md](../../hld/case-studies/10-ride-hailing/my-design.md) · [H01-approach-hld-round/README.md](../../hld/1-basics/H01-approach-hld-round/README.md)  
  _45 min on a timer in my-design.md, talking out loud as if to an interviewer (do it as a mock if someone is free). Then 30 min comparing with the hints and filling in the Review._
- [ ] **REV · 45 min**: Weekly review  
  [L28-mediator/README.md](../../lld/4-behavioral/L28-mediator/README.md) · [H28-unique-ids/README.md](../../hld/5-reliability/H28-unique-ids/README.md) · [L29-visitor/README.md](../../lld/4-behavioral/L29-visitor/README.md) · [H29-consensus-locks/README.md](../../hld/5-reliability/H29-consensus-locks/README.md) · [L30-machine-coding-framework/README.md](../../lld/5-machine-coding/L30-machine-coding-framework/README.md) · [H30-observability/README.md](../../hld/5-reliability/H30-observability/README.md) · [L19-flyweight/README.md](../../lld/3-structural/L19-flyweight/README.md) · [H19-quorum-merkle/README.md](../../hld/3-databases/H19-quorum-merkle/README.md) · [L20-strategy/README.md](../../lld/4-behavioral/L20-strategy/README.md) · [H20-message-queues/README.md](../../hld/4-async/H20-message-queues/README.md) · [L21-observer/README.md](../../lld/4-behavioral/L21-observer/README.md) · [H21-kafka/README.md](../../hld/4-async/H21-kafka/README.md)  
  _Self-test every concept from this week (L28, H28, L29, H29, L30, H30) and the spaced review from 3 weeks ago (L19, H19, L20, H20, L21, H21). Replay any visual you couldn't explain. Write 5 flashcards for what you got wrong. Then run /daily week._

## Notes

_Write what was hard this week, what to repeat, and anything from interviews._
