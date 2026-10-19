# SD Day 1 — Interview Quiz + Model Answers

> Rule: try answering OUT LOUD before reading the answer. Interviews are spoken.
> These answers are tailored to YOUR background — steal the phrasing.

---

## Q1. Your video-call signaling server runs on 1 box at 90% CPU. Scale up or out? Full answer with trade-offs.

**Model answer:**
"Short-term I'd scale up — it's a config change, zero risk, buys time. But it's
not the real fix: there's a hardware ceiling, cost grows non-linearly, and the
box stays a single point of failure — unacceptable for a real-time product where
downtime kills every active call.

So the real fix is scaling out behind a load balancer. But a signaling server
holds WebSocket connections — which are stateful. Before I can scale out I must
make instances shareable: room membership and session data go to Redis, and
cross-instance messaging goes through Redis pub/sub (Socket.io adapter) so any
instance can signal any client. Once that's done, instances are interchangeable
and I can autoscale on CPU.

I'd also check WHY it's at 90% — in Node, CPU saturation is often one hot loop
(e.g. JSON parsing of signaling messages). Profiling might buy 10× before
adding any machine."

**Why this answer wins:** it gives the short-term/long-term split, names the
WebSocket-state trap before the interviewer asks, and questions the premise
(profiling) — senior signals everywhere.

---

## Q2. We moved sessions to Redis to make app servers stateless. What NEW problem did we just create?

**Model answer:**
"We traded a scaling problem for a dependency problem — three new issues:

1. **Redis is now a SPOF and a bottleneck.** Every request now does a network
   hop to Redis for session lookup. If Redis is down, NOBODY can be logged in —
   we centralized the failure. So Redis itself needs HA: replication + automatic
   failover (Sentinel/cluster mode).
2. **Added latency.** RAM lookup (~ns) became a network round trip (~ms).
   Usually fine, but it's on EVERY request — worth saying out loud.
3. **Sessions need durability decisions.** Eviction policy, TTLs, what happens
   on Redis restart — do users get logged out? (persistence: RDB/AOF trade-off).

The lesson: statelessness doesn't delete state, it RELOCATES it — and the new
location must be more reliable than where it was."

**Why this answer wins:** "we centralized the failure" is the insight most
candidates miss. Naming the next problem you created = systems thinking.

---

## Q3. JWT vs Redis sessions: user gets banned mid-session. What happens in each? How do you fix JWT?

**Model answer:**
"**Redis sessions:** ban = delete the session key. Next request fails the lookup
→ user is out instantly. Centralized state makes revocation trivial.

**JWT:** the token is self-contained and signed — it stays valid until `exp`, and
no server checks anything centrally. The banned user keeps full access until
expiry. That's the fundamental JWT trade-off: we removed the lookup, so we
removed the kill switch.

**Fixes, in order of preference:**
1. **Short-lived access token (5–15 min) + refresh token.** Ban revokes the
   refresh token (stored server-side), so damage is capped at minutes. This is
   the standard production pattern — it's what I use.
2. **Blocklist of revoked token IDs (jti) in Redis** — but now every request
   checks Redis again, so we've quietly rebuilt sessions and lost JWT's main
   benefit. Acceptable if bans are rare (small blocklist, only until exp).
3. Key rotation — nukes ALL tokens for everyone. Emergency lever only.

In an interview I'd say: JWTs for service-to-service and short-lived access;
anything needing instant revocation gets server-side state."

---

## Q4. (Personal) When my PWAs / SenseGrass services ran multiple instances — what state was still stuck ON the server?

**Honest audit checklist — fill with your real answers, but typical culprits:**

1. **Socket.io connections** → fixed with Redis adapter (pub/sub across instances).
2. **Local file uploads** (multer writing to local disk → other instance can't
   serve the file, and the file dies with the container) → fix: stream to
   S3/GCS, store only the URL.
3. **In-memory caches** (a `Map` of hot data per instance → cache inconsistency
   between instances, N× cold starts) → fix: move to Redis, or accept it as an
   L1 cache with short TTL and Redis as L2.
4. **Cron jobs / setInterval inside the app** → N instances = job runs N times
   (double emails, double billing!) → fix: distributed lock in Redis, or extract
   to a single dedicated worker / BullMQ queue with a single consumer group.
5. **Rate-limit counters in memory** → each instance allows the full limit →
   N× the intended rate → fix: counters in Redis (atomic INCR + TTL).

**Why this matters:** "job runs N times after scaling" and "rate limit silently
became N×" are REAL incidents interviewers love hearing — they prove you've
operated multi-instance systems, not just read about them.

---

## One-liner to close any scaling discussion

> "Statelessness isn't about having no state — it's about making sure no state
> lives in the layer I want to scale."
