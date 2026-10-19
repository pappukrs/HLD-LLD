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
| Distributed metrics logging and aggregation | [19 metrics and monitoring](./19-metrics-monitoring/README.md) | [H30 observability](../5-reliability/H30-observability/README.md) · [H36 stream processing](../6-building-blocks/H36-batch-stream/README.md) · [H21 Kafka](../4-async/H21-kafka/README.md) |
| Collecting performance metrics from thousands of servers | [19 metrics and monitoring](./19-metrics-monitoring/README.md) | [H30 observability](../5-reliability/H30-observability/README.md) · [H02 estimation](../1-basics/H02-back-of-envelope/README.md) · [H20 message queues](../4-async/H20-message-queues/README.md) |
| Monitoring health for a large compute cluster | [19 metrics and monitoring](./19-metrics-monitoring/README.md) | [H29 consensus and failure detection](../5-reliability/H29-consensus-locks/README.md) · [H30 observability](../5-reliability/H30-observability/README.md) · [H27 resilience](../5-reliability/H27-resilience/README.md) |
| Designing a distributed tracing system | [19 metrics and monitoring](./19-metrics-monitoring/README.md) | [H30 observability](../5-reliability/H30-observability/README.md) · [H36 stream processing](../6-building-blocks/H36-batch-stream/README.md) · [H14 choosing a database](../3-databases/H14-sql-vs-nosql/README.md) |
| Building a system to sort huge datasets across machines | [20 ad click aggregation](./20-ad-click-aggregation/README.md) (batch layer) | [H36 batch processing](../6-building-blocks/H36-batch-stream/README.md) · [H16 partitioning](../3-databases/H16-partitioning-sharding/README.md) · [H32 blob storage](../6-building-blocks/H32-blob-storage/README.md) |
| Control plane for a distributed database | [04 key-value store](./04-key-value-store/README.md) | [H29 consensus](../5-reliability/H29-consensus-locks/README.md) · [H15 replication](../3-databases/H15-replication/README.md) · [H17 consistent hashing](../3-databases/H17-consistent-hashing/README.md) |

### Category 2: Streams, Queues and Live Features

| Problem | Closest base problem | Concepts to revise |
|---|---|---|
| Kafka style distributed stream processing | [18 distributed message queue](./18-distributed-message-queue/README.md) | [H21 Kafka](../4-async/H21-kafka/README.md) · [H36 stream processing](../6-building-blocks/H36-batch-stream/README.md) · [H22 delivery semantics](../4-async/H22-delivery-semantics/README.md) |
| Distributed queue service like RabbitMQ | [18 distributed message queue](./18-distributed-message-queue/README.md) | [H20 message queues](../4-async/H20-message-queues/README.md) · [H22 delivery semantics](../4-async/H22-delivery-semantics/README.md) · [H15 replication](../3-databases/H15-replication/README.md) |
| Surge pricing engine for ride sharing | [10 ride hailing](./10-ride-hailing/README.md) | [H34 geospatial](../6-building-blocks/H34-geospatial/README.md) · [H36 stream processing](../6-building-blocks/H36-batch-stream/README.md) · [H09 caching](../2-scaling/H09-caching/README.md) |
| ETA and live location sharing between driver and rider | [10 ride hailing](./10-ride-hailing/README.md) | [H34 geospatial](../6-building-blocks/H34-geospatial/README.md) · [H05 real-time](../1-basics/H05-realtime-communication/README.md) · [H37 data modelling at scale](../6-building-blocks/H37-data-at-scale/README.md) |
| Live comments system for a social app | [27 live comments](./27-live-comments/README.md) | [H05 real-time](../1-basics/H05-realtime-communication/README.md) · [H20 message queues](../4-async/H20-message-queues/README.md) · [H26 rate limiting](../5-reliability/H26-rate-limiting/README.md) |
| Showing live viewer count on a page | [27 live comments](./27-live-comments/README.md) | [H35 HyperLogLog](../6-building-blocks/H35-probabilistic-ds/README.md) · [H37 hot keys and counters](../6-building-blocks/H37-data-at-scale/README.md) · [H05 real-time](../1-basics/H05-realtime-communication/README.md) |

### Category 3: Storage, Sync and Large Files

| Problem | Closest base problem | Concepts to revise |
|---|---|---|
| Key value store at scale | [04 key-value store](./04-key-value-store/README.md) | [H19 quorums](../3-databases/H19-quorum-merkle/README.md) · [H17 consistent hashing](../3-databases/H17-consistent-hashing/README.md) · [H15 replication](../3-databases/H15-replication/README.md) |
| Cloud file storage like Dropbox or Google Drive | [15 file storage and sync](./15-file-storage/README.md) | [H32 blob storage](../6-building-blocks/H32-blob-storage/README.md) · [H10 CDN](../2-scaling/H10-cdn/README.md) · [H22 idempotency](../4-async/H22-delivery-semantics/README.md) |
| Photo sharing platform like Google Photos or Flickr | [16 photo sharing](./16-photo-sharing/README.md) | [H32 blob storage](../6-building-blocks/H32-blob-storage/README.md) · [H10 CDN](../2-scaling/H10-cdn/README.md) · [H33 search](../6-building-blocks/H33-search-typeahead/README.md) |
| Distributed file transfer like Bittorrent | [15 file storage and sync](./15-file-storage/README.md) (chunking) | [H32 blob storage](../6-building-blocks/H32-blob-storage/README.md) · [H03 networking](../1-basics/H03-networking-basics/README.md) · [H17 consistent hashing (DHT)](../3-databases/H17-consistent-hashing/README.md) |
| Reliable file downloader library | [15 file storage and sync](./15-file-storage/README.md) (chunks, resume) | [H27 retries and backoff](../5-reliability/H27-resilience/README.md) · [H32 large files](../6-building-blocks/H32-blob-storage/README.md) · [H03 networking](../1-basics/H03-networking-basics/README.md) |
| Bulk data migration from on-prem to cloud | [15 file storage and sync](./15-file-storage/README.md) | [H36 batch processing](../6-building-blocks/H36-batch-stream/README.md) · [H39 multi-region and DR](../6-building-blocks/H39-deployment-multi-region/README.md) · [H24 CDC and events](../4-async/H24-event-driven-cqrs/README.md) |

### Category 4: Consumer Apps, Content and Feeds

| Problem | Closest base problem | Concepts to revise |
|---|---|---|
| Calendar application like Google Calendar | [24 job scheduler](./24-job-scheduler/README.md) (reminders) + LLD [meeting room scheduler](../../lld/problems/21-meeting-room-scheduler/README.md) | [H11 SQL and transactions](../3-databases/H11-indexing/README.md) · [H16 sharding](../3-databases/H16-partitioning-sharding/README.md) · [H05 real-time](../1-basics/H05-realtime-communication/README.md) |
| User analytics dashboard and data pipeline | [20 ad click aggregation](./20-ad-click-aggregation/README.md) | [H36 batch and stream](../6-building-blocks/H36-batch-stream/README.md) · [H14 choosing a database (OLAP)](../3-databases/H14-sql-vs-nosql/README.md) · [H35 HyperLogLog](../6-building-blocks/H35-probabilistic-ds/README.md) |
| Hotel booking system with availability, reservation and booking | [23 hotel reservation](./23-hotel-booking/README.md) | [H11 SQL locking](../3-databases/H11-indexing/README.md) · [H04 idempotency in APIs](../1-basics/H04-api-design/README.md) · [H23 saga](../4-async/H23-distributed-transactions/README.md) |
| Weather application backend | [22 proximity service](./22-proximity-service/README.md) (geo lookup) | [H09 caching](../2-scaling/H09-caching/README.md) · [H10 CDN](../2-scaling/H10-cdn/README.md) · [H34 geospatial](../6-building-blocks/H34-geospatial/README.md) |
| Marketplace feature inside a social app | [22 proximity service](./22-proximity-service/README.md) + [07 news feed](./07-news-feed/README.md) | [H33 search](../6-building-blocks/H33-search-typeahead/README.md) · [H34 geospatial](../6-building-blocks/H34-geospatial/README.md) · [H38 payments](../6-building-blocks/H38-payments-domain/README.md) |
| Ads management and serving for a social feed | [20 ad click aggregation](./20-ad-click-aggregation/README.md) + [07 news feed](./07-news-feed/README.md) | [H36 stream processing](../6-building-blocks/H36-batch-stream/README.md) · [H09 caching](../2-scaling/H09-caching/README.md) · [H33 search and indexing](../6-building-blocks/H33-search-typeahead/README.md) |

### Category 5: Money, Commerce and Pricing

| Problem | Closest base problem | Concepts to revise |
|---|---|---|
| API rate limiter for public or paid APIs | [02 rate limiter](./02-rate-limiter/README.md) | [H26 rate limiting](../5-reliability/H26-rate-limiting/README.md) · [H09 caching](../2-scaling/H09-caching/README.md) · [H17 consistent hashing](../3-databases/H17-consistent-hashing/README.md) |
| Price alert system for products or stocks | [05 notification system](./05-notification-system/README.md) | [H36 stream processing](../6-building-blocks/H36-batch-stream/README.md) · [H20 message queues](../4-async/H20-message-queues/README.md) · [H22 idempotency](../4-async/H22-delivery-semantics/README.md) |
| Credit card processing engine | [08 payment system](./08-payment-system/README.md) | [H38 payments domain](../6-building-blocks/H38-payments-domain/README.md) · [H22 idempotency](../4-async/H22-delivery-semantics/README.md) · [H31 security](../5-reliability/H31-security-auth/README.md) |
| Wire transfer API between banks | [28 digital wallet](./28-digital-wallet/README.md) | [H38 ledger and reconciliation](../6-building-blocks/H38-payments-domain/README.md) · [H23 saga and outbox](../4-async/H23-distributed-transactions/README.md) · [H22 idempotency](../4-async/H22-delivery-semantics/README.md) |
| Parts compatibility system for an ecommerce site | [12 search autocomplete](./12-search-autocomplete/README.md) | [H33 search and indexing](../6-building-blocks/H33-search-typeahead/README.md) · [H14 choosing a database (graph)](../3-databases/H14-sql-vs-nosql/README.md) · [H09 caching](../2-scaling/H09-caching/README.md) |
| Rider matching for a ride hailing or food delivery app | [10 ride hailing](./10-ride-hailing/README.md) | [H34 geospatial](../6-building-blocks/H34-geospatial/README.md) · [H29 distributed locks](../5-reliability/H29-consensus-locks/README.md) · [H37 hot keys](../6-building-blocks/H37-data-at-scale/README.md) |

### Category 6: Platform, Auth and Reliability

| Problem | Closest base problem | Concepts to revise |
|---|---|---|
| Login and authentication system for web and mobile apps | [02 rate limiter](./02-rate-limiter/README.md) (brute-force limits) | [H31 security, OAuth2, JWT](../5-reliability/H31-security-auth/README.md) · [H09 caching (sessions)](../2-scaling/H09-caching/README.md) · [H26 rate limiting](../5-reliability/H26-rate-limiting/README.md) |
| Distributed job scheduler for background tasks | [24 job scheduler](./24-job-scheduler/README.md) | [H29 leases and fencing](../5-reliability/H29-consensus-locks/README.md) · [H22 delivery semantics](../4-async/H22-delivery-semantics/README.md) · [H27 retries](../5-reliability/H27-resilience/README.md) |
| Notification system that works at global scale | [05 notification system](./05-notification-system/README.md) | [H20 message queues](../4-async/H20-message-queues/README.md) · [H39 multi-region](../6-building-blocks/H39-deployment-multi-region/README.md) · [H22 idempotency](../4-async/H22-delivery-semantics/README.md) |
| A/B testing platform for experiments | [20 ad click aggregation](./20-ad-click-aggregation/README.md) (event pipeline) | [H36 batch and stream](../6-building-blocks/H36-batch-stream/README.md) · [H09 caching (config at the edge)](../2-scaling/H09-caching/README.md) · [H25 microservices](../5-reliability/H25-microservices/README.md) |
| On call escalation system for incidents | [24 job scheduler](./24-job-scheduler/README.md) + [05 notification system](./05-notification-system/README.md) | [H29 consensus](../5-reliability/H29-consensus-locks/README.md) · [H27 resilience](../5-reliability/H27-resilience/README.md) · [H30 observability](../5-reliability/H30-observability/README.md) |
| IoC or dependency injection framework | None in HLD. It's an LLD round: [repository and DI pattern](../../lld/5-machine-coding/L31-repository-and-di/README.md) | [SOLID](../../lld/1-foundations/L04-solid-srp-ocp/README.md) · [TypeScript for LLD](../../lld/1-foundations/L01-classes-and-interfaces/README.md) |
| Counting and broadcasting likes for very high traffic users | [27 live comments](./27-live-comments/README.md) + [16 photo sharing](./16-photo-sharing/README.md) (like counters) | [H37 hot keys and counters](../6-building-blocks/H37-data-at-scale/README.md) · [H35 probabilistic structures](../6-building-blocks/H35-probabilistic-ds/README.md) · [H05 real-time](../1-basics/H05-realtime-communication/README.md) |
