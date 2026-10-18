# Week 4 · Async systems: queues, Kafka, idempotency

> Mon 9 Nov – Sun 15 Nov · Phase 2: Core problems · ~10 h this week
> **Goal:** Design anything that sends messages. Know at-least-once + idempotency by heart.

[← Week 3](week-03.md) · [All weeks](README.md) · [Week 5 →](week-05.md)

## Mon 9 Nov · Day 22 · 60 min

- [ ] **LLD · 25 min**: Template Method + Iterator  
  [patterns/p15-template-method](../../lld/concepts/patterns/p15-template-method.md) · [patterns/p15-template-method.ts](../../lld/concepts/patterns/p15-template-method.ts) · [patterns/p16-iterator](../../lld/concepts/patterns/p16-iterator.md) · [patterns/p16-iterator.ts](../../lld/concepts/patterns/p16-iterator.ts)  
  _Read the card, run the .ts file, then close it and write the pattern from memory. Answer the self-test._
- [ ] **HLD · 35 min**: Message queues  
  [concepts/17-message-queues](../../hld/concepts/17-message-queues.md)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._

## Tue 10 Nov · Day 23 · 60 min

- [ ] **LLD · 25 min**: Mediator + Repository + DI  
  [patterns/p17-mediator](../../lld/concepts/patterns/p17-mediator.md) · [patterns/p17-mediator.ts](../../lld/concepts/patterns/p17-mediator.ts) · [patterns/p18-repository-di](../../lld/concepts/patterns/p18-repository-di.md) · [patterns/p18-repository-di.ts](../../lld/concepts/patterns/p18-repository-di.ts)  
  _Read the card, run the .ts file, then close it and write the pattern from memory. Answer the self-test._
- [ ] **HLD · 35 min**: Kafka deep dive  
  [concepts/18-kafka-deep-dive](../../hld/concepts/18-kafka-deep-dive.md) · [visuals/v10-kafka-consumer-groups.html](../../visuals/v10-kafka-consumer-groups.html)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._

## Wed 11 Nov · Day 24 · 60 min

- [ ] **LLD · 25 min**: Notification Service: requirements + class diagram  
  [05-notification-service](../../lld/problems/05-notification-service/README.md)  
  _Read "Your v1 attempt: what to fix" first. Do Step 1 and Step 3 on paper: entities, relationships, patterns. Don't code yet._
- [ ] **HLD · 35 min**: Idempotency and delivery semantics  
  [concepts/19-idempotency-delivery-semantics](../../hld/concepts/19-idempotency-delivery-semantics.md) · [visuals/v11-delivery-semantics.html](../../visuals/v11-delivery-semantics.html)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._

## Thu 12 Nov · Day 25 · 60 min

- [ ] **LLD · 25 min**: Notification Service: implement the core  
  [05-notification-service](../../lld/problems/05-notification-service/README.md)  
  _Code the main flow in starter.ts. Run the tests and get the first half green._
- [ ] **HLD · 35 min**: Notification System: part 1 (steps 1–5)  
  [05-notification-system](../../hld/problems/05-notification-system/README.md) · [05-notification-system/my-design](../../hld/problems/05-notification-system/my-design.md)  
  _In my-design.md: requirements, estimates, API, data model, diagram. Don't open the hints._

## Fri 13 Nov · Day 26 · 60 min

- [ ] **LLD · 25 min**: Notification Service: finish + extensions  
  [05-notification-service](../../lld/problems/05-notification-service/README.md)  
  _Make all tests green. Then answer the Step 5 extensions out loud. Only now compare with reference.ts._
- [ ] **HLD · 35 min**: Notification System: part 2 (deep dives + compare)  
  [05-notification-system](../../hld/problems/05-notification-system/README.md) · [05-notification-system/my-design](../../hld/problems/05-notification-system/my-design.md)  
  _Write the 2–3 deep dives. Then open every hint, compare, and fill in the Review section._

## Sat 14 Nov · Day 27 · 150 min

- [ ] **LLD · 90 min**: Vending Machine: timed machine-coding  
  [06-vending-machine](../../lld/problems/06-vending-machine/README.md)  
  _Full round, 90 min on a timer: 10 min clarify, 10 min design, the rest code + tests. Then compare with reference.ts and note 3 differences._
- [ ] **HLD · 60 min**: Real-time: polling, SSE, WebSockets  
  [concepts/05-realtime-communication](../../hld/concepts/05-realtime-communication.md) · [visuals/v14-realtime-transport.html](../../visuals/v14-realtime-transport.html)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._

## Sun 15 Nov · Day 28 · 120 min

- [ ] **HLD · 75 min**: Chat System (WhatsApp): full design  
  [06-chat-system](../../hld/problems/06-chat-system/README.md) · [06-chat-system/my-design](../../hld/problems/06-chat-system/my-design.md)  
  _45 min on a timer in my-design.md, talking out loud as if to an interviewer. Then 30 min comparing with the hints and filling in the Review._
- [ ] **REV · 45 min**: Weekly review  
  _Self-test this week's cards. Redo the vending machine state diagram from memory. Then run /daily week._

## Notes

_Write what was hard this week, what to repeat, and anything from interviews._
