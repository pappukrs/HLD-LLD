# 06 · Scaling Basics and Stateless Services

> **Read time:** 30 min · **Visual:** [v01 life of a request](../../visuals/v01-request-lifecycle.html) · **Code it:** none
> **Shows up in:** every HLD round, usually right after the first diagram; [URL shortener](../problems/01-url-shortener/README.md), [news feed](../problems/07-news-feed/README.md), [ticket booking](../problems/09-ticket-booking/README.md)

## The idea in one line

Make app servers stateless so you can add copies behind a load balancer, push state into shared stores (DB, cache, object storage), and then scale those stores with caching, replicas and sharding, in that order.

## The problem it solves

One server has limits: CPU, memory, connections, disk I/O. Making it bigger (vertical scaling) is simple but has a ceiling and is a single point of failure. Adding more servers (horizontal scaling) has no hard ceiling, but only works if any server can handle any request. If a server keeps a user's session or uploaded file in memory, the next request may land on a different server and fail.

## How it works

### Vertical vs horizontal

- **Vertical (scale up):** bigger machine. No code change. Limited by the largest instance, costs grow faster than capacity, and one box is one failure.
- **Horizontal (scale out):** more machines behind a load balancer. Needs stateless services or partitioned state. Gives fault tolerance and near-linear growth for the stateless tier.

### Make the app tier stateless

Move every piece of state out of the process:

| State | Move it to |
|---|---|
| Sessions | Redis, or a signed token (JWT) the client carries |
| Uploaded files | Object storage (S3), uploaded with pre-signed URLs |
| In-memory cache | Redis/Memcached (keep a small local cache only for read-mostly data) |
| Scheduled jobs / cron | A job scheduler with a lock or leader, not "every instance runs cron" |
| WebSocket connections | A separate gateway tier with a registry (see [real-time](./05-realtime-communication.md)) |

Then any instance can serve any request, instances can be killed at any time, and autoscaling works.

### The usual scaling path

1. One server, one database.
2. Split the database onto its own machine. Add a **load balancer** and 2+ stateless app servers in different AZs.
3. Add a **cache** (Redis) for hot reads, and a **CDN** for static files and media.
4. Add **read replicas** for read-heavy load. Watch replication lag.
5. Move slow work to **queues** and workers (emails, reports, webhooks).
6. **Shard** the database when writes or data size exceed one primary.
7. Split into services where team or scaling boundaries are clear. Go **multi-region** for latency or disaster recovery.

Do not jump to step 6 or 7 unless the numbers say so.

### Autoscaling

- Scale on a metric that tracks load: CPU (~50–70% target), request rate per instance, or queue depth for workers.
- Target tracking ("keep CPU at 60%") is the default choice. Add scheduled scaling before known peaks (sales, matches), because new instances take minutes to become ready.
- Set a minimum that survives one AZ failure, and a maximum that protects the database from too many connections.

### Find the bottleneck

The database is usually the first limit. Others: connection count (each app instance holds a pool; 100 instances × 20 connections = 2,000 Postgres connections, too many without a pooler like PgBouncer or RDS Proxy), network egress, a single hot key, or a synchronous call to a slow dependency.

## Numbers to remember

- Target CPU for autoscaling: **~50–70%**, so there is room for spikes while new instances start.
- New instance ready time: **~1–5 min** for VMs, **seconds to a minute** for containers on warm nodes.
- Run at least **2–3 instances across AZs** for any production tier.
- Postgres handles **hundreds**, not thousands, of direct connections well; use a pooler beyond that.

## Trade-offs

| Option | Use when | Weakness |
|---|---|---|
| Vertical scaling | Early stage; databases you can't shard yet; quick fix | Ceiling, cost curve, single point of failure, downtime to resize |
| Horizontal scaling | Stateless tiers; anything that must survive failures | Needs stateless design, LB, distributed state |
| Sticky sessions | Legacy apps with in-memory sessions | Uneven load; sessions lost when an instance dies |
| Sessions in Redis | Most web apps | One more dependency; Redis must be highly available |
| JWT sessions | Many services verify the user without a lookup | Hard to revoke before expiry; keep them short-lived |
| Read replicas | Read-heavy, lag is acceptable | Stale reads; doesn't help writes |
| Sharding | Write throughput or data size beyond one node | Cross-shard queries, resharding, operational cost |

## In real systems

- **AWS:** ALB + an Auto Scaling Group or ECS/EKS service across 3 AZs, RDS/Aurora with replicas, ElastiCache Redis, S3 + CloudFront.
- **Flipkart / Amazon sales:** pre-scale capacity days before, then autoscale; queue non-critical work.
- **Stack Overflow** famously served large traffic for years with a small number of powerful (vertically scaled) SQL Servers plus caching. Vertical scaling is a valid answer when the numbers fit.

## What to say in the interview

"The API servers are stateless: sessions are short-lived JWTs, files go to S3 through pre-signed URLs, and shared state is in Postgres and Redis. They sit behind an ALB across three AZs and autoscale on CPU at 60%, with pre-scaling before known peaks. The first bottleneck will be the database, so I'll add Redis for hot reads and replicas next, and only shard when write volume needs it. I'll put PgBouncer in front so 50 app instances don't open thousands of connections."

## Common follow-ups

<details><summary>How do you handle user sessions with 20 app servers?</summary>

Store sessions in Redis (keyed by a session id cookie), or use short-lived signed tokens (JWT, 5–15 min) with a refresh token. Avoid sticky sessions except as a temporary step; they break when an instance dies and they unbalance load.
</details>

<details><summary>Autoscaling is too slow for a flash sale at 12:00. What do you do?</summary>

Scheduled scaling to pre-warm capacity before 12:00, warm caches, and a queue or virtual waiting room in front of the hot path (checkout) so excess load waits instead of crashing the database. Rate-limit per user.
</details>

<details><summary>When is vertical scaling the right answer?</summary>

When the load fits one large machine with headroom, especially for a relational database where sharding is costly. It's simpler, keeps transactions and joins, and you can add replicas for reads and failover. Move to sharding when growth will pass the biggest instance.
</details>

## Self-test (answer before opening)

<details><summary>1. A service stores uploaded images on local disk, and you add a second instance. What breaks?</summary>

Half the image reads go to the instance that doesn't have the file and return 404. Move files to object storage (S3) and serve them through a CDN.
</details>

<details><summary>2. You scaled the app tier from 10 to 100 instances and the DB started refusing connections. Why?</summary>

Each instance opens its own connection pool, so total connections grew 10×. Use a connection pooler (PgBouncer, RDS Proxy), shrink per-instance pools, and set a max on autoscaling.
</details>

<details><summary>3. Name the typical scaling steps in order for a read-heavy web app.</summary>

Separate DB, LB with multiple stateless app servers, cache + CDN, read replicas, async queues for slow work, then sharding, then multi-region.
</details>

## Go deeper

- *System Design Interview* (Alex Xu), vol. 1, chapter 1: "Scale from Zero to Millions of Users"
- DDIA, chapter 1: "Scalability" (describing load and performance)
- Related: [load balancing](./07-load-balancing.md), [caching](./08-caching.md), [replication](./12-replication.md), [sharding](./13-partitioning-sharding.md), [deployment and multi-region](./36-deployment-multi-region.md)
- Older notes in this repo: `archive/notes/hld-parts/part2.md`, sections "Module 2.1: Horizontal vs Vertical Scaling", "Auto-Scaling Strategies", "Stateless vs Stateful Services" and "Scaling Limitations & Bottlenecks"
