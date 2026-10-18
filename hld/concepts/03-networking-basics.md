# 03 · Networking Basics (DNS, TCP/UDP, HTTP, TLS)

> **Read time:** 30 min · **Visual:** [v01 life of a request](../../visuals/v01-request-lifecycle.html) · **Code it:** none
> **Shows up in:** "what happens when you type a URL", latency questions, [chat system](../problems/06-chat-system/README.md), [video streaming](../problems/14-video-streaming/README.md), [load balancing](./07-load-balancing.md)

## The idea in one line

A request goes DNS lookup → TCP (or QUIC) connection → TLS handshake → HTTP request → response. Each step costs round trips, and most latency work is about removing or reusing those round trips.

## The problem it solves

Interviewers use networking to check whether you understand where time goes. A cross-region round trip is ~150–250 ms. If a new HTTPS connection needs 3 round trips before the first byte, that's half a second before your server does any work. Knowing this explains why we use keep-alive, connection pools, CDNs, HTTP/2 and regional deployments.

## How it works

### The life of a request

1. **DNS.** The browser asks a recursive resolver (ISP, 8.8.8.8) for `api.example.com`. The resolver walks root → `.com` TLD → the authoritative server, and caches the answer for its **TTL**.
2. **TCP handshake.** SYN → SYN-ACK → ACK. One round trip before data can flow.
3. **TLS handshake.** TLS 1.3: one round trip (zero with session resumption, 0-RTT). TLS 1.2: two round trips.
4. **HTTP request/response.** The request reaches a load balancer, then an app server, then maybe a cache or DB.
5. **Reuse.** Keep-alive keeps the TCP + TLS connection open for the next request, so the handshakes are paid once.

```
Client            DNS            LB / Server
  | --- A? api --> |                  |
  | <-- 1.2.3.4 -- |                  |   ~1 RTT (or cached)
  | ----------- SYN ----------------> |
  | <---------- SYN-ACK ------------- |   1 RTT
  | ----------- ACK + ClientHello --> |
  | <---------- ServerHello, cert --- |   1 RTT (TLS 1.3)
  | ----------- GET /v1/orders -----> |
  | <---------- 200 OK -------------- |   1 RTT + server time
```

### TCP vs UDP

| | TCP | UDP |
|---|---|---|
| Connection | Handshake, connection state | None |
| Delivery | Reliable, ordered, retransmits | Best effort, no order |
| Flow/congestion control | Yes | No (app must do it) |
| Head-of-line blocking | Yes: one lost packet stalls the stream | No |
| Used by | HTTP/1.1, HTTP/2, DB protocols, Kafka | DNS, video calls, games, QUIC (HTTP/3) |

### HTTP versions

- **HTTP/1.1:** one request at a time per connection; browsers open ~6 connections per host.
- **HTTP/2:** many streams multiplexed on one TCP connection, binary framing, header compression (HPACK). Still has TCP head-of-line blocking. gRPC runs on it.
- **HTTP/3:** runs on **QUIC** over UDP. Streams are independent, so one lost packet does not block the others. Faster handshakes (transport + TLS combined), and connections survive a network change (Wi-Fi to 4G).

### TLS in one paragraph

TLS gives encryption, integrity and server identity. The server presents a certificate signed by a CA; the client checks it, then both agree a session key (ECDHE in TLS 1.3). Terminate TLS at the load balancer or edge to save CPU on app servers; use mTLS between services when you need service identity (common in fintech and in service meshes).

### DNS details that come up

- Record types: **A** (IPv4), **AAAA** (IPv6), **CNAME** (alias), **MX** (mail), **NS** (delegation), **TXT** (verification, SPF).
- **TTL** trade-off: low TTL (30–60 s) allows fast failover but more DNS traffic; high TTL caches longer but failover is slow.
- **GeoDNS / latency-based routing** (Route 53, Cloudflare) sends users to the nearest region. **Anycast** advertises the same IP from many locations; routers pick the nearest. CDNs and public DNS use it.

## Numbers to remember

- Same-DC round trip: **~0.5 ms**. Same region, cross-AZ: **~1–2 ms**. India ↔ US: **~200+ ms**.
- New HTTPS connection: **~2 RTT** before the first request byte with TLS 1.3 (TCP + TLS), **~3 RTT** with TLS 1.2. QUIC: **1 RTT**, 0 with resumption.
- Ethernet MTU: **1,500 bytes**. A TCP connection is identified by the 4-tuple (src IP, src port, dst IP, dst port), so one client IP can open ~64k connections to one server port.
- Browsers: ~6 parallel HTTP/1.1 connections per host.

## Trade-offs

| Choice | Pick when | Cost |
|---|---|---|
| TCP | You need every byte, in order (APIs, DBs, payments) | Handshake latency, head-of-line blocking |
| UDP | Late data is useless (voice, video, games) | You build loss handling yourself |
| HTTP/1.1 | Simple internal calls, legacy | Many connections needed for parallelism |
| HTTP/2 | Browser and service-to-service traffic, gRPC | TCP head-of-line blocking on lossy networks |
| HTTP/3 (QUIC) | Mobile users on bad networks | Some middleboxes block UDP; more CPU |
| TLS at the edge | Public traffic | Traffic inside the VPC is plaintext unless you re-encrypt |
| mTLS everywhere | Zero-trust, regulated (PCI DSS) | Certificate management (use a mesh or a PKI) |

## In real systems

- **Connection pooling** to Postgres, Redis and downstream HTTP services saves handshakes. In Node, use an `http.Agent` with `keepAlive: true`; it is a common latency fix.
- **AWS:** an NLB works at L4 (TCP/UDP, static IPs); an ALB works at L7 (HTTP routing, TLS termination). Route 53 does latency and failover routing.
- **CDNs** (CloudFront, Akamai, Cloudflare) terminate TLS close to the user, so the expensive handshakes travel a short distance.
- **Video calls** (Zoom, Google Meet) use UDP-based media (WebRTC/SRTP), with TCP fallbacks.

## What to say in the interview

"The user resolves our domain with latency-based DNS to the nearest region. TLS terminates at the CDN or the ALB. From there we use keep-alive connections, and HTTP/2 or gRPC between services, so we don't pay handshakes per request. For the mobile app on flaky networks, HTTP/3 would help, but I'd start with HTTP/2."

## Common follow-ups

<details><summary>What happens when you type a URL and press Enter?</summary>

Browser cache and OS cache for DNS → recursive resolver → root, TLD, authoritative → IP. TCP handshake, TLS handshake (certificate check), HTTP request. Server side: LB → web server → app → cache/DB. Response, browser parses HTML, fetches CSS/JS/images (often from a CDN), renders. Mention keep-alive and caching at each layer.
</details>

<details><summary>Why is DNS-based failover slow?</summary>

Resolvers and clients cache records for the TTL, and some ignore low TTLs. So after you change a record, some users keep the old IP for minutes. Fix: low TTLs plus health-checked routing, or anycast / a global load balancer with a static IP so the IP never changes.
</details>

<details><summary>Why does HTTP/2 still have head-of-line blocking?</summary>

The streams are independent at the HTTP layer, but they share one TCP byte stream. If one TCP packet is lost, the kernel holds all later bytes until it is retransmitted, which stalls every stream. QUIC moves streams into the transport so a loss affects only its own stream.
</details>

## Self-test (answer before opening)

<details><summary>1. Client in Mumbai, server in us-east-1 (RTT 200 ms). Minimum time to first response byte on a new HTTPS (TLS 1.3) connection, ignoring DNS and server time?</summary>

TCP 1 RTT + TLS 1 RTT + request/response 1 RTT = 3 × 200 = ~600 ms. With a reused connection: ~200 ms. This is why you use a CDN or a regional deployment.
</details>

<details><summary>2. Why does DNS use UDP?</summary>

Queries and answers are small and a single round trip; a TCP handshake would double the cost. DNS falls back to TCP for large responses and for zone transfers.
</details>

<details><summary>3. You are moving a service to new IPs next week. What do you do with the DNS TTL?</summary>

Lower the TTL (e.g. to 60 s) a day or more before the move, so caches expire quickly when you switch. Raise it again afterwards.
</details>

## Go deeper

- *Computer Networking: A Top-Down Approach* (Kurose and Ross), chapters 2–3
- *High Performance Browser Networking* (Ilya Grigorik): TCP, TLS, HTTP/2 chapters
- Older notes in this repo: `archive/notes/hld-parts/part1.md`, sections "HTTP/HTTPS Protocols", "TCP vs UDP" and "DNS Resolution Flow"
- Next: [API design](./04-api-design.md)
