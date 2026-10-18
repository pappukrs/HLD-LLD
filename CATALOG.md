# Catalog

Every concept, problem and visual in this repo, with its exact path. The day-wise plan links to these.

## LLD concepts: `lld/concepts/`
| Slug | Title |
|---|---|
| 01-oop-pillars | OOP pillars in TypeScript |
| 02-solid | SOLID principles |
| 03-uml-relationships | UML and class relationships |
| 04-lld-interview-framework | The machine-coding round framework |
| 05-ts-for-lld | TypeScript features for LLD |
| 06-concurrency-in-node | Concurrency and race conditions in Node LLD |

### Patterns: `lld/concepts/patterns/` (each has `.md` + runnable `.ts`)
| Slug | Title |
|---|---|
| p01-singleton | Singleton |
| p02-factory | Factory Method and Abstract Factory |
| p03-builder | Builder |
| p04-prototype | Prototype |
| p05-adapter | Adapter |
| p06-decorator | Decorator |
| p07-facade | Facade |
| p08-proxy | Proxy |
| p09-composite | Composite |
| p10-strategy | Strategy |
| p11-observer | Observer |
| p12-state | State |
| p13-command | Command (and Memento) |
| p14-chain-of-responsibility | Chain of Responsibility |
| p15-template-method | Template Method |
| p16-iterator | Iterator |
| p17-mediator | Mediator |
| p18-repository-di | Repository and Dependency Injection |

## LLD problems: `lld/problems/<slug>/` (README, starter.ts, reference.ts, *.test.ts)
| Slug | Title | Main patterns |
|---|---|---|
| 01-parking-lot | Parking Lot | Strategy, Factory |
| 02-lru-cache | LRU / LFU Cache | HashMap + DLL, Strategy |
| 03-logger | Logger framework | Chain of Responsibility, Singleton, Strategy |
| 04-rate-limiter | Rate Limiter | Strategy, Factory |
| 05-notification-service | Notification Service | Strategy, Observer, Template Method |
| 06-vending-machine | Vending Machine | State |
| 07-tic-tac-toe | Tic-Tac-Toe | Strategy (win check) |
| 08-snake-ladder | Snake and Ladder | Builder, Strategy (dice) |
| 09-splitwise | Splitwise | Strategy (split types) |
| 10-elevator | Elevator System | State, Strategy (scheduling) |
| 11-atm | ATM | State, Chain of Responsibility (cash) |
| 12-library-management | Library Management | Repository, Observer |
| 13-bookmyshow | BookMyShow (seat locking) | Concurrency, Strategy |
| 14-kv-store | In-memory KV Store (TTL + transactions) | Command, Memento |
| 15-pub-sub-queue | Pub-Sub Queue (Kafka-lite) | Observer, Iterator |
| 16-task-scheduler | Task Scheduler | Priority queue, Strategy |
| 17-ride-sharing | Ride Sharing | State, Strategy, Observer |
| 18-food-delivery | Food Delivery | State, Strategy, Observer |
| 19-payment-wallet | Payment Wallet (ledger + idempotency) | Command, Repository |
| 20-ecommerce-cart-coupons | Cart with Coupons | Strategy, Chain of Responsibility |
| 21-meeting-room-scheduler | Meeting Room Scheduler | Strategy, intervals |
| 22-text-editor | Text Editor (undo/redo) | Command, Memento |
| 23-chess | Chess | Strategy (moves), Factory |
| 24-file-system | In-memory File System | Composite |

## HLD concepts: `hld/concepts/<slug>.md`
| Slug | Title |
|---|---|
| 01-how-to-approach-hld | How to approach an HLD round |
| 02-back-of-envelope | Back-of-the-envelope estimation |
| 03-networking-basics | Networking basics (DNS, TCP/UDP, HTTP, TLS) |
| 04-api-design | API design (REST, gRPC, GraphQL, pagination, idempotency) |
| 05-realtime-communication | Real-time: polling, SSE, WebSockets |
| 06-scaling-basics | Scaling basics and stateless services |
| 07-load-balancing | Load balancing |
| 08-caching | Caching |
| 09-cdn | CDN and edge |
| 10-sql-deep-dive | SQL deep dive (indexes, transactions, isolation, locking) |
| 11-nosql-types | NoSQL types and how to choose a database |
| 12-replication | Replication |
| 13-partitioning-sharding | Partitioning and sharding |
| 14-consistent-hashing | Consistent hashing |
| 15-cap-pacelc-consistency | CAP, PACELC and consistency models |
| 16-quorum-leaderless | Quorums and leaderless replication |
| 17-message-queues | Message queues (RabbitMQ, SQS, Kafka) |
| 18-kafka-deep-dive | Kafka deep dive |
| 19-idempotency-delivery-semantics | Idempotency and delivery semantics |
| 20-distributed-transactions | Distributed transactions (2PC, Saga, Outbox) |
| 21-event-driven-cqrs | Event-driven architecture, CQRS, event sourcing |
| 22-microservices | Microservices, API gateway, service discovery |
| 23-rate-limiting | Rate limiting |
| 24-resilience-patterns | Resilience: timeouts, retries, circuit breakers |
| 25-unique-id-generation | Unique ID generation |
| 26-blob-storage | Blob/object storage and large files |
| 27-search-indexing | Search, inverted index, typeahead |
| 28-geospatial | Geospatial indexing |
| 29-probabilistic-data-structures | Bloom filter, HyperLogLog, Count-Min sketch |
| 30-consensus-coordination | Consensus, leader election, distributed locks |
| 31-observability | Observability: logs, metrics, traces, SLOs |
| 32-security-auth | Security: authn/authz, OAuth2, JWT |
| 33-batch-stream-processing | Batch and stream processing |
| 34-data-modeling-at-scale | Data modelling at scale (fan-out, hot keys, counters) |
| 35-payments-domain | Payments domain (ledger, PSPs, reconciliation) |
| 36-deployment-multi-region | Deployment, autoscaling, multi-region, DR |

## HLD problems: `hld/problems/<slug>/` (README with hidden hints + my-design.md)
| Slug | Title | Level |
|---|---|---|
| 01-url-shortener | URL Shortener | Easy |
| 02-rate-limiter | Distributed Rate Limiter | Easy |
| 03-unique-id-generator | Unique ID Generator | Easy |
| 04-key-value-store | Distributed Key-Value Store | Medium |
| 05-notification-system | Notification System | Medium |
| 06-chat-system | Chat System (WhatsApp) | Medium |
| 07-news-feed | News Feed (Twitter/Instagram) | Medium |
| 08-payment-system | Payment System (Razorpay/Stripe) | Medium |
| 09-ticket-booking | Ticket Booking (BookMyShow) | Medium |
| 10-ride-hailing | Ride Hailing (Uber/Ola) | Hard |
| 11-food-delivery | Food Delivery (Swiggy/Zomato) | Medium |
| 12-search-autocomplete | Search Autocomplete | Medium |
| 13-web-crawler | Web Crawler | Medium |
| 14-video-streaming | Video Streaming (YouTube/Netflix) | Hard |
| 15-file-storage | File Storage and Sync (Dropbox) | Hard |
| 16-photo-sharing | Photo Sharing (Instagram) | Medium |
| 17-distributed-cache | Distributed Cache (Redis) | Medium |
| 18-distributed-message-queue | Distributed Message Queue (Kafka) | Hard |
| 19-metrics-monitoring | Metrics and Monitoring | Hard |
| 20-ad-click-aggregation | Ad Click Aggregation | Hard |
| 21-leaderboard | Real-time Leaderboard | Medium |
| 22-proximity-service | Proximity Service (Yelp/nearby) | Medium |
| 23-hotel-booking | Hotel Reservation | Medium |
| 24-job-scheduler | Distributed Job Scheduler | Hard |
| 25-collaborative-editor | Collaborative Editor (Google Docs) | Hard |
| 26-stock-exchange | Stock Exchange / Order Matching | Hard |
| 27-live-comments | Live Comments and Viewer Count | Medium |
| 28-digital-wallet | Digital Wallet / UPI | Hard |

Advanced list for the interview-loop phase: [`hld/problems/advanced-37.md`](hld/problems/advanced-37.md)

## HLD code: `hld/code/<slug>/` (README, starter.ts, reference.ts, *.test.ts)
| Slug | Title |
|---|---|
| 01-consistent-hashing | Consistent hash ring with virtual nodes |
| 02-rate-limiter-algorithms | Token bucket, sliding window log, sliding window counter |
| 03-bloom-filter | Bloom filter |
| 04-snowflake-id | Snowflake ID generator |
| 05-base62-shortener | Base62 encoding and an ID-range allocator |
| 06-geohash | Geohash encode, decode, neighbours |
| 07-trie-autocomplete | Trie with top-k suggestions |
| 08-quorum-kv | Quorum replicated KV (N, R, W) simulation |
| 09-circuit-breaker | Circuit breaker + retry with backoff and jitter |
| 10-count-min-sketch | Count-Min sketch + top-k heavy hitters |

## Visuals: `visuals/<slug>.html` (open `visuals/index.html`)
| Slug | Title | Track |
|---|---|---|
| v01-request-lifecycle | Life of a request | HLD |
| v02-load-balancing | Load balancing algorithms | HLD |
| v03-caching-patterns | Caching patterns | HLD |
| v04-consistent-hashing | Consistent hashing | HLD |
| v05-replication | Leader-follower replication | HLD |
| v06-sharding | Sharding strategies | HLD |
| v07-cap-partition | CAP under a network partition | HLD |
| v08-quorum | Quorum reads and writes | HLD |
| v09-rate-limiting | Rate limiting algorithms | HLD |
| v10-kafka-consumer-groups | Kafka partitions and consumer groups | HLD |
| v11-delivery-semantics | Delivery semantics and idempotency | HLD |
| v12-saga-outbox | Saga and transactional outbox | HLD |
| v13-circuit-breaker | Circuit breaker and retries | HLD |
| v14-realtime-transport | Polling, SSE and WebSockets | HLD |
| v15-feed-fanout | Feed fan-out: push vs pull | HLD |
| v16-bloom-filter | Bloom filter | HLD |
| v17-geohash-quadtree | Geohash and quadtree | HLD |
| v18-raft-leader-election | Raft leader election | HLD |
| v19-estimation-calculator | Estimation calculator | HLD |
| v20-isolation-levels | Transaction isolation levels | HLD |
| v21-solid-refactor | SOLID refactor | LLD |
| v22-uml-relationships | UML relationships | LLD |
| v23-strategy-factory | Strategy and Factory | LLD |
| v24-observer-pubsub | Observer and pub-sub | LLD |
| v25-state-machine | State pattern: vending machine | LLD |
| v26-decorator-chain | Decorator and Chain of Responsibility | LLD |
| v27-command-undo-redo | Command: undo and redo | LLD |
| v28-seat-locking | Seat locking and race conditions | LLD |
| v29-lru-cache | LRU cache internals | LLD |
| v30-node-event-loop | Node.js event loop | LLD |
