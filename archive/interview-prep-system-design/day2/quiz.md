# SD Day 2 — Interview Quiz + Model Answers

> Rule: try answering OUT LOUD before reading the answer. Interviews are spoken.
> These answers are tailored to YOUR background — steal the phrasing.

---

## Q1. You're designing your video platform. Interviewer: "you drew a load balancer — L4 or L7, and why?"

**Model answer:**
"Both, for different traffic. For the HTTPS API and signaling I want L7 — it
terminates TLS, routes by path (`/api` to the REST fleet, `/ws` to signaling),
and handles the WebSocket Upgrade handshake. I'd run least-connections there
because signaling connections are long-lived — round robin only counts NEW
connections and ignores the thousands already parked on a server.

For the actual media (Mediasoup/WebRTC) the answer is different: that's UDP/RTP,
HTTP load balancers don't apply. Media servers are typically reached directly —
the signaling layer assigns you to an SFU instance, which is load balancing at
the APPLICATION level rather than the network level.

If we're at serious scale I'd put an L4 tier (NLB or anycast IP) in front of the
L7 fleet — L4 for raw packet spraying, L7 for the smart decisions."

**Why this answer wins:** splits the traffic types instead of giving one answer,
names the algorithm WITH its reason, and the SFU note shows real-time prod
experience nobody gets from books.

---

## Q2. Your gRPC microservices run 10 pods, but monitoring shows one pod at 90% CPU and nine idle. The LB is healthy. What's happening?

**Model answer:**
"Classic gRPC trap — I'd bet the LB is L4. gRPC rides HTTP/2, which multiplexes
ALL requests over ONE long-lived TCP connection. An L4 balancer distributes
*connections*, not requests — so the client service opened one connection, it
landed on one pod, and every call since then rides that same pipe. Scaling pods
does nothing because the connection never moves.

Three fixes, in order:
1. **HTTP/2-aware L7 balancing** — Envoy sidecar/proxy that balances per-REQUEST
   across pods. This is a big part of why service meshes exist.
2. **Client-side load balancing** — client gets the pod list from service
   discovery (K8s headless service) and round-robins per call. No middle box,
   but the logic lives in every client.
3. Quick mitigation: set `MAX_CONNECTION_AGE` on servers so connections recycle
   every few minutes and re-balance — crude but ships today.

In Kubernetes specifically: a normal ClusterIP Service is connection-level, so
this exact incident is why gRPC shops deploy Linkerd/Istio or use headless
services with client-side LB."

**Why this answer wins:** diagnoses from symptoms, explains the MECHANISM
(connections vs requests), and gives a ship-today mitigation plus the real fix.

---

## Q3. Deploys cause a 30-second burst of 502s. The new code is fine. What's missing in the LB setup?

**Model answer:**
"Two usual suspects, both LB lifecycle, not code:

1. **No connection draining.** When the old instance is killed, in-flight
   requests die with it → 502s. Fix: deregister from the LB FIRST, let existing
   requests finish (ALB 'deregistration delay'), then terminate. In K8s terms:
   a preStop hook + readiness flip before SIGTERM.
2. **Traffic before readiness.** The new instance gets requests while still
   booting (connecting to DB, warming caches). Fix: health check must pass
   before the LB sends anything — readiness probe gates traffic, and a *slow
   start* setting ramps it up gradually instead of (with least-connections)
   hammering the new zero-connection server.

And one trap I'd flag: keep `/healthz` SHALLOW. If it checks the database and
the DB blips, every instance reports unhealthy at once and the LB ejects the
entire fleet — a partial outage becomes a total one. Liveness = 'process is up';
deep dependency checks belong in monitoring."

**Why this answer wins:** "deploys 502" is an ops-reality question — naming
draining + readiness + the healthz trap proves you've run deploys, not read
about them.

---

## Q4. (Personal audit) My Socket.io app broke with random 400s when we scaled to 2 instances — reconstruct WHY and the full fix.

**The honest reconstruction:**

1. Socket.io starts with HTTP **long-polling**, then upgrades to WebSocket. The
   polling phase is SEVERAL separate HTTP requests that must all hit the SAME
   instance (it holds the session in memory).
2. Round-robin LB sprayed those requests across both instances → instance B got
   a poll for a session that lives on A → `400 Unknown session`.
3. **Fix part 1 — sticky sessions** at the LB (cookie-based at L7, or `ip_hash`
   in Nginx) so the handshake sequence stays on one instance.
4. **Fix part 2 — Redis adapter** for pub/sub across instances, so an emit on
   instance A reaches a client connected to instance B. Stickiness solves the
   handshake; the adapter solves cross-instance messaging. You need BOTH.
5. Alternative: force `transports: ['websocket']` (skip polling) — kills the 400s
   without stickiness, but drops the fallback for restrictive networks/proxies.

**Why this matters:** this is a REAL multi-instance incident with a layered fix —
exactly the story to tell when a chat/realtime design interview reaches the
"how do you scale the WebSocket tier?" deep dive.

---

## One-liner to close any LB discussion

> "L4 balances connections, L7 balances requests — half of all production LB
> surprises (gRPC pinning, Socket.io 400s, deploy 502s) come from forgetting
> which one you have."
