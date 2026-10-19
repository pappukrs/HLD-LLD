# SD Day 2 — Load Balancers: L4 vs L7 + Algorithms
*(Jun 6, 2026 · ~1 hr · the box in EVERY diagram — know it cold)*

---

## 1. The LB's three jobs

1. **Distribute** traffic across N backends
2. **Health-check** — stop routing to dead/slow servers
3. **Single stable entry point** — clients see one IP/DNS while servers come and go
   (this is what makes "cattle, not pets" from Day 1 possible)

## 2. L4 vs L7 — say which one, always

| | L4 (transport) | L7 (application) |
|---|---|---|
| Sees | IP + port, TCP/UDP packets | full HTTP: path, host, headers, cookies |
| Mechanics | forwards packets (≈ smart NAT), 1 client conn ≈ 1 backend conn | **terminates** client TCP+TLS, parses request, opens a 2nd conn to backend |
| Can do | raw speed, millions of conns, any protocol (TCP/UDP/MQTT/DB) | path/host routing, cookie stickiness, retries, TLS termination, compression, rate limit, WAF |
| Can't do | read HTTP — no smart routing, no per-request retry | as fast/cheap — pays CPU for TLS + parsing |
| Examples | AWS **NLB**, LVS/IPVS, HAProxy `tcp` mode, **Nginx `stream{}`** | AWS **ALB**, **Nginx `http{}`** (`proxy_pass` = my daily L7), HAProxy `http`, Envoy |

**Senior move:** big systems chain them — L4 tier (NLB/anycast) spraying packets onto an
L7 fleet (Envoy/Nginx) doing smart routing.

## 3. Algorithms — when each wins

| Algorithm | When it wins | When it bites |
|---|---|---|
| Round robin (default) | uniform short HTTP, identical servers | slow requests pile unevenly |
| Weighted RR | mixed hardware; **canary deploys** (1% weight) | stale static weights |
| **Least connections** ⭐ | long-lived/uneven: WebSockets, streaming, slow APIs | new server has 0 conns → gets hammered (want *slow start*) |
| IP hash | cheap stickiness, no cookies | NAT'd office = one hot server; reshuffles on server change |
| Consistent hashing | cache affinity, minimal reshuffle (Day 15 deep dive) | — |
| Power of two choices | near-least-conn with no global state (Envoy/Nginx distributed) | — |

Nginx spellings: default RR · `least_conn;` · `ip_hash;` · `hash $key consistent;` · `random two least_conn;`

**Rule of thumb:** short stateless HTTP → RR. Long-lived/variable → least conn. Cache locality → consistent hash.

## 4. Health checks + draining (production reality)

- **Active**: probe `/healthz` every N sec (HAProxy/Envoy/ALB; open-source Nginx is only **passive** — `max_fails`)
- **Passive / outlier detection**: consecutive real-traffic errors → eject backend
- **Connection draining** (ALB: "deregistration delay"): on deploy, stop NEW traffic, let in-flight finish — without it every deploy 502s
- ⚠️ **Health-check trap**: if `/healthz` checks the DB and the DB blips → ALL servers report
  unhealthy → LB ejects the whole fleet → partial outage becomes total. Keep liveness shallow.

## 5. "Isn't the LB a SPOF?" — guaranteed follow-up

1. **Active-passive pair + floating VIP** (keepalived/**VRRP**) — standby claims the IP in ~1s
2. **DNS round robin** over several LB IPs — crude (TTL caching, no health awareness)
3. **Anycast** — same IP announced by BGP from many sites (Cloudflare front door)
4. **Managed ALB/NLB** = already a distributed fleet behind one DNS name
5. **GSLB** (Route 53 latency/geo) balances across REGIONS before any LB — DNS is the L0 balancer

## 6. My deep-dive ammo ⚠️

**WebSockets (Mediasoup / Socket.io prod experience):**
- LB must pass the `Upgrade` handshake (Nginx `proxy_set_header Upgrade/Connection` — written it)
- LB idle timeouts kill quiet sockets (ALB default 60s) → heartbeats
- **Socket.io needs sticky sessions** while long-polling fallback is on (polling must hit the
  instance holding the session) + Redis adapter for cross-instance emits — the full prod pattern
- Long-lived conns → **least connections**, never RR (RR ignores the 10k conns already parked)

**gRPC trap (my fintech microservices):**
gRPC = HTTP/2 = ALL requests multiplexed on ONE long-lived TCP conn. An L4 LB balances
*connections* → every request from a client lands on the SAME pod forever; 10 pods, 9 idle.
Fixes: ① L7/HTTP-2-aware per-request balancing (Envoy — ~why service meshes exist),
② client-side LB + service discovery (K8s headless svc / Consul), ③ crude: `MAX_CONNECTION_AGE`
forcing reconnects. Edge traffic → server-side LB; internal service-to-service → client-side/mesh.

## 7. The diagram sentence

> "L7 LB — terminates TLS, routes by path, health-checks the fleet, least-connections because
> we hold WebSockets. The LB itself is HA via managed fleet / VRRP pair."

---

### Half-page summary (the version to remember)

> L4 = forwards packets by IP:port — fast, dumb, protocol-agnostic. L7 = terminates and
> parses HTTP — smart routing, stickiness, retries, TLS, at CPU cost. Real systems chain
> L4 → L7. Algorithms: RR for uniform short HTTP, least-conn for long-lived (WebSockets),
> hashing for affinity. Health checks active vs passive + connection draining; keep
> /healthz shallow or a DB blip ejects the whole fleet. LB's own SPOF → VRRP pair, anycast,
> or managed fleet; DNS/GSLB balances above it. My traps: Socket.io polling needs sticky,
> gRPC over L4 pins all traffic to one pod → L7/Envoy or client-side LB.
