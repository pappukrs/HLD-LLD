# H25 · Microservices and service discovery

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/5-reliability/H25-microservices/demo.ts`)
> **Builds on:** [H06 Proxies and API gateway](../../1-basics/H06-proxies-api-gateway/README.md) · [H08 Load balancing](../../2-scaling/H08-load-balancing/README.md) · [H20 Message queues](../../4-async/H20-message-queues/README.md) · [H23 Distributed transactions](../../4-async/H23-distributed-transactions/README.md) · **Used in:** [Food delivery](../../case-studies/11-food-delivery/README.md), [Ride hailing](../../case-studies/10-ride-hailing/README.md), [Payment system](../../case-studies/08-payment-system/README.md), [Notification system](../../case-studies/05-notification-system/README.md), [Hotel booking](../../case-studies/23-hotel-booking/README.md)

## The idea in one line

Split a system into small services that each own one business capability and its own data, deploy them independently, put a gateway in front, and let services find each other's live instances through a registry or DNS instead of fixed IPs.

## Why it matters (the problem it solves)

A monolith is the right start for a small team. It starts to hurt when:
- 80 engineers merge into one repo and one deploy. One bad change blocks everyone's release.
- Search needs 50 instances and admin needs 2, but you must scale the whole thing together.
- A memory leak in the reports module takes down checkout.

Microservices let each team **deploy, scale and fail** on its own. The price: every call is now a network call that can be slow or fail, data is spread across databases, and you need discovery, tracing and resilience everywhere. In an HLD round you are expected to draw the service split, say how services find each other, and say which calls are sync and which are async.

## How it works

### 1. Drawing the boundaries

- Split by **business capability / bounded context** (DDD): Orders, Payments, Catalog, Delivery, Notifications. Not by technical layer ("DB service", "validation service").
- **Database per service.** Nobody reads another service's tables. They call its API or consume its events.
- A good boundary has **high cohesion** (a change stays inside one service) and **low coupling** (few sync calls across).
- New domain? Start with a **modular monolith** and extract a service when a module needs its own scale, team or release cycle (the **strangler fig** pattern: route one path at a time to the new service).

The bad outcome is a **distributed monolith**: services that must deploy together, share a DB, or call each other in long sync chains. All the costs of microservices, none of the benefits.

```
           Monolith                                  Microservices
┌──────────────────────────────┐          ┌────────┐ ┌─────────┐ ┌──────────┐
│ orders  payments  catalog    │          │ Orders │ │ Payments│ │ Catalog  │
│ reports notifications        │   ──►    └───┬────┘ └────┬────┘ └────┬─────┘
└──────────────┬───────────────┘           (Orders DB) (Payments DB) (Catalog DB)
           (one DB)                         each deploys, scales and fails alone
```

### 2. The request path

```
Mobile ─┐                          ┌──► Catalog svc ──► (Catalog DB)
Web ────┼──► API gateway ──────────┼──► Order svc ──gRPC──► Payment svc ──► (Payments DB)
Partner ┘   TLS, JWT, rate limit,  │        │
            routing, request id    │        └── event "OrderPlaced" ──► Kafka ──► Notification svc
                                   └──► (BFF per client type, optional)
```

**API gateway** (Kong, Envoy, NGINX, AWS API Gateway, or your own Express gateway): TLS termination, routing (`/orders/*` → order service), JWT validation, rate limiting ([H26](../H26-rate-limiting/README.md)), request ids and trace headers ([H30](../H30-observability/README.md)). Keep **business logic out** of it, or it becomes a new monolith.

**BFF (backend for frontend):** a thin gateway per client type that shapes responses for that screen. Mobile gets a small payload; partners get a stable versioned API.

### 3. Service discovery

Instances come and go (autoscaling, deploys, crashes), so their IPs change all the time. A caller needs the **current list of healthy instances**.

| Style | How it works | Examples |
|---|---|---|
| **Client-side** | Caller asks the registry for instances, caches the list, load-balances itself | Netflix Eureka + Ribbon, Consul + client library, gRPC with a resolver |
| **Server-side** | Caller hits one stable name; a proxy or LB picks the instance | Kubernetes Service (DNS + kube-proxy), AWS ALB, Consul + Envoy |
| **Service mesh** | A sidecar proxy beside each pod does discovery, retries, mTLS, metrics | Istio / Linkerd with Envoy-style sidecars |

**Registration** keeps the list true:
- **Self-registration**: the instance registers itself at boot and sends heartbeats (Eureka: every 30 s, evicted after ~90 s of silence).
- **Third-party registration**: the platform registers it. Kubernetes adds a pod to the Service's endpoints only when its **readiness probe** passes, and removes it when the probe fails or the pod is deleted.

```
 pod starts ──► readiness probe OK ──► added to endpoints ──► gets traffic
 pod overloaded / dying ──► readiness fails ──► removed ──► no new traffic
```

On Kubernetes, `http://payment.payments.svc.cluster.local` already gives you server-side discovery. You rarely run Eureka or Consul yourself there. Client-side discovery still matters for **gRPC**: HTTP/2 keeps one long connection, so a plain K8s Service sends all calls from one client pod to one server pod. Fix it with a headless Service + client-side balancing, or a mesh.

**The registry is critical infrastructure.** If it is down, callers must keep using their last known list (cache it). Consul and etcd run as 3- or 5-node Raft clusters for this reason ([H29](../H29-consensus-locks/README.md)).

### 4. Sync or async between services

- **Sync** (REST, gRPC) when the caller needs the answer to continue: price, stock check, auth, charge. gRPC for internal hops: binary Protobuf, typed contracts, HTTP/2, deadlines.
- **Async** (events, queues) when it does not: send the receipt, update search, analytics, loyalty points. A slow consumer cannot slow down checkout.
- Every sync call needs a **timeout, a retry policy and a circuit breaker** ([H27](../H27-resilience/README.md)).
- Cross-service consistency uses **sagas + outbox** ([H23](../../4-async/H23-distributed-transactions/README.md)), not 2PC. Cross-service queries use **API composition** or a **CQRS read model** ([H24](../../4-async/H24-event-driven-cqrs/README.md)).
- Version APIs and events. Only add fields; never rename or remove in place.

### 5. Availability math: why sync chains hurt

```
availability of a sync chain = product of each hop
5 hops at 99.9% each = 0.999^5 = 99.50%   → ~3.6 h down per month instead of ~43 min
```

Keep sync depth to 2–3 on the hot path. Push everything else async.

## In TypeScript

A tiny client-side discovery: registry with heartbeats + TTL eviction, and a round-robin client that caches the list.

```ts
type Instance = { id: string; addr: string; lastBeat: number };

class Registry {
  private services = new Map<string, Map<string, Instance>>();
  constructor(private ttlMs = 15_000) {}
  register(svc: string, id: string, addr: string, now: number) {
    if (!this.services.has(svc)) this.services.set(svc, new Map());
    this.services.get(svc)!.set(id, { id, addr, lastBeat: now });
  }
  heartbeat(svc: string, id: string, now: number) {
    const i = this.services.get(svc)?.get(id);
    if (i) i.lastBeat = now;
  }
  lookup(svc: string, now: number): Instance[] {
    const all = [...(this.services.get(svc)?.values() ?? [])];
    return all.filter((i) => now - i.lastBeat <= this.ttlMs); // expired = presumed dead
  }
}

class DiscoveryClient {
  private rr = 0;
  constructor(private reg: Registry) {}
  pick(svc: string, now: number): Instance {
    const list = this.reg.lookup(svc, now);
    if (list.length === 0) throw new Error(`no healthy ${svc} instances`);
    return list[this.rr++ % list.length];
  }
}
```

[demo.ts](demo.ts) runs this with instances joining, dying and being evicted, compares sync-chain availability, and shows a sync vs async checkout.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Monolith | Small team, new product, unclear domain | Shared deploys and scaling; one failure domain |
| Modular monolith | One deployable with strict module boundaries | Still one runtime and one release train |
| Microservices | Many teams, very different scale needs per area | Network failures, distributed data, ops cost, tracing needed |
| Client-side discovery | gRPC, need smart balancing (least-loaded, zone-aware) | Library in every language; clients hold stale lists |
| Server-side discovery | Simple callers, Kubernetes | Extra hop; LB must be HA |
| Service mesh | 50+ services, need mTLS and uniform retries everywhere | Sidecar CPU and latency; complex to operate |

Do **not** start a 4-person startup with 15 services. Do not split when two services change together, call each other on every request, or need one transaction. That is one service split in the wrong place.

## Common mistakes

- Splitting by technical layer ("user-DB service") instead of business capability.
- A shared database between "microservices" (distributed monolith).
- Long sync chains (A → B → C → D → E) on the hot path.
- Hard-coded IPs or a config file of hosts instead of discovery.
- Business rules in the gateway.
- Liveness probes that check dependencies (restart storms), or no readiness probe at all (traffic to cold pods).
- Saying "we use 2PC across services" instead of sagas + outbox.
- Forgetting that a plain K8s Service does not balance long-lived gRPC connections.

## Say this in the interview

> "I'll split by business capability: orders, payments, catalog, delivery and notifications. Each owns its database, and nobody reads another service's tables. Clients go through an API gateway that terminates TLS, validates the JWT, rate-limits and adds a request id. Business logic stays in the services."

> "Services find each other through Kubernetes DNS: a pod joins the endpoints only after its readiness probe passes, and leaves when it fails. For gRPC I use a headless service with client-side round robin so long-lived connections spread out. Checkout makes sync calls only where it needs an answer, stock and payment, each with a timeout and a circuit breaker. Everything else, like receipts and search updates, reacts to events on Kafka, so a slow notification service can never slow down checkout."

## Your experience hook

- **Video SFU platform**: you split it into **API Gateway · Signaling · Media** services, used **gRPC** between Signaling and Media (REST 20–50 ms → gRPC 2–5 ms), and **Consul** for service discovery. That is a complete microservices + discovery story with real numbers.
- **SenseGrass / node-microservices**: an Express gateway (JWT, rate limiting, reverse-proxy routing, LRU cache) in front of auth, product, order, payment and notification services, each with its own DB, Dockerfile and k8s manifests. Say what you would add at 10×: a broker for async events, circuit breakers, maybe a mesh for mTLS.

## Numbers to remember

- 5 sync hops at 99.9% each ≈ **99.5%** (≈3.6 h/month down vs ≈43 min for one).
- In-region sync hop: **~1–5 ms** network + the callee's own time. gRPC vs REST+JSON: often **2–10× less** latency and payload.
- Keep sync call depth to **2–3** on the hot path.
- Eureka: heartbeat **30 s**, eviction after **~90 s**. Kubernetes readiness probe: typically every **5–10 s**, removed after **3** failures.
- Registry clusters: **3 or 5** nodes (Raft majority).

## Self-test

<details><summary>1. Three teams share one Postgres schema across their "microservices". What is the problem?</summary>

It is a distributed monolith. A schema change by one team can break the others, they cannot deploy or scale independently, and the database is a shared failure point.
</details>

<details><summary>2. Client-side vs server-side discovery: one advantage of each?</summary>

Client-side: no extra hop, and the client can do smart balancing (least-loaded, same zone). Server-side: callers stay simple (just a DNS name), and the logic lives in one place (kube-proxy, ALB).
</details>

<details><summary>3. Why do readiness probes matter for discovery?</summary>

Kubernetes adds a pod to the Service endpoints only when readiness passes, so traffic never reaches pods that are still warming up, and an overloaded pod can take itself out of rotation without being restarted.
</details>

<details><summary>4. The registry goes down. What happens to running services?</summary>

If clients cache the last known instance list, calls keep working; only new or moved instances are missed. That is why registries are replicated (Raft clusters) and clients must cache.
</details>

<details><summary>5. Name two things a gateway should do and one it should not.</summary>

Should: TLS termination, JWT validation, rate limiting, routing, request ids. Should not: business rules like pricing or order validation.
</details>

<details><summary>6. A screen needs data from Orders, Payments and Delivery. How?</summary>

API composition in a BFF or gateway (parallel calls, join in memory) for small results, or a CQRS read model built from all three services' events for heavy queries. Never read another service's DB directly.
</details>

<details><summary>7. Your gRPC client pods all hammer one server pod. Why?</summary>

HTTP/2 keeps one long connection, and a ClusterIP Service balances per connection, not per request. Use a headless Service with client-side round robin, or a mesh that balances per request.
</details>

## Go deeper

- Case studies: [Food delivery](../../case-studies/11-food-delivery/README.md), [Ride hailing](../../case-studies/10-ride-hailing/README.md), [Payment system](../../case-studies/08-payment-system/README.md)
- Next: [H27 Resilience](../H27-resilience/README.md) (protect every sync call), [H30 Observability](../H30-observability/README.md) (trace across services), [H31 Security](../H31-security-auth/README.md) (gateway auth, mTLS)
- Archive notes: [hld-parts/part3.md](../../../archive/notes/hld-parts/part3.md) ("MODULE 3.1: MICROSERVICES ARCHITECTURE": service boundaries, service discovery, API gateway, service mesh)
- Sam Newman, *Building Microservices* (2nd ed.) and *Monolith to Microservices*; Chris Richardson, *Microservices Patterns*
