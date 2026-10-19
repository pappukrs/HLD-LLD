# SD Day 17 — WebSockets vs SSE vs Long-Polling at Scale

*(~1 hr · building-blocks block. This is YOUR home turf — you've shipped NestJS/Redis WebSocket
messaging and a Mediasoup SFU. Today is about **formalizing** it: naming the trade-offs precisely,
knowing what SSE and long-polling buy you (interviewers love asking "why NOT WebSockets?"), and —
the senior part — what happens when you go from 1 server to 50: sticky routing, the pub/sub
backbone, heartbeats, and reconnect storms. Pairs with Day 2 (load balancers — L4 vs L7 matters
here), Day 3 (Redis pub/sub), Day 11 (Kafka as the fan-out spine), and Day 1 (these connections
make your servers **stateful** — the exception to "keep services stateless").)*

---

## 1. The core problem: HTTP is client-pull, real-time is server-push

Plain HTTP is **request → response → done**. The server cannot start a conversation. But chat,
notifications, live dashboards, presence, collab editing all need the **server to push** when
something happens — without the client asking at exactly the right moment.

Every technique today is a different answer to one question: **how do you keep a path open from
server to client, and what does it cost?**

> **One line:** *"The techniques differ in who holds the connection open, in which direction data
> flows, and how much infrastructure (proxies, LBs, HTTP tooling) still understands the traffic."*

The baseline nobody ships: **short polling** — client asks "anything new?" every N seconds. Simple,
stateless, works everywhere… and it's the worst of both worlds: **latency up to N seconds** AND
**wasted requests** (most polls return empty). Mention it only to dismiss it — *"polling every 2s at
1M users is 500k QPS of mostly-empty responses."*

---

## 2. Long-polling — "hold my question until you have an answer"

**Mechanics:** client sends a normal HTTP request; the server **doesn't respond** until it has data
(or a timeout, ~30–60s, fires). Client processes the response and **immediately re-requests**. The
"push" is faked by always having one pending request parked at the server.

- ✅ It's **just HTTP** — works through every proxy, LB, corporate firewall, and ancient browser.
  This is *the* fallback transport (Socket.IO falls back to it for a reason).
- ✅ Near-real-time latency (data flows the moment it arrives, not at the next poll tick).
- ❌ **One message per round-trip**: respond → connection closes → client re-establishes (headers,
  possibly TLS resume) → a gap where messages must be buffered server-side.
- ❌ Server holds many parked requests = many open connections anyway, but with *worse* overhead
  than the persistent options.
- ❌ Ordering/duplication care: client must pass a cursor/offset ("give me everything after msg 42")
  so the gap between polls loses nothing.

> **Hook:** *"Long-polling is push emulated with parked requests — maximum compatibility, worst
> per-message overhead. It's the fallback, not the design."*

---

## 3. SSE (Server-Sent Events) — "one-way tap over plain HTTP"

**Mechanics:** client opens one GET; server responds with `Content-Type: text/event-stream` and
**never closes** — it keeps writing `data: ...\n\n` frames down the same response, forever.
Browser-native via `EventSource`.

- ✅ Still **just HTTP** — CDNs, proxies, LBs, HTTP/2, normal auth headers/cookies all work.
- ✅ **Auto-reconnect is built into the browser**, including `Last-Event-ID`: the client
  automatically re-sends the last event id it saw, so the server can **resume the stream without
  losing messages**. You get reconnect + resume *for free* — with WebSockets you hand-roll both.
- ✅ Lightweight: text frames over one long-lived response; on HTTP/2 many SSE streams multiplex
  over one TCP connection.
- ❌ **One-way only** (server → client). Client-to-server goes as normal POSTs on the side —
  which is *fine* for most "live updates" products.
- ❌ Text-only (base64 for binary), and on **HTTP/1.1** browsers cap ~6 connections per domain
  (HTTP/2 removes this).

> **Hook:** *"If data only flows one way — notifications, feeds, dashboards, LLM token streams —
> SSE gives you push with HTTP's whole ecosystem intact, plus free reconnect-and-resume. ChatGPT
> streams tokens over SSE, not WebSockets."*

---

## 4. WebSockets — "upgrade to a raw two-way pipe"

**Mechanics:** starts as an HTTP GET with `Upgrade: websocket` + a handshake; server replies `101
Switching Protocols`; from then on the TCP connection **stops being HTTP** and becomes a
**full-duplex, message-framed** channel (`ws://` / `wss://`). Either side sends at any time; frames
can be text or **binary**.

- ✅ **True bidirectional**, lowest per-message overhead (a few bytes of framing vs full HTTP
  headers), binary support. The only real choice for chat, multiplayer, collab editing (your
  whiteboard), trading UIs, signaling.
- ❌ **You leave HTTP-land.** Caching, standard auth-per-request, request logging, REST-ish LB
  routing all stop applying. Every proxy/LB in the path must understand the Upgrade and be
  configured with **long idle timeouts** (Nginx `proxy_read_timeout`, ALB idle timeout — the classic
  "my sockets die every 60s" bug).
- ❌ **You hand-roll everything SSE gave free:** heartbeats, reconnect with backoff, resume/replay
  (sequence numbers per channel), and often a fallback transport.
- ❌ Stateful long-lived connections — the entire scaling section below is the price.

> **Hook:** *"WebSockets buy full-duplex + binary at the cost of leaving HTTP — so I pay that cost
> only when the client genuinely talks back on the same channel at low latency."*

*(Adjacent, not interchangeable: **WebRTC** is for **media** — UDP, tolerates loss for latency; your
Mediasoup SFU. WebSockets typically carry its **signaling**. And **WebTransport**, over HTTP/3/QUIC,
is the up-and-coming datagram/stream option — name-drop, don't deep-dive.)*

---

## 5. The decision framework (say this in interviews)

| | Short poll | Long-poll | SSE | WebSocket |
|---|---|---|---|---|
| Direction | pull | pull (parked) | **server→client** | **both** |
| Protocol | HTTP | HTTP | HTTP (stream) | own protocol after Upgrade |
| Latency | worst (poll interval) | good | good | best |
| Per-message overhead | full request | full request | tiny frame | tiniest frame |
| Binary | – | – | no (text) | **yes** |
| Auto reconnect+resume | n/a | manual cursor | **built-in** (`Last-Event-ID`) | **hand-rolled** |
| Proxy/CDN/firewall friendliness | perfect | perfect | very good | needs config end-to-end |
| Use when | never (baseline) | fallback | one-way live updates | chat, games, collab, signaling |

**The rule:** *"Direction decides. One-way → SSE. Two-way interactive → WebSocket. Long-polling is
the compatibility fallback. And I don't upgrade to WebSockets for prestige — a notifications feed
on WebSockets is paying the stateful-scaling tax for a channel the client never talks on."*

---

## 6. Scaling: the moment you have more than one server

This is where the senior answer lives. A persistent connection means **the server holding your
socket is now special** — state (the connection itself) lives in a specific process. Three problems
follow:

### (a) Connection density & resources
Each connection ≈ a file descriptor + tens of KB of kernel/userland buffers. A tuned Node/Go box
handles **~100k–1M** connections (raise fd limits, tune keepalive) — but *mostly-idle* connections.
Do the math out loud: 10M concurrent users ÷ ~200k conns/box ≈ **50 gateway boxes**. Connections,
not CPU, are the scaling unit — so **split the gateway tier from business logic**: dumb
"connection gateway" servers hold sockets; stateless app services behind them do the work (your
NestJS gateway + services shape).

### (b) Routing & the "who holds user X?" problem
- **LB choice:** WebSockets need an LB that supports Upgrade (L7: Nginx/ALB) or plain TCP
  passthrough (L4). Use **least-connections**, not round-robin — long-lived conns pile up unevenly.
  After the handshake the connection is inherently "sticky" (it's one TCP stream); what you must
  avoid is *requiring* session affinity for correctness — any gateway should be able to serve any
  user who reconnects.
- **The fan-out problem:** user A (socket on gateway 3) messages user B (socket on gateway 17).
  Gateway 3 must reach gateway 17. Two standard shapes:
  1. **Pub/sub backbone** — every gateway subscribes to channels (per-room, per-user) on
     **Redis pub/sub / Kafka / NATS**; a message is published once and each gateway holding a
     relevant socket delivers it. Simple, the default. (Your NestJS + Redis adapter *is* this.)
  2. **Connection registry** — a store mapping `userId → gateway` so senders route point-to-point.
     More precise, more moving parts; used when broadcast channels get too noisy.
- **Presence** ("who's online?") = connection state + TTL'd heartbeat keys in Redis, *not* a DB
  column — servers crash without goodbye.

### (c) Lifecycle: heartbeats, reconnects, and the stampede
- **Heartbeats (ping/pong)** both detect dead peers (mobile networks drop silently — TCP won't tell
  you for minutes) and keep intermediaries from idle-killing the connection. Typical: ping every
  ~30s, kill after 2 missed.
- **Reconnect storm / thundering herd:** a gateway restart or LB blip disconnects 200k clients
  **at once**; naive clients all reconnect in the same second and DDoS you — repeatedly, in waves.
  Fix: client reconnect with **exponential backoff + jitter**, server-side connection-rate limits,
  and rolling deploys that **drain** gateways (stop accepting, let clients migrate) instead of
  killing them.
- **Delivery guarantees:** a socket delivers to a *connected* client only. For "user was offline /
  between reconnects," you need **sequence numbers per channel + replay from a store** on reconnect
  ("I have up to seq 42") — i.e., you end up rebuilding `Last-Event-ID` by hand, backed by Redis
  streams/Kafka retention. Say explicitly: *"WebSocket ≠ message queue; durability comes from the
  layer behind it."*
- **Backpressure:** a slow client on a fast stream fills the server's send buffer → memory balloons.
  Bound per-connection queues; drop/coalesce (dashboards: send latest state, not every tick) or
  disconnect chronic laggards.

---

## 7. Map it to YOUR systems (interview gold)

- **NestJS/Redis real-time messaging:** you already run the canonical architecture — Socket.IO
  gateways + **Redis pub/sub adapter** as the fan-out backbone. Formalize it: *"gateways are the
  stateful edge, Redis pub/sub decouples which gateway holds which socket, services stay
  stateless."* Add the war-story details: heartbeat tuning, and what your reconnect/backfill story
  is (sequence + replay).
- **Mediasoup SFU:** perfect contrast answer — *"media went over **WebRTC/UDP** because real-time
  video tolerates loss but not latency; **WebSockets carried only signaling** (join, offer/answer,
  ICE). Different tools per channel in the same product."*
- **10k+ IoT devices:** persistent conns at fleet scale = fd limits, multi-core workers
  (`cluster`/SO_REUSEPORT), heartbeat intervals as a battery/traffic trade-off, and reconnect
  jitter after a broker restart (you've *lived* the thundering herd). MQTT vs WebSocket framing is
  a nice aside.
- **Offline-first PWA (CHESA):** why you *didn't* hold sockets — sync on reconnect with a cursor
  is long-polling's cousin; not everything needs a live pipe.

---

## 8. The traps that catch people

1. **"WebSockets are just better" — no *why*.** The senior answer picks by **direction + interactivity**
   and names the tax: leaving HTTP, hand-rolled reconnect/resume, stateful gateways. SSE for one-way
   is the answer interviewers are fishing for with notification/feed/LLM-streaming questions.
2. **Forgetting intermediaries.** Proxies/LBs idle-kill long connections (~60s defaults) → the
   "mystery disconnect" bug. Heartbeats + raised idle timeouts, end to end.
3. **Sticky-session correctness.** If a user *must* return to gateway 7 or things break, you've
   built a fragile system. Any gateway must serve any reconnect; shared state (Redis) makes that true.
4. **Assuming the socket delivers.** No queue, no durability, no offline story. Sequence numbers +
   replay-on-reconnect from a real store, or you silently lose messages exactly when networks flap.
5. **No reconnect-storm plan.** Backoff **with jitter**, rate-limited accepts, drain-then-deploy.
   One restarted gateway must not become an outage.
6. **Round-robin for long-lived conns.** Balances *arrival*, not *load* — use least-connections;
   watch for old gateways staying full while new ones idle after scale-out (connection rebalancing).
7. **Ignoring fan-out cost.** 1 message to a 10k-member room = 10k socket writes spread across
   gateways — the pub/sub backbone and per-connection backpressure are where dashboards melt.

---

## 9. The whole day on one page (say it out loud)

> *"HTTP is client-pull; real-time needs server-push, and the options form a ladder. **Short polling**
> is the strawman — latency AND wasted load. **Long-polling** parks a request at the server until data
> arrives — pure HTTP, works everywhere, one message per round-trip — the compatibility fallback.
> **SSE** holds one HTTP response open and streams events down it — one-way only, but it keeps the
> whole HTTP ecosystem AND gives free auto-reconnect with `Last-Event-ID` resume, so it's my default
> for notifications, feeds, dashboards, LLM token streams. **WebSockets** upgrade the connection out
> of HTTP into a full-duplex binary pipe — the right call when the client genuinely talks back at low
> latency: chat, collab, games, signaling — but the price is leaving HTTP (proxy/LB config, no free
> reconnect or resume) and **stateful gateways**. At scale I split a connection-gateway tier from
> stateless services, route with least-connections, fan out through a **Redis/Kafka pub/sub backbone**
> so no gateway needs to know who holds which socket, run **heartbeats** to detect dead peers and defeat
> idle timeouts, and plan for the **reconnect storm** with backoff-plus-jitter and drained deploys.
> And because a socket isn't a queue, delivery guarantees come from sequence numbers and
> replay-on-reconnect backed by a durable log — I built exactly this shape with NestJS gateways over
> Redis pub/sub, and for video the answer wasn't WebSockets at all: media rode WebRTC/UDP, sockets
> only carried signaling."*

**Why it matters next:** the messages flowing down these sockets need identities — next building
block: **distributed locking (Redis Redlock and its criticisms)**, then **unique ID generation
(Snowflake)**: minting IDs that are unique, time-sortable, and shard-friendly without a central
bottleneck.
