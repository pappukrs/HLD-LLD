# Week 6 · Coordination and bookings

> Mon 23 Nov – Sun 29 Nov · Phase 2: Core problems · ~10 h this week
> **Goal:** Never double-book a seat. Explain locks, leases and leader election.

[← Week 5](week-05.md) · [All weeks](README.md) · [Week 7 →](week-07.md)

## Mon 23 Nov · Day 36 · 60 min

- [ ] **LLD · 25 min**: Elevator System: requirements + class diagram  
  [10-elevator](../../lld/problems/10-elevator/README.md)  
  _Do Step 1 and Step 3 on paper: entities, relationships, patterns. Don't code yet._
- [ ] **HLD · 35 min**: Resilience: timeouts, retries, circuit breakers  
  [concepts/24-resilience-patterns](../../hld/concepts/24-resilience-patterns.md) · [visuals/v13-circuit-breaker.html](../../visuals/v13-circuit-breaker.html)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._
- [ ] **Stretch · 40 min**: Code: circuit breaker + retry  
  [09-circuit-breaker](../../hld/code/09-circuit-breaker/README.md)  
  _With an injected clock and jitter._

## Tue 24 Nov · Day 37 · 60 min

- [ ] **LLD · 25 min**: Elevator System: implement the core  
  [10-elevator](../../lld/problems/10-elevator/README.md)  
  _Code the main flow in starter.ts. Run the tests and get the first half green._
- [ ] **HLD · 35 min**: Consensus, leader election, locks  
  [concepts/30-consensus-coordination](../../hld/concepts/30-consensus-coordination.md) · [visuals/v18-raft-leader-election.html](../../visuals/v18-raft-leader-election.html)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._

## Wed 25 Nov · Day 38 · 60 min

- [ ] **LLD · 25 min**: Elevator System: finish + extensions  
  [10-elevator](../../lld/problems/10-elevator/README.md)  
  _Make all tests green. Then answer the Step 5 extensions out loud. Only now compare with reference.ts._
- [ ] **HLD · 35 min**: Microservices, API gateway, discovery  
  [concepts/22-microservices](../../hld/concepts/22-microservices.md)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._

## Thu 26 Nov · Day 39 · 60 min

- [ ] **LLD · 25 min**: ATM: requirements + class diagram  
  [11-atm](../../lld/problems/11-atm/README.md)  
  _Read "Your v1 attempt: what to fix" first. Do Step 1 and Step 3 on paper: entities, relationships, patterns. Don't code yet._
- [ ] **HLD · 35 min**: Ticket Booking (BookMyShow): part 1 (steps 1–5)  
  [09-ticket-booking](../../hld/problems/09-ticket-booking/README.md) · [09-ticket-booking/my-design](../../hld/problems/09-ticket-booking/my-design.md)  
  _In my-design.md: requirements, estimates, API, data model, diagram. Don't open the hints._

## Fri 27 Nov · Day 40 · 60 min

- [ ] **LLD · 25 min**: ATM: implement the core  
  [11-atm](../../lld/problems/11-atm/README.md)  
  _Code the main flow in starter.ts. Run the tests and get the first half green._
- [ ] **HLD · 35 min**: Ticket Booking (BookMyShow): part 2 (deep dives + compare)  
  [09-ticket-booking](../../hld/problems/09-ticket-booking/README.md) · [09-ticket-booking/my-design](../../hld/problems/09-ticket-booking/my-design.md)  
  _Write the 2–3 deep dives. Then open every hint, compare, and fill in the Review section._

## Sat 28 Nov · Day 41 · 150 min

- [ ] **LLD · 90 min**: BookMyShow seat locking: timed machine-coding  
  [13-bookmyshow](../../lld/problems/13-bookmyshow/README.md)  
  _Full round, 90 min on a timer: 10 min clarify, 10 min design, the rest code + tests. Then compare with reference.ts and note 3 differences._
- [ ] **HLD · 60 min**: Geospatial indexing  
  [concepts/28-geospatial](../../hld/concepts/28-geospatial.md) · [visuals/v17-geohash-quadtree.html](../../visuals/v17-geohash-quadtree.html) · [visuals/v28-seat-locking.html](../../visuals/v28-seat-locking.html)  
  _Read the card. Play the visual if there is one. Answer the self-test without peeking, then say the "what to say" part out loud._
- [ ] **Stretch · 30 min**: Code: geohash  
  [06-geohash](../../hld/code/06-geohash/README.md)  
  _Encode, decode, neighbours._

## Sun 29 Nov · Day 42 · 120 min

- [ ] **HLD · 75 min**: Ride Hailing (Uber/Ola): full design  
  [10-ride-hailing](../../hld/problems/10-ride-hailing/README.md) · [10-ride-hailing/my-design](../../hld/problems/10-ride-hailing/my-design.md)  
  _45 min on a timer in my-design.md, talking out loud as if to an interviewer. Then 30 min comparing with the hints and filling in the Review._
- [ ] **REV · 45 min**: Weekly review  
  _Finish the ATM tests if they are still red. Self-test this week's cards. Then run /daily week._

## Notes

_Write what was hard this week, what to repeat, and anything from interviews._
