# Week 9 · Machine-coding toolkit · Architecture and reliability · Specialised building blocks

> Mon 14 Dec – Sun 20 Dec · Phase 2: Core problems · ~10 h this week
> **Goal:** Finish the concepts and do 2 HLD designs + 1 LLD problem every week. Explain every concept from its visual, out loud.

[← Week 8](week-08.md) · [All weeks](README.md) · [Week 10 →](week-10.md)

## Mon 14 Dec · Day 57 · 60 min

- [ ] **LLD · 25 min**: L31 Repository and dependency injection  
  [L31-repository-and-di/README.md](../../lld/5-machine-coding/L31-repository-and-di/README.md) · [visual](../../lld/5-machine-coding/L31-repository-and-di/visual.html) · [demo.ts](../../lld/5-machine-coding/L31-repository-and-di/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H31 Security: authn, authz, JWT, OAuth2  
  [H31-security-auth/README.md](../../hld/5-reliability/H31-security-auth/README.md) · [visual](../../hld/5-reliability/H31-security-auth/visual.html) · [demo.ts](../../hld/5-reliability/H31-security-auth/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Tue 15 Dec · Day 58 · 60 min

- [ ] **LLD · 25 min**: L32 Concurrency in Node: event loop, races, locks  
  [L32-concurrency-in-node/README.md](../../lld/5-machine-coding/L32-concurrency-in-node/README.md) · [visual](../../lld/5-machine-coding/L32-concurrency-in-node/visual.html) · [demo.ts](../../lld/5-machine-coding/L32-concurrency-in-node/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H32 Blob storage and large files  
  [H32-blob-storage/README.md](../../hld/6-building-blocks/H32-blob-storage/README.md) · [visual](../../hld/6-building-blocks/H32-blob-storage/visual.html) · [demo.ts](../../hld/6-building-blocks/H32-blob-storage/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Wed 16 Dec · Day 59 · 60 min

- [ ] **LLD · 25 min**: L33 Domain modelling in TS: value objects, enums, errors  
  [L33-domain-modeling/README.md](../../lld/5-machine-coding/L33-domain-modeling/README.md) · [visual](../../lld/5-machine-coding/L33-domain-modeling/visual.html) · [demo.ts](../../lld/5-machine-coding/L33-domain-modeling/demo.ts)  
  _Play the visual first (5 min). Read the README. Run demo.ts, then close it and rewrite the core classes from memory in a scratch file. Answer the self-test._
- [ ] **HLD · 35 min**: H33 Search: inverted index and typeahead  
  [H33-search-typeahead/README.md](../../hld/6-building-blocks/H33-search-typeahead/README.md) · [visual](../../hld/6-building-blocks/H33-search-typeahead/visual.html) · [demo.ts](../../hld/6-building-blocks/H33-search-typeahead/demo.ts)  
  _Play the visual (5 min). Read the README. Run demo.ts. Answer the self-test without peeking, then say the "Say this in the interview" part out loud._

## Thu 17 Dec · Day 60 · 60 min

- [ ] **LLD · 25 min**: BookMyShow (seat locking): requirements + class diagram  
  [13-bookmyshow/README.md](../../lld/problems/13-bookmyshow/README.md) · [L30-machine-coding-framework/README.md](../../lld/5-machine-coding/L30-machine-coding-framework/README.md)  
  _Steps 1–3 on paper: clarify, list entities, draw the class diagram, name the patterns. No code yet._
- [ ] **HLD · 35 min**: Web Crawler: part 1 (requirements → diagram)  
  [13-web-crawler/README.md](../../hld/case-studies/13-web-crawler/README.md) · [13-web-crawler/my-design.md](../../hld/case-studies/13-web-crawler/my-design.md)  
  _In my-design.md: requirements, estimates, API, data model, high-level diagram. Don't open the hints._

## Fri 18 Dec · Day 61 · 60 min

- [ ] **LLD · 25 min**: BookMyShow (seat locking): build the core  
  [13-bookmyshow/README.md](../../lld/problems/13-bookmyshow/README.md)  
  _Code the main flow in starter.ts. Run `npx vitest run lld/problems/13-bookmyshow` and get the first tests green._
- [ ] **HLD · 35 min**: Web Crawler: part 2 (deep dives + compare)  
  [13-web-crawler/README.md](../../hld/case-studies/13-web-crawler/README.md) · [13-web-crawler/my-design.md](../../hld/case-studies/13-web-crawler/my-design.md)  
  _Write 2–3 deep dives and the trade-offs. Then open every hint, compare, and fill in the Review section._

## Sat 19 Dec · Day 62 · 150 min

- [ ] **LLD · 90 min**: BookMyShow (seat locking): finish + timed redo  
  [13-bookmyshow/README.md](../../lld/problems/13-bookmyshow/README.md)  
  _Finish starter.ts until all tests pass (40 min). Then answer the extension questions out loud. Only now open reference.ts and write down 3 differences._
- [ ] **HLD · 60 min**: Lab: H28 base62  
  [lab-base62/README.md](../../hld/5-reliability/H28-unique-ids/lab-base62/README.md) · [H28-unique-ids/README.md](../../hld/5-reliability/H28-unique-ids/README.md)  
  _Implement starter.ts until `npx vitest run hld/5-reliability/H28-unique-ids/lab-base62` passes. Then compare with reference.ts._
- [ ] **Stretch · 45 min**: Lab: H33 trie  
  [lab-trie/README.md](../../hld/6-building-blocks/H33-search-typeahead/lab-trie/README.md) · [H33-search-typeahead/README.md](../../hld/6-building-blocks/H33-search-typeahead/README.md)  
  _Implement starter.ts until `npx vitest run hld/6-building-blocks/H33-search-typeahead/lab-trie` passes. Then compare with reference.ts._

## Sun 20 Dec · Day 63 · 120 min

- [ ] **HLD · 75 min**: Photo Sharing (Instagram): full design  
  [16-photo-sharing/README.md](../../hld/case-studies/16-photo-sharing/README.md) · [16-photo-sharing/my-design.md](../../hld/case-studies/16-photo-sharing/my-design.md) · [H01-approach-hld-round/README.md](../../hld/1-basics/H01-approach-hld-round/README.md)  
  _45 min on a timer in my-design.md, talking out loud as if to an interviewer (do it as a mock if someone is free). Then 30 min comparing with the hints and filling in the Review._
- [ ] **REV · 45 min**: Weekly review  
  [L31-repository-and-di/README.md](../../lld/5-machine-coding/L31-repository-and-di/README.md) · [H31-security-auth/README.md](../../hld/5-reliability/H31-security-auth/README.md) · [L32-concurrency-in-node/README.md](../../lld/5-machine-coding/L32-concurrency-in-node/README.md) · [H32-blob-storage/README.md](../../hld/6-building-blocks/H32-blob-storage/README.md) · [L33-domain-modeling/README.md](../../lld/5-machine-coding/L33-domain-modeling/README.md) · [H33-search-typeahead/README.md](../../hld/6-building-blocks/H33-search-typeahead/README.md) · [L22-state/README.md](../../lld/4-behavioral/L22-state/README.md) · [H22-delivery-semantics/README.md](../../hld/4-async/H22-delivery-semantics/README.md) · [L23-command/README.md](../../lld/4-behavioral/L23-command/README.md) · [H23-distributed-transactions/README.md](../../hld/4-async/H23-distributed-transactions/README.md) · [L24-memento/README.md](../../lld/4-behavioral/L24-memento/README.md) · [H24-event-driven-cqrs/README.md](../../hld/4-async/H24-event-driven-cqrs/README.md)  
  _Self-test every concept from this week (L31, H31, L32, H32, L33, H33) and the spaced review from 3 weeks ago (L22, H22, L23, H23, L24, H24). Replay any visual you couldn't explain. Write 5 flashcards for what you got wrong. Then run /daily week._

## Notes

_Write what was hard this week, what to repeat, and anything from interviews._
