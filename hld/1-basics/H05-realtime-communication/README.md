# H05 · Real-time: polling, SSE, WebSockets

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/1-basics/H05-realtime-communication/demo.ts`)
> **Builds on:** [H03 Networking basics](../H03-networking-basics/) · [H04 API design](../H04-api-design/) · **Used in:** [Chat system](../../case-studies/06-chat-system/README.md), [Live comments](../../case-studies/27-live-comments/README.md), [Ride hailing](../../case-studies/10-ride-hailing/README.md), [Food delivery](../../case-studies/11-food-delivery/README.md), [Collaborative editor](../../case-studies/25-collaborative-editor/README.md), [Notification system](../../case-studies/05-notification-system/README.md)

## The idea in one line

HTTP is client-pull, so to push from the server you either ask again and again (polling), park a request until there is data (long polling), keep one response open and stream into it (SSE), or upgrade to a two-way pipe (WebSocket). **Direction decides the transport.**

## Why it matters (the problem it solves)

A chat message, a driver's location or a payment status changes on the server. The client must see it within a second. Plain short polling every 2 s from 1 M users is 500 k requests per second, and almost all of them come back "nothing new".

The push options remove that waste, but they bring long-lived connections. Long-lived connections make your servers **stateful**: a message for user B can only be written by the one server that holds B's socket. Scaling that is the real interview question.

## How it works

### 1. The four transports

```
Short poll : C→S ?   C→S ?   C→S ? (data)        up to N s late, most answers empty
Long poll  : C→S ?........(held)........data  C→S ?.....     one HTTP request per message
SSE        : C→S GET /events   ←ev   ←ev   ←ev               one response, server → client only
WebSocket  : C→S Upgrade ←101   →msg ←msg ←msg →msg           one TCP connection, both ways
```

1. **Short polling.** `GET /updates?since=t` every N seconds. Stateless and simple. Delay is up to N seconds; most responses are empty.
2. **Long polling.** The server holds the request until data arrives or a ~30 s timeout, then answers; the client re-requests at once. Pure HTTP, so it passes every proxy. That is why Socket.IO uses it as a fallback. The client must send a cursor ("after id 42") so nothing falls in the gap between requests.
3. **Server-Sent Events.** One `GET` answered with `Content-Type: text/event-stream`; the server keeps writing `id: 43\ndata: {...}\n\n`. Server to client only, text only. Two free gifts: the browser's `EventSource` **reconnects by itself**, and it sends **`Last-Event-ID`** so the server can replay what was missed.
4. **WebSocket.** The client sends `GET` with `Upgrade: websocket`; the server answers `101 Switching Protocols`. After that, both sides send small frames (2 to 14 bytes of header) at any time. Binary is fine. But you leave HTTP: no HTTP caching, no per-request auth, and you write heartbeats, reconnect and replay yourself.

### 2. Side by side

| | Short poll | Long poll | SSE | WebSocket |
|---|---|---|---|---|
| Direction | Client pulls | Client pulls, server answers when ready | Server → client | Both ways |
| Delay | Up to the interval | ~1 network trip | ~1 network trip | ~1 network trip |
| Wasted work | Many empty responses | New request per message + timeouts | None | Tiny heartbeat frames |
| Server state | None | Held request | Open response | Open socket + registry |
| Proxies / firewalls | Always fine | Always fine | Fine (turn off proxy buffering) | Most; LB must allow Upgrade and long idle |
| Binary | Yes | Yes | No (UTF-8 text) | Yes |
| Reconnect + resume | n/a | Client code + cursor | Built in (`Last-Event-ID`) | Client code + sequence numbers |

### 3. Pick by direction

| Use case | Pick | Why |
|---|---|---|
| Job status, admin dashboard | Short poll every 10 to 30 s | Rare updates, zero infra |
| Notifications, live scores, stock ticker | SSE | One way, plain HTTP, free resume |
| LLM token streaming (ChatGPT style) | SSE | One stream per request |
| Chat, multiplayer, collaborative editing | WebSocket | Frequent messages both ways |
| Driver location (Uber, Ola) | WebSocket (or MQTT on mobile) | Client sends every few seconds, server pushes back |
| Video calls | WebRTC over UDP for media | WebSocket only for signaling |
| App in background or closed | Mobile push (FCM / APNs) | No socket exists |

### 4. Scaling WebSockets (the senior part)

```
 phones ──WSS──▶ [ L4/L7 LB: least-conn, idle timeout > heartbeat ]
                     │                │                 │
                 Gateway 1        Gateway 2         Gateway 3       ← stateful: hold sockets only
                 sockets: A       sockets: B, D     sockets: C
                     │ PUBLISH user:B   ▲ SUBSCRIBE user:B
                     └──────▶ [ Redis pub/sub / NATS / Kafka ] ◀────┘
                                      │
                       chat-svc (stateless) ──▶ DB (messages, seq per conversation)
```

- **Gateway tier.** Dumb, stateful servers that only hold sockets. Business logic lives in stateless services behind them.
- **Routing a message to the right gateway.** Two standard answers:
  - **Pub/sub backbone:** each gateway subscribes to channels for the users (or rooms) it holds. Gateway 1 publishes once to `user:B`; Gateway 2 receives it and writes to B's socket. No one needs to know where B is. This is the Socket.IO Redis adapter.
  - **Connection registry:** Redis hash `userId → gatewayId` with a TTL refreshed by heartbeats. The service looks up B's gateway and sends directly. Better when broadcast traffic gets noisy at scale.
- **Store first, then push.** Save the message with a sequence number before pushing. A socket is not a queue. If the push is lost, the client gets it on reconnect.
- **Reconnect and replay.** On reconnect the client says "I have up to seq 42"; the server replays 43 onwards from the DB or a Redis Stream. This is what SSE's `Last-Event-ID` gives you for free.
- **Heartbeats.** Ping/pong every 20 to 30 s. Two jobs: detect dead peers (a phone in a lift sends no FIN; TCP can take minutes to notice), and keep LBs and NATs from closing idle connections (AWS ALB idle timeout is 60 s by default).
- **Reconnect storms.** One gateway restart drops 100 k sockets. If they all reconnect in the same second they DDoS the LB and the auth service. Fix: exponential backoff **with jitter** on the client, connection-rate limits on the server, and drain-then-deploy (stop accepting, let clients move slowly, then kill).
- **Load balancing.** Use **least-connections**, not round robin. Round robin balances new arrivals, but connections live for hours, so old servers stay full while new ones sit empty after a scale-out. Correctness must not need sticky sessions: any gateway must serve any reconnect.
- **Backpressure.** Bound each connection's send queue. For fast-changing state (a driver's location), send the latest value and drop old ones. Disconnect clients that stay too far behind.
- **Auth.** Authenticate on the upgrade request with a short-lived token (cookie or first message; avoid long-lived tokens in the URL, which gets logged). Close the socket when the token expires.

### 5. Capacity math

Plan WebSocket servers by **concurrent connections**, not QPS. Each connection costs a file descriptor plus roughly 10 to 50 KB of buffers.

- 10 M concurrent users / 100 k per gateway = 100 gateways, plus ~30% headroom so the others can absorb a failed one.
- Heartbeats alone: 10 M / 30 s = ~333 k tiny frames per second. Cheap, but not free.

## In TypeScript

An SSE endpoint with resume, using only `node:http`:

```ts
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
  const lastId = Number(req.headers['last-event-id'] ?? 0);
  for (const m of log.filter((m) => m.id > lastId)) res.write(`id: ${m.id}\ndata: ${m.text}\n\n`); // replay
  const sub = (m: Msg) => res.write(`id: ${m.id}\ndata: ${m.text}\n\n`);
  bus.on('msg', sub);
  req.on('close', () => bus.off('msg', sub));
});
```

Cross-gateway delivery with pub/sub (the shape of the Socket.IO Redis adapter):

```ts
class Gateway {
  private sockets = new Map<string, Socket>();
  constructor(private bus: PubSub) {}
  connect(userId: string, s: Socket) {
    this.sockets.set(userId, s);
    this.bus.subscribe(`user:${userId}`, (msg) => this.sockets.get(userId)?.send(msg));
  }
  send(to: string, msg: string) { this.bus.publish(`user:${to}`, msg); } // works for any gateway
}
```

[demo.ts](demo.ts) runs a polling-vs-push cost comparison, three gateways joined by an in-memory pub/sub, a reconnect with sequence replay, and a jitter vs no-jitter reconnect storm.

## Trade-offs / when NOT to use it

| Option | Use when | Avoid when |
|---|---|---|
| Short polling | Updates are rare and a few seconds of delay is fine | You need sub-second updates for many users |
| Long polling | Streams are blocked, or as a fallback | You send many messages per second (one request each) |
| SSE | Server to client only | Client also sends often, or you need binary |
| WebSocket | Frequent two-way messages | Updates are one-way or rare (you pay the stateful tax for nothing) |
| Mobile push | App is closed or in background | You need guaranteed or instant delivery |

## Common mistakes

- Choosing WebSockets for a notification bell that only ever receives. SSE is simpler and stays inside HTTP.
- Treating the socket as the source of truth. Messages must be stored first, with sequence numbers, and replayed on reconnect.
- No heartbeats, then "sockets die every 60 seconds" because the LB idle timeout closes them.
- Round-robin LB for long-lived connections, and needing sticky sessions for correctness.
- Clients reconnecting immediately with no jitter. One deploy becomes a self-DDoS.
- Forgetting that a user can have several devices on several gateways (pub/sub handles it; a single-value registry does not).
- Saying "WebSockets for video". Media goes over WebRTC (UDP); sockets carry only signaling.

## Say this in the interview

> "Direction decides. For one-way updates like notifications or live scores I'd use SSE: plain HTTP, the browser reconnects by itself and resumes with Last-Event-ID. For chat, where both sides send often, I'd use WebSockets."

> "The WebSocket gateways are stateful, so I keep them thin and put logic in stateless services. Each gateway subscribes to a Redis pub/sub channel per connected user. To deliver, the chat service saves the message with a sequence number, then publishes to `user:B`, and whichever gateway holds B writes it to the socket. If B is offline we send an FCM or APNs push."

> "Heartbeats every 30 seconds detect dead phones and keep the load balancer from closing idle sockets. Clients reconnect with exponential backoff and jitter, send their last sequence number, and we replay the gap from storage. For capacity I plan by concurrent connections: 10 million users at about 100k per box is roughly 100 gateways plus headroom."

## Your experience hook

- **IoT platform, 10k+ devices:** you scaled WebSocket servers horizontally behind Nginx with IP-hash, and used the **Redis adapter** to broadcast across instances. That is section 4 exactly. Add: "Today I'd use least-conn and make correctness independent of stickiness."
- **Video SFU (Mediasoup):** Socket.IO over WSS for signaling only; media over WebRTC/UDP through the SFU. Great answer to "WebSockets for video?".
- **Scale story:** "To go 10x I'd sync signaling state with Redis pub/sub across instances and shard rooms across media servers."

## Numbers to remember

| Thing | Number |
|---|---|
| Idle WebSocket connections per tuned server | 100 k+ (plan 50 k to 100 k, load-test) |
| Memory per connection | ~10 to 50 KB |
| Heartbeat interval | 20 to 30 s |
| Default LB idle timeout (AWS ALB) | 60 s |
| Long-poll hold time | 20 to 30 s |
| HTTP/1.1 connections per host (limits SSE) | ~6 (HTTP/2 removes this) |
| WebSocket frame header | 2 to 14 bytes |
| 1 M users polling every 2 s | 500 k req/s, mostly empty |

## Self-test

<details><summary>1. Pick a transport for: notifications, chat, live scores, LLM tokens, video calls.</summary>

Notifications: SSE. Chat: WebSocket. Live scores: SSE. LLM tokens: SSE. Video calls: WebRTC over UDP for media, WebSocket only for signaling.
</details>

<details><summary>2. A is on gateway 3 and B is on gateway 17. How does A's message reach B?</summary>

Gateway 17 subscribed to `user:B` when B connected. The chat service stores the message, then publishes to `user:B`; the pub/sub layer delivers it to gateway 17, which writes to B's socket. Alternative: look up `userId → gateway` in a Redis registry and send directly.
</details>

<details><summary>3. Why heartbeats, if TCP already has keepalive?</summary>

TCP keepalive defaults are hours, and a phone that loses signal sends no FIN. App-level ping/pong every ~30 s detects dead peers quickly (so you clean up the registry and fall back to push) and keeps LBs and NATs from closing the idle connection.
</details>

<details><summary>4. A user was offline for 30 seconds. How do you make sure they missed nothing?</summary>

Every message is stored with a per-conversation sequence number before it is pushed. On reconnect the client sends its last seq; the server replays everything after it. The socket is only a delivery path.
</details>

<details><summary>5. A gateway with 100k sockets restarts. What goes wrong and how do you fix it?</summary>

100k clients reconnect in the same second and overload the LB and auth service (a reconnect storm). Fix: exponential backoff with random jitter in clients, connection-rate limits, and drain-then-deploy so clients leave gradually.
</details>

<details><summary>6. Why least-connections instead of round robin for WebSockets?</summary>

Round robin balances new connections, not current load. Connections live for hours, so after a scale-out the old servers stay full and the new ones stay empty. Least-connections sends new sockets to the emptiest server.
</details>

<details><summary>7. What does SSE give you for free that WebSockets do not?</summary>

Automatic reconnection in the browser, and resume via the `Last-Event-ID` header. It also stays inside HTTP, so normal auth, proxies and HTTP/2 multiplexing keep working.
</details>

<details><summary>8. How many gateways for 10 M concurrent users?</summary>

At ~100k connections per box, 100 gateways, plus ~30% headroom for failures and deploys, so about 130.
</details>

## Go deeper

- Next: [H06 Proxies, reverse proxies and the API gateway](../H06-proxies-api-gateway/) (where the WebSocket upgrade passes through).
- [H08 Load balancing](../../2-scaling/H08-load-balancing/) (least-conn, L4 vs L7, idle timeouts).
- [H20 Message queues](../../4-async/H20-message-queues/) (pub/sub backbones: Redis, Kafka, NATS).
- Case studies: [Chat system](../../case-studies/06-chat-system/README.md), [Live comments](../../case-studies/27-live-comments/README.md).
- LLD: [Pub/sub queue](../../../lld/problems/15-pub-sub-queue/README.md).
- Archive notes: [hld-parts/part1.md](../../../archive/notes/hld-parts/part1.md) ("WebSockets vs HTTP"), [hld-parts/part7.md](../../../archive/notes/hld-parts/part7.md) ("Real-Time Updates").
- RFC 6455 (The WebSocket Protocol); *High Performance Browser Networking*, chapters on WebSocket and SSE.
