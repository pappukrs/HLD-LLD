# H07 · Vertical vs horizontal scaling and stateless services

> **Time:** ~40 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/2-scaling/H07-scaling-stateless/demo.ts`) · **Hands-on:** [hands-on/README.md](hands-on/README.md) (cluster, PM2, Nginx, HAProxy, Envoy, Traefik, Kubernetes HPA, AWS ASG)
> **Builds on:** [H02 Back-of-envelope](../../1-basics/H02-back-of-envelope/) · [H06 Proxies and API gateway](../../1-basics/H06-proxies-api-gateway/) · **Used in:** [URL shortener](../../case-studies/01-url-shortener/README.md), [News feed](../../case-studies/07-news-feed/README.md), [Ticket booking](../../case-studies/09-ticket-booking/README.md), [Chat system](../../case-studies/06-chat-system/README.md), every HLD round

## The idea in one line

Scale up (a bigger box) until it stops being cheap or safe, then scale out (more boxes behind a load balancer); scaling out only works when the app servers are **stateless**, which means moving every piece of state to a shared store that is more reliable than the server was.

## Why it matters (the problem it solves)

One server has hard limits: CPU, RAM, open connections, disk and network. When you hit them you have two moves:

- **Vertical (scale up):** a bigger machine. No code change, but there is a ceiling, you pay for peak capacity all day, resizing usually means a restart, and one box is still one failure.
- **Horizontal (scale out):** more machines. No hard ceiling and you survive failures, **but** the second server breaks anything that lived in the first server's memory or disk: sessions, uploaded files, in-memory counters, cron jobs, WebSocket rooms.

Interviewers ask this right after your first diagram: "Traffic grows 10x. What do you do?" The answer is the stateless checklist plus the scaling path below.

## How it works

### 1. Up vs out

```
Vertical                          Horizontal
  ┌──────────────┐                  ┌──────┐ ┌──────┐ ┌──────┐
  │  64 vCPU     │                  │ app1 │ │ app2 │ │ app3 │ ... add more
  │  512 GB RAM  │                  └──┬───┘ └──┬───┘ └──┬───┘
  │  one box     │                     └────────┼────────┘
  └──────────────┘                         [ load balancer ]
  ceiling, SPOF, simple               no ceiling, HA, needs stateless apps
```

| | Vertical | Horizontal |
|---|---|---|
| Change needed | None | Stateless app + load balancer |
| Ceiling | Largest instance (hundreds of vCPU) | Practically none for the stateless tier |
| Cost | You pay for peak 24x7; the top sizes cost more per core | Pay per box; scale in at night |
| Failure | One box = outage | Lose 1 of N = lose 1/N capacity |
| Downtime to grow | Usually a restart | None (add instances live) |
| Best for | Early stage, relational DB primaries, quick fix | Web/API tiers, workers, anything that must survive failures |

**Node.js twist:** one Node process uses one CPU core for JavaScript. On an 8-core box, a single process wastes 7 cores. `cluster` or PM2 (`pm2 start server.js -i max`) forks one worker per core. That is "scaling out inside one box", and it already forces you to be stateless, because the workers do not share memory.

### 2. Make the app tier stateless

Statelessness does not delete state. It **relocates** it.

| State on the server | What breaks with 2+ instances | Move it to |
|---|---|---|
| Session in memory | User logged in on app1, next request hits app2: logged out | Redis session store, or a short-lived JWT the client carries |
| Uploaded file on local disk | 404 on half the reads; file dies with the container | Object storage (S3) via pre-signed URLs, served by a CDN |
| In-memory cache (`Map`) | N different, inconsistent copies; N cold starts | Redis; keep only a tiny local L1 with a short TTL |
| Rate-limit counter in memory | Limit silently becomes N times higher | Redis `INCR` + TTL, or a Lua token bucket |
| `setInterval` / cron in the app | Job runs N times: double emails, double billing | One scheduler with a lock (Redis `SET NX`), or a queue (BullMQ) |
| WebSocket rooms | Message for B only reaches sockets on this instance | Redis pub/sub adapter + connection registry ([H05](../../1-basics/H05-realtime-communication/)) |

After this, any instance can serve any request, you can kill any instance at any time, and autoscaling just works.

**The catch:** you centralised the failure. If Redis holds every session and Redis dies, nobody is logged in. The new home for state must be **more** reliable than the server was: Redis with replication and automatic failover, a managed database, S3. And every request now pays a network hop (~0.5 to 1 ms in the same zone) instead of a RAM lookup.

### 3. Sticky sessions: the shortcut

A load balancer can pin a user to one server (cookie or IP hash). It lets a stateful legacy app run on several servers without changes. But load becomes uneven, and when that server dies its users lose their sessions. Use it as a stepping stone or for long-lived connections where it is a performance hint, never as the thing correctness depends on.

### 4. The usual scaling path (do not skip ahead)

```
1 box ─▶ split DB ─▶ LB + 2..N stateless apps ─▶ cache + CDN ─▶ read replicas
      ─▶ queues for slow work ─▶ shard the DB ─▶ services / multi-region
```

1. One server, one database.
2. Database on its own machine. Load balancer plus 2+ stateless app servers in different availability zones.
3. Redis for hot reads ([H09](../H09-caching/)), CDN for static files and media ([H10](../H10-cdn/)).
4. Read replicas for read-heavy load ([H15](../../3-databases/H15-replication/)). Watch replication lag.
5. Queues and workers for slow work: emails, reports, webhooks ([H20](../../4-async/H20-message-queues/)).
6. Shard when writes or data size pass one primary ([H16](../../3-databases/H16-partitioning-sharding/)).
7. Split services along team or scaling boundaries; multi-region for latency or disaster recovery.

Say "the numbers will tell us when", and use your estimate from [H02](../../1-basics/H02-back-of-envelope/).

### 5. Autoscaling

- **Metric:** CPU (target 50 to 70%), requests per instance, p95 latency, or queue depth for workers.
- **Target tracking** ("keep CPU at 60%") is the default. Leave headroom because new instances take time: ~1 to 5 min for VMs, seconds to a minute for containers on warm nodes.
- **Scheduled scaling** before known peaks (Big Billion Days, an IPL final, 9 am logins). Autoscaling reacts; it cannot predict.
- **Min** = enough to survive losing one zone. **Max** = what the database can take (see below).
- **Scale in gently:** connection draining (finish in-flight requests, 30 to 300 s) before killing an instance.

### 6. Scaling out moves the bottleneck

More app servers push more load onto whatever is shared. The classic one:

```
100 app instances × pool of 20 connections = 2,000 Postgres connections
Postgres is happiest with a few hundred → errors, memory pressure, slow queries
Fix: PgBouncer / RDS Proxy, smaller pools per instance, an autoscaling max
```

Other shared bottlenecks: one hot cache key, network egress, a slow synchronous dependency, a single queue partition. Scaling is never linear forever: coordination and contention eat into each added server (Amdahl's law; the Universal Scalability Law adds a penalty for cross-talk).

## In TypeScript

Before: works on one server, breaks on two.

```ts
const sessions = new Map<string, { userId: string }>();     // lives in THIS process
app.post('/login', (req, res) => { const sid = randomUUID(); sessions.set(sid, { userId: req.body.user }); res.cookie('sid', sid); });
app.get('/me', (req, res) => { const s = sessions.get(req.cookies.sid); s ? res.json(s) : res.status(401).end(); });
setInterval(sendDailyDigest, 24 * 3600_000);                  // runs once PER instance
```

After: state lives outside the process, so any instance can answer.

```ts
app.post('/login', async (req, res) => {
  const sid = randomUUID();
  await redis.set(`sess:${sid}`, JSON.stringify({ userId: req.body.user }), { EX: 1800 });
  res.cookie('sid', sid, { httpOnly: true, secure: true });
});
app.get('/me', async (req, res) => {
  const s = await redis.get(`sess:${req.cookies.sid}`);
  s ? res.json(JSON.parse(s)) : res.status(401).end();
});
// cron: only the instance that wins the lock runs it
if (await redis.set('lock:digest:2026-10-19', instanceId, { NX: true, EX: 3600 })) await sendDailyDigest();
```

[demo.ts](demo.ts) simulates 3 instances behind round robin: in-memory sessions fail ~2/3 of the time, the shared store fixes it, the cron runs 3 times then once with a lock, and it prints the vertical vs horizontal cost and connection-pool math.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Vertical scaling | Early stage; a DB primary you cannot shard yet; quick relief | Ceiling, cost curve, SPOF, restart to resize |
| Horizontal scaling | Stateless web/API tiers, workers | Needs stateless design, LB, shared stores |
| Sticky sessions | Legacy in-memory sessions; long-lived sockets as a hint | Uneven load; sessions die with the server |
| Redis sessions | Most web apps; instant logout and bans | Extra hop per request; Redis must be HA |
| JWT sessions | Many services verify users without a lookup | Hard to revoke; keep access tokens 5 to 15 min |
| Autoscaling | Variable traffic | Lag of minutes; needs a max to protect the DB |

Vertical is a real answer: Stack Overflow ran for years on a few powerful SQL Servers plus caching. If the numbers fit one big box with headroom, say so, add a replica for failover, and move on.

## Common mistakes

- "Just add more servers" without saying what state blocks it.
- Forgetting cron, rate-limit counters and local file uploads in the statelessness list.
- Moving sessions to a single Redis node and calling it done (now Redis is the SPOF).
- Making correctness depend on sticky sessions.
- Scaling the app tier 10x and forgetting the database connection limit.
- Autoscaling on CPU for a queue worker (scale on queue depth or age instead).
- Jumping to sharding or microservices before caching and replicas, with no numbers.

## Say this in the interview

> "Short term I can scale up; it's a config change. But there's a ceiling and it stays a single point of failure, so the real plan is to scale out behind a load balancer. That needs stateless app servers: sessions in Redis or short-lived JWTs, files in S3 through pre-signed URLs, rate-limit counters in Redis, and cron behind a distributed lock so it doesn't run once per instance."

> "Statelessness doesn't delete state, it relocates it. So the new home has to be more reliable than the server was: Redis with replication and failover, a managed database, S3."

> "The app tier autoscales on CPU at about 60% across three zones, with scheduled scaling before known peaks. Scaling out moves the bottleneck to the database, so I'd put PgBouncer in front and cap the autoscaling max so 100 instances don't open 2,000 connections."

## Your experience hook

- **IoT platform, 10k+ devices:** you scaled WebSocket servers horizontally in Docker behind Nginx, and the Redis adapter made instances interchangeable for broadcast. A real example of "find the state, move it out".
- **Express API gateway:** run stateless behind a load balancer so it is not a SPOF; JWTs verified locally so no shared session store was needed.
- **Audit story (use it):** "When we went multi-instance, the things still stuck on the server were Socket.io rooms, multer uploads on local disk, an in-memory cache and a `setInterval` job. Each one got moved: Redis adapter, S3, Redis, and a lock or queue."

## Numbers to remember

| Thing | Number |
|---|---|
| Autoscaling CPU target | 50 to 70% |
| New instance ready | VM ~1 to 5 min; container seconds to ~1 min |
| Minimum production instances | 2 to 3, across zones |
| Redis lookup in the same zone | ~0.5 to 1 ms (vs ~100 ns RAM) |
| Postgres comfortable direct connections | a few hundred; use a pooler beyond |
| Connection draining | 30 to 300 s |
| Node.js | 1 core per process for JS; use cluster/PM2 per core |

## Self-test

<details><summary>1. Your signaling server is at 90% CPU on one box. Scale up or out?</summary>

Scale up now as a quick, low-risk fix. Then scale out, because one box has a ceiling and is a SPOF. Before scaling out, move room membership and sessions to Redis and use the Redis pub/sub adapter so any instance can reach any client. Also profile: in Node, one hot loop (for example JSON parsing) can be the whole problem.
</details>

<details><summary>2. You moved sessions to Redis. What new problems did you create?</summary>

Redis is now a SPOF and on every request's path (needs replication and failover). Each request pays a network hop. You must decide eviction, TTLs and persistence, or a Redis restart logs everyone out. You centralised the failure.
</details>

<details><summary>3. Images are saved to local disk and you add a second instance. What breaks?</summary>

About half the image reads hit the instance without the file and return 404, and files vanish when a container is replaced. Upload to S3 with pre-signed URLs and serve through a CDN.
</details>

<details><summary>4. After scaling from 1 to 4 instances, users get 4 copies of the daily email. Why and fix?</summary>

Each instance runs its own `setInterval`. Use a distributed lock (Redis `SET key NX EX`) so only one instance runs the job per period, or move the job to one scheduler or a queue with a single consumer.
</details>

<details><summary>5. App tier went from 10 to 100 instances and the DB started refusing connections. Why?</summary>

Each instance opens its own pool, so connections grew 10x (for example 2,000). Add a pooler (PgBouncer, RDS Proxy), shrink per-instance pools, and cap the autoscaling max.
</details>

<details><summary>6. JWT vs Redis sessions: a user is banned mid-session. What happens?</summary>

Redis: delete the session key and the next request fails at once. JWT: the token stays valid until `exp`. Fix with short-lived access tokens (5 to 15 min) plus revocable refresh tokens, or a small denylist of token ids checked in Redis.
</details>

<details><summary>7. Autoscaling is too slow for a flash sale at 12:00. What do you do?</summary>

Scheduled scaling to pre-warm before 12:00, warm the caches, put a queue or virtual waiting room in front of checkout, and rate-limit per user, so excess load waits instead of crashing the database.
</details>

<details><summary>8. When is vertical scaling the right answer?</summary>

When the load fits one large machine with headroom, especially a relational database where sharding is expensive. It keeps joins and transactions simple. Add a replica for reads and failover, and plan sharding only when growth will pass the biggest instance.
</details>

## Go deeper

- Hands-on: [hands-on/README.md](hands-on/README.md) (cluster, Nginx, Docker Compose, Kubernetes HPA, AWS ASG). Load testing: [hands-on/Autocannon.md](hands-on/Autocannon.md), [hands-on/scalable-api/canon-jmeter.md](hands-on/scalable-api/canon-jmeter.md). Round robin walk-through: [hands-on/round-robin.md](hands-on/round-robin.md).
- Next: [H08 Load balancing](../H08-load-balancing/), [H09 Caching](../H09-caching/).
- Later: [H15 Replication](../../3-databases/H15-replication/), [H16 Sharding](../../3-databases/H16-partitioning-sharding/), [H39 Deployment and multi-region](../../6-building-blocks/H39-deployment-multi-region/).
- Archive notes: [hld-parts/part2.md](../../../archive/notes/hld-parts/part2.md) ("Horizontal vs Vertical Scaling", "Auto-Scaling Strategies", "Stateless vs Stateful Services").
- *System Design Interview* (Alex Xu) vol. 1, chapter 1; DDIA chapter 1.
