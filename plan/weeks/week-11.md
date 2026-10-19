# Week 11 · Interview loop starts: the last building blocks

> Mon 28 Dec – Sun 3 Jan · Phase 3: Interview loop · ~10 h this week
> **Goal:** Interviews are running. Hard designs, advanced problems, and fix what each interview exposed.

[← Week 10](week-10.md) · [All weeks](README.md) · [Week 12 →](week-12.md)

## Mon 28 Dec · Day 71 · 60 min

- [ ] **LLD · 25 min**: Refresh: L01 + L02  
  [demo.ts](../../lld/1-foundations/L01-classes-and-interfaces/demo.ts) · [demo.ts](../../lld/1-foundations/L02-oop-pillars/demo.ts)  
  _Write both patterns from memory (10 min each), then diff against demo.ts._
- [ ] **HLD · 35 min**: H37 Data at scale: fan-out, hot keys, counters  
  [H37-data-at-scale/README.md](../../hld/6-building-blocks/H37-data-at-scale/README.md) · [visual](../../hld/6-building-blocks/H37-data-at-scale/visual.html) · [demo.ts](../../hld/6-building-blocks/H37-data-at-scale/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Tue 29 Dec · Day 72 · 60 min

- [ ] **LLD · 25 min**: Redo sprint: LRU / LFU Cache  
  [02-lru-cache/README.md](../../lld/problems/02-lru-cache/README.md)  
  _Empty file, 25 min. Rebuild the core classes and the main method from memory. Spaced repetition: this is what makes it stick._
- [ ] **HLD · 35 min**: H38 Payments: ledger, PSPs, reconciliation  
  [H38-payments-domain/README.md](../../hld/6-building-blocks/H38-payments-domain/README.md) · [visual](../../hld/6-building-blocks/H38-payments-domain/visual.html) · [demo.ts](../../hld/6-building-blocks/H38-payments-domain/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Wed 30 Dec · Day 73 · 60 min

- [ ] **LLD · 25 min**: Debrief fix  
  _Fix the weakest topic from this week's real interviews (see ~/career-agent/debriefs/). No interview this week? Redo the self-test of your lowest-scored concept._
- [ ] **HLD · 35 min**: H39 Deployment, autoscaling and multi-region  
  [H39-deployment-multi-region/README.md](../../hld/6-building-blocks/H39-deployment-multi-region/README.md) · [visual](../../hld/6-building-blocks/H39-deployment-multi-region/visual.html) · [demo.ts](../../hld/6-building-blocks/H39-deployment-multi-region/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Thu 31 Dec · Day 74 · 60 min

- [ ] **LLD · 25 min**: Splitwise: requirements + class diagram  
  [09-splitwise/README.md](../../lld/problems/09-splitwise/README.md) · [L30-machine-coding-framework/README.md](../../lld/5-machine-coding/L30-machine-coding-framework/README.md)  
  _Steps 1–3 on paper: clarify, list entities, draw the class diagram, name the patterns. No code yet._
- [ ] **HLD · 35 min**: Distributed Message Queue: part 1 (requirements → diagram)  
  [18-distributed-message-queue/README.md](../../hld/case-studies/18-distributed-message-queue/README.md) · [18-distributed-message-queue/my-design.md](../../hld/case-studies/18-distributed-message-queue/my-design.md)  
  _In my-design.md: requirements, estimates, API, data model, high-level diagram. Don't open the hints._

## Fri 1 Jan · Day 75 · 60 min

- [ ] **LLD · 25 min**: Splitwise: build the core  
  [09-splitwise/README.md](../../lld/problems/09-splitwise/README.md)  
  _Code the main flow in starter.ts. Run `npx vitest run lld/problems/09-splitwise` and get the first tests green._
- [ ] **HLD · 35 min**: Distributed Message Queue: part 2 (deep dives + compare)  
  [18-distributed-message-queue/README.md](../../hld/case-studies/18-distributed-message-queue/README.md) · [18-distributed-message-queue/my-design.md](../../hld/case-studies/18-distributed-message-queue/my-design.md)  
  _Write 2–3 deep dives and the trade-offs. Then open every hint, compare, and fill in the Review section._

## Sat 2 Jan · Day 76 · 150 min

- [ ] **LLD · 90 min**: Splitwise: finish + timed redo  
  [09-splitwise/README.md](../../lld/problems/09-splitwise/README.md)  
  _Finish starter.ts until all tests pass (40 min). Then answer the extension questions out loud. Only now open reference.ts and write down 3 differences._
- [ ] **HLD · 60 min**: Lab: H35 count-min  
  [lab-count-min/README.md](../../hld/6-building-blocks/H35-probabilistic-ds/lab-count-min/README.md) · [H35-probabilistic-ds/README.md](../../hld/6-building-blocks/H35-probabilistic-ds/README.md)  
  _Implement starter.ts until `npx vitest run hld/6-building-blocks/H35-probabilistic-ds/lab-count-min` passes. Then compare with reference.ts._
- [ ] **Stretch · 45 min**: Hands-on: H35 Bloom filter, HyperLogLog, Count-Min sketch  
  [hands-on/README.md](../../hld/6-building-blocks/H35-probabilistic-ds/hands-on/README.md) · [H35-probabilistic-ds/README.md](../../hld/6-building-blocks/H35-probabilistic-ds/README.md)  
  _Pick one folder in hands-on/, run it with Docker or Node, and watch the behaviour the README describes. Write 3 lines on what you saw._

## Sun 3 Jan · Day 77 · 120 min

- [ ] **HLD · 75 min**: File Storage (Dropbox): full design  
  [15-file-storage/README.md](../../hld/case-studies/15-file-storage/README.md) · [15-file-storage/my-design.md](../../hld/case-studies/15-file-storage/my-design.md) · [H01-approach-hld-round/README.md](../../hld/1-basics/H01-approach-hld-round/README.md)  
  _45 min on a timer in my-design.md, talking out loud as if to an interviewer (do it as a mock if someone is free). Then 30 min comparing with the hints and filling in the Review._
- [ ] **REV · 45 min**: Weekly review  
  [H37-data-at-scale/README.md](../../hld/6-building-blocks/H37-data-at-scale/README.md) · [H38-payments-domain/README.md](../../hld/6-building-blocks/H38-payments-domain/README.md) · [H39-deployment-multi-region/README.md](../../hld/6-building-blocks/H39-deployment-multi-region/README.md) · [L28-mediator/README.md](../../lld/4-behavioral/L28-mediator/README.md) · [H28-unique-ids/README.md](../../hld/5-reliability/H28-unique-ids/README.md) · [L29-visitor/README.md](../../lld/4-behavioral/L29-visitor/README.md) · [H29-consensus-locks/README.md](../../hld/5-reliability/H29-consensus-locks/README.md) · [L30-machine-coding-framework/README.md](../../lld/5-machine-coding/L30-machine-coding-framework/README.md) · [H30-observability/README.md](../../hld/5-reliability/H30-observability/README.md)  
  _Self-test every concept from this week (H37, H38, H39) and the spaced review from 3 weeks ago (L28, H28, L29, H29, L30, H30). Replay any visual you couldn't explain. Write 5 flashcards for what you got wrong. Then run /daily week._

## Notes

_Write what was hard this week, what to repeat, and anything from interviews._
