# H03 · Networking: DNS, TCP/UDP, HTTP, TLS

> **Time:** ~40 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/1-basics/H03-networking-basics/demo.ts`)
> **Builds on:** [H02 Back-of-the-envelope estimation](../H02-back-of-envelope/README.md) (latency numbers) · **Used in:** "what happens when you type a URL", every latency question, [Chat system](../../case-studies/06-chat-system/README.md), [Video streaming](../../case-studies/14-video-streaming/README.md), [Live comments](../../case-studies/27-live-comments/README.md), and as the base for [H06 Proxies and API gateway](../H06-proxies-api-gateway/README.md) and [H08 Load balancing](../../2-scaling/H08-load-balancing/README.md)

## The idea in one line

A request goes **DNS lookup → TCP (or QUIC) connection → TLS handshake → HTTP request → response**; each step costs round trips, and most latency work is about **removing, shortening or reusing those round trips**.

## Why it matters (the problem it solves)

Interviewers use networking to see if you know where time goes. A Mumbai ↔ us-east round trip is ~200 ms. A new HTTPS connection needs ~3 round trips before the first byte, so that is ~600 ms before your server does anything. This one fact explains keep-alive, connection pools, CDNs, HTTP/2, gRPC, regional deployments and why real-time media uses UDP.

## How it works

### The life of a request

```
Browser          Resolver          root/.in/auth           Server
   | -- A? api ----> |                    |                    |
   |                 | -- walk the tree ->|                    |   cold: 20–100 ms
   | <-- 13.2.4.5 -- | <-- A, TTL 300 --- |                    |   then cached for TTL
   | ------------------------- SYN -------------------------->  |
   | <------------------------ SYN-ACK ----------------------   |   1 RTT  (TCP)
   | ------------------------- ACK + ClientHello ----------->   |
   | <------------------------ ServerHello, cert, Finished --   |   1 RTT  (TLS 1.3; 1.2 = 2 RTT)
   | ------------------------- GET /v1/orders -------------->   |
   | <------------------------ 200 OK -----------------------   |   1 RTT + server time
```

With RTT = 150 ms: DNS 60 + TCP 150 + TLS 150 + request 150 + server 20 ≈ **530 ms**. Only 20 ms was your code. A reused connection costs **170 ms**. Through a CDN edge 20 ms away: ≈ **290 ms**.

### DNS

| Piece | What it does |
|---|---|
| Stub resolver (OS, browser) | Caches answers, asks the recursive resolver |
| Recursive resolver (ISP, 8.8.8.8, 1.1.1.1) | Walks root → TLD (`.in`) → authoritative; caches by TTL |
| Authoritative server (Route 53, Cloudflare) | Owns the zone; returns the records |

Records: **A** (IPv4), **AAAA** (IPv6), **CNAME** (alias to another name), **NS** (delegation), **MX** (mail), **TXT** (verification, SPF). DNS uses **UDP** (one small question, one answer), falling back to TCP for large answers and zone transfers.

**TTL trade-off:** low TTL (30–60 s) gives fast failover but more queries; high TTL (hours) caches well but failover is slow, and some resolvers ignore low TTLs anyway. **GeoDNS / latency-based routing** answers with the nearest region. **Anycast** announces the same IP from many places and lets BGP pick the nearest; CDNs and public resolvers use it.

### TCP vs UDP

| | TCP | UDP |
|---|---|---|
| Connection | 3-way handshake, kernel state per connection | None |
| Delivery | Reliable, ordered, retransmits | Best effort, may drop or reorder |
| Flow + congestion control | Yes (slow start, windows) | No; the app must do it |
| Head-of-line blocking | Yes: one lost segment holds all later bytes | No |
| Used by | HTTP/1.1, HTTP/2, Postgres, Redis, Kafka | DNS, WebRTC media, games, QUIC |

A TCP connection is identified by the 4-tuple (src IP, src port, dst IP, dst port). One client IP can open ~64k connections to one server port; a server can hold far more (one per client 4-tuple), limited by memory and file descriptors.

**Slow start:** a new TCP connection starts with a small congestion window (~10 segments ≈ 14 KB) and grows each RTT. Another reason warm, reused connections are faster.

### HTTP versions

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| Transport | TCP | TCP | QUIC over UDP |
| Parallelism | One request at a time per connection; ~6 connections per host | Many streams multiplexed on one connection | Many independent streams |
| Headers | Text, repeated | Binary, HPACK-compressed | QPACK-compressed |
| Head-of-line blocking | Per connection | At the TCP layer: one loss stalls all streams | Only the stream that lost data |
| Handshake to first request | TCP + TLS (2–3 RTT) | Same | 1 RTT, 0-RTT on resumption |
| Network change (Wi-Fi → 4G) | Connection breaks | Breaks | Survives (connection id) |

gRPC runs on HTTP/2. Browsers negotiate the version with **ALPN** during TLS.

### TLS

TLS gives **encryption, integrity and server identity**. The server sends a certificate chain signed by a CA; the client verifies the chain and the hostname, and both derive session keys with ECDHE (forward secrecy). TLS 1.3 cut the handshake to 1 RTT and supports 0-RTT resumption (replayable, so only for idempotent requests).

Where to terminate:

| Option | Pros | Cons |
|---|---|---|
| At the CDN / edge | Handshake near the user, offloads CPU | Edge → origin needs its own TLS |
| At the load balancer (ALB) | One place for certs (ACM), simple apps | Plaintext inside the VPC unless re-encrypted |
| End to end / mTLS between services | Zero-trust, service identity, PCI DSS | Certificate rotation; use a mesh or internal PKI |

### Forward vs reverse proxy (quick)

A **forward proxy** acts for the client (corporate proxy, VPN). A **reverse proxy** acts for the server (Nginx, Envoy, Cloudflare): TLS termination, routing, compression, caching. The API gateway is a reverse proxy with auth and rate limits on top (see [H06](../H06-proxies-api-gateway/README.md)).

## In TypeScript

Keep-alive in Node is one option on the HTTP agent; without it, every outbound call pays TCP + TLS again:

```ts
import https from 'node:https';
const agent = new https.Agent({ keepAlive: true, maxSockets: 50 });   // pooled, reused connections
const res = await fetch('https://payments.internal/v1/charge', { /* undici pools by default */ });
https.get({ host: 'api.razorpay.com', path: '/v1/payments', agent }, (r) => { /* ... */ });
```

[demo.ts](demo.ts) is a round-trip calculator: it prints time-to-first-byte for new vs reused connections, TLS 1.2 vs 1.3, direct vs via an edge, and for N sequential calls with and without keep-alive.

## Trade-offs / when NOT to use it

| Choice | Pick when | Cost |
|---|---|---|
| TCP | Every byte matters, in order (APIs, DBs, payments) | Handshake latency, HOL blocking |
| UDP | Late data is useless (voice, video, games) | You build loss handling, ordering, congestion control |
| HTTP/2 | Browsers, service-to-service, gRPC | TCP HOL blocking on lossy links |
| HTTP/3 | Mobile users on bad networks | Some networks block UDP; more CPU |
| Low DNS TTL | Planned migrations, fast failover | More DNS queries; not all resolvers honour it |
| TLS only at the edge | Simple, cheap | Plaintext internal hop |
| mTLS everywhere | Regulated, zero-trust | Cert lifecycle work |

## Common mistakes

- "TCP is slow, UDP is fast." UDP has no handshake and no retransmit; the app pays for reliability itself if it needs it.
- Forgetting DNS and TLS in latency estimates; only counting server time.
- Creating a new HTTP client (and connection) per request in Node, so every call pays the handshakes.
- Thinking HTTP/2 removes head-of-line blocking completely. It moves it to the TCP layer.
- Expecting DNS failover to be instant. Caches hold the old IP until the TTL ends.
- Mixing up L4 (TCP/UDP, IPs and ports) and L7 (HTTP: paths, headers, cookies) load balancers.

## Say this in the interview

> "The client resolves our domain through latency-based DNS to the nearest region. TLS terminates at the CDN edge, so the expensive handshakes happen close to the user, and the edge talks to our origin over warm pooled connections."

> "Between services I use keep-alive connections and HTTP/2 or gRPC, so we never pay handshakes per call. A new HTTPS connection costs about three round trips; from Mumbai to us-east that's over half a second, which is why we deploy in-region."

> "For the live video path I'd use UDP via WebRTC: a late frame is useless, so retransmitting it is worse than skipping it. For signaling and payments I need TCP."

## Your experience hook

- SFU video platform: WebRTC media over UDP (ports 40000–40100, DTLS/SRTP) because real-time tolerates loss but not delay; TURN relays for the ~10% of clients behind symmetric NAT; Socket.io over WSS (TCP) for signaling. That is the TCP vs UDP answer from production.
- REST → gRPC between signaling and media dropped internal calls from 20–50 ms to 2–5 ms: persistent HTTP/2 connections, binary Protobuf, no per-call handshake.
- Matriot: Nginx in front of WebSocket servers with IP-hash stickiness. Long-lived TCP connections are why stickiness and connection limits per box matter.

## Numbers to remember

| What | Value |
|---|---|
| Same-DC RTT | ~0.5 ms |
| Cross-AZ RTT | ~1–2 ms |
| Mumbai ↔ Singapore | ~60 ms |
| Mumbai ↔ Europe | ~120–150 ms |
| Mumbai ↔ us-east | ~200–250 ms |
| New HTTPS (TLS 1.3) | 2 RTT before the request (TCP + TLS), 3 RTT to first byte |
| TLS 1.2 | one extra RTT |
| QUIC | 1 RTT to first request, 0-RTT on resume |
| DNS cold lookup | 20–100 ms; cached ~0 |
| TCP initial window | ~10 segments ≈ 14 KB |
| Ethernet MTU | 1,500 bytes |
| Browser HTTP/1.1 connections per host | ~6 |
| Ephemeral ports per client IP | ~28k–64k |

## Self-test

<details><summary>1. Mumbai client, us-east-1 server, RTT 200 ms. Minimum time to first byte on a new HTTPS (TLS 1.3) connection, ignoring DNS and server time?</summary>

TCP 1 RTT + TLS 1 RTT + request 1 RTT = 600 ms. With a reused connection, 200 ms. Hence CDNs, edge TLS termination and regional deployments.
</details>

<details><summary>2. What happens when you type a URL and press Enter?</summary>

Browser and OS DNS caches → recursive resolver → root, TLD, authoritative → IP. TCP handshake, TLS handshake with certificate check, HTTP request. Server side: CDN/LB → web server → app → cache/DB. Response; the browser parses HTML and fetches CSS/JS/images (often from a CDN) over the same or new connections, then renders. Mention caching and keep-alive at each layer.
</details>

<details><summary>3. Why does DNS use UDP?</summary>

Questions and answers are tiny and need one round trip. A TCP handshake would double the cost. It falls back to TCP for large responses and zone transfers.
</details>

<details><summary>4. You move a service to new IPs next week. What do you do with the DNS TTL?</summary>

Lower it (say to 60 s) at least one old-TTL period before the move, switch, verify, then raise it again.
</details>

<details><summary>5. Why does HTTP/2 still suffer head-of-line blocking, and how does HTTP/3 fix it?</summary>

All HTTP/2 streams share one TCP byte stream; a lost segment holds back every later byte until it is retransmitted. QUIC runs streams in user space over UDP and tracks loss per stream, so only the affected stream waits.
</details>

<details><summary>6. Why would a Node service see high latency on outbound calls even though the downstream is fast?</summary>

No keep-alive / no pooling: every call does TCP + TLS again (and TCP slow start). Use a shared agent with `keepAlive: true` or undici's pool, and reuse clients.
</details>

<details><summary>7. L4 vs L7 load balancer in one line each?</summary>

L4 routes by IP and port (TCP/UDP), fast and protocol-agnostic (AWS NLB). L7 understands HTTP and routes by path, host, header or cookie, and can terminate TLS (AWS ALB, Nginx, Envoy).
</details>

## Go deeper

- [H04 API design](../H04-api-design/README.md) and [H05 Real-time communication](../H05-realtime-communication/README.md): what runs on top of these connections
- [H06 Proxies and API gateway](../H06-proxies-api-gateway/README.md): reverse proxies in practice (hands-on Nginx, Kong)
- [H10 CDN](../../2-scaling/H10-cdn/README.md): edge caching and TLS at the edge
- Archive: [hld-parts/part1.md](../../../archive/notes/hld-parts/part1.md) (HTTP/HTTPS, TCP vs UDP, DNS resolution flow)
- Books: Ilya Grigorik, *High Performance Browser Networking* (TCP, TLS, HTTP/2 chapters); Kurose and Ross, *Computer Networking: A Top-Down Approach*, chapters 2–3
