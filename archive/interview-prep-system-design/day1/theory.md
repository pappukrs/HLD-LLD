# SD Day 1 — Vertical vs Horizontal Scaling + Stateless Services
*(Jun 5, 2026 · ~1 hr · the foundational concept every design interview starts with)*

---

## 1. Vertical Scaling (Scale UP)

Make the one machine bigger: more CPU, RAM, faster disk.

- ✅ Dead simple — zero code changes, no distributed-system problems
- ❌ Hard ceiling (biggest box money can buy)
- ❌ Cost grows non-linearly (2× the machine ≫ 2× the price)
- ❌ **Single point of failure** — one machine dies, product is down

**Interview line:** *"I'd start vertical for simplicity, but it doesn't address availability — so for any serious system I scale horizontally."*

## 2. Horizontal Scaling (Scale OUT)

More machines behind a load balancer.

- ✅ Near-unlimited ceiling
- ✅ Fault tolerance — one node dies → LB routes around it
- ✅ Cheap commodity machines
- ❌ Introduces every hard distributed-systems problem: load balancing, state, consistency, service discovery

**My production link:** Node.js is single-threaded → I've run multi-core via
cluster/PM2 (10k+ IoT devices at Matriot). That's horizontal scaling *inside one
box*. Same concept across boxes.

## 3. The Catch: Only STATELESS Things Scale Out

Horizontal scaling fails if servers remember things between requests.

**Classic failure:** sessions in server RAM. Login → session in Server A's memory →
LB sends next request to Server B → "please log in again." More servers = more broken.

### The three fixes (know all three + trade-offs)

| Fix | How | Trade-off |
|-----|-----|-----------|
| Sticky sessions | LB pins user to one server (cookie/IP hash) | Uneven load; server dies = sessions lost. Mention it, then reject it. |
| **Externalize state** ⭐ | Sessions/state in Redis or DB; servers hold nothing | THE standard answer. Servers become identical, disposable — "cattle, not pets" |
| Client-side tokens (JWT) | State lives inside the signed token | No store lookup, but **revocation is hard** — logout/ban needs a blocklist… which is Redis again |

### Stateless ≠ no state anywhere

State is *pushed down* to layers built for sharing/replication/durability
(Redis, Postgres, S3) so the **compute layer** can scale freely.
→ The DB then becomes the next bottleneck → that's why replication (Day 7) and
sharding (Day 8) exist.

## 4. Why Interviewers Care

Stateless compute is the prerequisite for:
- **Auto-scaling** — K8s HPA adding/killing pods only works if pods are interchangeable
- **Zero-downtime deploys** — kill and replace servers freely
- **Fault tolerance** — any server can serve any request

When I draw `Clients → LB → [App × N] → Cache → DB`, I must say:
*"the app tier is stateless so I can scale it horizontally behind the LB"* —
that sentence justifies the whole left half of the diagram.

## 5. WebSockets Break Easy Statelessness ⚠️ (my deep-dive ammo)

A WebSocket connection IS state pinned to a server. Server B cannot push to a
client connected to Server A.

**Fix I've used in prod:** Socket.io Redis adapter — every server pub/subs through
Redis, so any server can emit to any client regardless of where it's connected.
That's "externalize the state" applied to *connections*. Use this story in the
chat-app / video-platform design interviews.

---

### Half-page summary (the version to remember)

> Scale up = simple but capped + SPOF. Scale out = unlimited + fault-tolerant but
> requires statelessness. Stateless = push session/state down to Redis/DB so app
> servers are identical and disposable. JWT trades the lookup away but makes
> revocation hard. WebSockets are inherently stateful → Redis pub/sub across
> instances. Stateless app tier is what makes auto-scaling, zero-downtime deploys,
> and the standard LB diagram work.
