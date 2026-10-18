# 37 Niche System Design Problems

Prepare for system design interviews targeting Senior & Staff+ roles at Big Tech (with compensation crossing 75 LPA - 1Cr+)

## Compensation Context

- A Senior Engineer at Amazon in India (L6) can make 1Cr+
- A Senior Engineer at Microsoft in India (L64) can make 1Cr+
- A Senior Engineer at Google in India (L5) can make 1Cr+

Tech salaries at upper-level roles are high, but so is the standard of the interview loop.

## Overview

I compiled questions I used while preparing and put 37 of them into 6 categories for focused practice.

---

## Category 1: Observability, Metrics, and Control

- Distributed metrics logging and aggregation
- Collecting performance metrics from thousands of servers
- Monitoring health for a large compute cluster
- Designing a distributed tracing system
- Building a system to sort huge datasets across machines
- Control plane for a distributed database

## Category 2: Streams, Queues and Live Features

- Kafka style distributed stream processing
- Distributed queue service like RabbitMQ
- Surge pricing engine for ride sharing
- ETA and live location sharing between driver and rider
- Live comments system for a social app
- Showing live viewer count on a page

## Category 3: Storage, Sync and Large Files

- Key value store at scale
- Cloud file storage like Dropbox or Google Drive
- Photo sharing platform like Google Photos or Flickr
- Distributed file transfer like Bittorrent
- Reliable file downloader library
- Bulk data migration from on-prem to cloud

## Category 4: Consumer Apps, Content and Feeds

- Calendar application like Google Calendar
- User analytics dashboard and data pipeline
- Hotel booking system with availability, reservation and booking
- Weather application backend
- Marketplace feature inside a social app
- Ads management and serving for a social feed

## Category 5: Money, Commerce and Pricing

- API rate limiter for public or paid APIs
- Price alert system for products or stocks
- Credit card processing engine
- Wire transfer API between banks
- Parts compatibility system for an ecommerce site
- Rider matching for a ride hailing or food delivery app

## Category 6: Platform, Auth and Reliability

- Login and authentication system for web and mobile apps
- Distributed job scheduler for background tasks
- Notification system that works at global scale
- A/B testing platform for experiments
- On call escalation system for incidents
- IoC or dependency injection framework
- Counting and broadcasting likes for very high traffic users

---

## How to practise these

Do these only after the 28 core problems. Each one below is a variation of a core problem. Practise it like this:

1. Do the **closest base problem** again from memory first (45 min). That gives you 70% of the design.
2. Then design the advanced problem in 45 minutes, using the same 6 steps as in the core problems. Write it in a copy of the template at `hld/problems/_template/my-design.md`.
3. Spend the extra time on what is **different** from the base problem. That difference is what senior rounds score.
4. Revise the listed concept cards before the attempt, not after.

### Category 1: Observability, Metrics, and Control

| Problem | Closest base problem | Concepts to revise |
|---|---|---|
| Distributed metrics logging and aggregation | [19 metrics and monitoring](./19-metrics-monitoring/README.md) | [31 observability](../concepts/31-observability.md) · [33 stream processing](../concepts/33-batch-stream-processing.md) · [18 Kafka](../concepts/18-kafka-deep-dive.md) |
| Collecting performance metrics from thousands of servers | [19 metrics and monitoring](./19-metrics-monitoring/README.md) | [31 observability](../concepts/31-observability.md) · [02 estimation](../concepts/02-back-of-envelope.md) · [17 message queues](../concepts/17-message-queues.md) |
| Monitoring health for a large compute cluster | [19 metrics and monitoring](./19-metrics-monitoring/README.md) | [30 consensus and failure detection](../concepts/30-consensus-coordination.md) · [31 observability](../concepts/31-observability.md) · [24 resilience](../concepts/24-resilience-patterns.md) |
| Designing a distributed tracing system | [19 metrics and monitoring](./19-metrics-monitoring/README.md) | [31 observability](../concepts/31-observability.md) · [33 stream processing](../concepts/33-batch-stream-processing.md) · [11 choosing a database](../concepts/11-nosql-types.md) |
| Building a system to sort huge datasets across machines | [20 ad click aggregation](./20-ad-click-aggregation/README.md) (batch layer) | [33 batch processing](../concepts/33-batch-stream-processing.md) · [13 partitioning](../concepts/13-partitioning-sharding.md) · [26 blob storage](../concepts/26-blob-storage.md) |
| Control plane for a distributed database | [04 key-value store](./04-key-value-store/README.md) | [30 consensus](../concepts/30-consensus-coordination.md) · [12 replication](../concepts/12-replication.md) · [14 consistent hashing](../concepts/14-consistent-hashing.md) |

### Category 2: Streams, Queues and Live Features

| Problem | Closest base problem | Concepts to revise |
|---|---|---|
| Kafka style distributed stream processing | [18 distributed message queue](./18-distributed-message-queue/README.md) | [18 Kafka](../concepts/18-kafka-deep-dive.md) · [33 stream processing](../concepts/33-batch-stream-processing.md) · [19 delivery semantics](../concepts/19-idempotency-delivery-semantics.md) |
| Distributed queue service like RabbitMQ | [18 distributed message queue](./18-distributed-message-queue/README.md) | [17 message queues](../concepts/17-message-queues.md) · [19 delivery semantics](../concepts/19-idempotency-delivery-semantics.md) · [12 replication](../concepts/12-replication.md) |
| Surge pricing engine for ride sharing | [10 ride hailing](./10-ride-hailing/README.md) | [28 geospatial](../concepts/28-geospatial.md) · [33 stream processing](../concepts/33-batch-stream-processing.md) · [08 caching](../concepts/08-caching.md) |
| ETA and live location sharing between driver and rider | [10 ride hailing](./10-ride-hailing/README.md) | [28 geospatial](../concepts/28-geospatial.md) · [05 real-time](../concepts/05-realtime-communication.md) · [34 data modelling at scale](../concepts/34-data-modeling-at-scale.md) |
| Live comments system for a social app | [27 live comments](./27-live-comments/README.md) | [05 real-time](../concepts/05-realtime-communication.md) · [17 message queues](../concepts/17-message-queues.md) · [23 rate limiting](../concepts/23-rate-limiting.md) |
| Showing live viewer count on a page | [27 live comments](./27-live-comments/README.md) | [29 HyperLogLog](../concepts/29-probabilistic-data-structures.md) · [34 hot keys and counters](../concepts/34-data-modeling-at-scale.md) · [05 real-time](../concepts/05-realtime-communication.md) |

### Category 3: Storage, Sync and Large Files

| Problem | Closest base problem | Concepts to revise |
|---|---|---|
| Key value store at scale | [04 key-value store](./04-key-value-store/README.md) | [16 quorums](../concepts/16-quorum-leaderless.md) · [14 consistent hashing](../concepts/14-consistent-hashing.md) · [12 replication](../concepts/12-replication.md) |
| Cloud file storage like Dropbox or Google Drive | [15 file storage and sync](./15-file-storage/README.md) | [26 blob storage](../concepts/26-blob-storage.md) · [09 CDN](../concepts/09-cdn.md) · [19 idempotency](../concepts/19-idempotency-delivery-semantics.md) |
| Photo sharing platform like Google Photos or Flickr | [16 photo sharing](./16-photo-sharing/README.md) | [26 blob storage](../concepts/26-blob-storage.md) · [09 CDN](../concepts/09-cdn.md) · [27 search](../concepts/27-search-indexing.md) |
| Distributed file transfer like Bittorrent | [15 file storage and sync](./15-file-storage/README.md) (chunking) | [26 blob storage](../concepts/26-blob-storage.md) · [03 networking](../concepts/03-networking-basics.md) · [14 consistent hashing (DHT)](../concepts/14-consistent-hashing.md) |
| Reliable file downloader library | [15 file storage and sync](./15-file-storage/README.md) (chunks, resume) | [24 retries and backoff](../concepts/24-resilience-patterns.md) · [26 large files](../concepts/26-blob-storage.md) · [03 networking](../concepts/03-networking-basics.md) |
| Bulk data migration from on-prem to cloud | [15 file storage and sync](./15-file-storage/README.md) | [33 batch processing](../concepts/33-batch-stream-processing.md) · [36 multi-region and DR](../concepts/36-deployment-multi-region.md) · [21 CDC and events](../concepts/21-event-driven-cqrs.md) |

### Category 4: Consumer Apps, Content and Feeds

| Problem | Closest base problem | Concepts to revise |
|---|---|---|
| Calendar application like Google Calendar | [24 job scheduler](./24-job-scheduler/README.md) (reminders) + LLD [meeting room scheduler](../../lld/problems/21-meeting-room-scheduler/README.md) | [10 SQL and transactions](../concepts/10-sql-deep-dive.md) · [13 sharding](../concepts/13-partitioning-sharding.md) · [05 real-time](../concepts/05-realtime-communication.md) |
| User analytics dashboard and data pipeline | [20 ad click aggregation](./20-ad-click-aggregation/README.md) | [33 batch and stream](../concepts/33-batch-stream-processing.md) · [11 choosing a database (OLAP)](../concepts/11-nosql-types.md) · [29 HyperLogLog](../concepts/29-probabilistic-data-structures.md) |
| Hotel booking system with availability, reservation and booking | [23 hotel reservation](./23-hotel-booking/README.md) | [10 SQL locking](../concepts/10-sql-deep-dive.md) · [04 idempotency in APIs](../concepts/04-api-design.md) · [20 saga](../concepts/20-distributed-transactions.md) |
| Weather application backend | [22 proximity service](./22-proximity-service/README.md) (geo lookup) | [08 caching](../concepts/08-caching.md) · [09 CDN](../concepts/09-cdn.md) · [28 geospatial](../concepts/28-geospatial.md) |
| Marketplace feature inside a social app | [22 proximity service](./22-proximity-service/README.md) + [07 news feed](./07-news-feed/README.md) | [27 search](../concepts/27-search-indexing.md) · [28 geospatial](../concepts/28-geospatial.md) · [35 payments](../concepts/35-payments-domain.md) |
| Ads management and serving for a social feed | [20 ad click aggregation](./20-ad-click-aggregation/README.md) + [07 news feed](./07-news-feed/README.md) | [33 stream processing](../concepts/33-batch-stream-processing.md) · [08 caching](../concepts/08-caching.md) · [27 search and indexing](../concepts/27-search-indexing.md) |

### Category 5: Money, Commerce and Pricing

| Problem | Closest base problem | Concepts to revise |
|---|---|---|
| API rate limiter for public or paid APIs | [02 rate limiter](./02-rate-limiter/README.md) | [23 rate limiting](../concepts/23-rate-limiting.md) · [08 caching](../concepts/08-caching.md) · [14 consistent hashing](../concepts/14-consistent-hashing.md) |
| Price alert system for products or stocks | [05 notification system](./05-notification-system/README.md) | [33 stream processing](../concepts/33-batch-stream-processing.md) · [17 message queues](../concepts/17-message-queues.md) · [19 idempotency](../concepts/19-idempotency-delivery-semantics.md) |
| Credit card processing engine | [08 payment system](./08-payment-system/README.md) | [35 payments domain](../concepts/35-payments-domain.md) · [19 idempotency](../concepts/19-idempotency-delivery-semantics.md) · [32 security](../concepts/32-security-auth.md) |
| Wire transfer API between banks | [28 digital wallet](./28-digital-wallet/README.md) | [35 ledger and reconciliation](../concepts/35-payments-domain.md) · [20 saga and outbox](../concepts/20-distributed-transactions.md) · [19 idempotency](../concepts/19-idempotency-delivery-semantics.md) |
| Parts compatibility system for an ecommerce site | [12 search autocomplete](./12-search-autocomplete/README.md) | [27 search and indexing](../concepts/27-search-indexing.md) · [11 choosing a database (graph)](../concepts/11-nosql-types.md) · [08 caching](../concepts/08-caching.md) |
| Rider matching for a ride hailing or food delivery app | [10 ride hailing](./10-ride-hailing/README.md) | [28 geospatial](../concepts/28-geospatial.md) · [30 distributed locks](../concepts/30-consensus-coordination.md) · [34 hot keys](../concepts/34-data-modeling-at-scale.md) |

### Category 6: Platform, Auth and Reliability

| Problem | Closest base problem | Concepts to revise |
|---|---|---|
| Login and authentication system for web and mobile apps | [02 rate limiter](./02-rate-limiter/README.md) (brute-force limits) | [32 security, OAuth2, JWT](../concepts/32-security-auth.md) · [08 caching (sessions)](../concepts/08-caching.md) · [23 rate limiting](../concepts/23-rate-limiting.md) |
| Distributed job scheduler for background tasks | [24 job scheduler](./24-job-scheduler/README.md) | [30 leases and fencing](../concepts/30-consensus-coordination.md) · [19 delivery semantics](../concepts/19-idempotency-delivery-semantics.md) · [24 retries](../concepts/24-resilience-patterns.md) |
| Notification system that works at global scale | [05 notification system](./05-notification-system/README.md) | [17 message queues](../concepts/17-message-queues.md) · [36 multi-region](../concepts/36-deployment-multi-region.md) · [19 idempotency](../concepts/19-idempotency-delivery-semantics.md) |
| A/B testing platform for experiments | [20 ad click aggregation](./20-ad-click-aggregation/README.md) (event pipeline) | [33 batch and stream](../concepts/33-batch-stream-processing.md) · [08 caching (config at the edge)](../concepts/08-caching.md) · [22 microservices](../concepts/22-microservices.md) |
| On call escalation system for incidents | [24 job scheduler](./24-job-scheduler/README.md) + [05 notification system](./05-notification-system/README.md) | [30 consensus](../concepts/30-consensus-coordination.md) · [24 resilience](../concepts/24-resilience-patterns.md) · [31 observability](../concepts/31-observability.md) |
| IoC or dependency injection framework | None in HLD. It's an LLD round: [repository and DI pattern](../../lld/concepts/patterns/p18-repository-di.md) | [SOLID](../../lld/concepts/02-solid.md) · [TypeScript for LLD](../../lld/concepts/05-ts-for-lld.md) |
| Counting and broadcasting likes for very high traffic users | [27 live comments](./27-live-comments/README.md) + [16 photo sharing](./16-photo-sharing/README.md) (like counters) | [34 hot keys and counters](../concepts/34-data-modeling-at-scale.md) · [29 probabilistic structures](../concepts/29-probabilistic-data-structures.md) · [05 real-time](../concepts/05-realtime-communication.md) |
