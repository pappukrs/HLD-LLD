# Glossary: system design and LLD terms

An A to Z list of the words you will hear in LLD and HLD rounds. Each entry has one plain line, then a link to the concept folder that teaches it. Read the line, then open the link when you want the full notes and the animation.

How to use it:
- Before a mock, scan one letter. Say each definition out loud in one breath.
- If you cannot explain a term in one line, open its concept and do the self-test.
- Many examples use a ticket-booking app (like BookMyShow), because one running example makes the terms stick.

[A](#a) · [B](#b) · [C](#c) · [D](#d) · [E](#e) · [F](#f) · [G](#g) · [H](#h) · [I](#i) · [J](#j) · [K](#k) · [L](#l) · [M](#m) · [N](#n) · [O](#o) · [P](#p) · [Q](#q) · [R](#r) · [S](#s) · [T](#t) · [U](#u) · [V](#v) · [W](#w) · [Y](#y) · [Z](#z)

## A

- **Abstract Factory**: a factory that creates a whole family of related objects that must match each other, such as a dark-theme button and a dark-theme dialog. → [L10](lld/2-creational/L10-abstract-factory/README.md)
- **Abstraction**: show callers only what they need and hide the details behind a simple interface. → [L02](lld/1-foundations/L02-oop-pillars/README.md)
- **ACID**: the four promises of a database transaction: Atomic (all or nothing), Consistent (rules hold), Isolated (transactions do not see each other's half-work), Durable (a commit survives a crash). → [H12](hld/3-databases/H12-transactions-isolation/README.md)
- **Active-active / active-passive**: two ways to run a backup. Active-active means both copies serve traffic. Active-passive means one copy waits as a standby until the main one fails. → [H39](hld/6-building-blocks/H39-deployment-multi-region/README.md)
- **Adapter**: a wrapper that makes a class fit the interface your code expects. Classic use: one payment interface, one adapter per provider. → [L13](lld/3-structural/L13-adapter/README.md)
- **API gateway**: the single front door to many services. It handles auth, rate limits, routing and logging so each service does not have to. → [H06](hld/1-basics/H06-proxies-api-gateway/README.md)
- **At-least-once delivery**: a message is never lost, but it may arrive more than once. The usual default, so consumers must be idempotent. → [H22](hld/4-async/H22-delivery-semantics/README.md)
- **At-most-once delivery**: a message is sent once and never retried. It may be lost but is never duplicated. Fine for metrics, bad for payments. → [H22](hld/4-async/H22-delivery-semantics/README.md)
- **Authentication (authn)**: proving who you are, for example with a password, OTP or token. → [H31](hld/5-reliability/H31-security-auth/README.md)
- **Authorization (authz)**: deciding what you are allowed to do once we know who you are, for example with roles (RBAC). → [H31](hld/5-reliability/H31-security-auth/README.md)
- **Autoscaling**: adding or removing servers automatically based on load, such as CPU or queue length. → [H39](hld/6-building-blocks/H39-deployment-multi-region/README.md)
- **Availability**: the percent of time a system is up and usable. It is written in "nines": 99.9% (three nines) allows about 8.76 hours of downtime a year, 99.99% about 52 minutes. → [H30](hld/5-reliability/H30-observability/README.md)

## B

- **Back-of-the-envelope estimation**: quick rough maths for QPS, storage and bandwidth, to decide how big the design must be. Example: 1M daily users x 10 requests = about 115 requests per second on average. → [H02](hld/1-basics/H02-back-of-envelope/README.md)
- **Backpressure**: a way to slow down senders when the receiver cannot keep up, instead of crashing. Example: a waiting queue during a ticket rush. → [H20](hld/4-async/H20-message-queues/README.md)
- **Base62**: writing a number with 0-9, a-z and A-Z. It turns a numeric ID into a short code for URL shorteners. → [H28](hld/5-reliability/H28-unique-ids/README.md)
- **Batch processing**: processing a big, fixed set of data in one go, often on a schedule, such as a nightly report. → [H36](hld/6-building-blocks/H36-batch-stream/README.md)
- **BFF (backend for frontend)**: a small API layer built for one client type, such as mobile, that returns exactly the data that screen needs. → [H04](hld/1-basics/H04-api-design/README.md)
- **Blob storage (object storage)**: storage for large files (images, videos, backups) addressed by a key, such as S3. → [H32](hld/6-building-blocks/H32-blob-storage/README.md)
- **Bloom filter**: a small bit array that tells you "definitely not present" or "maybe present". It never gives a false negative. → [H35](hld/6-building-blocks/H35-probabilistic-ds/README.md)
- **Blue-green deployment**: run the old (blue) and new (green) versions side by side, then switch all traffic at once. Rollback is a switch back. → [H39](hld/6-building-blocks/H39-deployment-multi-region/README.md)
- **Bridge**: split one class into two hierarchies (what it is and how it does it) so each can change on its own. → [L18](lld/3-structural/L18-bridge/README.md)
- **B-tree / B+tree**: the default database index. A sorted, wide, shallow tree that serves both exact lookups and range queries. → [H11](hld/3-databases/H11-indexing/README.md)
- **Builder**: build a complex object step by step, often with chained calls, instead of a constructor with ten arguments. → [L11](lld/2-creational/L11-builder/README.md)
- **Bulkhead**: give each dependency its own pool of connections or threads, so one slow dependency cannot use up everything. → [H27](hld/5-reliability/H27-resilience/README.md)

## C

- **Cache-aside (lazy loading)**: the app checks the cache first. On a miss it reads the DB, stores the result with a TTL, then returns it. → [H09](hld/2-scaling/H09-caching/README.md)
- **Cache avalanche**: many keys expire at the same moment, or the cache node dies, so the DB suddenly gets all the traffic. → [H09](hld/2-scaling/H09-caching/README.md)
- **Cache invalidation**: removing or refreshing cached data when the source changes. One of the hard problems in computing. → [H09](hld/2-scaling/H09-caching/README.md)
- **Cache penetration**: requests for keys that exist nowhere, so nothing is ever cached and every request reaches the DB. Fix with negative caching or a Bloom filter. → [H09](hld/2-scaling/H09-caching/README.md)
- **Cache stampede (dogpile, thundering herd)**: one hot key expires and every request rebuilds it at the same time, hammering the DB. → [H09](hld/2-scaling/H09-caching/README.md)
- **Canary release**: send a small slice of traffic (say 5%) to the new version first, watch the metrics, then roll out to everyone. → [H39](hld/6-building-blocks/H39-deployment-multi-region/README.md)
- **CAP theorem**: during a network partition, a distributed system must choose between consistency and availability. You cannot keep both. → [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md)
- **Causal consistency**: if one event caused another, everyone sees them in that order. A reply never shows up before the message it answers. → [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md)
- **CDN (content delivery network)**: servers around the world that cache static files close to users, to cut latency and load on your origin. → [H10](hld/2-scaling/H10-cdn/README.md)
- **Chain of Responsibility**: pass a request along a chain of handlers until one handles it. Express middleware is this pattern. → [L25](lld/4-behavioral/L25-chain-of-responsibility/README.md)
- **Choreography vs orchestration**: two ways to run a saga. In choreography, services react to each other's events. In orchestration, one coordinator tells each service what to do. → [H23](hld/4-async/H23-distributed-transactions/README.md)
- **Circuit breaker**: after too many failures, stop calling a broken service for a while and fail fast. Then test it again with a few calls. → [H27](hld/5-reliability/H27-resilience/README.md)
- **Class**: a blueprint for objects that bundles data and the methods that work on it. → [L01](lld/1-foundations/L01-classes-and-interfaces/README.md)
- **Cohesion**: how closely the parts of one module belong together. You want high cohesion. → [L07](lld/1-foundations/L07-design-principles/README.md)
- **Command**: wrap a request as an object, so you can queue it, log it or undo it. → [L23](lld/4-behavioral/L23-command/README.md)
- **Compensating action**: the "undo" step for a saga, such as a refund that cancels an earlier charge. → [H23](hld/4-async/H23-distributed-transactions/README.md)
- **Composite**: treat a single item and a group of items the same way, as in a file and a folder tree. → [L17](lld/3-structural/L17-composite/README.md)
- **Composite index**: an index on more than one column. Column order matters because of the leftmost-prefix rule. → [H11](hld/3-databases/H11-indexing/README.md)
- **Composition vs aggregation (UML)**: both are "has-a" links. In composition the part dies with the whole (house and rooms, filled diamond). In aggregation the part can live on its own (team and players, hollow diamond). → [L06](lld/1-foundations/L06-uml-relationships/README.md)
- **Composition over inheritance**: build behaviour by combining small objects instead of deep class trees. → [L03](lld/1-foundations/L03-composition-over-inheritance/README.md)
- **Concurrency**: many operations in progress at the same time. In Node, one thread interleaves them at each await. → [L32](lld/5-machine-coding/L32-concurrency-in-node/README.md)
- **Consensus**: a group of nodes agreeing on one value even when some nodes fail. Raft and Paxos do this. → [H29](hld/5-reliability/H29-consensus-locks/README.md)
- **Consistency**: everyone sees the same, correct data. For example, two users can never book the same seat. → [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md)
- **Consistent hashing**: put nodes and keys on a ring, so adding or removing a node moves only about 1/N of the keys. → [H17](hld/3-databases/H17-consistent-hashing/README.md)
- **Consumer group**: a set of consumers that share a Kafka topic's partitions. Each partition is read by one member of the group. → [H21](hld/4-async/H21-kafka/README.md)
- **Count-Min sketch**: a small grid of counters that estimates how often items appear. It may over-count but never under-counts. → [H35](hld/6-building-blocks/H35-probabilistic-ds/README.md)
- **Coupling**: how much one module depends on another's details. You want low coupling. → [L07](lld/1-foundations/L07-design-principles/README.md)
- **Covering index**: an index that holds every column a query needs, so the DB never reads the table itself. → [H11](hld/3-databases/H11-indexing/README.md)
- **CQRS**: use separate models for writes (commands) and reads (queries), each shaped for its job. → [H24](hld/4-async/H24-event-driven-cqrs/README.md)
- **Cursor pagination**: page through results with "give me items after this ID". It stays fast and stable when rows are added. → [H04](hld/1-basics/H04-api-design/README.md)

## D

- **Dead-letter queue (DLQ)**: a side queue for messages that failed too many times, so they can be inspected without blocking the main queue. → [H20](hld/4-async/H20-message-queues/README.md)
- **Decorator**: wrap an object to add behaviour (logging, caching, retries) without changing its class. → [L14](lld/3-structural/L14-decorator/README.md)
- **Denormalization**: copying data into more than one place on purpose, so reads need fewer joins. → [H13](hld/3-databases/H13-data-modeling/README.md)
- **Dependency injection (DI)**: pass a class the things it needs from outside, instead of creating them inside. This makes testing easy. → [L31](lld/5-machine-coding/L31-repository-and-di/README.md)
- **Dependency Inversion Principle (DIP)**: high-level code should depend on interfaces, not on concrete low-level classes. → [L05](lld/1-foundations/L05-solid-lsp-isp-dip/README.md)
- **Distributed lock**: a lock shared across many machines, for example a Redis `SET NX` lease. Use it with care. → [H29](hld/5-reliability/H29-consensus-locks/README.md)
- **Distributed transaction**: one business action that has to change data in more than one service or database. → [H23](hld/4-async/H23-distributed-transactions/README.md)
- **DNS**: the internet's phone book. It turns a name like example.com into an IP address. → [H03](hld/1-basics/H03-networking-basics/README.md)
- **DRY (don't repeat yourself)**: each piece of knowledge should live in one place. → [L07](lld/1-foundations/L07-design-principles/README.md)
- **Dual-write problem**: writing to the DB and to a queue as two separate steps. If one fails, they disagree. The outbox pattern fixes this. → [H23](hld/4-async/H23-distributed-transactions/README.md)

## E

- **Encapsulation**: keep an object's data private and change it only through its methods. → [L02](lld/1-foundations/L02-oop-pillars/README.md)
- **Error budget**: the amount of failure an SLO allows. At 99.9% that is about 43 minutes a month. When it runs out, you slow down releases. → [H30](hld/5-reliability/H30-observability/README.md)
- **Event loop**: Node's single thread that runs one callback at a time and picks up I/O results when they are ready. → [L32](lld/5-machine-coding/L32-concurrency-in-node/README.md)
- **Event sourcing**: store every change as an event and rebuild the current state by replaying the events. → [H24](hld/4-async/H24-event-driven-cqrs/README.md)
- **Event-driven architecture**: services talk by publishing events ("OrderPlaced") rather than calling each other directly. → [H24](hld/4-async/H24-event-driven-cqrs/README.md)
- **Eventual consistency**: replicas may differ for a short time but will all agree if writes stop. Example: a new movie review may take a moment to show for everyone. → [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md)
- **Exactly-once effect**: true exactly-once delivery is not possible over a network. You get at-least-once delivery plus idempotent processing, which gives the same effect. → [H22](hld/4-async/H22-delivery-semantics/README.md)

## F

- **Facade**: one simple interface in front of a messy subsystem. → [L15](lld/3-structural/L15-facade/README.md)
- **Factory Method**: let a method or subclass decide which concrete class to create. → [L09](lld/2-creational/L09-factory-method/README.md)
- **Failover**: switching to a standby when the primary dies. → [H15](hld/3-databases/H15-replication/README.md)
- **Fan-out on read / on write**: two ways to build feeds. On write, push each post to every follower's feed now. On read, gather posts when the user opens the feed. → [H37](hld/6-building-blocks/H37-data-at-scale/README.md)
- **Fault tolerance**: the system keeps working when a part fails. Example: if one payment gateway fails, switch to another. → [H27](hld/5-reliability/H27-resilience/README.md)
- **Fencing token**: a number that goes up each time a lock is granted. The storage rejects writes with an old number, so a paused old lock holder cannot do damage. → [H29](hld/5-reliability/H29-consensus-locks/README.md)
- **Flyweight**: share the common, unchanging part of many objects to save memory. → [L19](lld/3-structural/L19-flyweight/README.md)
- **Functional requirements**: what the system must do, such as "users can book a seat". → [H01](hld/1-basics/H01-approach-hld-round/README.md)

## G

- **Generator (JS)**: a `function*` that can pause with `yield`. It gives you a lazy iterator. → [L27](lld/4-behavioral/L27-iterator/README.md)
- **Geohash**: turn a latitude and longitude into a short string. Nearby places share a prefix. → [H34](hld/6-building-blocks/H34-geospatial/README.md)
- **Gossip protocol**: nodes share state by telling a few random peers, and the news spreads through the cluster like a rumour. → [H19](hld/3-databases/H19-quorum-merkle/README.md)
- **GraphQL**: an API where the client asks for exactly the fields it wants, in one request. → [H04](hld/1-basics/H04-api-design/README.md)
- **gRPC**: fast service-to-service calls using HTTP/2 and Protobuf, with typed contracts. → [H04](hld/1-basics/H04-api-design/README.md)

## H

- **Hash partitioning**: pick a shard by hashing the key. Load spreads evenly, but range queries get harder. → [H16](hld/3-databases/H16-partitioning-sharding/README.md)
- **Health check**: the load balancer probes each server (for example `/healthz`) and stops sending traffic to failing ones. → [H08](hld/2-scaling/H08-load-balancing/README.md)
- **Horizontal scaling (scale out)**: add more machines. → [H07](hld/2-scaling/H07-scaling-stateless/README.md)
- **Hot key / hot partition**: one key or shard that gets far more traffic than the rest, such as a celebrity's profile. → [H37](hld/6-building-blocks/H37-data-at-scale/README.md)
- **HTTP/1.1, HTTP/2, HTTP/3**: versions of the web protocol. HTTP/2 sends many requests over one connection. HTTP/3 runs on QUIC over UDP. → [H03](hld/1-basics/H03-networking-basics/README.md)
- **HyperLogLog**: counts unique items (such as unique visitors) in about 12 KB of memory, with a small error. → [H35](hld/6-building-blocks/H35-probabilistic-ds/README.md)

## I

- **Idempotency**: doing the same operation twice has the same effect as doing it once. Example: a retried payment does not charge twice. → [H22](hld/4-async/H22-delivery-semantics/README.md)
- **Idempotency key**: a unique ID the client sends with a request. The server stores key to result and returns the saved result on a repeat. → [H22](hld/4-async/H22-delivery-semantics/README.md)
- **Index**: an extra sorted structure that makes reads fast but makes writes a little slower. → [H11](hld/3-databases/H11-indexing/README.md)
- **Inheritance**: a class reuses and extends another class ("is-a"). → [L02](lld/1-foundations/L02-oop-pillars/README.md)
- **Interface (TypeScript)**: a contract that says which methods and fields an object must have. → [L01](lld/1-foundations/L01-classes-and-interfaces/README.md)
- **Interface Segregation Principle (ISP)**: many small, focused interfaces are better than one fat interface. → [L05](lld/1-foundations/L05-solid-lsp-isp-dip/README.md)
- **Inverted index**: a map from each word to the list of documents that contain it. It is the core of search engines. → [H33](hld/6-building-blocks/H33-search-typeahead/README.md)
- **Isolation level**: how much concurrent transactions can see of each other: Read Uncommitted, Read Committed, Repeatable Read, Serializable. → [H12](hld/3-databases/H12-transactions-isolation/README.md)
- **Iterator**: walk through a collection one item at a time without knowing how it is stored. → [L27](lld/4-behavioral/L27-iterator/README.md)

## J

- **Jitter**: add a small random amount to retry delays or TTLs, so many clients do not all act at the same moment. → [H27](hld/5-reliability/H27-resilience/README.md)
- **JWT (JSON Web Token)**: a signed token that carries user claims. Any service can verify it without a session store. It is hard to revoke early. → [H31](hld/5-reliability/H31-security-auth/README.md)

## K

- **Kafka**: a distributed, durable, append-only log. Many consumers read it at their own pace and can replay history. → [H21](hld/4-async/H21-kafka/README.md)
- **KISS (keep it simple)**: choose the simplest design that works. → [L07](lld/1-foundations/L07-design-principles/README.md)

## L

- **L4 vs L7 load balancer**: L4 routes by IP and port only. L7 reads HTTP (path, headers, cookies) and can route smarter. → [H08](hld/2-scaling/H08-load-balancing/README.md)
- **Latency**: the time from request to response. Example: 200 ms to show the seat map. → [H02](hld/1-basics/H02-back-of-envelope/README.md)
- **Law of Demeter**: talk only to your direct friends. Avoid chains like `a.getB().getC().doX()`. → [L07](lld/1-foundations/L07-design-principles/README.md)
- **Leader election**: nodes pick one node to be the leader. If the leader dies, they pick a new one. → [H29](hld/5-reliability/H29-consensus-locks/README.md)
- **Leader-follower replication (primary-replica)**: one node takes writes and copies them to followers that serve reads. Older name: master-slave. → [H15](hld/3-databases/H15-replication/README.md)
- **Leaderless replication**: any replica accepts writes, and quorums keep data correct. Used by Dynamo and Cassandra. → [H19](hld/3-databases/H19-quorum-merkle/README.md)
- **Leaky bucket**: requests drain out at a fixed, steady rate. Good when a downstream has a hard rate cap. → [H26](hld/5-reliability/H26-rate-limiting/README.md)
- **Least connections**: a load-balancing rule that sends the next request to the server with the fewest open connections. Best for long-lived connections. → [H08](hld/2-scaling/H08-load-balancing/README.md)
- **Ledger (double-entry)**: an append-only record of money movements. Every transfer is a debit and a matching credit. → [H38](hld/6-building-blocks/H38-payments-domain/README.md)
- **Linearizability**: the strongest consistency. The system acts as if there is one copy of the data, and every read sees the latest write. → [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md)
- **Liskov Substitution Principle (LSP)**: a subclass must work anywhere its parent works, without surprises. → [L05](lld/1-foundations/L05-solid-lsp-isp-dip/README.md)
- **Load balancer**: spreads incoming requests across many servers. → [H08](hld/2-scaling/H08-load-balancing/README.md)
- **Long polling**: the client asks, and the server holds the request open until there is news or a timeout. → [H05](hld/1-basics/H05-realtime-communication/README.md)
- **Lost update**: two transactions read a value, both change it, and one write silently overwrites the other. → [H12](hld/3-databases/H12-transactions-isolation/README.md)
- **LRU / LFU**: cache eviction rules. LRU removes the least recently used key. LFU removes the least frequently used key. → [H09](hld/2-scaling/H09-caching/README.md)

## M

- **Machine-coding round**: a 60 to 90 minute round where you build a small working system (parking lot, splitwise) with clean classes. → [L30](lld/5-machine-coding/L30-machine-coding-framework/README.md)
- **Mediator**: objects talk through one central mediator instead of to each other directly. → [L28](lld/4-behavioral/L28-mediator/README.md)
- **Memento**: save and restore an object's state without exposing its insides. → [L24](lld/4-behavioral/L24-memento/README.md)
- **Merkle tree**: a tree of hashes. Two replicas compare the root hashes to find exactly which ranges differ. → [H19](hld/3-databases/H19-quorum-merkle/README.md)
- **Message queue**: a buffer between producer and consumer that absorbs spikes and survives crashes. Examples: RabbitMQ, SQS. → [H20](hld/4-async/H20-message-queues/README.md)
- **Microservices**: split the system into small services that you deploy on their own and that own their own data. → [H25](hld/5-reliability/H25-microservices/README.md)
- **Monolith**: one deployable app with all features. It is simple to start with but harder to scale teams on. → [H25](hld/5-reliability/H25-microservices/README.md)
- **Monotonic reads**: once you have seen a value, you never see an older one later. → [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md)
- **Multi-leader replication (multi-master)**: more than one node accepts writes. You then have to resolve conflicts. → [H15](hld/3-databases/H15-replication/README.md)

## N

- **Non-functional requirements**: how well the system must work: scale, latency, availability, consistency. → [H01](hld/1-basics/H01-approach-hld-round/README.md)
- **Normalization**: store each fact once and link tables with keys, to avoid duplicates and update bugs. → [H13](hld/3-databases/H13-data-modeling/README.md)
- **NoSQL**: non-relational databases (document, key-value, wide-column, graph) built for flexible schemas or massive scale. → [H14](hld/3-databases/H14-sql-vs-nosql/README.md)

## O

- **OAuth2**: a standard for letting an app act for a user without the user's password, using access tokens. → [H31](hld/5-reliability/H31-security-auth/README.md)
- **Observability**: understanding what a system is doing from its logs, metrics and traces. → [H30](hld/5-reliability/H30-observability/README.md)
- **Observer**: when one object changes, it notifies all its subscribers. → [L21](lld/4-behavioral/L21-observer/README.md)
- **Open/Closed Principle (OCP)**: open for extension, closed for modification. Add new behaviour with new code, not by editing old code. → [L04](lld/1-foundations/L04-solid-srp-ocp/README.md)
- **Optimistic locking**: no lock while reading. On write, check a version number and retry if someone else changed the row. → [H12](hld/3-databases/H12-transactions-isolation/README.md)
- **Outbox pattern**: write the business change and an "event to send" row in one local transaction. A relay publishes the event later. → [H23](hld/4-async/H23-distributed-transactions/README.md)

## P

- **PACELC**: an extension of CAP. If there is a Partition, pick A or C. Else, pick Latency or Consistency. → [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md)
- **Partition (Kafka)**: an ordered slice of a topic. Order is kept only inside one partition. → [H21](hld/4-async/H21-kafka/README.md)
- **Partition key**: the field that decides which shard or partition a row goes to. It is the hardest choice to undo. → [H16](hld/3-databases/H16-partitioning-sharding/README.md)
- **Partition tolerance**: the system keeps working when the network between nodes breaks. → [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md)
- **Partitioning**: splitting data into parts. Sharding is partitioning across machines. → [H16](hld/3-databases/H16-partitioning-sharding/README.md)
- **Percentiles (p50, p95, p99)**: p99 latency means 99% of requests are faster than this. Averages hide the slow tail. → [H30](hld/5-reliability/H30-observability/README.md)
- **Pessimistic locking**: lock the row before working on it (`SELECT ... FOR UPDATE`) so no one else can change it. → [H12](hld/3-databases/H12-transactions-isolation/README.md)
- **Polymorphism**: one interface, many implementations. The right method runs based on the real type. → [L02](lld/1-foundations/L02-oop-pillars/README.md)
- **Presigned URL**: a time-limited URL that lets a client upload or download one file directly from blob storage, without going through your server. → [H32](hld/6-building-blocks/H32-blob-storage/README.md)
- **Prototype**: create new objects by cloning an existing one. → [L12](lld/2-creational/L12-prototype/README.md)
- **Proxy (pattern)**: a stand-in object that controls access to the real one, for lazy loading, caching or access checks. → [L16](lld/3-structural/L16-proxy/README.md)
- **PSP (payment service provider)**: the outside company that actually moves the money, such as Razorpay or Stripe. → [H38](hld/6-building-blocks/H38-payments-domain/README.md)
- **Pub-sub**: publishers send to a topic, and every subscriber gets a copy. → [H20](hld/4-async/H20-message-queues/README.md)

## Q

- **QPS (queries per second)**: requests handled per second. Peak is often 2 to 10 times the average. → [H02](hld/1-basics/H02-back-of-envelope/README.md)
- **Quadtree**: a tree that splits a map into four squares again and again until each square has few points. → [H34](hld/6-building-blocks/H34-geospatial/README.md)
- **Quorum (R + W > N)**: with N replicas, if reads ask R nodes and writes wait for W nodes, and R + W > N, every read overlaps the latest write. → [H19](hld/3-databases/H19-quorum-merkle/README.md)

## R

- **Race condition**: the result depends on the timing of two tasks. In Node, it happens between awaits. → [L32](lld/5-machine-coding/L32-concurrency-in-node/README.md)
- **Range partitioning**: shard by key ranges (A to F, G to M). Range scans are easy, but hot spots appear if writes hit one range, such as "now" for time keys. → [H16](hld/3-databases/H16-partitioning-sharding/README.md)
- **Rate limiting**: capping how many requests a client can make in a time window. Example: 10 booking tries a minute to stop bots. → [H26](hld/5-reliability/H26-rate-limiting/README.md)
- **Read-your-writes**: you always see your own latest write, even if others see it a bit later. → [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md)
- **Reconciliation**: comparing your records with the provider's or bank's records, and fixing any mismatch. → [H38](hld/6-building-blocks/H38-payments-domain/README.md)
- **Redis Cluster hash slots**: Redis splits keys into 16384 slots and assigns slots to nodes. Adding a node moves some slots, not every key. → [H17](hld/3-databases/H17-consistent-hashing/README.md)
- **Redundancy**: keeping extra copies of critical parts, so one failure does not take the system down. → [H27](hld/5-reliability/H27-resilience/README.md)
- **Reliability**: the system keeps doing the right thing even when things fail. → [H27](hld/5-reliability/H27-resilience/README.md)
- **Replication**: keeping copies of the same data on more than one machine. → [H15](hld/3-databases/H15-replication/README.md)
- **Replication lag**: the delay before a follower has the leader's latest write. It causes stale reads. → [H15](hld/3-databases/H15-replication/README.md)
- **Repository pattern**: a class that hides how data is stored behind methods like `findById` and `save`. → [L31](lld/5-machine-coding/L31-repository-and-di/README.md)
- **Resharding**: moving data when the number of shards changes. With plain `hash mod N`, almost everything moves. → [H16](hld/3-databases/H16-partitioning-sharding/README.md)
- **REST**: resource-based HTTP APIs (`GET /orders/42`). Simple, cacheable and understood everywhere. → [H04](hld/1-basics/H04-api-design/README.md)
- **Retry**: try a failed call again. Safe only if the call is idempotent, and only with backoff and a limit. → [H27](hld/5-reliability/H27-resilience/README.md)
- **Reverse proxy**: a server in front of your servers that takes client requests and forwards them, such as Nginx. → [H06](hld/1-basics/H06-proxies-api-gateway/README.md)
- **Round robin**: a load-balancing rule that sends each request to the next server in turn. → [H08](hld/2-scaling/H08-load-balancing/README.md)
- **RPO / RTO**: RPO is how much data you can afford to lose. RTO is how long you can afford to be down. → [H39](hld/6-building-blocks/H39-deployment-multi-region/README.md)

## S

- **Saga**: a chain of local transactions across services. If a step fails, earlier steps are undone with compensating actions. → [H23](hld/4-async/H23-distributed-transactions/README.md)
- **Scalability**: the ability to handle more load by adding resources. → [H07](hld/2-scaling/H07-scaling-stateless/README.md)
- **Server-Sent Events (SSE)**: a one-way stream from server to client over plain HTTP. → [H05](hld/1-basics/H05-realtime-communication/README.md)
- **Service discovery**: how a service finds the current addresses of another service, for example with Consul or Kubernetes DNS. → [H25](hld/5-reliability/H25-microservices/README.md)
- **Service mesh**: a sidecar proxy next to every service that handles retries, mTLS and per-request load balancing. → [H25](hld/5-reliability/H25-microservices/README.md)
- **Sharding**: splitting a database across machines by a key, such as user ID or city. → [H16](hld/3-databases/H16-partitioning-sharding/README.md)
- **Single point of failure (SPOF)**: one part whose failure takes the whole system down. → [H07](hld/2-scaling/H07-scaling-stateless/README.md)
- **Single Responsibility Principle (SRP)**: a class should have one reason to change. → [L04](lld/1-foundations/L04-solid-srp-ocp/README.md)
- **Singleton**: a class with only one instance in the app. In Node, a module export often does the job. → [L08](lld/2-creational/L08-singleton/README.md)
- **SLA / SLO / SLI**: SLI is the measured number (such as p99 latency). SLO is your internal target for it. SLA is the promise to customers, with a penalty if broken. → [H30](hld/5-reliability/H30-observability/README.md)
- **Sliding window**: rate limiting that counts requests in a rolling time window. It fixes the fixed-window edge burst. → [H26](hld/5-reliability/H26-rate-limiting/README.md)
- **Snowflake ID**: a 64-bit ID made of timestamp, machine ID and sequence. It is unique without coordination and sorts by time. → [H28](hld/5-reliability/H28-unique-ids/README.md)
- **SOLID**: five class-design rules: SRP, OCP, LSP, ISP, DIP. → [L04](lld/1-foundations/L04-solid-srp-ocp/README.md), [L05](lld/1-foundations/L05-solid-lsp-isp-dip/README.md)
- **Split brain**: two nodes both think they are the leader and both accept writes. → [H29](hld/5-reliability/H29-consensus-locks/README.md)
- **SQL (relational database)**: tables, joins, ACID transactions and a fixed schema. Examples: PostgreSQL, MySQL. → [H14](hld/3-databases/H14-sql-vs-nosql/README.md)
- **State (pattern)**: an object changes its behaviour when its internal state changes, with one class per state. → [L22](lld/4-behavioral/L22-state/README.md)
- **State machine**: a fixed set of states and allowed moves between them, such as created to pending to success or failed. → [L22](lld/4-behavioral/L22-state/README.md)
- **Stateless service**: a server that keeps no user data in its memory between requests, so any server can handle any request. → [H07](hld/2-scaling/H07-scaling-stateless/README.md)
- **Stale-while-revalidate**: serve the old cached value right away and refresh it in the background. → [H09](hld/2-scaling/H09-caching/README.md)
- **Sticky sessions**: the load balancer keeps sending one client to the same server, for example by IP hash or cookie. → [H08](hld/2-scaling/H08-load-balancing/README.md)
- **Strategy**: put each interchangeable algorithm behind one interface and pick one at runtime. → [L20](lld/4-behavioral/L20-strategy/README.md)
- **Stream processing**: processing events one by one as they arrive, with no end to the data. → [H36](hld/6-building-blocks/H36-batch-stream/README.md)
- **Strong consistency**: every read sees the latest committed write. → [H18](hld/3-databases/H18-cap-pacelc-consistency/README.md)
- **Sync vs async replication**: sync waits for followers before acking (safe, slower). Async acks first (fast, but you can lose the last writes on failover). → [H15](hld/3-databases/H15-replication/README.md)

## T

- **TCP**: a reliable, ordered connection protocol. Lost packets are resent. → [H03](hld/1-basics/H03-networking-basics/README.md)
- **Template Method**: a base class fixes the steps of an algorithm and lets subclasses fill in some steps. → [L26](lld/4-behavioral/L26-template-method/README.md)
- **Test double (mock, stub, fake)**: a stand-in for a real dependency in tests. → [L34](lld/5-machine-coding/L34-testing-designs/README.md)
- **Throughput**: how much work the system finishes per unit of time. Example: 10,000 bookings a second. → [H02](hld/1-basics/H02-back-of-envelope/README.md)
- **Timeout**: the maximum time you wait for a call before giving up. Every network call needs one. → [H27](hld/5-reliability/H27-resilience/README.md)
- **TLS**: encryption for data in transit. It is the "S" in HTTPS. → [H03](hld/1-basics/H03-networking-basics/README.md)
- **Token bucket**: a bucket fills with tokens at a steady rate, and each request spends one token. It allows short bursts while capping the average rate. → [H26](hld/5-reliability/H26-rate-limiting/README.md)
- **Top-K / heavy hitters**: finding the K most frequent items in a huge stream, such as trending hashtags. → [H37](hld/6-building-blocks/H37-data-at-scale/README.md)
- **Trie (prefix tree)**: a tree of characters used for autocomplete. Every word with the same prefix shares the same path. → [H33](hld/6-building-blocks/H33-search-typeahead/README.md)
- **TTL (time to live)**: how long a cached value or record lives before it expires. → [H09](hld/2-scaling/H09-caching/README.md)
- **Two-phase commit (2PC)**: a coordinator asks all parties to prepare, then tells them all to commit. It is correct, but it blocks if the coordinator dies. → [H23](hld/4-async/H23-distributed-transactions/README.md)

## U

- **UDP**: a fast, connectionless protocol with no resends. Good for live video and games, where late data is useless. → [H03](hld/1-basics/H03-networking-basics/README.md)
- **UML class diagram**: boxes for classes and lines for their relationships (inheritance, composition, and so on). → [L06](lld/1-foundations/L06-uml-relationships/README.md)
- **UUID**: a 128-bit random (v4) or time-ordered (v7) ID that any machine can create on its own. → [H28](hld/5-reliability/H28-unique-ids/README.md)

## V

- **Value object**: a small, immutable object defined by its value, such as `Money(100, "INR")`, not by an ID. → [L33](lld/5-machine-coding/L33-domain-modeling/README.md)
- **Vector clock**: a list of counters, one per node, used to tell whether two versions happened in order or at the same time. → [H19](hld/3-databases/H19-quorum-merkle/README.md)
- **Versioning (API)**: changing an API without breaking old clients, for example `/v2` or only adding new fields. → [H04](hld/1-basics/H04-api-design/README.md)
- **Vertical scaling (scale up)**: give one machine more CPU or RAM. It is simple, but it has a ceiling and a single point of failure. → [H07](hld/2-scaling/H07-scaling-stateless/README.md)
- **Virtual nodes (vnodes)**: each physical node sits at many points on the hash ring, so load spreads more evenly. → [H17](hld/3-databases/H17-consistent-hashing/README.md)
- **Visitor**: add new operations to a set of classes without changing those classes. → [L29](lld/4-behavioral/L29-visitor/README.md)

## W

- **WebRTC**: browser-to-browser real-time audio and video, usually over UDP. → [H05](hld/1-basics/H05-realtime-communication/README.md)
- **WebSocket**: a long-lived, two-way connection between client and server. → [H05](hld/1-basics/H05-realtime-communication/README.md)
- **Write-behind (write-back)**: write to the cache now and flush to the DB later. Fast, but you can lose data. → [H09](hld/2-scaling/H09-caching/README.md)
- **Write-through**: write to the cache and the DB at the same time, so the cache is always fresh. → [H09](hld/2-scaling/H09-caching/README.md)

## Y

- **YAGNI (you aren't gonna need it)**: do not build features or hooks until you actually need them. → [L07](lld/1-foundations/L07-design-principles/README.md)

## Z

- **Zero-downtime deploy (rolling deploy)**: replace servers a few at a time behind the load balancer, so users never see an outage. → [H39](hld/6-building-blocks/H39-deployment-multi-region/README.md)
- **ZooKeeper / etcd**: small strongly-consistent stores used for leader election, locks and config. → [H29](hld/5-reliability/H29-consensus-locks/README.md)
