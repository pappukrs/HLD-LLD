# H08 · Load balancing

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/2-scaling/H08-load-balancing/demo.ts`) · **Hands-on:** [hands-on/](hands-on/README.md) (Node round-robin LB, Nginx upstreams, Kubernetes Service + HPA)
> **Builds on:** [H06 Proxies and API gateway](../../1-basics/H06-proxies-api-gateway/) · [H07 Scaling and stateless services](../H07-scaling-stateless/) · **Used in:** every HLD diagram; [Chat system](../../case-studies/06-chat-system/README.md) (WebSocket routing), [URL shortener](../../case-studies/01-url-shortener/README.md), [Video streaming](../../case-studies/14-video-streaming/README.md), [Distributed cache](../../case-studies/17-distributed-cache/README.md)

## The idea in one line

Put one stable address in front of many identical servers, send each request to a healthy server chosen by an algorithm that matches the traffic, and take sick servers out (and put drained ones back) without clients noticing.

## Why it matters (the problem it solves)

If clients talk to servers directly:

- Adding a second server means telling every client about it.
- A crash means errors until someone notices.
- A deploy means downtime.

A load balancer (LB) hides the fleet behind one name. You can add, remove, drain and replace servers freely. It is the box that makes the stateless app tier from [H07](../H07-scaling-stateless/) actually work.

## How it works

### 1. Where LBs sit

```
            DNS / GeoDNS / anycast  (picks a region or an LB IP)
                        │
                ┌───────▼────────┐
  clients ────▶ │  L4 LB (NLB)   │   millions of connections, no HTTP parsing
                └───────┬────────┘
                ┌───────▼────────┐
                │ L7 LB (ALB,    │   TLS, path routing, retries, health checks
                │ Nginx, Envoy)  │
                └──┬────┬────┬───┘
                   ▼    ▼    ▼
                 app1 app2 app3      stateless, 2+ zones
```

| | L4 (transport) | L7 (application) |
|---|---|---|
| Sees | IP, port, TCP/UDP | Method, path, headers, cookies |
| Balances | Connections | Requests |
| Can do | Forward packets or connections | TLS termination, route `/api` vs `/static`, retries, header rewrites, rate limits |
| Cost | Very cheap; millions of connections | More CPU; parses every request |
| Examples | AWS NLB, LVS, Google Maglev | AWS ALB, Nginx, HAProxy, Envoy, Traefik |

Common setup: L4 at the edge for raw scale and static IPs, L7 behind it for smart routing. DNS can also spread load (several A records), but clients cache DNS, so it reacts slowly and knows nothing about health.

### 2. Algorithms

| Algorithm | How it picks | Good for | Weak spot |
|---|---|---|---|
| Round robin | Next server in order | Equal servers, short similar requests | Ignores load: slow requests pile up |
| Weighted round robin | More turns for bigger servers | Mixed hardware, canary at 5% | Still blind to live load |
| Least connections | Fewest in-flight connections | Uneven request cost, WebSockets | LB must track counts; a fresh server gets a burst |
| Least response time / EWMA | Lowest recent latency | Backends with mixed latency (Envoy, Finagle) | Needs latency tracking |
| Power of two choices | Pick 2 at random, take the less busy | Many LB nodes, each with partial state | Slightly less exact than full least-conn |
| IP hash / sticky cookie | Same client to same server | In-memory sessions, local caches | Hot clients; `% N` moves most clients when N changes |
| Consistent hashing | Hash ring of servers | Cache affinity with servers joining/leaving | Needs virtual nodes ([H17](../../3-databases/H17-consistent-hashing/)) |

**Why power of two choices works:** with many LB nodes, all of them think the same server is "least loaded" and hit it at once (herding). Sampling two at random and taking the better one cuts the worst server's load from about `log n / log log n` (pure random) to `log log n`, with almost no coordination.

### 3. Health checks

- **Active:** the LB calls `GET /health` every 5 to 10 s. After 2 to 3 failures (the unhealthy threshold) it removes the server; after 2 successes it adds it back. Thresholds stop a flapping server from bouncing in and out.
- **Passive (outlier detection):** the LB watches real traffic. Too many 5xx or timeouts and the server is ejected for a while (Envoy, Nginx `max_fails`).
- **Liveness vs readiness:** liveness = "is the process alive?" (restart if not). Readiness = "can it take traffic now?" (DB pool ready, cache warm). The LB uses readiness.
- **Keep `/health` shallow.** A deep check that queries the DB can mark the **whole fleet** down when the DB blips for a second. Turn a partial problem into a full outage.

Detection time = interval × threshold, so 5 s × 3 = ~15 s of errors before a dead server is removed. Retries on idempotent requests hide most of that window.

### 4. Connection draining and rolling deploys

Before removing a server, mark it **draining**: no new requests, but in-flight requests may finish (AWS calls it the deregistration delay, default 300 s; 30 s is common for APIs). Then deploy, wait for readiness, add it back. Do one server (or one batch) at a time. Missing draining is the classic cause of "a burst of 502s on every deploy".

### 5. Stickiness

Sticky sessions (cookie or IP hash) send a user to the same server. Needed for legacy in-memory sessions and useful as a hint for local caches. The costs: uneven load, and the user loses state when that server dies. Better: stateless servers with sessions in Redis. For WebSockets, use least-connections at connect time; the connection itself is sticky by nature.

### 6. Long-lived connections and gRPC

- **gRPC trap:** gRPC uses one long-lived HTTP/2 connection with many requests multiplexed on it. An L4 LB balances **connections**, so one pod gets all the calls while nine sit idle. Fix: an HTTP/2-aware L7 LB (Envoy, Linkerd) or client-side balancing over a headless Kubernetes Service; quick mitigation: `MAX_CONNECTION_AGE` on the server so connections recycle.
- **WebSockets:** connections live for hours, so round robin balances arrivals, not load. After a scale-out the old servers stay full. Use least-connections and slowly shed connections from hot servers.
- **Kubernetes:** a `ClusterIP` Service balances connections inside the cluster (via kube-proxy); `type: LoadBalancer` gets a cloud L4 LB; an Ingress controller (Nginx, Traefik) is the L7 layer.

### 7. The LB must not be the single point of failure

- Self-hosted: two LBs share a floating virtual IP with keepalived (VRRP); the standby takes over in seconds. Or run active-active behind DNS.
- Managed LBs (ALB, NLB, GCP LB) are already spread across zones.
- Across regions: DNS health checks (Route 53), GeoDNS or anycast ([H39](../../6-building-blocks/H39-deployment-multi-region/)).

## In TypeScript

The three most asked algorithms, side by side:

```ts
interface Server { id: string; active: number; healthy: boolean; weight: number }

const pool = (s: Server[]) => s.filter((x) => x.healthy);

let rr = 0;
const roundRobin = (s: Server[]) => { const p = pool(s); return p[rr++ % p.length]; };

const leastConn = (s: Server[]) => pool(s).reduce((a, b) => (b.active < a.active ? b : a));

const powerOfTwo = (s: Server[], rand = Math.random) => {
  const p = pool(s);
  const a = p[Math.floor(rand() * p.length)], b = p[Math.floor(rand() * p.length)];
  return b.active < a.active ? b : a;
};
```

[demo.ts](demo.ts) runs 2,000 requests with mixed fast and slow work through round robin, least connections, power of two and random, prints the peak queue on the worst server, then shows health-check detection time and how many clients move with `hash % N` when a server is added.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| DNS round robin only | Simple multi-region entry | Clients cache DNS; no health awareness; slow failover |
| L4 LB | Huge connection counts, non-HTTP, TLS passthrough | Cannot route by path or header; connection-level only |
| L7 LB | HTTP services, path routing, TLS termination | More CPU; one more hop to tune |
| Client-side LB (gRPC, Ribbon) | Service-to-service with discovery | Logic in every client |
| Service mesh (Envoy sidecars) | Many services needing retries, mTLS, metrics | Operational cost, extra latency per hop |
| Sticky sessions | Legacy in-memory state | Uneven load, state lost on failure |

## Common mistakes

- Saying "round robin" for everything, including WebSockets and slow mixed requests.
- Not saying L4 or L7, or not knowing that L4 cannot see the URL.
- Deep health checks that take the whole fleet down when the DB is slow.
- No connection draining, then 502s on every deploy.
- Drawing one LB box and never saying how it avoids being a SPOF.
- `hash(ip) % N` for stickiness, then losing most sessions when N changes (use consistent hashing).
- Forgetting the gRPC/HTTP/2 connection-level imbalance with an L4 LB.

## Say this in the interview

> "Clients resolve our domain to an L7 load balancer, ALB or Envoy, that terminates TLS and routes by path to stateless app servers in at least two zones. Request cost varies, so I'd use least connections or power of two choices instead of round robin."

> "Health checks run every 5 seconds against a shallow readiness endpoint and remove a server after 3 failures, so about 15 seconds to detect. Outlier detection ejects servers returning lots of 5xx. Deploys are rolling with connection draining, so no in-flight request is dropped."

> "Sessions are in Redis, so I don't need stickiness. For the WebSocket tier I use least-connections at connect time, and for internal gRPC I balance per request with Envoy, because an L4 balancer would pin each HTTP/2 connection to one pod."

## Your experience hook

- **IoT platform:** you ran WebSocket servers behind Nginx with **IP hash** so a device stayed on one node, plus the Redis adapter. The trade-off you can state: IP hash gives uneven load if many devices share a NAT IP; the Redis adapter removed the need for stickiness for correctness.
- **Video SFU:** L7 (Nginx) for the HTTPS API and WSS signaling; media over UDP goes straight to the SFU instance that signaling assigned. That is application-level load balancing, a strong senior answer.
- **gRPC between signaling and media:** a natural place to mention the HTTP/2 connection-pinning trap.

## Numbers to remember

| Thing | Number |
|---|---|
| Health check interval / threshold | 5 to 10 s / 2 to 3 failures → ~10 to 30 s to detect |
| Draining (deregistration delay) | 30 s typical for APIs; AWS default 300 s; longer for WebSockets |
| Nginx/HAProxy simple proxying | tens of thousands of req/s per box |
| L4 LBs | millions of connections, very high packet rates |
| Power of two choices max load | ~log log n (vs ~log n / log log n random) |
| Default idle timeout (ALB) | 60 s |

## Self-test

<details><summary>1. You need `/payments/*` on one service and `/catalog/*` on another. L4 or L7?</summary>

L7. An L4 balancer sees only IPs and ports, not the URL path.
</details>

<details><summary>2. One server is slower than the rest under round robin. What happens?</summary>

It gets the same share of requests, its queue grows and its latency climbs while others sit idle. Least connections or latency-aware (EWMA) balancing sends it less work automatically.
</details>

<details><summary>3. Why can a health check that queries the database be dangerous?</summary>

If the DB is slow for a moment, every server fails the check at once and the LB marks the whole fleet down: a full outage instead of a few slow requests. Keep readiness checks shallow.
</details>

<details><summary>4. Deploys cause a 30-second burst of 502s although the new code is fine. What's missing?</summary>

Connection draining and readiness gating. The LB is still sending requests to instances being killed, and sending to new instances before they are ready. Drain before stop; only add instances after readiness passes.
</details>

<details><summary>5. 10 gRPC pods, one at 90% CPU and nine idle, LB healthy. Why?</summary>

The LB is L4 and balances connections. gRPC multiplexes all calls over one long-lived HTTP/2 connection, which landed on one pod. Use an HTTP/2-aware L7 proxy (Envoy) or client-side balancing; recycle connections with `MAX_CONNECTION_AGE` as a quick fix.
</details>

<details><summary>6. Why is power of two choices better than "always pick the least loaded"?</summary>

With many LB nodes working from slightly stale data, they all pick the same "least loaded" server at the same time and overload it. Picking the better of two random servers spreads traffic and needs almost no shared state.
</details>

<details><summary>7. The load balancer itself dies. What happens?</summary>

Run it redundantly: a pair sharing a floating IP via keepalived (VRRP), active-active behind DNS, or a managed multi-zone LB. Across regions, DNS health checks or anycast route around a dead region.
</details>

<details><summary>8. Liveness vs readiness?</summary>

Liveness: is the process alive (restart it if not). Readiness: can it serve traffic now (connections ready, warm-up done). The LB routes only to ready instances; the orchestrator restarts dead ones.
</details>

## Go deeper

- Hands-on: [hands-on/README.md](hands-on/README.md).
- Next: [H09 Caching](../H09-caching/), [H10 CDN](../H10-cdn/).
- Related: [H17 Consistent hashing](../../3-databases/H17-consistent-hashing/), [H27 Resilience](../../5-reliability/H27-resilience/) (retries, outlier ejection), [H39 Deployment and multi-region](../../6-building-blocks/H39-deployment-multi-region/).
- Archive notes: [hld-parts/part1.md](../../../archive/notes/hld-parts/part1.md) ("Module 1.4: Load Balancing").
- Papers: Google Maglev (NSDI 2016); Mitzenmacher, "The Power of Two Choices in Randomized Load Balancing".
