# H39 · Deployment, autoscaling and multi-region

> **Time:** ~55 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/6-building-blocks/H39-deployment-multi-region/demo.ts`)
> **Builds on:** [H07 Scaling the stateless tier](../../2-scaling/H07-scaling-stateless/README.md) · [H08 Load balancing](../../2-scaling/H08-load-balancing/README.md) · [H15 Replication](../../3-databases/H15-replication/README.md) · [H18 CAP and PACELC](../../3-databases/H18-cap-pacelc-consistency/README.md) · [H30 Observability](../../5-reliability/H30-observability/README.md) · **Used in:** Payment system, Digital wallet (data residency), Video streaming, Chat system, Food delivery (sale-day spikes), Stock exchange

## The idea in one line

Ship changes gradually with a fast way back (rolling, blue-green, canary, feature flags), scale on the signal that actually limits you, and plan for losing a whole region with explicit **RPO** and **RTO** targets, inside whatever data-residency rules apply.

## Why it matters (the problem it solves)

- A deploy at 8 p.m. breaks the UPI flow. Without a canary and quick rollback, every user hits it for 20 minutes.
- An IPL final or a Big Billion Days sale brings 10x traffic in minutes. CPU-based autoscaling reacts late, and new pods take 60 s to start.
- An AWS region has a major outage. Is your RPO "zero" or "the last 6 hours of payments"? Who decides to fail over, and how long does it take?
- A payment company wants a DR region in Singapore. RBI says payment data must stay in India.

This is the "how do you deploy it and how does it survive?" part of every HLD round, and the place where senior answers stand out.

## How it works

### 1. Deployment strategies

| Strategy | How | Rollback | Extra cost | Risk |
|---|---|---|---|---|
| **Rolling** | Replace pods a few at a time (K8s `maxSurge` and `maxUnavailable`, default 25% each) | Roll again: minutes | None | Old and new versions serve together |
| **Blue-green** | Full new stack (green) beside the old (blue); flip the load balancer | Flip back: seconds | 2x capacity during release | Big-bang switch; the DB is shared |
| **Canary** | 1% -> 5% -> 25% -> 100% to the new version, compare metrics at each step | Route 0% to canary: seconds | Small | Needs good metrics and automated analysis |
| **Feature flags** | Code deployed "off"; turn on per user, merchant or % | Flip the flag: instant | Flag system | Flag debt; test both paths |

```
canary:   v1 ██████████████████▉ 99%     metrics: error rate, p99, payment success rate
          v2 ▏ 1%                        canary vs baseline -> worse? abort to 0%. same? next step.
          v1 ████████████████ 90%
          v2 ██ 10%
          ...
          v2 ████████████████████ 100%
```

- **Automated canary analysis**: compare canary vs baseline on error rate, p99 latency and a business KPI. Abort automatically if worse. Tools: Argo Rollouts, Flagger, Spinnaker.
- **Deploy ≠ release**: deploy code dark, release with a flag. Rollback becomes a flag flip, not a redeploy.
- **Schema changes use expand-contract**: (1) add the new column, (2) write both, (3) backfill, (4) read new, (5) drop old in a later release. Every step works with old and new code running at the same time, which rolling and canary always do.
- **Readiness probes** gate traffic to a new pod; **liveness probes** restart a stuck one. A pod with no readiness probe takes traffic before it is warm.

### 2. Kubernetes traffic in one picture

```
Internet -> cloud LB (Service type LoadBalancer) -> Ingress controller (L7: host/path routing, TLS)
         -> Service (ClusterIP, stable virtual IP) -> kube-proxy -> ready Pods (spread across AZs)
```

- `ClusterIP`: internal only, for service-to-service calls.
- `LoadBalancer`: one cloud load balancer per service; simple, costly with many services.
- `Ingress` (NGINX, Traefik, ALB controller): one L7 entry point routing many hosts and paths.

### 3. Autoscaling

| Level | Tool | Scales |
|---|---|---|
| Pods (horizontal) | HPA, KEDA | Replica count on a metric |
| Pods (vertical) | VPA | CPU/memory requests of each pod |
| Nodes | Cluster Autoscaler, Karpenter | Machines, when pods are Pending |

**The HPA formula** (checked every 15 s):

```
desiredReplicas = ceil( currentReplicas × currentMetric / targetMetric )

4 pods at 90% CPU, target 60%  ->  ceil(4 × 90 / 60) = 6 pods
```

**Pick the signal that actually limits you:**
- CPU for CPU-bound services. A **Node.js** pod tops out at about one core (one main thread), so also watch **event-loop lag**.
- **Requests per second or in-flight requests per pod** for I/O-bound APIs.
- **Queue depth / consumer lag** for workers (KEDA scales on Kafka lag, SQS depth, RabbitMQ queue length).
- Latency is a weak direct signal: it also rises when a dependency is slow, and more pods will not fix that.

**Behaviour:**
- Scale out fast, scale in slowly. HPA's default scale-down stabilisation is **5 minutes**, to avoid flapping.
- Reactive scaling has a delay: metric scrape (15 to 30 s) + HPA decision + pod start (image pull, boot, warm-up, often 30 to 90 s) + node start if needed (1 to 3 min).
- **Pre-scale for known events**: scheduled scaling before a sale or a match, warm caches and connection pools, raised DB and PSP limits. Reactive scaling is for the unknown.
- **Limits autoscaling does not fix**: DB connections (use PgBouncer), downstream TPS limits (banks, PSPs), Kafka partitions (max consumers in a group = partitions), and the database itself.

### 4. Multi-AZ first, then multi-region

Most outages are a single machine or a single **Availability Zone**. Run at least 3 replicas spread across 3 AZs, with the DB primary and standby in different AZs (sync replication within a region is cheap: ~1 to 2 ms). That covers the common case. Multi-region is for **region** failure, data locality and latency, and costs a lot more.

### 5. Multi-region DR models

```
            GeoDNS / anycast (health-checked, TTL 30-60 s)
               |                         :
         Region A (primary)        Region B (standby)
         services -> primary DB ---async replication---> replica DB
                                  lag = your RPO
```

| Model | Writes | RPO | RTO | Hard part |
|---|---|---|---|---|
| Backup and restore | One region; backups copied away | Hours | Hours | Restore drills |
| Pilot light | Core data replicated; compute off | Minutes | Tens of minutes | Bringing compute up fast |
| Warm standby (active-passive) | One region; a scaled-down copy runs | Seconds to minutes (async lag) | Minutes | Promotion, DNS, client caches |
| Active-active | Both regions take traffic | ~0 for region-owned data | ~0 to minutes | Write conflicts, routing, consistency |

- **RPO** (Recovery Point Objective): how much data you may lose, in time. **RTO** (Recovery Time Objective): how long you may be down.
- **Async replication**: RPO = replication lag at the moment of failure. RPO zero needs **synchronous** replication (or a consensus DB across regions), which adds the inter-region round trip to every write (PACELC: you pay latency for consistency).
- **Active-active without conflicts**: give each user/merchant/account a **home region** (or **cell**) that owns its writes; other regions forward to it. Or use a globally consistent DB (Spanner, CockroachDB) and pay the write latency. **Last-writer-wins** (DynamoDB global tables) is fine for profiles, never for balances.
- **Avoid split brain**: only one region may be primary for a dataset. **Fence** the old primary (revoke its write access, bump an epoch) before promoting the new one.
- **Failover** = promote replica, fence old primary, flip DNS / global LB, scale up standby compute, drain queues. For money systems, keep a human "go" decision in a mostly automated runbook.
- **Game days**: actually fail over on a schedule. A DR plan that was never tested is a guess.
- **Cells**: split customers into independent stacks (cell 1 serves merchants 0 to 999, ...). A bad deploy or a poison request hurts one cell, not everyone. Slack, DoorDash and AWS itself use this.

### 6. Data residency: payments in India

- RBI "Storage of Payment System Data" (April 2018): **all data relating to payment systems** in India must be **stored only in India**, end to end.
- For cross-border transactions, a copy of the foreign leg may be stored abroad; if processing happens abroad, the data must be deleted there and brought back within one business day or 24 hours.
- The DPDP Act (2023) covers personal data generally; RBI's sector rules still apply on top.
- **Design result**: primary and DR both in India: AWS Mumbai (`ap-south-1`) and Hyderabad (`ap-south-2`), or GCP Mumbai and Delhi. Logs, backups, analytics copies and vendor tools (monitoring, support desks) count as storage too. A global CDN may cache only non-sensitive static content.

## In TypeScript

```ts
// HPA decision, with a scale-down stabilisation window
function desiredReplicas(current: number, metric: number, target: number, min: number, max: number) {
  const raw = Math.ceil(current * (metric / target));
  return Math.min(max, Math.max(min, raw));
}
// Scale up at once; scale down only to the HIGHEST recommendation of the last 5 minutes.
function stabilised(history: { at: number; want: number }[], now: number, want: number, current: number) {
  if (want >= current) return want;
  const recent = history.filter((h) => now - h.at <= 300_000).map((h) => h.want);
  return Math.max(want, ...recent);
}

// Canary gate
function canaryVerdict(base: Stats, canary: Stats) {
  if (canary.errorRate > base.errorRate * 1.5 + 0.001) return 'ABORT';
  if (canary.p99 > base.p99 * 1.2) return 'ABORT';
  if (canary.successRate < base.successRate - 0.005) return 'ABORT';     // business KPI
  return 'PROMOTE';
}
```

[demo.ts](demo.ts) simulates a traffic spike with HPA (scale lag, pre-scaling, stabilisation), a canary rollout that aborts on a bad version, and a region failover that computes RPO from replication lag.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Rolling | Most stateless services | Mixed versions; slower rollback |
| Blue-green | Instant switch and rollback; few big releases | Double capacity; DB still shared |
| Canary | High-traffic services with good metrics | Needs automated analysis; useless at 50 requests a day |
| Single region, multi-AZ | Most companies; AZ failures are the common case | A region outage means downtime |
| Warm standby multi-region | Must survive a region; minutes of RTO OK | Standby cost; risky if untested |
| Active-active | Very high availability, global users | Conflicts, cost, complexity |
| Cells | Limit blast radius | Routing layer; cross-cell operations |

Do not start with active-active. Multi-AZ in one region plus tested backups covers most real outages. Go multi-region when the business has an explicit RTO/RPO that needs it, or when users are on several continents.

## Common mistakes

- "We will just autoscale" for a flash sale. Reactive scaling lags by minutes; pre-scale and raise downstream limits.
- Scaling a Node.js service only on CPU while it is I/O-bound, or ignoring event-loop lag.
- Forgetting the database: 10x pods with 20 connections each can exhaust Postgres. Use a pooler.
- Blue-green with a schema change that breaks the old version, so rollback is impossible.
- Saying "RPO zero" while using async replication.
- No fencing, so after failover both regions accept writes (split brain).
- A DR plan that was never rehearsed, or DNS TTLs of 1 hour on failover records.
- Putting backups, logs or monitoring data for Indian payments in a foreign region.

## Say this in the interview

> "Deploys are canaries with Argo Rollouts: 1%, 10%, 50%, 100%, with automatic rollback if error rate, p99 or payment success rate is worse than baseline. Risky features sit behind flags, and schema changes follow expand-contract so old and new code can run together."

> "Pods scale on in-flight requests and Kafka lag, not just CPU, with scheduled pre-scaling before known sale events, and PgBouncer so more pods do not mean more DB connections. We run 3 AZs in Mumbai and a warm standby in Hyderabad with async replication: RPO of a few seconds and RTO under 15 minutes through a rehearsed runbook that fences the old primary first. Both regions are in India because RBI requires payment data to stay in India."

## Your experience hook

- You containerised every service with its own Dockerfile and **Kubernetes manifests** (SenseGrass microservices). Say which rollout you used, and how you would add readiness probes, HPA on in-flight requests, and a canary.
- Matriot IoT: WebSocket servers behind Nginx with IP-hash. Scaling stateful sockets is harder than stateless HTTP: new pods only get **new** connections, so scale earlier and drain old pods gracefully on deploy (send a reconnect, then stop).
- Mediasoup SFU: media workers are CPU-bound per core; autoscale on CPU and room count, and pin rooms to a region close to users for latency.

## Numbers to remember

| Fact | Value |
|---|---|
| K8s rolling update defaults | maxSurge 25%, maxUnavailable 25% |
| HPA sync period / scale-down window | 15 s / 5 minutes |
| Pod cold start | ~30 to 90 s (image pull, boot, warm-up); a new node 1 to 3 min |
| Intra-region (cross-AZ) round trip | ~1 to 2 ms |
| Mumbai <-> Hyderabad | ~15 to 25 ms |
| Mumbai <-> Singapore / US east | ~60 ms / 200 ms+ |
| DNS failover records | TTL 30 to 60 s; some clients ignore it |
| Availability | 99.9% = 8.8 h/year down; 99.99% = 53 min/year |

## Self-test

<details><summary>1. Async replication with 3 s of lag, the region dies. What is your RPO?</summary>

About 3 seconds of writes: the lag at the moment of failure. Those writes may need recovery from the old region later (or are lost).
</details>

<details><summary>2. 4 pods at 90% CPU, HPA target 60%. How many pods?</summary>

ceil(4 × 90 / 60) = 6. Then it re-checks every 15 s.
</details>

<details><summary>3. Canary or blue-green for a service with 50 requests a day?</summary>

Blue-green (or rolling with smoke tests). A 1% canary of 50 requests a day gives no signal.
</details>

<details><summary>4. Blue-green with a database: how do you switch without breaking either version?</summary>

Both colours share one DB, so schema changes must be backward compatible before the switch (expand-contract). Drop old columns only after blue is gone for good.
</details>

<details><summary>5. Why can autoscaling not save you during a flash sale that starts at exactly 12:00?</summary>

Detection, decision, pod and node start add up to minutes, and downstream limits (DB connections, PSP TPS) do not scale with pods. Pre-scale before 12:00 and raise those limits.
</details>

<details><summary>6. Region A comes back after you failed over to B. What now?</summary>

Do not let A accept writes. Rebuild A as a replica of B, reconcile any writes A took before failing that never replicated (from logs or the outbox), and fail back later in a planned window, if at all.
</details>

<details><summary>7. Can an Indian payment aggregator use Singapore for DR of transaction data?</summary>

No. RBI requires payment system data to be stored only in India. Use a second Indian region.
</details>

<details><summary>8. How do you do active-active for wallet balances without conflicts?</summary>

Give each wallet a home region that owns its writes; other regions forward writes there. Or use a globally consistent DB and accept the cross-region write latency. Never last-writer-wins for balances.
</details>

## Go deeper

- Hands-on (other concepts): [H07 scaling hands-on](../../2-scaling/H07-scaling-stateless/hands-on) · [H08 load balancing hands-on](../../2-scaling/H08-load-balancing/hands-on) (Docker and Kubernetes labs from the 35-day repo)
- Case studies: [Payment system](../../case-studies/08-payment-system/README.md) · [Digital wallet](../../case-studies/28-digital-wallet/README.md) · [Video streaming](../../case-studies/14-video-streaming/README.md) · [Food delivery](../../case-studies/11-food-delivery/README.md)
- Related: [H38 Payments domain](../H38-payments-domain/README.md) · [H27 Resilience patterns](../../5-reliability/H27-resilience/README.md)
- Archive notes: [hld-parts/part4.md](../../../archive/notes/hld-parts/part4.md) (disaster recovery, RTO vs RPO) · [hld-parts/part2.md](../../../archive/notes/hld-parts/part2.md) (auto-scaling, multi-region replication)
- AWS whitepaper "Disaster Recovery of Workloads on AWS"; Kubernetes docs "Deployments" and "Horizontal Pod Autoscaling"; Argo Rollouts docs; RBI "Storage of Payment System Data" (2018) and FAQs
