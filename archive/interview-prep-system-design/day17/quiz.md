# SD Day 17 — Quiz: WebSockets vs SSE vs Long-Polling at Scale

*Answer each OUT LOUD, in your own words, before expanding. This is your domain — the bar is higher:
you should be able to defend WHY (Q3, Q4), do the multi-server story cold (Q6, Q7), and tell the
war-story versions (Q10). "Direction decides" is the framework; the scaling section is the senior
signal.*

---

**Q1. Why doesn't plain HTTP work for real-time, and why is short polling a bad fix?**

<details><summary>answer</summary>

HTTP is **client-pull**: request → response → done; the server can't initiate. Real-time needs
**server-push** the moment an event happens. Short polling ("anything new?" every N seconds) is the
worst of both worlds: **latency up to N seconds** AND **wasted load** — most polls return empty.
At 1M users polling every 2s that's 500k QPS of mostly-empty responses. It's the baseline you name
only to dismiss.
</details>

---

**Q2. How does long-polling work, and what is it good for today?**

<details><summary>answer</summary>

Client sends a normal HTTP request; the server **parks it** and only responds when data arrives (or a
~30–60s timeout). The client processes and **immediately re-requests**, so one request is always
pending. It's **pure HTTP** — works through every proxy/firewall/browser — which makes it the
**compatibility fallback** (why Socket.IO has it). Costs: one message per round-trip, full headers
each time, and a gap between polls that requires a **cursor** ("everything after msg 42") so nothing
is lost.
</details>

---

**Q3. How does SSE work, and what two things does it give you that WebSockets make you build yourself?**

<details><summary>answer</summary>

One long-lived GET; server responds `Content-Type: text/event-stream` and keeps writing `data:`
frames down the same open response. It stays **inside HTTP** (proxies, CDNs, auth, HTTP/2 multiplexing
all keep working). Free gifts: (1) **automatic reconnection** in the browser (`EventSource`), and
(2) **resume via `Last-Event-ID`** — the client re-sends the last event id, the server replays what
was missed. Limits: **one-way** (server→client), text-only, ~6-connection cap per domain on HTTP/1.1
(fixed by HTTP/2).
</details>

---

**Q4. What do WebSockets actually buy, and what's the full price you pay?**

<details><summary>answer</summary>

Buy: after an HTTP `Upgrade` handshake (`101 Switching Protocols`) you get a **full-duplex,
message-framed, binary-capable** pipe with a few bytes of per-message overhead — the only real choice
for chat, multiplayer, collab editing, signaling. Price: you **leave HTTP** — caching, per-request
auth, standard LB routing stop applying; every proxy/LB must support Upgrade and have long idle
timeouts; and you **hand-roll** what SSE gave free: heartbeats, reconnect with backoff, resume/replay
via sequence numbers, plus often a fallback transport. And the connections make your servers
**stateful**.
</details>

---

**Q5. The decision framework: which transport for (a) a notification feed, (b) chat, (c) live sports
scores, (d) LLM token streaming, (e) video calls?**

<details><summary>answer</summary>

**Direction decides.** (a) Notifications: one-way → **SSE**. (b) Chat: two-way interactive →
**WebSocket**. (c) Sports scores: one-way broadcast → **SSE** (CDN-friendly). (d) LLM tokens: one-way
stream per request → **SSE** (what ChatGPT uses). (e) Video calls: **neither** — media goes
**WebRTC/UDP** (loss-tolerant, latency-critical); WebSockets carry only the **signaling**. Bonus
line: "I don't pay the stateful WebSocket tax for a channel the client never talks on."
</details>

---

**Q6. You have 50 gateway servers. User A's socket is on gateway 3, user B's on gateway 17. How does
A's message reach B?**

<details><summary>answer</summary>

The **fan-out problem** — a gateway can only write to sockets it holds. Standard answer: a **pub/sub
backbone** (Redis pub/sub, Kafka, NATS): every gateway subscribes to the channels (per-room/per-user)
of the sockets it holds; gateway 3 **publishes once**, gateway 17 receives and writes to B's socket.
No gateway needs to know where anyone is connected. Alternative: a **connection registry**
(`userId → gateway`) for point-to-point routing when broadcast gets too noisy. Architecture shape:
**dumb stateful gateway tier** (holds sockets) + **stateless services** behind it.
</details>

---

**Q7. Why heartbeats? And what's the reconnect-storm problem and its fixes?**

<details><summary>answer</summary>

Heartbeats (ping/pong ~30s) do two jobs: **detect silently dead peers** (mobile drops don't send FIN;
TCP takes minutes to notice) and **keep proxies/LBs from idle-killing** the connection (~60s default
timeouts — the classic "sockets mysteriously die" bug). Reconnect storm: one gateway restart drops
200k clients at once; naive clients all reconnect the same second → self-DDoS in waves. Fixes:
client-side **exponential backoff + jitter**, server-side connection-rate limiting, and
**drain-then-deploy** (stop accepting, let clients migrate, then kill the process).
</details>

---

**Q8. A user was disconnected for 30 seconds during a chat. How do you make sure they missed nothing?
What's the principle?**

<details><summary>answer</summary>

Principle: **a socket is not a message queue** — it only delivers to connected clients; durability
must come from the layer behind it. Implementation: **sequence numbers per channel** + a durable
buffer (Redis Streams / Kafka retention / DB); on reconnect the client says "I have up to seq 42" and
the server **replays** 43+. (This is hand-rolling what SSE's `Last-Event-ID` does natively.) Related:
presence = TTL'd heartbeat keys in Redis, because servers crash without saying goodbye.
</details>

---

**Q9. What load-balancing and resource details change when connections are long-lived?**

<details><summary>answer</summary>

**LB:** must speak Upgrade (L7) or pass TCP through (L4); use **least-connections**, not round-robin —
round-robin balances *arrivals*, but long-lived connections pile up unevenly; after scale-out, old
gateways stay full while new ones idle (consider rebalancing/disconnecting slowly). Correctness must
not *require* stickiness — any gateway serves any reconnect (shared state in Redis). **Resources:**
each conn = an fd + tens of KB of buffers; a tuned box holds ~100k+ mostly-idle conns — so estimate:
10M concurrent ÷ 200k/box ≈ 50 gateways. Also: **backpressure** — bound per-connection send queues,
coalesce updates (send latest state, not every tick), drop chronic laggards.
</details>

---

**Q10 (interview close). In 30 seconds: the three transports and how you scaled them in production?**

<details><summary>answer</summary>

"Real-time means server-push, and direction decides the transport: **long-polling** is push faked
with parked HTTP requests — the compatibility fallback; **SSE** streams one-way over a held-open
HTTP response with free reconnect-and-resume — my default for feeds, notifications, token streams;
**WebSockets** upgrade out of HTTP to a full-duplex binary pipe — for chat and collab, at the cost of
stateful gateways and hand-rolled reconnect, heartbeat, and replay. In production I ran NestJS
Socket.IO gateways with a **Redis pub/sub backbone** so no gateway needed to know who held which
socket, heartbeats to beat idle timeouts, backoff-with-jitter for reconnect storms, and
sequence-plus-replay for missed messages. And for video I didn't use WebSockets at all — media rode
**WebRTC/UDP** through a Mediasoup SFU; sockets carried only signaling."
</details>

---

> Next (building blocks): **distributed locking** — Redis Redlock, why it's controversial (Kleppmann's
> critique, fencing tokens), and when a lock is the wrong tool — then **unique ID generation
> (Snowflake)** for the messages these sockets carry.
