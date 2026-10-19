# Week 10 · Machine-coding toolkit · Specialised building blocks

> Mon 21 Dec – Sun 27 Dec · Phase 2: Core problems · ~10 h this week
> **Goal:** Finish the concepts and do 2 HLD designs + 1 LLD problem every week. Explain every concept from its visual, out loud.

[← Week 9](week-09.md) · [All weeks](README.md) · [Week 11 →](week-11.md)

## Mon 21 Dec · Day 64 · 60 min

- [ ] **LLD · 25 min**: L34 Testing your design with Vitest  
  [L34-testing-designs/README.md](../../lld/5-machine-coding/L34-testing-designs/README.md) · [visual](../../lld/5-machine-coding/L34-testing-designs/visual.html) · [demo.ts](../../lld/5-machine-coding/L34-testing-designs/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H34 Geospatial: geohash and quadtree  
  [H34-geospatial/README.md](../../hld/6-building-blocks/H34-geospatial/README.md) · [visual](../../hld/6-building-blocks/H34-geospatial/visual.html) · [demo.ts](../../hld/6-building-blocks/H34-geospatial/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Tue 22 Dec · Day 65 · 60 min

- [ ] **LLD · 25 min**: Redo sprint: Parking Lot  
  [01-parking-lot/README.md](../../lld/problems/01-parking-lot/README.md)  
  _Empty file, 25 min. Rebuild the core classes and the main method from memory. Spaced repetition: this is what makes it stick._
- [ ] **HLD · 35 min**: H35 Bloom filter, HyperLogLog, Count-Min sketch  
  [H35-probabilistic-ds/README.md](../../hld/6-building-blocks/H35-probabilistic-ds/README.md) · [visual](../../hld/6-building-blocks/H35-probabilistic-ds/visual.html) · [demo.ts](../../hld/6-building-blocks/H35-probabilistic-ds/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Wed 23 Dec · Day 66 · 60 min

- [ ] **LLD · 25 min**: Redo sprint: BookMyShow (seat locking)  
  [13-bookmyshow/README.md](../../lld/problems/13-bookmyshow/README.md)  
  _Empty file, 25 min. Rebuild the core classes and the main method from memory. Spaced repetition: this is what makes it stick._
- [ ] **HLD · 35 min**: H36 Batch and stream processing  
  [H36-batch-stream/README.md](../../hld/6-building-blocks/H36-batch-stream/README.md) · [visual](../../hld/6-building-blocks/H36-batch-stream/visual.html) · [demo.ts](../../hld/6-building-blocks/H36-batch-stream/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Thu 24 Dec · Day 67 · 60 min

- [ ] **LLD · 25 min**: Rate Limiter: requirements + class diagram  
  [04-rate-limiter/README.md](../../lld/problems/04-rate-limiter/README.md) · [L30-machine-coding-framework/README.md](../../lld/5-machine-coding/L30-machine-coding-framework/README.md)  
  _Steps 1–3 on paper: clarify, list entities, draw the class diagram, name the patterns. No code yet._
- [ ] **HLD · 35 min**: Real-time Leaderboard: part 1 (requirements → diagram)  
  [21-leaderboard/README.md](../../hld/case-studies/21-leaderboard/README.md) · [21-leaderboard/my-design.md](../../hld/case-studies/21-leaderboard/my-design.md)  
  _In my-design.md: requirements, estimates, API, data model, high-level diagram. Don't open the hints._

## Fri 25 Dec · Day 68 · 60 min

- [ ] **LLD · 25 min**: Rate Limiter: build the core  
  [04-rate-limiter/README.md](../../lld/problems/04-rate-limiter/README.md)  
  _Code the main flow in starter.ts. Run `npx vitest run lld/problems/04-rate-limiter` and get the first tests green._
- [ ] **HLD · 35 min**: Real-time Leaderboard: part 2 (deep dives + compare)  
  [21-leaderboard/README.md](../../hld/case-studies/21-leaderboard/README.md) · [21-leaderboard/my-design.md](../../hld/case-studies/21-leaderboard/my-design.md)  
  _Write 2–3 deep dives and the trade-offs. Then open every hint, compare, and fill in the Review section._

## Sat 26 Dec · Day 69 · 150 min

- [ ] **LLD · 90 min**: Rate Limiter: finish + timed redo  
  [04-rate-limiter/README.md](../../lld/problems/04-rate-limiter/README.md)  
  _Finish starter.ts until all tests pass (40 min). Then answer the extension questions out loud. Only now open reference.ts and write down 3 differences._
- [ ] **HLD · 60 min**: Lab: H34 geohash  
  [lab-geohash/README.md](../../hld/6-building-blocks/H34-geospatial/lab-geohash/README.md) · [H34-geospatial/README.md](../../hld/6-building-blocks/H34-geospatial/README.md)  
  _Implement starter.ts until `npx vitest run hld/6-building-blocks/H34-geospatial/lab-geohash` passes. Then compare with reference.ts._
- [ ] **Stretch · 45 min**: Lab: H35 bloom-filter  
  [lab-bloom-filter/README.md](../../hld/6-building-blocks/H35-probabilistic-ds/lab-bloom-filter/README.md) · [H35-probabilistic-ds/README.md](../../hld/6-building-blocks/H35-probabilistic-ds/README.md)  
  _Implement starter.ts until `npx vitest run hld/6-building-blocks/H35-probabilistic-ds/lab-bloom-filter` passes. Then compare with reference.ts._

## Sun 27 Dec · Day 70 · 120 min

- [ ] **HLD · 75 min**: Proximity Service: full design  
  [22-proximity-service/README.md](../../hld/case-studies/22-proximity-service/README.md) · [22-proximity-service/my-design.md](../../hld/case-studies/22-proximity-service/my-design.md) · [H01-approach-hld-round/README.md](../../hld/1-basics/H01-approach-hld-round/README.md)  
  _45 min on a timer in my-design.md, talking out loud as if to an interviewer (do it as a mock if someone is free). Then 30 min comparing with the hints and filling in the Review._
- [ ] **REV · 45 min**: Weekly review  
  [L34-testing-designs/README.md](../../lld/5-machine-coding/L34-testing-designs/README.md) · [H34-geospatial/README.md](../../hld/6-building-blocks/H34-geospatial/README.md) · [H35-probabilistic-ds/README.md](../../hld/6-building-blocks/H35-probabilistic-ds/README.md) · [H36-batch-stream/README.md](../../hld/6-building-blocks/H36-batch-stream/README.md) · [L25-chain-of-responsibility/README.md](../../lld/4-behavioral/L25-chain-of-responsibility/README.md) · [H25-microservices/README.md](../../hld/5-reliability/H25-microservices/README.md) · [L26-template-method/README.md](../../lld/4-behavioral/L26-template-method/README.md) · [H26-rate-limiting/README.md](../../hld/5-reliability/H26-rate-limiting/README.md) · [L27-iterator/README.md](../../lld/4-behavioral/L27-iterator/README.md) · [H27-resilience/README.md](../../hld/5-reliability/H27-resilience/README.md)  
  _Self-test every concept from this week (L34, H34, H35, H36) and the spaced review from 3 weeks ago (L25, H25, L26, H26, L27, H27). Replay any visual you couldn't explain. Write 5 flashcards for what you got wrong. Then run /daily week._

## Gate: pass this before moving on

- [ ] All 73 concept self-tests at 80%+ (redo the weak ones first)
- [ ] Can whiteboard any of these in 45 min: URL shortener, chat, news feed, payment system, BookMyShow, Uber
- [ ] Can finish Parking Lot or BookMyShow with tests in 90 min
- [ ] 2 mock rounds done with written debriefs

Not passing? Repeat the weakest week's Saturday and Sunday before starting the next phase. Moving on with gaps costs more later.

## Notes

_Write what was hard this week, what to repeat, and anything from interviews._
