# Week 3 · Behavioural patterns · spreading data across machines

> Mon 2 Nov – Sun 8 Nov · Phase 1: Foundations · ~10 h this week
> **Goal:** Explain sharding, consistent hashing, CAP and quorums with a drawing. Use Strategy/Observer/State without thinking.

[← Week 2](week-02.md) · [All weeks](README.md) · [Week 4 →](week-04.md)

## Mon 2 Nov · Day 15 · 60 min

- [ ] **LLD · 25 min**: Strategy  
  [patterns/p10-strategy](../../lld/concepts/patterns/p10-strategy.md) · [patterns/p10-strategy.ts](../../lld/concepts/patterns/p10-strategy.ts) · [visuals/v23-strategy-factory.html](../../visuals/v23-strategy-factory.html)  
  _Read the card, run the .ts file, then close it and write the pattern from memory. Answer the self-test._
- [ ] **HLD · 35 min**: Partitioning and sharding  
  [concepts/13-partitioning-sharding](../../hld/concepts/13-partitioning-sharding.md) · [visuals/v06-sharding.html](../../visuals/v06-sharding.html)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._

## Tue 3 Nov · Day 16 · 60 min

- [ ] **LLD · 25 min**: Observer  
  [patterns/p11-observer](../../lld/concepts/patterns/p11-observer.md) · [patterns/p11-observer.ts](../../lld/concepts/patterns/p11-observer.ts) · [visuals/v24-observer-pubsub.html](../../visuals/v24-observer-pubsub.html)  
  _Read the card, run the .ts file, then close it and write the pattern from memory. Answer the self-test._
- [ ] **HLD · 35 min**: Consistent hashing  
  [concepts/14-consistent-hashing](../../hld/concepts/14-consistent-hashing.md) · [visuals/v04-consistent-hashing.html](../../visuals/v04-consistent-hashing.html)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._
- [ ] **Stretch · 40 min**: Code: consistent hash ring  
  [01-consistent-hashing](../../hld/code/01-consistent-hashing/README.md)  
  _Implement it with virtual nodes._

## Wed 4 Nov · Day 17 · 60 min

- [ ] **LLD · 25 min**: State  
  [patterns/p12-state](../../lld/concepts/patterns/p12-state.md) · [patterns/p12-state.ts](../../lld/concepts/patterns/p12-state.ts) · [visuals/v25-state-machine.html](../../visuals/v25-state-machine.html)  
  _Read the card, run the .ts file, then close it and write the pattern from memory. Answer the self-test._
- [ ] **HLD · 35 min**: CAP, PACELC, consistency models  
  [concepts/15-cap-pacelc-consistency](../../hld/concepts/15-cap-pacelc-consistency.md) · [visuals/v07-cap-partition.html](../../visuals/v07-cap-partition.html)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._

## Thu 5 Nov · Day 18 · 60 min

- [ ] **LLD · 25 min**: Command + Memento  
  [patterns/p13-command](../../lld/concepts/patterns/p13-command.md) · [patterns/p13-command.ts](../../lld/concepts/patterns/p13-command.ts) · [visuals/v27-command-undo-redo.html](../../visuals/v27-command-undo-redo.html)  
  _Read the card, run the .ts file, then close it and write the pattern from memory. Answer the self-test._
- [ ] **HLD · 35 min**: Quorums and leaderless replication  
  [concepts/16-quorum-leaderless](../../hld/concepts/16-quorum-leaderless.md) · [visuals/v08-quorum.html](../../visuals/v08-quorum.html)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._
- [ ] **Stretch · 40 min**: Code: quorum KV  
  [08-quorum-kv](../../hld/code/08-quorum-kv/README.md)  
  _Simulate N/R/W with node failures._

## Fri 6 Nov · Day 19 · 60 min

- [ ] **LLD · 25 min**: Chain of Responsibility  
  [patterns/p14-chain-of-responsibility](../../lld/concepts/patterns/p14-chain-of-responsibility.md) · [patterns/p14-chain-of-responsibility.ts](../../lld/concepts/patterns/p14-chain-of-responsibility.ts)  
  _Read the card, run the .ts file, then close it and write the pattern from memory. Answer the self-test._
- [ ] **HLD · 35 min**: Rate limiting  
  [concepts/23-rate-limiting](../../hld/concepts/23-rate-limiting.md) · [visuals/v09-rate-limiting.html](../../visuals/v09-rate-limiting.html)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._
- [ ] **Stretch · 40 min**: Code: rate limiter algorithms  
  [02-rate-limiter-algorithms](../../hld/code/02-rate-limiter-algorithms/README.md)  
  _Token bucket and sliding window._

## Sat 7 Nov · Day 20 · 150 min

- [ ] **LLD · 90 min**: Rate Limiter (rewrite your v1): timed machine-coding  
  [04-rate-limiter](../../lld/problems/04-rate-limiter/README.md)  
  _Full round, 90 min on a timer: 10 min clarify, 10 min design, the rest code + tests. Then compare with reference.ts and note 3 differences._
- [ ] **HLD · 60 min**: Distributed Rate Limiter: design  
  [02-rate-limiter](../../hld/problems/02-rate-limiter/README.md) · [02-rate-limiter/my-design](../../hld/problems/02-rate-limiter/my-design.md)  
  _Design it in my-design.md in 45 min, then compare._

## Sun 8 Nov · Day 21 · 120 min

- [ ] **HLD · 75 min**: Distributed Key-Value Store: full design  
  [04-key-value-store](../../hld/problems/04-key-value-store/README.md) · [04-key-value-store/my-design](../../hld/problems/04-key-value-store/my-design.md)  
  _45 min on a timer in my-design.md, talking out loud as if to an interviewer. Then 30 min comparing with the hints and filling in the Review._
- [ ] **REV · 45 min**: Weekly review  
  _Phase 1 gate (see below). Explain 10 concepts out loud, 2 min each. Record yourself once. Then run /daily week._

## Gate: pass this before moving on

- [ ] You can run the 45-minute HLD framework without notes.
- [ ] You can explain caching patterns, replication, sharding, consistent hashing and CAP with a drawing, in 2 minutes each.
- [ ] Parking Lot, LRU Cache and Rate Limiter are green in your own starter.ts.
- [ ] You can name the pattern for: choosing an algorithm at runtime, reacting to events, objects with lifecycle states, undo.

Not passing? Repeat the weakest week's Saturday and Sunday before starting the next phase. Moving on with gaps costs more later.

## Notes

_Write what was hard this week, what to repeat, and anything from interviews._
