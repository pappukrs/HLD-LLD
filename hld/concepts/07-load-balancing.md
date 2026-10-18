# 07 · Load Balancing

> **Read time:** 30 min · **Visual:** [v02 load balancing algorithms](../../visuals/v02-load-balancing.html) · **Code it:** [hld/code/01-consistent-hashing](../code/01-consistent-hashing/README.md) (for hash-based routing)
> **Shows up in:** every HLD diagram, chat system (sticky WebSocket routing), URL shortener, API gateway, multi-region designs

## The idea in one line

Put one stable address in front of many identical servers, and spread requests across the healthy ones so no single server is overloaded or a single point of failure.

## The problem it solves

One server has a limit (CPU, memory, connections) and it can crash. If clients talk to it directly:

- You cannot add a second server without telling every client.
- A crash means downtime.
- A deploy means downtime.

A load balancer (LB) hides the fleet behind one name. You can add, remove, drain and replace servers without clients noticing.

## How it works

```
             DNS (api.example.com)
                     │
              ┌──────▼──────┐
  clients ──▶ │ L4/L7  LB   │ ── health checks every few seconds
              └──┬───┬───┬──┘
                 ▼   ▼   ▼
               app1 app2 app3   (stateless; sessions in Redis)
```

### Layer 4 vs Layer 7

| | L4 (transport) | L7 (application) |
|---|---|---|
| Sees | IP, port, TCP/UDP | HTTP method, path, headers, cookies |
| Can do | Forward connections | Route `/api/*` vs `/static/*`, rewrite headers, TLS termination, retries, rate limits |
| Cost | Very cheap, millions of connections | More CPU per request; parses every request |
| Examples | AWS NLB, LVS, Maglev | AWS ALB, Nginx, Envoy, HAProxy (both modes) |

Common setup: L4 at the edge for raw scale, L7 behind it for smart routing.

### Algorithms

| Algorithm | How | Good for |
|---|---|---|
| Round robin | Next server in order | Equal servers, short similar requests |
| Weighted round robin | Bigger servers get more turns | Mixed hardware, canary (5% weight) |
| Least connections | Server with fewest open connections | Long or uneven requests, WebSockets |
| Least response time / EWMA | Fastest recent latency | Mixed latency backends (Envoy, Finagle) |
| Power of two choices | Pick 2 at random, send to the less loaded | Large fleets; avoids herding on one "best" server |
| IP hash / consistent hash | `hash(client or key)` → server | Stickiness, cache locality |

### Health checks

- **Active**: LB calls `GET /health` every few seconds. N failures → mark down. M successes → mark up.
- **Passive** (outlier detection): LB watches real traffic. Many 5xx or timeouts → eject the server for a while.
- Keep `/health` cheap. A deep check that calls the DB can mark the **whole** fleet down when the DB blips.

### Sticky sessions

The LB sends the same user to the same server (cookie or IP hash). It is needed for WebSockets and for legacy apps with in-memory sessions. The cost: uneven load, and the user loses state when that server dies. Better: keep servers stateless and put sessions in Redis.

### Removing the LB as a single point of failure

- Run LBs in pairs (active-passive with a floating IP via VRRP/keepalived) or active-active.
- Managed LBs (ALB/NLB) are already multi-AZ.
- Above the LB: DNS with several A records, or anycast, or GeoDNS across regions.

### Connection draining

Before you remove a server in a deploy, stop sending it new requests and let the in-flight ones finish (e.g. 30 s). This gives zero-downtime deploys.

## Numbers to remember

- One Nginx/HAProxy box: tens of thousands of requests/s for simple proxying; L4 balancers handle far more.
- Health check: every 5–10 s, mark down after 2–3 failures. So detection takes ~10–30 s.
- Power of two choices: the maximum load falls from `O(log n / log log n)` (pure random) to `O(log log n)`. Two random picks are almost as good as checking every server.
- Draining timeout: 30–300 s, longer for WebSockets.

## Trade-offs and when not to use it

| Option | Use when | Weakness |
|---|---|---|
| DNS round robin only | Very simple, multi-region entry | Clients cache DNS; no health awareness; slow failover |
| L4 LB | Huge connection counts, non-HTTP (TCP, gRPC passthrough) | Cannot route by path or header |
| L7 LB | HTTP microservices, path routing, TLS termination | More CPU; one more hop to tune |
| Client-side LB (gRPC, Ribbon-style) | Service-to-service in a mesh | Every client needs discovery and the LB logic |
| Service mesh sidecar (Envoy) | Many services, need retries/mTLS/metrics everywhere | Operational complexity |

**gRPC trap:** gRPC uses one long-lived HTTP/2 connection. An L4 LB balances connections, not requests, so one server can get all the traffic. Use an L7 LB that understands HTTP/2, or client-side balancing.

## In real systems

- **AWS**: NLB (L4, static IPs, very high scale), ALB (L7, path/host rules), Route 53 for DNS failover.
- **Google Maglev**: software L4 LB with consistent hashing so a connection stays on the same backend even when LB nodes change.
- **Envoy** (used inside Uber, Lyft and many Indian product companies via Istio): L7 with outlier detection, retries, EWMA.
- **Nginx / HAProxy**: the default self-hosted L7 choice.

## What to say in the interview

"Clients reach us through DNS to an L7 load balancer, ALB or Envoy, that terminates TLS and routes by path to stateless app servers in at least two AZs. I'd use least-connections, or power of two choices, because request times vary. Health checks remove a bad instance in about 15 seconds, and outlier detection ejects instances that return many 5xx. Sessions live in Redis, so I don't need sticky sessions, except for WebSocket servers, where I route by user id with consistent hashing."

## Common follow-ups

<details><summary>The load balancer itself goes down. What happens?</summary>

Run it redundantly. Self-hosted: two LBs sharing a virtual IP with keepalived (VRRP); the standby takes the IP in seconds. Managed: ALB/NLB nodes already span AZs. For regions: DNS health checks or anycast send traffic to another region.
</details>

<details><summary>How do you balance WebSocket connections?</summary>

Use least-connections at connect time, because connections last hours. Round robin balances new connections, not the existing load. Keep a connection registry (user → server) in Redis so other services can find which server holds a user. On deploy, drain slowly and let clients reconnect with jitter.
</details>

<details><summary>Where does TLS terminate?</summary>

Usually at the L7 LB, so it can read HTTP and backends save CPU. If you need encryption inside the network (compliance, fintech), re-encrypt from LB to backend or use mTLS in a mesh. With an L4 passthrough, TLS ends at the app server.
</details>

<details><summary>Round robin, but one server is slower. What happens?</summary>

It gets the same number of requests, builds a queue and its latency grows. Least-connections or latency-aware (EWMA) algorithms send it less traffic automatically.
</details>

## Self-test (answer before opening)

<details><summary>1. Why can a deep health check that pings the database be dangerous?</summary>

If the DB is slow for a moment, every app server fails its check at once. The LB marks the whole fleet down and you get a full outage, instead of a few slow requests.
</details>

<details><summary>2. You need to route `/payments/*` to one service and `/catalog/*` to another. L4 or L7?</summary>

L7. An L4 LB cannot see the URL path.
</details>

<details><summary>3. What is the main cost of sticky sessions?</summary>

Uneven load (a heavy user pins one server), and the user loses session state when that server dies. It also makes scaling in harder.
</details>

<details><summary>4. Why is "power of two choices" better than "always pick the least loaded server"?</summary>

With many LB nodes, all of them see the same "least loaded" server and send it traffic at the same time (herding). Picking the better of two random servers spreads the load and needs little global state.
</details>

## Go deeper

- Concepts: [06 scaling basics](./06-scaling-basics.md), [14 consistent hashing](./14-consistent-hashing.md), [24 resilience patterns](./24-resilience-patterns.md)
- Visual: [v01 life of a request](../../visuals/v01-request-lifecycle.html)
- Google's Maglev paper (NSDI 2016); "The Power of Two Choices in Randomized Load Balancing" (Mitzenmacher)
- Older notes in this repo: `archive/notes/hld-parts/part1.md`, the "Module 1.4: Load Balancing" section ("Layer 4 vs Layer 7 Load Balancing", "Load Balancing Algorithms", "Health Checks & Failover", "Session Persistence (Sticky Sessions)")
