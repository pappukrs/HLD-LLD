# System Design Talking Points — grounded in YOUR real work

> Purpose: turn the systems you actually built into confident interview answers. Two interview modes
> this preps you for: (A) "Tell me about a system you designed" (experience) and (B) "Design X"
> (generic HLD) — where you lean on your real experience instead of textbook fluff.
> Golden rule: **state the requirement → propose → name the tradeoff → say what you'd do at 10×.**

---

## Part 0 — The HLD framework (use on ANY "design X" question)
Never start drawing boxes. Walk these 6 steps out loud:

1. **Clarify & scope** — functional reqs (what it does) + non-functional (scale, latency, consistency,
   availability). Ask: how many users? read or write heavy? real-time?
2. **Back-of-envelope estimate** — QPS, storage, bandwidth. (e.g., "1M DAU, 10 req/user/day ≈ ~115 req/s avg, ~10× peak ≈ 1.2k req/s.")
3. **API design** — the key endpoints (REST/gRPC/WS) with inputs/outputs.
4. **Data model** — entities, SQL vs NoSQL, indexes.
5. **High-level diagram** — client → LB → services → cache → DB → queue.
6. **Deep dive + bottlenecks** — pick the hard part, scale it, name tradeoffs (CAP, consistency, cost).

Keywords to land: **load balancing, caching, sharding/partitioning, replication, CAP, idempotency,
message queues, CDN, rate limiting, consistent hashing, eventual consistency.**

---

## Part 1 — Your 5 flagship stories (memorize the shape of each)

### 1. Real-Time Multi-Party Video Platform (SFU)  ⭐ your strongest
**Problem:** Multi-party video calls. Naive **WebRTC mesh** = each client sends a stream to every
other → N×(N-1) connections; dies past ~4 people (upload bandwidth + CPU explode).

**What you built:** An **SFU (Selective Forwarding Unit)** with **Mediasoup** — each client sends
**one** upstream to the server, which forwards (not re-encodes) streams to others. Split into
**API Gateway · Signaling · Media** microservices; **Socket.io/WSS** for signaling, **gRPC** for
internal service calls; **Consul** discovery, **Prometheus + Grafana** observability; **Nginx** edge.

**Key decisions & tradeoffs:**
- **SFU vs Mesh vs MCU:** Mesh = no server cost but doesn't scale. MCU = mixes streams server-side
  (low client bandwidth) but huge server CPU. **SFU = the middle** — forwards streams, scales to many
  participants, moderate server cost. *You chose SFU for scale without MCU's CPU bill.*
- **gRPC internally:** Signaling↔Media went REST(20–50ms) → **gRPC(2–5ms)** — Protobuf is compact +
  compile-time typed. Tradeoff: less human-readable than JSON, needs proto tooling.
- **WebRTC transport:** DTLS/ICE over UDP (ports 40000–40100); UDP because real-time tolerates loss but not delay.

**How it scales (the 10× answer):** distribute Mediasoup workers across **multiple nodes/CPU cores**;
**Redis Pub/Sub** to sync signaling state across instances; add a **STUN/TURN** cluster for clients
behind strict NATs; shard rooms across media servers.

**Likely follow-ups → answers:**
- *Why not mesh?* → bandwidth/CPU blow up at N²; SFU is one-up, many-down.
- *How do peers discover each other?* → signaling service brokers SDP/ICE over WSS; media flows P2P-to-SFU.
- *TURN?* → relay for ~10% of clients behind symmetric NAT/firewalls.

---

### 2. Microservices + API Gateway (SenseGrass / node-microservices)
**Problem:** A monolith couples teams and scaling. Needed independent services with one secure front door.

**What you built:** An **Express API Gateway** as the single entry point doing **JWT auth,
rate limiting, reverse-proxy routing, and response caching (LRU)**, fronting services (auth, product,
order, payment, notification). Each service: own DB, own Dockerfile, own k8s manifests.

**Key decisions & tradeoffs:**
- **Gateway pattern:** centralizes cross-cutting concerns (auth, rate limit, logging) so services stay
  focused. Tradeoff: gateway is a potential bottleneck/SPOF → run it stateless behind a LB, scale horizontally.
- **Stateless JWT:** services verify the token signature independently — no shared session store needed.
  Tradeoff: can't easily revoke a token before expiry → keep TTLs short + a denylist for critical cases.
- **Per-service DB:** loose coupling + independent scaling. Tradeoff: no cross-service JOINs → use
  API composition or events; eventual consistency.

**10×:** add a **message broker** (RabbitMQ/Kafka) for async inter-service events, **circuit breakers**
for failing downstreams, service mesh for mTLS + retries.

**Follow-ups:** *Service-to-service comms?* REST/gRPC sync + events async. *Distributed transaction?*
**Saga pattern** (choreography via events or orchestration), not 2PC.

---

### 3. Payment Idempotency (SenseGrass)  ⭐ great "hard problem" story
**Problem:** Networks retry. A double-submitted or retried payment must **not** charge twice.
Webhooks from gateways can also arrive **more than once** and out of order.

**What you built:** A **payment orchestration service** with **idempotency keys**, webhook handling,
and retry strategies across **3 providers** via the **Adapter pattern**.

**Key decisions & tradeoffs:**
- **Idempotency key** per payment intent (client-generated UUID). Server stores `key → result`; a repeat
  with the same key **returns the stored result instead of re-charging**. This is the core "exactly-once
  effect over an at-least-once network."
- **Webhook idempotency:** dedupe by provider event id; process in a transaction; ignore already-seen ids.
- **Adapter pattern:** one internal interface, per-provider adapters → adding a gateway doesn't touch core logic.
- **State machine** for payment status (created → pending → success/failed) to handle out-of-order webhooks.

**10×:** outbox pattern + queue so the charge and the DB write can't diverge; reconciliation job vs provider.

**Follow-ups:** *Exactly-once?* There's no true exactly-once delivery — you get **at-least-once delivery
+ idempotent processing = exactly-once effect.** Nail that sentence.

---

### 4. Redis Cache-Aside (Chesa)
**Problem:** High-traffic dashboard endpoints hit the DB repeatedly for the same data → slow + DB load.

**What you built:** **Cache-aside (lazy loading):** on read, check Redis; **hit** → return; **miss** →
read DB, write to Redis with a TTL, return. Cut avg response **~60% (≈400ms → ≈160ms)**.

**Key decisions & tradeoffs:**
- **Cache-aside vs write-through vs write-behind:** cache-aside is simple and resilient (cache down ≠
  app down), but first read is a miss and data can go stale → mitigate with **TTL + explicit invalidation on write.**
- **Invalidation** is the hard part ("one of the two hard things in CS"). On a write, delete/refresh the key.
- **Stampede/thundering herd:** when a hot key expires, many requests hit the DB at once → mitigate with
  a short lock / "single flight" / staggered TTLs.

**Follow-ups:** *Eviction?* LRU/LFU when memory full. *Consistency?* eventual — acceptable for dashboards;
use shorter TTL or write-through for stricter needs.

---

### 5. IoT Real-Time Platform — scaled to 10,000+ devices (Matriot)
**Problem:** 10k devices streaming high-frequency data over persistent connections; one server can't hold
all sockets, and naive writes hammer the DB.

**What you built:**
- **Horizontal scaling** of WebSocket servers in Docker behind **Nginx with IP-hash** (sticky sessions
  so a device stays on one node).
- **Redis adapter** to broadcast/sync WebSocket events **across** server instances (so clients on
  different nodes still get messages).
- **Redis queue + batch processing** to absorb high-frequency device writes → fewer, bigger DB writes.
- Eliminated **duplicate MQTT** processing with load-sharing; **MongoDB→MySQL** migration with indexing.

**Key decisions & tradeoffs:**
- **Sticky sessions (IP-hash):** keeps a stateful WS on one node; tradeoff: uneven load if IPs cluster →
  the Redis adapter decouples message delivery from connection location.
- **Batching:** trades a little latency for a big throughput/DB-load win.
- **MQTT** for device telemetry: lightweight pub/sub built for constrained devices.

**10×:** partition devices across server groups; Kafka for the ingestion firehose; time-series DB for telemetry.

**Follow-ups:** *Why sticky?* WebSocket is a long-lived stateful connection. *Scale broadcast?*
Redis Pub/Sub adapter, or a dedicated message bus.

---

## Part 2 — Core concepts cheat sheet (be able to define each in one line)
- **CAP:** under a network partition you pick Consistency **or** Availability. Most web apps choose AP + eventual consistency.
- **Load balancing:** round-robin / least-conn / IP-hash (sticky). L4 vs L7.
- **Caching:** cache-aside / write-through / write-behind; TTL; eviction (LRU/LFU); stampede.
- **DB scaling:** replication (read replicas) → vertical → **sharding/partitioning** (by key); index to speed reads.
- **SQL vs NoSQL:** SQL = relations + ACID + joins; NoSQL = scale + flexible schema + denormalized.
- **Message queues:** decouple + absorb spikes + retries; RabbitMQ (smart broker) vs Kafka (log, high-throughput, replay).
- **Idempotency:** same request twice = same effect once (keys, dedupe).
- **Consistent hashing:** add/remove nodes with minimal key remapping (caches, shards).
- **Rate limiting:** token bucket / leaky bucket / fixed-or-sliding window.
- **CDN:** cache static assets at the edge near users.
- **Consistency models:** strong vs eventual; read-your-writes.

---

## Part 3 — Map common interview questions → your real story to lean on
| If they ask "Design…" | Lean on |
|---|---|
| a chat / realtime system | **IoT WS scaling** + **video signaling** (sticky sessions, Redis pub/sub fan-out) |
| a video call / live streaming | **SFU video platform** (mesh vs SFU vs MCU, TURN, gRPC) |
| a payment system | **payment idempotency** (keys, webhooks, saga, state machine) |
| a rate limiter | gateway **rate limiting** (token bucket) |
| a URL shortener / read-heavy service | **cache-aside** + read replicas + hashing |
| an API gateway / microservices | **gateway pattern** (auth, rate limit, proxy, per-service DB, saga) |
| a notification system | **event-driven** (RabbitMQ + adapters), fan-out, retries |

> Practice: pick one row/day, whiteboard it in 20 min out loud using the Part 0 framework. See `quiz.md`.
