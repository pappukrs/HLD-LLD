# System Design Quiz — self-test (answers at the bottom)

Answer out loud, as if to an interviewer. If you can do all of these, you can defend your projects
and handle generic HLD rounds. Pair with `talking-points.md`.

## Project deep-dives
1. Why does a WebRTC **mesh** fail for group calls, and how does an **SFU** fix it? When would you pick an **MCU** instead?
2. In your video platform, why did you use **gRPC** between Signaling and Media instead of REST? One downside?
3. What's a **TURN** server and roughly what fraction of users need it?
4. Explain **idempotency** in your payment service. Why can't you rely on "exactly-once delivery"?
5. A payment webhook arrives **twice**. Walk through how your system avoids a double effect.
6. Describe **cache-aside**. What are its two failure modes and how did you mitigate them?
7. Why do WebSocket servers need **sticky sessions**, and how did the **Redis adapter** let you scale past one node?
8. Why **batch** the IoT device writes? What's the tradeoff?

## Generic HLD
9. State **CAP** in one sentence. What do most web apps choose and why?
10. Compare **cache-aside vs write-through vs write-behind**.
11. **SQL vs NoSQL** — when each?
12. **RabbitMQ vs Kafka** — one-line difference and when to use each.
13. What problem does **consistent hashing** solve?
14. Name 3 **rate-limiting** algorithms; which is smoothest?
15. How do you do a **transaction across microservices** without 2PC?
16. Give the 6-step framework you'd use to attack any "Design X" question.

---

## Answers
1. Mesh = each peer streams to every other → N×(N-1) connections; client upload + CPU explode past ~4.
   **SFU** = each client sends one upstream; server forwards copies → scales to many, moderate server cost.
   **MCU** = server mixes all streams into one (tiny client bandwidth) but high server CPU — pick it for very
   low-bandwidth clients / recording.
2. gRPC = binary Protobuf + HTTP/2 → ~2–5ms vs ~20–50ms REST, plus compile-time typed contracts. Downside:
   not human-readable, needs proto tooling/codegen.
3. **TURN** relays media when peers can't connect directly (symmetric NAT/strict firewall); ~10% of clients.
4. Idempotency = the same operation applied twice has the effect of once, via an **idempotency key** stored
   server-side (`key → result`). Networks only guarantee **at-least-once delivery**, so you make **processing
   idempotent** → "exactly-once **effect**."
5. Dedupe by the provider's **event id** inside a transaction: if the id was already processed, ignore; else
   process + record the id. A state machine ignores out-of-order/duplicate transitions.
6. Cache-aside: check cache → hit returns; miss → read DB, populate cache (TTL), return. Failure modes:
   **stale data** (mitigate: TTL + invalidate on write) and **stampede** when a hot key expires (mitigate:
   lock / single-flight / staggered TTLs).
7. A WebSocket is a long-lived **stateful** connection pinned to one server, so the LB must send the same
   client back to the same node (**sticky / IP-hash**). The **Redis pub/sub adapter** broadcasts events across
   all nodes, so a message from a client on node A reaches clients on node B.
8. Batching turns many small high-frequency writes into fewer large ones → big DB-load/throughput win;
   tradeoff is a small added latency before data is persisted.
9. Under a network **partition**, you can keep **Consistency** or **Availability**, not both. Most web apps
   choose **AP** (stay available, eventual consistency) because uptime matters more than instant global consistency.
10. **Cache-aside**: app manages cache, lazy populate (simple, resilient, can be stale). **Write-through**:
    write to cache+DB together (fresh, slower writes). **Write-behind**: write cache now, DB async (fast,
    risk of loss).
11. **SQL** for relational data, joins, transactions, strong consistency (payments, orders). **NoSQL** for
    massive scale, flexible/denormalized schema, high write throughput (feeds, telemetry, sessions).
12. **RabbitMQ** = smart broker, per-message routing/ack, good for task queues. **Kafka** = distributed log,
    very high throughput, **replayable**, good for event streaming/analytics.
13. **Consistent hashing** minimizes key remapping when nodes are added/removed — only ~1/N keys move
    (vital for distributed caches and shards).
14. **Token bucket, leaky bucket, fixed window, sliding window.** Sliding-window (log) is smoothest; token
    bucket allows bursts.
15. **Saga pattern** — a sequence of local transactions with compensating actions on failure, coordinated by
    events (choreography) or an orchestrator. Avoids the locking/availability cost of 2PC.
16. **Clarify reqs (functional + non-functional) → estimate scale → API → data model → high-level diagram →
    deep-dive a bottleneck with tradeoffs.**
