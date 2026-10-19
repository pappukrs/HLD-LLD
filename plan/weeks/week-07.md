# Week 7 · Behavioral patterns · Architecture and reliability

> Mon 30 Nov – Sun 6 Dec · Phase 2: Core problems · ~10 h this week
> **Goal:** Finish the concepts and do 2 HLD designs + 1 LLD problem every week. Explain every concept from its visual, out loud.

[← Week 6](week-06.md) · [All weeks](README.md) · [Week 8 →](week-08.md)

## Mon 30 Nov · Day 43 · 60 min

- [ ] **LLD · 25 min**: L25 Chain of Responsibility  
  [L25-chain-of-responsibility/README.md](../../lld/4-behavioral/L25-chain-of-responsibility/README.md) · [visual](../../lld/4-behavioral/L25-chain-of-responsibility/visual.html) · [demo.ts](../../lld/4-behavioral/L25-chain-of-responsibility/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H25 Microservices and service discovery  
  [H25-microservices/README.md](../../hld/5-reliability/H25-microservices/README.md) · [visual](../../hld/5-reliability/H25-microservices/visual.html) · [demo.ts](../../hld/5-reliability/H25-microservices/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Tue 1 Dec · Day 44 · 60 min

- [ ] **LLD · 25 min**: L26 Template Method  
  [L26-template-method/README.md](../../lld/4-behavioral/L26-template-method/README.md) · [visual](../../lld/4-behavioral/L26-template-method/visual.html) · [demo.ts](../../lld/4-behavioral/L26-template-method/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H26 Rate limiting algorithms  
  [H26-rate-limiting/README.md](../../hld/5-reliability/H26-rate-limiting/README.md) · [visual](../../hld/5-reliability/H26-rate-limiting/visual.html) · [demo.ts](../../hld/5-reliability/H26-rate-limiting/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Wed 2 Dec · Day 45 · 60 min

- [ ] **LLD · 25 min**: L27 Iterator (and JS generators)  
  [L27-iterator/README.md](../../lld/4-behavioral/L27-iterator/README.md) · [visual](../../lld/4-behavioral/L27-iterator/visual.html) · [demo.ts](../../lld/4-behavioral/L27-iterator/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H27 Resilience: timeouts, retries, circuit breakers, bulkheads  
  [H27-resilience/README.md](../../hld/5-reliability/H27-resilience/README.md) · [visual](../../hld/5-reliability/H27-resilience/visual.html) · [demo.ts](../../hld/5-reliability/H27-resilience/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Thu 3 Dec · Day 46 · 60 min

- [ ] **LLD · 25 min**: Logger framework: requirements + class diagram  
  [03-logger/README.md](../../lld/problems/03-logger/README.md) · [L30-machine-coding-framework/README.md](../../lld/5-machine-coding/L30-machine-coding-framework/README.md)  
  _Steps 1–3 on paper: clarify, list entities, draw the class diagram, name the patterns. No code yet._
- [ ] **HLD · 35 min**: Ticket Booking (BookMyShow): part 1 (requirements → diagram)  
  [09-ticket-booking/README.md](../../hld/case-studies/09-ticket-booking/README.md) · [09-ticket-booking/my-design.md](../../hld/case-studies/09-ticket-booking/my-design.md)  
  _In my-design.md: requirements, estimates, API, data model, high-level diagram. Don't open the hints._

## Fri 4 Dec · Day 47 · 60 min

- [ ] **LLD · 25 min**: Logger framework: build the core  
  [03-logger/README.md](../../lld/problems/03-logger/README.md)  
  _Code the main flow in starter.ts. Run `npx vitest run lld/problems/03-logger` and get the first tests green._
- [ ] **HLD · 35 min**: Ticket Booking (BookMyShow): part 2 (deep dives + compare)  
  [09-ticket-booking/README.md](../../hld/case-studies/09-ticket-booking/README.md) · [09-ticket-booking/my-design.md](../../hld/case-studies/09-ticket-booking/my-design.md)  
  _Write 2–3 deep dives and the trade-offs. Then open every hint, compare, and fill in the Review section._

## Sat 5 Dec · Day 48 · 150 min

- [ ] **LLD · 90 min**: Logger framework: finish + timed redo  
  [03-logger/README.md](../../lld/problems/03-logger/README.md)  
  _Finish starter.ts until all tests pass (40 min). Then answer the extension questions out loud. Only now open reference.ts and write down 3 differences._
- [ ] **HLD · 60 min**: Hands-on: H24 Event-driven architecture, CQRS, event sourcing  
  [hands-on/README.md](../../hld/4-async/H24-event-driven-cqrs/hands-on/README.md) · [H24-event-driven-cqrs/README.md](../../hld/4-async/H24-event-driven-cqrs/README.md)  
  _Pick one folder in hands-on/, run it with Docker or Node, and watch the behaviour the README describes. Write 3 lines on what you saw._
- [ ] **Stretch · 45 min**: Lab: H26 rate-limiters  
  [lab-rate-limiters/README.md](../../hld/5-reliability/H26-rate-limiting/lab-rate-limiters/README.md) · [H26-rate-limiting/README.md](../../hld/5-reliability/H26-rate-limiting/README.md)  
  _Implement starter.ts until `npx vitest run hld/5-reliability/H26-rate-limiting/lab-rate-limiters` passes. Then compare with reference.ts._

## Sun 6 Dec · Day 49 · 120 min

- [ ] **HLD · 75 min**: Search Autocomplete: full design  
  [12-search-autocomplete/README.md](../../hld/case-studies/12-search-autocomplete/README.md) · [12-search-autocomplete/my-design.md](../../hld/case-studies/12-search-autocomplete/my-design.md) · [H01-approach-hld-round/README.md](../../hld/1-basics/H01-approach-hld-round/README.md)  
  _45 min on a timer in my-design.md, talking out loud as if to an interviewer (do it as a mock if someone is free). Then 30 min comparing with the hints and filling in the Review._
- [ ] **REV · 45 min**: Weekly review  
  [L25-chain-of-responsibility/README.md](../../lld/4-behavioral/L25-chain-of-responsibility/README.md) · [H25-microservices/README.md](../../hld/5-reliability/H25-microservices/README.md) · [L26-template-method/README.md](../../lld/4-behavioral/L26-template-method/README.md) · [H26-rate-limiting/README.md](../../hld/5-reliability/H26-rate-limiting/README.md) · [L27-iterator/README.md](../../lld/4-behavioral/L27-iterator/README.md) · [H27-resilience/README.md](../../hld/5-reliability/H27-resilience/README.md) · [L16-proxy/README.md](../../lld/3-structural/L16-proxy/README.md) · [H16-partitioning-sharding/README.md](../../hld/3-databases/H16-partitioning-sharding/README.md) · [L17-composite/README.md](../../lld/3-structural/L17-composite/README.md) · [H17-consistent-hashing/README.md](../../hld/3-databases/H17-consistent-hashing/README.md) · [L18-bridge/README.md](../../lld/3-structural/L18-bridge/README.md) · [H18-cap-pacelc-consistency/README.md](../../hld/3-databases/H18-cap-pacelc-consistency/README.md)  
  _Self-test every concept from this week (L25, H25, L26, H26, L27, H27) and the spaced review from 3 weeks ago (L16, H16, L17, H17, L18, H18). Replay any visual you couldn't explain. Write 5 flashcards for what you got wrong. Then run /daily week._

## Notes

_Write what was hard this week, what to repeat, and anything from interviews._
