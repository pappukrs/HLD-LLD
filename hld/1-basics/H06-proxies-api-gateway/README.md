# H06 · Proxies, reverse proxies and the API gateway

> **Time:** ~40 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/1-basics/H06-proxies-api-gateway/demo.ts`) · **Hands-on:** [hands-on/](hands-on/README.md) (Nginx, Kong, Express Gateway, AWS via LocalStack)
> **Builds on:** [H03 Networking basics](../H03-networking-basics/) · [H04 API design](../H04-api-design/) · **Used in:** [Rate limiter](../../case-studies/02-rate-limiter/README.md), [Payment system](../../case-studies/08-payment-system/README.md), [Chat system](../../case-studies/06-chat-system/README.md), [Food delivery](../../case-studies/11-food-delivery/README.md), [Ride hailing](../../case-studies/10-ride-hailing/README.md)

## The idea in one line

A forward proxy acts for the **client**, a reverse proxy acts for the **servers**, a load balancer is a reverse proxy that spreads traffic, and an API gateway is a reverse proxy that also runs the cross-cutting checks (TLS, auth, rate limits, routing, request ids) so every service does not have to.

## Why it matters (the problem it solves)

Say you split a monolith into 6 services. Without a front door:

- The mobile app must know 6 hostnames, and every service is exposed to the internet.
- Each service re-implements JWT checks, rate limits, CORS, request logging and TLS. Six copies, six sets of bugs.
- You cannot move `/orders` to a new service without shipping a new app version.

A reverse proxy or gateway gives clients **one address**, hides the internal layout, and does the shared work **once**. In almost every HLD diagram, the first box after the client is this one.

## How it works

### 1. Who sits where

```
Forward proxy (acts for clients)          Reverse proxy (acts for servers)
 laptop ─┐                                              ┌─▶ app-1
 laptop ─┼─▶ [ corporate proxy ] ─▶ internet ─▶ [ nginx ]─┼─▶ app-2
 laptop ─┘   hides clients,                    hides     └─▶ app-3
             filters, caches                   servers
```

| | Forward proxy | Reverse proxy | Load balancer | API gateway |
|---|---|---|---|---|
| Acts for | Clients | Servers | Servers | Servers (APIs) |
| Who configures it | Client side (browser, OS, company) | Server owner | Server owner | Server owner |
| Hides | Client IPs | Server IPs and layout | Server IPs | Service layout |
| Main jobs | Filtering, caching, anonymity, egress control | TLS termination, caching, compression, routing | Spread load, health checks, failover | Auth, rate limits, routing by path/version, transforms, API keys, metrics |
| Examples | Squid, corporate proxy, VPN egress | Nginx, HAProxy, Envoy, Cloudflare | AWS ALB/NLB, HAProxy, Nginx upstream | Kong, AWS API Gateway, Apigee, Envoy Gateway, Express Gateway |

The honest summary: a load balancer and an API gateway are both **specialised reverse proxies**. In practice one Nginx or Envoy often plays all three roles.

### 2. What a reverse proxy does on every request

1. **Terminates TLS.** The certificate lives here; traffic inside the VPC can be plain HTTP or mTLS. One place to rotate certs.
2. **Adds headers.** `X-Forwarded-For` (real client IP), `X-Forwarded-Proto`, `X-Request-Id` (for tracing across services).
3. **Routes** by host or path: `api.shop.com/orders/*` → order service.
4. **Buffers slow clients.** A phone on 2G uploads slowly; the proxy absorbs it so the app server's worker is not stuck.
5. **Caches and compresses** static or cacheable responses (gzip/brotli).
6. **Protects** the origin: the servers have private IPs only; only the proxy is public.

### 3. The API gateway pipeline

```
request ─▶ TLS ─▶ request-id ─▶ authN (JWT/API key) ─▶ rate limit ─▶ route ─▶ transform ─▶ cache? ─▶ upstream
             │         │                │                     │            │                         │
           cert     trace id        401 if bad           429 + Retry-After  /v1/orders → order-svc  timeout,
                                                                                                    retry, breaker
```

Each stage can stop the request early. A bad token never reaches the order service. A client over its limit gets `429` from the gateway, so the backends never see the flood.

Typical gateway responsibilities:

| Concern | What the gateway does |
|---|---|
| Authentication | Validate JWT signature and expiry, or look up an API key. Pass `userId` downstream in a header. |
| Coarse authorization | "Only admins hit `/admin/*`". Fine-grained checks ("can user 7 see order 42?") stay in the service. |
| Rate limiting | Token bucket per user or API key, shared counters in Redis ([H26](../../5-reliability/H26-rate-limiting/)). |
| Routing and versioning | `/v1/*` and `/v2/*` to different deployments; canary 5% of traffic to a new version. |
| Transformation | Rename headers, strip internal fields, REST to gRPC translation. |
| Aggregation | One call that fans out to 3 services and merges results (or leave that to a BFF). |
| Observability | Access logs, latency metrics per route, trace headers ([H30](../../5-reliability/H30-observability/)). |
| Resilience | Timeouts, retries on idempotent calls, circuit breakers per upstream ([H27](../../5-reliability/H27-resilience/)). |
| Protocols | WebSocket upgrade pass-through, gRPC-web to gRPC, HTTP/2 to clients. |

### 4. Gateway, BFF and service mesh

```
 iOS / Android ─▶ [ mobile BFF ] ─┐
 web           ─▶ [ web BFF ]    ─┼─▶ [ API gateway ] ─▶ order-svc ⇄ [sidecar] ⇄ payment-svc [sidecar]
 partners      ──────────────────┘    north-south                   east-west (service mesh)
```

- **API gateway:** north-south traffic (outside world into your system).
- **BFF (backend for frontend):** a thin gateway per client type that shapes responses for that screen. Keeps mobile-only fields out of shared services.
- **Service mesh (Istio, Linkerd):** east-west traffic (service to service). A sidecar proxy next to each service does mTLS, retries, timeouts and metrics. Same ideas as the gateway, applied inside.

### 5. Keeping the gateway from becoming the problem

- **SPOF:** run it **stateless**, several instances behind an L4 load balancer (or DNS), across zones. Counters for rate limits live in Redis, not in gateway memory.
- **Bottleneck:** a good gateway adds ~1 to 5 ms. Keep plugins cheap; verify JWTs locally with a cached public key (JWKS) instead of calling the auth service per request.
- **New monolith:** keep business logic **out**. If "apply coupon" logic lives in the gateway, every team now deploys through it.
- **Config drift:** keep routes declarative and in git (Kong `kong.yml`, Nginx config, Terraform for AWS API Gateway).

## In TypeScript

A gateway is a chain of small middleware, each allowed to short-circuit:

```ts
type Ctx = { path: string; headers: Record<string, string>; userId?: string; status?: number; body?: string };
type Mw = (c: Ctx, next: () => Promise<void>) => Promise<void>;

const auth: Mw = async (c, next) => {
  const user = verifyJwt(c.headers.authorization);   // local signature check, no network call
  if (!user) { c.status = 401; c.body = 'invalid token'; return; } // stop here
  c.userId = user.sub;
  await next();
};
const rateLimit: Mw = async (c, next) => {
  if (!bucket(c.userId!).take()) { c.status = 429; c.body = 'slow down'; return; }
  await next();
};
const route: Mw = async (c) => {
  const svc = routes.find((r) => c.path.startsWith(r.prefix));
  if (!svc) { c.status = 404; return; }
  Object.assign(c, await svc.handle(c));             // proxy with a timeout in real life
};

const pipeline = compose([requestId, auth, rateLimit, route]);
```

[demo.ts](demo.ts) runs this pipeline against 7 requests (no token, forged and expired tokens, valid calls, unknown route, a burst over the limit) and prints where each one stopped. It also shows the 4-instance rate-limit bug and what each side sees through a forward vs reverse proxy.

## Trade-offs / when NOT to use it

| Choice | Good | Cost |
|---|---|---|
| Plain reverse proxy (Nginx) | Fast, simple, TLS + routing + caching | Auth and per-user limits need plugins or Lua |
| Managed gateway (AWS API Gateway) | No servers, usage plans, API keys built in | Per-request price, 29 s integration timeout, vendor lock-in |
| Self-hosted gateway (Kong, Envoy) | Plugins, full control, any cloud | You run, scale and upgrade it |
| Hand-written gateway (Express) | Full flexibility, same language as the team | You own performance and security bugs |
| BFF per client | Tailored payloads, fewer round trips on mobile | More services; logic can be duplicated |
| Service mesh | mTLS and retries everywhere without code | Sidecar latency and memory, steep operations cost |

Do not add a separate gateway for a single monolith with one client. A reverse proxy (or the cloud LB) is enough.

## Common mistakes

- Mixing up forward and reverse proxies. Ask: "whose side is it on?" Forward = client's side. Reverse = server's side.
- Drawing one gateway box and never saying how it avoids being a SPOF.
- Putting business logic (pricing, coupons) in the gateway.
- Calling the auth service on every request instead of verifying the JWT locally.
- Rate-limit counters in each gateway's memory: with 4 instances the user gets 4x the limit.
- Forgetting `X-Forwarded-For`, so every service logs the proxy's IP as the client.
- Retrying non-idempotent POSTs at the gateway (see [H04](../H04-api-design/)).
- Long WebSocket or SSE connections through a proxy with a 60 s idle timeout, or with response buffering on (breaks SSE).

## Say this in the interview

> "Clients hit one domain. An L4 load balancer spreads traffic over a few stateless gateway instances in different zones. The gateway terminates TLS, adds a request id, validates the JWT locally with cached public keys, applies a per-user token bucket backed by Redis, and routes by path to the right service with a timeout and a circuit breaker. Business logic stays in the services."

> "A forward proxy works for the client, like a corporate proxy that hides employees' IPs. A reverse proxy works for the servers: it hides them, terminates TLS and routes. A load balancer and an API gateway are both reverse proxies; the gateway adds API concerns like auth, rate limits and versioning."

> "If web and mobile need very different payloads, I'd add a thin BFF per client in front of the gateway. Service-to-service traffic inside goes through a mesh or plain gRPC with mTLS."

## Your experience hook

- **Express API gateway (node-microservices):** you built the single entry point with JWT auth, rate limiting, reverse-proxy routing and an LRU response cache in front of auth, product, order, payment and notification services. That is section 3.
- **Video SFU platform:** API Gateway, Signaling and Media as separate services with Nginx at the edge and Consul for discovery. Good example of edge proxy plus internal service discovery.
- **The trade-off you can name:** "The gateway was a possible SPOF, so we ran it stateless behind a load balancer and scaled it horizontally."

## Numbers to remember

| Thing | Number |
|---|---|
| Latency added by a good gateway | ~1 to 5 ms |
| AWS API Gateway integration timeout | 29 s (REST APIs, default) |
| Default proxy/LB idle timeout | ~60 s (Nginx `proxy_read_timeout`, AWS ALB) |
| Nginx connections per worker (default config) | 1024 `worker_connections` |
| Gateway instances | at least 2 per zone, stateless |

## Self-test

<details><summary>1. Forward proxy vs reverse proxy, in one line each, with an example.</summary>

A forward proxy sits in front of clients and talks to the internet for them (a company proxy, a VPN exit). A reverse proxy sits in front of servers and receives traffic for them (Nginx in front of three app servers).
</details>

<details><summary>2. Is a load balancer a reverse proxy? Is an API gateway?</summary>

Both are reverse proxies. A load balancer focuses on spreading traffic and health checks. A gateway adds API concerns: authentication, rate limits, routing by path and version, transformation, API keys and per-route metrics.
</details>

<details><summary>3. Name three things a gateway should do and one thing it should not.</summary>

Should: validate JWTs, rate-limit per user, route by path with timeouts, add request ids. Should not: hold business logic like pricing or coupon rules, or it becomes a new monolith every team must deploy through.
</details>

<details><summary>4. How do you stop the gateway being a single point of failure?</summary>

Make it stateless (rate-limit counters in Redis, JWT verified locally), run several instances across zones behind an L4 load balancer or DNS, and health-check them. Losing one instance only drops its in-flight requests.
</details>

<details><summary>5. You have 4 gateway instances and a limit of 100 requests per minute per user. A user gets 400. Why?</summary>

Each instance keeps its own counter in memory, and the load balancer spreads the user over all 4. Fix: keep the counter in a shared store (Redis with an atomic Lua script) or use consistent hashing so a user always lands on the same instance.
</details>

<details><summary>6. API gateway vs BFF vs service mesh?</summary>

Gateway: the front door for north-south traffic, shared cross-cutting concerns. BFF: one thin backend per client type that shapes responses for its screens. Mesh: sidecar proxies for east-west, service-to-service traffic (mTLS, retries, metrics).
</details>

<details><summary>7. Why should the gateway verify JWTs locally instead of calling the auth service?</summary>

A network call per request adds latency and makes the auth service a hot dependency for all traffic. A JWT is signed, so the gateway can check the signature with the cached public key (JWKS) and the expiry on its own. The trade-off is revocation: keep tokens short-lived and use a small denylist for emergencies.
</details>

## Go deeper

- Hands-on: [hands-on/README.md](hands-on/README.md) (the same Node API behind Nginx, Kong, Express Gateway and AWS API Gateway).
- Next: [H07 Scaling and stateless services](../../2-scaling/H07-scaling-stateless/), [H08 Load balancing](../../2-scaling/H08-load-balancing/).
- Proxy, reverse proxy and LB in Node: [H08 hands-on/proxy-reverse-proxy-load-balancer](../../2-scaling/H08-load-balancing/hands-on/proxy-reverse-proxy-load-balancer/flow.md).
- Later: [H25 Microservices](../../5-reliability/H25-microservices/) (discovery, BFF), [H26 Rate limiting](../../5-reliability/H26-rate-limiting/), [H31 Security and auth](../../5-reliability/H31-security-auth/).
- Case study: [Rate limiter](../../case-studies/02-rate-limiter/README.md).
- Archive notes: [hld-parts/part3.md](../../../archive/notes/hld-parts/part3.md) ("API Gateway Pattern", "Service Mesh").
