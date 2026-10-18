# 05 · Real-time Communication: Polling, SSE, WebSockets

> **Read time:** 30 min · **Visual:** [v14 polling, SSE and WebSockets](../../visuals/v14-realtime-transport.html) · **Code it:** none
> **Shows up in:** [chat system](../problems/06-chat-system/README.md), [live comments](../problems/27-live-comments/README.md), [ride hailing](../problems/10-ride-hailing/README.md) (driver location), [food delivery](../problems/11-food-delivery/README.md) (order tracking), [collaborative editor](../problems/25-collaborative-editor/README.md)

## The idea in one line

HTTP is request-response, so for server-to-client updates you either ask repeatedly (polling), hold a request open (long polling), keep a one-way stream (SSE), or keep a two-way connection (WebSocket).

## The problem it solves

A chat message, a driver's location or a payment status change happens on the server. The client must learn about it within a second or two. Plain short polling every second from 10 M clients is 10 M requests/s, nearly all returning "nothing new". The real-time options cut that waste, at the cost of long-lived connections that are harder to scale.

## How it works

1. **Short polling.** Client calls `GET /updates?since=t` every N seconds. Simple and stateless. Latency is up to N seconds; most responses are empty.
2. **Long polling.** Client calls `GET /updates`; the server holds the request until there is data or a timeout (e.g. 30 s), then the client reconnects at once. Near real-time, works through any proxy, but each message costs a new HTTP request.
3. **Server-Sent Events (SSE).** Client opens `GET /stream` with `Accept: text/event-stream`. The server keeps writing `data: ...\n\n` events on the same response. One direction only (server → client). Built-in auto-reconnect and `Last-Event-ID` so the server can resume.
4. **WebSocket.** Client sends an HTTP `Upgrade: websocket` request; after `101 Switching Protocols`, both sides send frames at any time on one TCP connection. Full duplex, low overhead per message.

```
Short poll : C->S ? ... C->S ? ... C->S ? (data)
Long poll  : C->S ?.........(held).........data  C->S ?....
SSE        : C->S open  <-ev  <-ev  <-ev  (one way)
WebSocket  : C<->S upgrade  ->msg <-msg <-msg ->msg (two way)
```

### Side by side

| | Short poll | Long poll | SSE | WebSocket |
|---|---|---|---|---|
| Direction | Client pulls | Client pulls | Server → client | Both ways |
| Latency | Up to the interval | ~Instant | ~Instant | ~Instant |
| Connection | New request each time | Held, then new | One long HTTP response | One long TCP connection |
| Server state | None | Held request | Open stream | Open socket + registry |
| Through proxies/firewalls | Always | Always | Usually (plain HTTP) | Usually; some old proxies break upgrades |
| Binary data | Yes | Yes | No (text, UTF-8) | Yes |
| Auto-reconnect | n/a | Client code | Built into `EventSource` | Client code |

### Scaling WebSockets (the real interview question)

- **Connection servers ("gateways")** hold the sockets. They are stateful: each knows which users are connected to it.
- **A session registry** (Redis: `userId → gatewayId`) records where each user is connected.
- **Fan-out.** To deliver to user B, a service looks up B's gateway and sends the message there, either directly or through **pub/sub** (Redis pub/sub, Kafka, NATS), where each gateway subscribes to its own channel or to the room channels it serves.
- **Load balancer.** Must support long-lived connections and upgrades (ALB, NLB, Nginx with the right timeouts). Use least-connections, not round robin.
- **Heartbeats.** Ping/pong every ~30 s to detect dead connections and keep NAT/LB idle timeouts from closing them.
- **Reconnect.** Clients reconnect with exponential backoff plus jitter, and send their last received message id so the server can replay missed messages from storage. The socket is a delivery path, not the source of truth.
- **Deploys.** Draining a gateway drops thousands of connections at once. Drain slowly and spread reconnects with jitter.

## Numbers to remember

- One well-tuned server can hold **hundreds of thousands** of mostly idle WebSocket connections; the limits are memory per connection, file descriptors and the kernel. Plan with a conservative number (e.g. 50k–100k per node) and load-test.
- Heartbeat interval: **~20–60 s**. Many LBs close idle connections after ~60 s by default (AWS ALB idle timeout defaults to 60 s).
- Long-poll hold time: **~20–30 s**.
- Browsers limit HTTP/1.1 to **~6 connections per host**, which also limits SSE over HTTP/1.1. HTTP/2 removes this.

## Trade-offs

| Option | Use when | Weakness |
|---|---|---|
| Short polling | Updates are rare and seconds of delay are fine (job status, dashboards) | Wasted requests; delay up to the interval |
| Long polling | You need near real-time but WebSockets are blocked | A new request per message; held connections still use resources |
| SSE | Server → client only: live scores, notifications, LLM token streams, stock tickers | One way; text only; HTTP/1.1 connection limit |
| WebSocket | Two-way and frequent: chat, games, collaborative editing, driver location | Stateful servers, harder LB, reconnect and fan-out logic |
| Mobile push (APNs/FCM) | App is in the background or closed | Not guaranteed or instant; payload limits |

## In real systems

- **WhatsApp, Slack, Discord:** persistent connections to gateway servers, with a registry of which user is on which gateway. Slack and Discord use WebSockets; WhatsApp uses its own protocol over long-lived TCP connections.
- **Uber/Ola driver apps:** send location every few seconds over a persistent connection; riders get updates pushed back.
- **Swiggy/Zomato order tracking:** server push for status changes, with mobile push notifications when the app is in the background.
- **ChatGPT-style token streaming:** usually SSE.

## What to say in the interview

"Clients keep a WebSocket to a gateway fleet behind an L4 load balancer. When a user connects, the gateway writes `userId → gatewayId` to Redis with a TTL that heartbeats refresh. To deliver a message, the chat service stores it first, then looks up the receiver's gateway and publishes to that gateway's channel. If the user is offline, we send an FCM/APNs push. On reconnect the client sends its last message id and we replay from the database, so a dropped socket never loses a message."

## Common follow-ups

<details><summary>Why not just use WebSockets everywhere?</summary>

They are stateful. You need sticky routing, connection registries, careful deploys and reconnect logic. If updates are one-way, SSE is simpler and uses plain HTTP. If updates are rare, polling is simplest and cheapest to operate.
</details>

<details><summary>A gateway with 100k connections crashes. What happens?</summary>

All 100k clients reconnect. Spread them with exponential backoff and jitter so they don't stampede the LB and auth service. They land on other gateways, which update the registry. Messages sent during the gap are in the database and get replayed by last-seen id. Stale registry entries expire by TTL.
</details>

<details><summary>How do you send one message to a group of 10,000 members?</summary>

Store it once. Fan out by gateway, not by user: find the set of gateways that have members of the group online and send one copy to each, and let each gateway deliver locally. For very large rooms (live comments), sample or batch messages. See [live comments](../problems/27-live-comments/README.md).
</details>

<details><summary>How do you authenticate a WebSocket?</summary>

Authenticate during the HTTP upgrade request: a short-lived token in a cookie or in the first message (browsers cannot set custom headers on the WebSocket constructor; avoid long-lived tokens in the URL because URLs get logged). The gateway validates it once and ties the connection to the user id. Re-check or close the socket when the token expires.
</details>

## Self-test (answer before opening)

<details><summary>1. A food delivery app shows order status that changes ~6 times in 40 minutes. Which transport?</summary>

SSE or even polling every 10–15 s is enough while the screen is open, plus mobile push when the app is in the background. WebSockets are overkill for six one-way updates.
</details>

<details><summary>2. Why do you need heartbeats on a WebSocket?</summary>

TCP does not tell you quickly when the other side vanishes (a phone loses signal). Heartbeats detect dead connections so you can clean up the registry, and they keep LBs and NATs from closing idle connections.
</details>

<details><summary>3. Why should the message be saved before being pushed on the socket?</summary>

The socket can drop at any time. If the database is the source of truth, a client that missed the push gets the message on reconnect by asking for everything after its last id. Push-only means lost messages.
</details>

## Go deeper

- *High Performance Browser Networking* (Ilya Grigorik): "WebSocket" and "Server-Sent Events" chapters
- RFC 6455 (The WebSocket Protocol)
- Related: [networking basics](./03-networking-basics.md), [load balancing](./07-load-balancing.md), [message queues](./17-message-queues.md)
- Older notes in this repo: `archive/notes/hld-parts/part1.md`, section "WebSockets vs HTTP"; `archive/notes/hld-parts/part7.md`, "3. Real-Time Updates (WebSocket/Long Polling)"
