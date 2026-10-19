# Talking points: my real work as interview answers

These are the systems I actually built, turned into answers for two kinds of question:

1. "Tell me about a system you designed" (experience round).
2. "Design X" (HLD round), where I use a real story to back up each choice instead of quoting a book.

Every fact here comes from my own notes (`archive/interview-prep-system-design/talking-points.md`, `SYSTEM-DESIGN.md`, the `dayN/theory.md` "map it to my systems" sections) and my resume (`../interview-prep/Resume-Review/resume-content.md`). Do not add numbers in the room that are not written here. If an interviewer asks for a number I do not have, say "I did not measure that, but here is how I would".

Lines marked **Check before you say it** are things my notes describe as a design idea or a future step, not something I clearly shipped. Confirm them in your head before you claim them.

## How to use these

Tell every story in the same five steps. It keeps you short and it shows senior thinking.

| Step | What you say | Time |
|---|---|---|
| 1. Situation | Where, what product, what scale. One or two sentences. | 10 s |
| 2. Problem | What broke or would break, and why the simple way fails. | 10 s |
| 3. Design | What I built: the 2 to 4 key parts. | 20 s |
| 4. Trade-off | What I gave up, and why that was the right price. | 10 s |
| 5. Result | The number or the outcome. Then "at 10x I would...". | 10 s |

Rules:
- Say the 60-second version first. Stop. Let them pick the deep dive.
- In a "Design X" round, use one line from a story at the moment you make a choice: "I did this in production at Matriot, and the catch was...". Do not tell the whole story.
- Always name the trade-off. A choice without a cost sounds junior.
- End with the 10x answer. It shows you know where your design stops working.

## Story index

| # | Story | Where | Best for |
|---|---|---|---|
| 1 | [Multi-party video platform (SFU)](#1-multi-party-video-platform-sfu) | Independent project (May 2025 to Feb 2026) | video calls, real-time, microservices, gRPC |
| 2 | [Payment idempotency across 3 providers](#2-payment-idempotency-across-3-providers) | SenseGrass | payments, retries, webhooks, exactly-once |
| 3 | [API gateway and microservices](#3-api-gateway-and-microservices) | SenseGrass | gateway, auth, rate limiting, service split |
| 4 | [IoT platform scaled to 10,000+ devices](#4-iot-platform-scaled-to-10000-devices) | Matriot | WebSockets at scale, chat, ingestion, sharding |
| 5 | [MongoDB to MySQL migration](#5-mongodb-to-mysql-migration) | Matriot | SQL vs NoSQL, data modelling, indexes |
| 6 | [Redis cache that cut latency 60%](#6-redis-cache-that-cut-latency-60) | Chesa | caching, invalidation, stampede |
| 7 | [Durable outbox for SAP sync](#7-durable-outbox-for-sap-sync) | Chesa | outbox, retries, DLQ, eventual consistency |
| 8 | [Offline-first PWAs for field engineers](#8-offline-first-pwas-for-field-engineers) | Chesa | offline sync, mobile APIs, uploads |
| 9 | [Short supporting stories](#9-short-supporting-stories) | various | replicas, real-time chat, AWS edge |

---

## 1. Multi-party video platform (SFU)

**Facts to keep straight:** built with Mediasoup. Microservices: API Gateway, Signaling, Media. Socket.io over WSS for signaling, gRPC between services, Consul for discovery, Prometheus and Grafana for monitoring, Nginx at the edge. Media over WebRTC (DTLS/ICE over UDP, ports 40000 to 40100). Signaling to Media calls went from REST (20 to 50 ms) to gRPC (2 to 5 ms). It was an independent project, deployed on GCP. Say "a platform I built", not "at my company".

### The 60-second version

"I built a multi-party video calling platform. The simple way is a WebRTC mesh, where every person sends their video to every other person. That is N times N-minus-1 streams, and it falls over at about four people because upload bandwidth and CPU explode. So I used an SFU, a Selective Forwarding Unit, with Mediasoup. Each client sends one stream up to the server, and the server forwards it to the others without re-encoding. I split it into three services: an API gateway, a signaling service on Socket.io over WebSockets, and a media service. The services talk over gRPC, which cut the signaling-to-media calls from 20 to 50 ms on REST to 2 to 5 ms. Consul handles discovery, and Prometheus and Grafana handle monitoring. The trade-off: an SFU costs more server than mesh, but much less CPU than an MCU, which mixes every stream on the server. To go 10x, I would spread Mediasoup workers across cores and nodes, sync signaling state with Redis pub/sub, and add a TURN cluster."

### Deep-dive follow-ups

| They ask | Your pointer |
|---|---|
| Why not mesh? | Streams grow as N squared. Upload bandwidth and CPU die past about 4 people. SFU is one up, many down. |
| Why not MCU? | An MCU decodes, mixes and re-encodes every stream. Client bandwidth is low, but the server CPU bill is huge. The SFU only forwards. |
| How do peers find each other? | The signaling service passes SDP offers and answers and ICE candidates over WSS. Media then flows from each client to the SFU. |
| Why UDP for media? | Live video can lose a packet but cannot wait for one. A resent frame is already too late. TCP's resends add delay. |
| What is TURN for? | A relay for clients behind strict NAT or firewalls that cannot connect directly. My notes say about 10% of clients, but treat that as the common rule of thumb, not my measurement. |
| Why gRPC inside, WebSocket outside? | Browsers speak WebSocket. Between my own services I wanted typed `.proto` contracts and binary speed. Cost: less readable than JSON, and you need proto tooling. |
| gRPC behind a load balancer? | gRPC uses one long-lived HTTP/2 connection, so an L4 balancer pins every request to one pod. You need L7 per-request balancing (Envoy), or client-side balancing with discovery (Consul). |
| Would you put this on a CDN? | No. Live WebRTC is sub-second and different for each peer. Recorded sessions played back later are a CDN job. |
| How do you keep a room on one media server? | Route by room ID. Consistent hashing on `roomId` puts all participants on the same media node without a central lookup, and still lets you add nodes. **Check before you say it**: my notes give this as the design answer, not as something I shipped. |
| How would you scale it? | Workers on more cores and nodes, rooms sharded across media servers, Redis pub/sub for signaling state across instances, a STUN/TURN cluster. |

### Concepts this proves

[H05](hld/1-basics/H05-realtime-communication/README.md), [H04](hld/1-basics/H04-api-design/README.md), [H03](hld/1-basics/H03-networking-basics/README.md), [H25](hld/5-reliability/H25-microservices/README.md), [H06](hld/1-basics/H06-proxies-api-gateway/README.md), [H08](hld/2-scaling/H08-load-balancing/README.md), [H17](hld/3-databases/H17-consistent-hashing/README.md), [H10](hld/2-scaling/H10-cdn/README.md), [H30](hld/5-reliability/H30-observability/README.md), [H07](hld/2-scaling/H07-scaling-stateless/README.md)

---

## 2. Payment idempotency across 3 providers

**Facts to keep straight:** SenseGrass, founding engineer (Apr 2024 to May 2025). A microservices fintech platform (Node.js, TypeScript, PostgreSQL, RabbitMQ, gRPC). I built a payment orchestration service with webhook handling, retry strategies and idempotency protection to prevent duplicate transactions across 3 payment providers. The Adapter pattern hides each provider behind one interface. A state machine tracks payment status (created, pending, success or failed).

### The 60-second version

"At SenseGrass I built the payment orchestration service for our fintech platform. The hard problem is that networks retry. A user double-clicks, or a client times out and retries, and the payment providers can send the same webhook more than once and out of order. None of that can charge someone twice. So every payment intent gets an idempotency key, a UUID made by the client. The server stores key to result. A repeat with the same key gets the stored result back instead of a new charge. Webhooks are deduped by the provider's event ID and processed inside a transaction. Payment status is a state machine, so a late or out-of-order webhook cannot move a payment backwards. We had three providers, so I put each one behind an adapter with one internal interface. Adding a provider did not touch the core logic. The key line: there is no true exactly-once delivery. You get at-least-once delivery plus idempotent processing, which gives an exactly-once effect."

### Deep-dive follow-ups

| They ask | Your pointer |
|---|---|
| Is exactly-once possible? | Not as delivery. At-least-once delivery plus an idempotent consumer gives an exactly-once effect. Say this sentence word for word. |
| Two retries arrive at the same time. Both see "key not found". | The check and the insert must be one atomic step: a unique constraint on the key column, or `SET key NX` in Redis. The loser of the race reads the winner's result. |
| Who makes the key? | The client, once per logical operation, not once per network attempt. A new key on each retry defeats the point. |
| How long do you keep keys? | With a TTL long enough to cover all retries (my notes say about 24 hours as an example). |
| Out-of-order webhooks? | The state machine only allows forward moves. "Success" after "success" is a no-op. "Pending" after "success" is ignored. |
| Why not a distributed lock around the charge? | "I didn't lock the charge. I made it idempotent. A retry hits the same key and gets the same result." A lock can expire mid-charge; idempotency cannot. |
| Why the Adapter pattern? | One `PaymentProvider` interface, one adapter per provider. New provider means a new class, not edits to core code (Open/Closed). |
| What if the DB write and the event publish disagree? | The outbox pattern: write the payment row and the event row in one local transaction, and a relay publishes it. **Check before you say it**: my talking points list the outbox as the 10x step for this service. The outbox I clearly built is story 7 at Chesa. Use that one. |
| How do you know nothing slipped through? | A reconciliation job that compares my records with each provider's records. **Check before you say it**: my STAR list names reconciliation as part of this story, but my talking points list it under 10x. Decide which is true before the interview. |
| Is the payment service CP or AP? | CP for the ledger. Better to reject and retry a payment than to accept a conflicting one during a partition. |
| Distributed transaction across payment, ledger and notification? | Saga, not 2PC. 2PC blocks if the coordinator dies. A saga runs local steps with compensations, such as a refund. |
| Rate limits on payment endpoints? | A per-client token bucket at the gateway. Limits plus idempotency together tame retry storms. |

### Concepts this proves

[H22](hld/4-async/H22-delivery-semantics/README.md), [H23](hld/4-async/H23-distributed-transactions/README.md), [H38](hld/6-building-blocks/H38-payments-domain/README.md), [L13](lld/3-structural/L13-adapter/README.md), [L22](lld/4-behavioral/L22-state/README.md), [L04](lld/1-foundations/L04-solid-srp-ocp/README.md), [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md), [H29](hld/5-reliability/H29-consensus-locks/README.md), [H26](hld/5-reliability/H26-rate-limiting/README.md), [H28](hld/5-reliability/H28-unique-ids/README.md), [H20](hld/4-async/H20-message-queues/README.md)

---

## 3. API gateway and microservices

**Facts to keep straight:** SenseGrass. A two-layer API gateway: Nginx at the edge plus an Express gateway, doing routing, rate limiting and load balancing. Auth is OTP mobile login (Twilio) plus JWT plus RBAC. External integrations (payment gateways, KYC, verification) sit behind adapters. Notifications are event-driven over RabbitMQ. My talking-points file also lists JWT auth, rate limiting, reverse-proxy routing and LRU response caching in the Express gateway, with each service owning its own DB, Dockerfile and Kubernetes manifests. **Check before you say it**: that file labels this "SenseGrass / node-microservices", and the service names there (auth, product, order, payment, notification) and the Kubernetes manifests may come from my own practice repo, not from SenseGrass. Name the SenseGrass parts as SenseGrass, and the rest as "in my reference implementation".

### The 60-second version

"At SenseGrass we built the fintech platform as microservices, so each part could scale and ship on its own. The risk with microservices is that every service ends up doing its own auth, rate limiting and logging. So I built a two-layer gateway: Nginx at the edge, then an Express gateway as the single front door. It checks the JWT, applies rate limits, and routes to the right service. Login was OTP over Twilio, then a JWT with RBAC roles. Because the JWT is signed, each service can verify it alone, with no shared session store. Each service owns its data. Services call each other over gRPC when they need an answer now, and publish events on RabbitMQ when they don't, for example for notifications. The trade-off: the gateway is a possible bottleneck and single point of failure, so it is stateless and scales out behind the balancer. At 10x I would add circuit breakers for failing downstreams, and maybe a service mesh for mTLS and retries."

### Deep-dive follow-ups

| They ask | Your pointer |
|---|---|
| Isn't the gateway a single point of failure? | Yes, if there is one. Keep it stateless, run several copies behind a load balancer, scale out. |
| How do you revoke a JWT? | You cannot easily before it expires. Keep TTLs short, and keep a denylist for critical cases such as a stolen token. |
| AuthN vs AuthZ? | OTP plus JWT proves who you are. RBAC decides what you can do. |
| How do services talk? | Sync with gRPC or REST when the caller needs the answer. Async with RabbitMQ events when it does not. |
| No joins across services. How do you query? | API composition (the caller fetches from each service), or keep a read copy updated by events. You accept eventual consistency. |
| Order touches several services. Transaction? | A saga with compensations, not 2PC. |
| Which rate-limit algorithm? | Token bucket by default: it caps the average and allows short bursts. In Redis with an atomic Lua script, return 429 with `Retry-After`. Nginx `limit_req`, which I ran in production, is leaky-bucket based. |
| Gateway middleware order? | Auth, then rate limit, then route. That is a chain of responsibility: each handler passes the request on or stops it. |
| RabbitMQ or Kafka here? | RabbitMQ for commands one worker should do once (send this notification). Kafka for event streams many consumers read or need to replay. |
| What breaks first at 10x? | A slow downstream ties up the gateway. Add timeouts, retries with backoff and jitter, and circuit breakers. |

### Concepts this proves

[H06](hld/1-basics/H06-proxies-api-gateway/README.md), [H25](hld/5-reliability/H25-microservices/README.md), [H31](hld/5-reliability/H31-security-auth/README.md), [H26](hld/5-reliability/H26-rate-limiting/README.md), [H20](hld/4-async/H20-message-queues/README.md), [H04](hld/1-basics/H04-api-design/README.md), [H23](hld/4-async/H23-distributed-transactions/README.md), [L25](lld/4-behavioral/L25-chain-of-responsibility/README.md), [L15](lld/3-structural/L15-facade/README.md), [L13](lld/3-structural/L13-adapter/README.md), [H27](hld/5-reliability/H27-resilience/README.md), [H07](hld/2-scaling/H07-scaling-stateless/README.md)

---

## 4. IoT platform scaled to 10,000+ devices

**Facts to keep straight:** Matriot (Mar 2023 to Feb 2024). Scaled a real-time IoT platform to 10,000+ devices. WebSocket servers in Docker, scaled out behind Nginx with IP-hash (sticky sessions). The Socket.io Redis adapter syncs events across instances. A Redis queue plus batch processing absorbs high-frequency device writes. Removed duplicate MQTT processing with load-sharing. Used Node's cluster/PM2 to use all CPU cores. Also did the MongoDB to MySQL migration with indexing (story 5).

### The 60-second version

"At Matriot I scaled our IoT platform to more than 10,000 devices. Each device holds a long-lived connection and sends data often. Two things broke. One server could not hold all the sockets, and writing every reading straight to the database hammered it. For the sockets, I ran several WebSocket servers in Docker behind Nginx with IP-hash, so each device stays on one node, and I used cluster and PM2 so Node used every CPU core. A WebSocket is state stuck to one server, so server B cannot push to a client on server A. The Socket.io Redis adapter fixes that: every server publishes through Redis, so any server can reach any client. For writes, device data goes into a Redis queue and workers write it in batches, so the DB gets fewer, bigger writes. I also removed duplicate MQTT processing with load-sharing. The trade-off: batching adds a little delay, but it is a big win on throughput and DB load. At 10x I would partition devices across server groups, use Kafka for ingestion, and use a time-series database for telemetry."

### Deep-dive follow-ups

| They ask | Your pointer |
|---|---|
| Why sticky sessions? | A WebSocket is a long-lived, stateful connection. Socket.io also needs stickiness while the long-polling fallback is on. |
| Downside of IP-hash? | Uneven load if many devices share IPs. The Redis adapter means delivery does not depend on which node holds the socket. |
| Round robin for sockets? | No. Use least connections for long-lived connections. Round robin ignores the thousands of sockets already parked on a node. |
| Load balancer gotchas with WebSockets? | Pass the `Upgrade` and `Connection` headers through Nginx (I have written that config). Idle timeouts kill quiet sockets, so send heartbeats. |
| Why MQTT for devices? | Lightweight pub/sub made for small, constrained devices. |
| How would you shard telemetry? | Not by timestamp. Then all writes hit the "now" partition. Partition by device ID hash, or a compound key. **Check before you say it**: my notes give this as the fix, not as what Matriot ran. |
| How do you keep one device's events in order? | Key by device ID. In Kafka, one partition per key range keeps order. One worker owns a device's stream, which is single-writer by partitioning, not a lock per device. |
| Server restarts and 10k devices reconnect at once? | Reconnect with jitter, or you get a thundering herd. **Check before you say it**: one note says I lived this. Only claim it if you remember it. |
| What happens if one device loops and floods you? | A token bucket per device ID, counters in Redis. |
| Duplicate device messages? | Make processing idempotent by message ID. A Bloom filter can cheaply answer "definitely not seen" before the real lookup. |
| Consistency for "last seen" status? | Eventual is fine. Add monotonic reads on the dashboard so a status does not flicker old, new, old. AP during a partition: keep ingesting, reconcile later. |
| IDs for readings from many collectors? | Mint locally, Snowflake or ObjectId style. A central ID service would melt. |

### Concepts this proves

[H05](hld/1-basics/H05-realtime-communication/README.md), [H07](hld/2-scaling/H07-scaling-stateless/README.md), [H08](hld/2-scaling/H08-load-balancing/README.md), [H20](hld/4-async/H20-message-queues/README.md), [H21](hld/4-async/H21-kafka/README.md), [H16](hld/3-databases/H16-partitioning-sharding/README.md), [H37](hld/6-building-blocks/H37-data-at-scale/README.md), [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md), [H26](hld/5-reliability/H26-rate-limiting/README.md), [H35](hld/6-building-blocks/H35-probabilistic-ds/README.md), [H28](hld/5-reliability/H28-unique-ids/README.md), [L32](lld/5-machine-coding/L32-concurrency-in-node/README.md), [H36](hld/6-building-blocks/H36-batch-stream/README.md)

---

## 5. MongoDB to MySQL migration

**Facts to keep straight:** Matriot. Started on MongoDB because the schema changed every week. As the product matured the data became relational: entities referenced each other, we faked joins in app code, and we needed transactions. Migrated to MySQL and added indexes. **Check before you say it**: my notes ask "zero-downtime?" but do not answer it. Do not claim zero downtime unless it is true.

### The 60-second version

"At Matriot we started on MongoDB because the schema was changing every week, and a document store let us move fast. As the product matured, the data turned relational. Entities referenced each other, we were faking joins in application code, and we needed transactions. The flexibility was now costing us: app-side joins, no foreign-key integrity, and consistency bugs. So we migrated to MySQL, with a stable schema, real joins, ACID transactions, and indexes on the access paths. My lesson: NoSQL's flexibility is a loan. You pay it back once your access patterns settle and turn relational. 'Schemaless' does not remove the schema. It moves it into your app code."

### Deep-dive follow-ups

| They ask | Your pointer |
|---|---|
| When would you still pick Mongo? | Fields change often, data is read as a whole document, few cross-entity joins, and you need easy horizontal scale. |
| How did you choose indexes? | From the real query patterns: composite indexes in leftmost-prefix order, covering indexes for hot reads. Say only what you remember doing. |
| How do you migrate safely? | The general method: dual-write or backfill, verify counts, switch reads, then switch writes. Be honest about what you actually did. |
| What about Mongo's sharding? | Mongo makes you pick the shard key up front, and a bad shard key is painful to undo. The partition key is the decision you cannot easily walk back. |
| Mongo replication? | Replica sets with automatic primary election, and `readPreference` to send analytics reads to secondaries. Same leader-follower idea as MySQL replicas. **Check before you say it**: from my day 7 notes, confirm it was this project. |
| Normalize or denormalize? | Normalize the source of truth for integrity. Denormalize read paths on purpose when joins become the bottleneck. |
| Isolation level for your transactions? | MySQL InnoDB defaults to Repeatable Read. Know what that blocks and what it allows. |

### Concepts this proves

[H14](hld/3-databases/H14-sql-vs-nosql/README.md), [H13](hld/3-databases/H13-data-modeling/README.md), [H11](hld/3-databases/H11-indexing/README.md), [H12](hld/3-databases/H12-transactions-isolation/README.md), [H15](hld/3-databases/H15-replication/README.md), [H16](hld/3-databases/H16-partitioning-sharding/README.md)

---

## 6. Redis cache that cut latency 60%

**Facts to keep straight:** Chesa Dental Care (Feb 2026 to now). Cut average API latency about 60% (about 400 ms to about 160 ms). From my resume: the old setup used a flush-all cache strategy that caused SAP load storms. I replaced it with a scope-based Redis invalidation registry. From my notes: cache-aside with Redis in the Node.js API gateway, write to the DB then DEL the key, a TTL on every key, JSON values under stable keys like `entity:id`. I have also done Redis rate limiting with INCR plus EXPIRE (fixed window).

### The 60-second version

"At Chesa our dashboard endpoints were hitting the database, and behind it SAP, again and again for the same data. The old cache used a flush-all strategy, so after a flush every request went back to SAP at the same time. That caused SAP load storms. I rebuilt it as cache-aside on Redis. On a read, check Redis. On a hit, return it. On a miss, read the source, store it with a TTL, and return. For writes, I built a scope-based invalidation registry, so a change only deletes the keys in its scope instead of flushing everything. On write we update the DB and then delete the key, not set it, to avoid ordering races. Average latency dropped about 60%, from about 400 ms to about 160 ms. The trade-off is staleness: data can be old for up to the TTL. That is fine for dashboards. If we needed stricter data, I would use a shorter TTL or write-through."

### Deep-dive follow-ups

| They ask | Your pointer |
|---|---|
| Why cache-aside, not write-through or write-behind? | Simple, and if the cache is down the app still works. Cost: the first read is a miss, and data can be stale. |
| Why DEL and not SET on write? | Two writers can set in the wrong order and leave old data cached. Delete, and let the next read rebuild. |
| What is a cache stampede? | One hot key expires and every request rebuilds it at once. Example to say: a 300 ms rebuild at 5k requests a second means 1,500 identical queries hit the DB in the gap. Fix with a per-key `SET NX` lock or stale-while-revalidate. |
| Stampede vs avalanche vs penetration? | One hot key, many keys or the whole cache, keys that never existed. Fixes: lock, jittered TTL plus HA, negative caching or a Bloom filter. |
| Eviction policy? | `allkeys-lru` for a pure cache, LFU if scans pollute it. Sessions and queues go in a separate Redis with `noeviction`. Sharing one Redis with LRU logs users out at random under memory pressure. |
| How did you measure 60%? | Average response time before and after. Do not invent a p99. If asked, say "I tracked the average; next time I would watch p99 too". |
| Why was flush-all bad? | It turns every change into a cache avalanche on SAP. Scoped invalidation only drops what changed. |
| Consistency? | Eventual, bounded by the TTL. Fine for dashboards. |
| Redis replication risk? | Redis replication is async, so a failover can lose the last writes. That is fine for a cache, not for a source of truth. |

### Concepts this proves

[H09](hld/2-scaling/H09-caching/README.md), [H37](hld/6-building-blocks/H37-data-at-scale/README.md), [H15](hld/3-databases/H15-replication/README.md), [H35](hld/6-building-blocks/H35-probabilistic-ds/README.md), [H26](hld/5-reliability/H26-rate-limiting/README.md), [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md), [H02](hld/1-basics/H02-back-of-envelope/README.md)

---

## 7. Durable outbox for SAP sync

**Facts to keep straight:** Chesa. This one is from my resume. A 15-service Node/Express backend (about 250 endpoints, SAP B1 plus 6 MySQL databases, PM2). I designed a durable outbox on Redis/BullMQ that guarantees idempotent, eventually-consistent closing of SAP service calls. The flow: MySQL intent log, then a 1-minute reconciler cron, then a retrying worker (5 tries with exponential backoff), then a dead-letter queue with audit and requeue. It removed a class of "closed locally but still open in the ERP" bugs.

### The 60-second version

"At Chesa, our backend had to close service calls in SAP as well as in our own MySQL. Doing both inline is a dual write. When it failed halfway, a call was closed locally but still open in the ERP, and the two systems disagreed. I made it a durable outbox. The close is first recorded as an intent in a MySQL intent log. A reconciler cron runs every minute and hands pending intents to a retrying worker on BullMQ and Redis. The worker calls SAP and retries up to five times with exponential backoff. If it still fails, the job goes to a dead-letter queue with an audit trail, and we can requeue it. Every step is idempotent, so a retry cannot close something twice. The trade-off is that SAP is now eventually consistent, not instant. That removed the whole class of 'closed locally, still open in the ERP' bugs."

### Deep-dive follow-ups

| They ask | Your pointer |
|---|---|
| Why not just call SAP in the request? | That is the dual-write problem. Two systems, no shared transaction, so a crash in between leaves them out of sync. |
| Why the MySQL intent log, not only the queue? | The intent lives in the durable DB, so it is not lost if Redis is down at that moment. The cron re-drives anything still pending. Be ready to say whether the intent row is written in the same transaction as the local change, because that is what makes it a true outbox. |
| Why idempotent? | The cron and retries mean a job can run more than once. At-least-once plus idempotent equals the exactly-once effect. |
| Why exponential backoff? | So retries do not pile onto SAP when it is struggling. Add jitter so many jobs do not retry at the same moment. |
| What goes in the DLQ? | Jobs that failed all 5 tries. They are kept with an audit trail and can be requeued by hand. No silent loss. |
| Outbox vs 2PC? | 2PC needs SAP to take part and blocks if the coordinator dies. The outbox only needs a local transaction. |
| Outbox vs CDC? | CDC tails the DB log instead of polling a table. A polling cron is the simpler choice; CDC is the step up if polling load or delay becomes a problem. |
| What if Redis is down? | The intent is in MySQL, so nothing is lost. The cron picks it up when Redis is back. (My CRM workers also degrade gracefully when Redis is down.) |

### Concepts this proves

[H23](hld/4-async/H23-distributed-transactions/README.md), [H22](hld/4-async/H22-delivery-semantics/README.md), [H20](hld/4-async/H20-message-queues/README.md), [H27](hld/5-reliability/H27-resilience/README.md), [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md), [H36](hld/6-building-blocks/H36-batch-stream/README.md), [H29](hld/5-reliability/H29-consensus-locks/README.md)

---

## 8. Offline-first PWAs for field engineers

**Facts to keep straight:** Chesa. 3+ production React and Vite PWAs used by 50+ field engineers across India. Offline-first Workbox caching, install prompts, auto-update, chunked resumable uploads plus image compression for low-end field phones, and SAP integration. From my notes: I did not hold sockets open; the app syncs on reconnect. **Check before you say it**: my notes list "sync conflicts" as a topic for this story but do not say how conflicts were resolved. Have your real answer ready.

### The 60-second version

"At Chesa I built the PWAs our 50+ field engineers use across India. They work in places with bad or no network, on low-end phones. So the apps are offline-first with Workbox caching, so they keep working with no network and sync when the phone reconnects. I did not hold a live socket open, because these users do not need a live pipe. Uploads are chunked and resumable with image compression, so a dropped network does not restart a big upload from zero. The trade-off of offline-first is conflicts and stale data: the phone can be behind the server, so sync has to handle two edits to the same record."

### Deep-dive follow-ups

| They ask | Your pointer |
|---|---|
| Why no WebSocket? | Not everything needs a live connection. Sync on reconnect with a cursor ("give me changes since X") is simpler and cheaper on a field phone. |
| Two people edit the same record offline? | Have your real answer ready. General options: last write wins, a version number with a conflict error (optimistic locking), or merge per field. |
| How do resumable uploads work? | Split the file into chunks. Track which chunks landed. On reconnect, send only the missing ones. In the cloud: S3 multipart upload with presigned URLs. |
| Which Workbox strategies? | Know the names: cache-first for static assets, network-first for fresh data, stale-while-revalidate for in-between. Say what you actually used. |
| What API shape suits this client? | Fewer, bigger calls. My notes suggest a BFF or GraphQL layer would fit, so the phone gets exactly the fields it needs in one round trip. That is a suggestion, not what I built. |
| How do you ship updates? | Service worker auto-update. My resume also lists CI/CD with Vitest and React Testing Library tests gating deploys, and auto-rollback. |

### Concepts this proves

[H05](hld/1-basics/H05-realtime-communication/README.md), [H32](hld/6-building-blocks/H32-blob-storage/README.md), [H04](hld/1-basics/H04-api-design/README.md), [H09](hld/2-scaling/H09-caching/README.md), [H12](hld/3-databases/H12-transactions-isolation/README.md), [L34](lld/5-machine-coding/L34-testing-designs/README.md)

---

## 9. Short supporting stories

Use these as one-line proof inside a bigger answer.

**Read replicas and replication lag.** (From my day 7 notes. **Check before you say it**: the notes do not name the company. Know which one before you use it.) "We moved dashboards, reports and list views to read replicas to take load off the primary. Writes and read-after-write paths stayed on the primary. The catch was replication lag: a user updated a record and the re-fetch from a replica showed old data. We fixed it by sending read-after-write for that request to the primary. That is read-your-writes." Proves [H15](hld/3-databases/H15-replication/README.md), [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md).

**Real-time messaging on NestJS, Redis and WebSockets.** (`SYSTEM-DESIGN.md` lists it as something I built. **Check before you say it**: it does not say where.) "Socket.IO gateways are the stateful edge. Redis pub/sub decides which gateway holds which socket, and the services stay stateless." For chat consistency: causal ordering plus read-your-writes, not global strong ordering. Proves [H05](hld/1-basics/H05-realtime-communication/README.md), [H07](hld/2-scaling/H07-scaling-stateless/README.md), [H21](hld/4-async/H21-kafka/README.md), [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md).

**Running Chesa's AWS production stack alone.** (From my resume.) I took it over after the lead engineer left: an Application Load Balancer (L7, HTTPS, ACM wildcard TLS, health checks) in front of an EC2 host serving about 30 subdomains through Apache (static React apps plus reverse-proxied Node/PM2 services, about 13 processes) over local MySQL, with Route 53 DNS, security groups and IAM, an OpenVPN bastion, SNS for OTP, CloudWatch, and nightly S3 backups. Use it when they ask about DNS to load balancer to app debugging, TLS, or single points of failure (one EC2 host is one, so say how you would fix it). Proves [H03](hld/1-basics/H03-networking-basics/README.md), [H06](hld/1-basics/H06-proxies-api-gateway/README.md), [H08](hld/2-scaling/H08-load-balancing/README.md), [H39](hld/6-building-blocks/H39-deployment-multi-region/README.md), [H30](hld/5-reliability/H30-observability/README.md).

**SOLID in a real codebase.** (From my resume.) SenseGrass services were built with SOLID and clean-architecture principles, so services stayed loosely coupled. Use the Adapter-per-provider design from story 2 as the concrete example. Proves [L04](lld/1-foundations/L04-solid-srp-ocp/README.md), [L05](lld/1-foundations/L05-solid-lsp-isp-dip/README.md), [L03](lld/1-foundations/L03-composition-over-inheritance/README.md).

---

## Concept to story map

When a concept comes up, tell this story. "None" means I have no real story for it. Answer from the notes and do not stretch a story to fit.

| Concept | Tell this story |
|---|---|
| [L01](lld/1-foundations/L01-classes-and-interfaces/README.md) Classes, interfaces, types | None. Answer from the notes. |
| [L02](lld/1-foundations/L02-oop-pillars/README.md) OOP pillars | 2 (one provider interface, many adapters is polymorphism) |
| [L03](lld/1-foundations/L03-composition-over-inheritance/README.md) Composition over inheritance | 2 (adapters plugged into the orchestrator, not subclassed) |
| [L04](lld/1-foundations/L04-solid-srp-ocp/README.md) SRP and OCP | 2 (new provider is a new adapter, no core edits); 9 SOLID |
| [L05](lld/1-foundations/L05-solid-lsp-isp-dip/README.md) LSP, ISP, DIP | 2 (core depends on the provider interface, not on a provider) |
| [L06](lld/1-foundations/L06-uml-relationships/README.md) UML | None |
| [L07](lld/1-foundations/L07-design-principles/README.md) DRY, KISS, YAGNI | 3 (cross-cutting auth and rate limits live once, in the gateway) |
| [L08](lld/2-creational/L08-singleton/README.md) Singleton | None |
| [L09](lld/2-creational/L09-factory-method/README.md) Factory Method | None. **Check before you say it**: picking an adapter by provider name is a factory, if your code did that. |
| [L10](lld/2-creational/L10-abstract-factory/README.md) Abstract Factory | None |
| [L11](lld/2-creational/L11-builder/README.md) Builder | None |
| [L12](lld/2-creational/L12-prototype/README.md) Prototype | None |
| [L13](lld/3-structural/L13-adapter/README.md) Adapter | 2 (3 payment providers), 3 (KYC and verification integrations) |
| [L14](lld/3-structural/L14-decorator/README.md) Decorator | None |
| [L15](lld/3-structural/L15-facade/README.md) Facade | 3 (the gateway is one simple front for many services) |
| [L16](lld/3-structural/L16-proxy/README.md) Proxy | 3 (reverse-proxy routing in the gateway, as a system-level proxy) |
| [L17](lld/3-structural/L17-composite/README.md) Composite | None |
| [L18](lld/3-structural/L18-bridge/README.md) Bridge | None |
| [L19](lld/3-structural/L19-flyweight/README.md) Flyweight | None |
| [L20](lld/4-behavioral/L20-strategy/README.md) Strategy | None |
| [L21](lld/4-behavioral/L21-observer/README.md) Observer and pub-sub | 4 (Redis pub/sub adapter), 3 (RabbitMQ notifications) |
| [L22](lld/4-behavioral/L22-state/README.md) State | 2 (payment status state machine) |
| [L23](lld/4-behavioral/L23-command/README.md) Command | None |
| [L24](lld/4-behavioral/L24-memento/README.md) Memento | None |
| [L25](lld/4-behavioral/L25-chain-of-responsibility/README.md) Chain of Responsibility | 3 (gateway middleware: auth, then rate limit, then route) |
| [L26](lld/4-behavioral/L26-template-method/README.md) Template Method | None |
| [L27](lld/4-behavioral/L27-iterator/README.md) Iterator | None |
| [L28](lld/4-behavioral/L28-mediator/README.md) Mediator | None |
| [L29](lld/4-behavioral/L29-visitor/README.md) Visitor | None |
| [L30](lld/5-machine-coding/L30-machine-coding-framework/README.md) Machine-coding framework | None. Practice rounds only. |
| [L31](lld/5-machine-coding/L31-repository-and-di/README.md) Repository and DI | None |
| [L32](lld/5-machine-coding/L32-concurrency-in-node/README.md) Concurrency in Node | 4 (cluster/PM2 on all cores), 2 (two retries racing on one key) |
| [L33](lld/5-machine-coding/L33-domain-modeling/README.md) Domain modelling | None shipped. Use the payment states from 2 as your example model. |
| [L34](lld/5-machine-coding/L34-testing-designs/README.md) Testing designs | 8 (Vitest and RTL tests gating deploys) |
| [H01](hld/1-basics/H01-approach-hld-round/README.md) HLD round approach | Use the 5-step frame above |
| [H02](hld/1-basics/H02-back-of-envelope/README.md) Estimation | 6 (stampede maths: 300 ms x 5k rps = 1,500 queries) |
| [H03](hld/1-basics/H03-networking-basics/README.md) Networking | 1 (UDP for media), 9 (AWS: DNS, ALB, TLS) |
| [H04](hld/1-basics/H04-api-design/README.md) API design | 1 (gRPC vs REST, 20 to 50 ms down to 2 to 5 ms), 8 (mobile API shape) |
| [H05](hld/1-basics/H05-realtime-communication/README.md) Real-time | 1 (WebRTC plus WSS signaling), 4 (WebSockets at 10k devices), 8 (why no socket) |
| [H06](hld/1-basics/H06-proxies-api-gateway/README.md) Proxies and API gateway | 3 (two-layer gateway), 9 (ALB plus Apache reverse proxy) |
| [H07](hld/2-scaling/H07-scaling-stateless/README.md) Scaling stateless | 4 (scale-out WS servers, Redis adapter), 3 (stateless gateway) |
| [H08](hld/2-scaling/H08-load-balancing/README.md) Load balancing | 4 (Nginx IP-hash, least connections), 1 (gRPC behind L4) |
| [H09](hld/2-scaling/H09-caching/README.md) Caching | 6 |
| [H10](hld/2-scaling/H10-cdn/README.md) CDN | 1 (live WebRTC is not a CDN job, recordings are) |
| [H11](hld/3-databases/H11-indexing/README.md) Indexing | 5 |
| [H12](hld/3-databases/H12-transactions-isolation/README.md) Transactions and isolation | 5, 2 (webhook processed in a transaction) |
| [H13](hld/3-databases/H13-data-modeling/README.md) Data modelling | 5 |
| [H14](hld/3-databases/H14-sql-vs-nosql/README.md) SQL vs NoSQL | 5 |
| [H15](hld/3-databases/H15-replication/README.md) Replication | 9 (read replicas and lag), 5 (Mongo replica sets) |
| [H16](hld/3-databases/H16-partitioning-sharding/README.md) Sharding | 4 (device ID, not timestamp), 5 (Mongo shard key) |
| [H17](hld/3-databases/H17-consistent-hashing/README.md) Consistent hashing | 1 (room to media node) |
| [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md) CAP and consistency | 2 (ledger is CP), 4 (telemetry is AP), 9 (read-your-writes) |
| [H19](hld/3-databases/H19-quorum-merkle/README.md) Quorums and Merkle trees | None |
| [H20](hld/4-async/H20-message-queues/README.md) Message queues | 7 (BullMQ, DLQ), 4 (Redis queue plus batching), 3 (RabbitMQ) |
| [H21](hld/4-async/H21-kafka/README.md) Kafka | 4 (the 10x answer: Kafka keyed by device ID) |
| [H22](hld/4-async/H22-delivery-semantics/README.md) Delivery semantics and idempotency | 2 (lead with this), 7 |
| [H23](hld/4-async/H23-distributed-transactions/README.md) 2PC, Saga, Outbox | 7 (outbox I built), 2 (saga across services) |
| [H24](hld/4-async/H24-event-driven-cqrs/README.md) Event-driven, CQRS | 3 (event-driven notifications) |
| [H25](hld/5-reliability/H25-microservices/README.md) Microservices | 3, 1 |
| [H26](hld/5-reliability/H26-rate-limiting/README.md) Rate limiting | 3 (gateway, Nginx `limit_req`), 6 (INCR plus EXPIRE) |
| [H27](hld/5-reliability/H27-resilience/README.md) Resilience | 7 (5 retries, exponential backoff, DLQ) |
| [H28](hld/5-reliability/H28-unique-ids/README.md) Unique IDs | 2 (client-made idempotency keys), 4 (IDs minted at ingest) |
| [H29](hld/5-reliability/H29-consensus-locks/README.md) Locks and consensus | 2 (idempotency instead of a lock) |
| [H30](hld/5-reliability/H30-observability/README.md) Observability | 1 (Prometheus and Grafana), 9 (CloudWatch) |
| [H31](hld/5-reliability/H31-security-auth/README.md) Security and auth | 3 (OTP plus JWT plus RBAC) |
| [H32](hld/6-building-blocks/H32-blob-storage/README.md) Blob storage | 8 (chunked resumable uploads), 9 (nightly S3 backups) |
| [H33](hld/6-building-blocks/H33-search-typeahead/README.md) Search and typeahead | None. **Check before you say it**: my notes say I have used Elasticsearch, but give no project. |
| [H34](hld/6-building-blocks/H34-geospatial/README.md) Geospatial | None in my notes. **Check before you say it**: my resume has a technician auto-assignment engine (Haversine plus Google Distance Matrix, 25 km clustering) at Chesa that may fit. |
| [H35](hld/6-building-blocks/H35-probabilistic-ds/README.md) Bloom, HLL, Count-Min | None shipped. 4 (dedupe idea) and 6 (penetration) as design answers. |
| [H36](hld/6-building-blocks/H36-batch-stream/README.md) Batch and stream | 4 (batched device writes), 7 (1-minute reconciler cron) |
| [H37](hld/6-building-blocks/H37-data-at-scale/README.md) Fan-out, hot keys, counters | 6 (hot key stampede), 4 (write-heavy telemetry) |
| [H38](hld/6-building-blocks/H38-payments-domain/README.md) Payments | 2 |
| [H39](hld/6-building-blocks/H39-deployment-multi-region/README.md) Deployment and multi-region | 9 (ALB, single EC2 host, nightly backups) |
