# Week 4 · Structural patterns · Databases and data distribution

> Mon 9 Nov – Sun 15 Nov · Phase 2: Core problems · ~10 h this week
> **Goal:** Finish the concepts and do 2 HLD designs + 1 LLD problem every week. Explain every concept from its visual, out loud.

[← Week 3](week-03.md) · [All weeks](README.md) · [Week 5 →](week-05.md)

## Mon 9 Nov · Day 22 · 60 min

- [ ] **LLD · 25 min**: L16 Proxy  
  [L16-proxy/README.md](../../lld/3-structural/L16-proxy/README.md) · [visual](../../lld/3-structural/L16-proxy/visual.html) · [demo.ts](../../lld/3-structural/L16-proxy/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H16 Partitioning and sharding  
  [H16-partitioning-sharding/README.md](../../hld/3-databases/H16-partitioning-sharding/README.md) · [visual](../../hld/3-databases/H16-partitioning-sharding/visual.html) · [demo.ts](../../hld/3-databases/H16-partitioning-sharding/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Tue 10 Nov · Day 23 · 60 min

- [ ] **LLD · 25 min**: L17 Composite  
  [L17-composite/README.md](../../lld/3-structural/L17-composite/README.md) · [visual](../../lld/3-structural/L17-composite/visual.html) · [demo.ts](../../lld/3-structural/L17-composite/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H17 Consistent hashing  
  [H17-consistent-hashing/README.md](../../hld/3-databases/H17-consistent-hashing/README.md) · [visual](../../hld/3-databases/H17-consistent-hashing/visual.html) · [demo.ts](../../hld/3-databases/H17-consistent-hashing/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Wed 11 Nov · Day 24 · 60 min

- [ ] **LLD · 25 min**: L18 Bridge  
  [L18-bridge/README.md](../../lld/3-structural/L18-bridge/README.md) · [visual](../../lld/3-structural/L18-bridge/visual.html) · [demo.ts](../../lld/3-structural/L18-bridge/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H18 CAP, PACELC and consistency models  
  [H18-cap-pacelc-consistency/README.md](../../hld/3-databases/H18-cap-pacelc-consistency/README.md) · [visual](../../hld/3-databases/H18-cap-pacelc-consistency/visual.html) · [demo.ts](../../hld/3-databases/H18-cap-pacelc-consistency/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Thu 12 Nov · Day 25 · 60 min

- [ ] **LLD · 25 min**: In-memory File System: requirements + class diagram  
  [24-file-system/README.md](../../lld/problems/24-file-system/README.md) · [L30-machine-coding-framework/README.md](../../lld/5-machine-coding/L30-machine-coding-framework/README.md)  
  _Steps 1–3 on paper: clarify, list entities, draw the class diagram, name the patterns. No code yet._
- [ ] **HLD · 35 min**: Distributed KV Store: part 1 (requirements → diagram)  
  [04-key-value-store/README.md](../../hld/case-studies/04-key-value-store/README.md) · [04-key-value-store/my-design.md](../../hld/case-studies/04-key-value-store/my-design.md)  
  _In my-design.md: requirements, estimates, API, data model, high-level diagram. Don't open the hints._

## Fri 13 Nov · Day 26 · 60 min

- [ ] **LLD · 25 min**: In-memory File System: build the core  
  [24-file-system/README.md](../../lld/problems/24-file-system/README.md)  
  _Code the main flow in starter.ts. Run `npx vitest run lld/problems/24-file-system` and get the first tests green._
- [ ] **HLD · 35 min**: Distributed KV Store: part 2 (deep dives + compare)  
  [04-key-value-store/README.md](../../hld/case-studies/04-key-value-store/README.md) · [04-key-value-store/my-design.md](../../hld/case-studies/04-key-value-store/my-design.md)  
  _Write 2–3 deep dives and the trade-offs. Then open every hint, compare, and fill in the Review section._

## Sat 14 Nov · Day 27 · 150 min

- [ ] **LLD · 90 min**: In-memory File System: finish + timed redo  
  [24-file-system/README.md](../../lld/problems/24-file-system/README.md)  
  _Finish starter.ts until all tests pass (40 min). Then answer the extension questions out loud. Only now open reference.ts and write down 3 differences._
- [ ] **HLD · 60 min**: Hands-on: H08 Load balancing  
  [hands-on/README.md](../../hld/2-scaling/H08-load-balancing/hands-on/README.md) · [H08-load-balancing/README.md](../../hld/2-scaling/H08-load-balancing/README.md)  
  _Pick one folder in hands-on/, run it with Docker or Node, and watch the behaviour the README describes. Write 3 lines on what you saw._
- [ ] **Stretch · 45 min**: Hands-on: H09 Caching patterns, eviction and failures  
  [hands-on/README.md](../../hld/2-scaling/H09-caching/hands-on/README.md) · [H09-caching/README.md](../../hld/2-scaling/H09-caching/README.md)  
  _Pick one folder in hands-on/, run it with Docker or Node, and watch the behaviour the README describes. Write 3 lines on what you saw._

## Sun 15 Nov · Day 28 · 120 min

- [ ] **HLD · 75 min**: Distributed Cache: full design  
  [17-distributed-cache/README.md](../../hld/case-studies/17-distributed-cache/README.md) · [17-distributed-cache/my-design.md](../../hld/case-studies/17-distributed-cache/my-design.md) · [H01-approach-hld-round/README.md](../../hld/1-basics/H01-approach-hld-round/README.md)  
  _45 min on a timer in my-design.md, talking out loud as if to an interviewer (do it as a mock if someone is free). Then 30 min comparing with the hints and filling in the Review._
- [ ] **REV · 45 min**: Weekly review  
  [L16-proxy/README.md](../../lld/3-structural/L16-proxy/README.md) · [H16-partitioning-sharding/README.md](../../hld/3-databases/H16-partitioning-sharding/README.md) · [L17-composite/README.md](../../lld/3-structural/L17-composite/README.md) · [H17-consistent-hashing/README.md](../../hld/3-databases/H17-consistent-hashing/README.md) · [L18-bridge/README.md](../../lld/3-structural/L18-bridge/README.md) · [H18-cap-pacelc-consistency/README.md](../../hld/3-databases/H18-cap-pacelc-consistency/README.md) · [L01-classes-and-interfaces/README.md](../../lld/1-foundations/L01-classes-and-interfaces/README.md) · [H01-approach-hld-round/README.md](../../hld/1-basics/H01-approach-hld-round/README.md) · [L02-oop-pillars/README.md](../../lld/1-foundations/L02-oop-pillars/README.md) · [H02-back-of-envelope/README.md](../../hld/1-basics/H02-back-of-envelope/README.md) · [L03-composition-over-inheritance/README.md](../../lld/1-foundations/L03-composition-over-inheritance/README.md) · [H03-networking-basics/README.md](../../hld/1-basics/H03-networking-basics/README.md)  
  _Self-test every concept from this week (L16, H16, L17, H17, L18, H18) and the spaced review from 3 weeks ago (L01, H01, L02, H02, L03, H03, L04, H04, L05, H05). Replay any visual you couldn't explain. Write 5 flashcards for what you got wrong. Then run /daily week._

## Notes

_Write what was hard this week, what to repeat, and anything from interviews._
