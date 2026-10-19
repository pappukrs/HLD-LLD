# H01 · How to approach an HLD round

> **Time:** ~35 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/1-basics/H01-approach-hld-round/demo.ts`)
> **Builds on:** nothing, start here · **Used in:** every case study; practise it first on [URL shortener](../../case-studies/01-url-shortener/README.md), then [Notification system](../../case-studies/05-notification-system/README.md) and [Payment system](../../case-studies/08-payment-system/README.md)

## The idea in one line

An HLD round is a **45-minute guided conversation**: clarify scope, put up a simple working design early, then go deep on the one or two parts that matter for *this* problem, saying every trade-off out loud.

## Why it matters (the problem it solves)

Most candidates who fail an SDE-2 HLD round know enough. They fail on process:

- They start drawing boxes before they know what to build, then solve the wrong problem.
- They spend 20 minutes on requirements and never reach a deep dive.
- They list technologies ("Kafka, Redis, Cassandra") with no reason or trade-off.
- They go silent while thinking, so the interviewer cannot give credit.
- They over-engineer for a scale nobody asked for, or ignore failures entirely.

A fixed framework removes the "what do I do next?" question. You spend your thinking on the design.

## How it works

### The 45-minute framework

```
 0     5     10    15          25                    40   45
 |-REQ-|-EST-|-API-|---HLD-----|------DEEP DIVES-----|WRAP|
  scope  QPS   endpoints  one diagram,   2–3 hard parts:     SPOFs,
  + NFRs storage + entities  1 read +      bottleneck, hot key, 10×, metrics
         ratio   + keys    1 write path    consistency, failure
```

| Minute | Step | What you produce |
|---|---|---|
| 0–5 | **Requirements** | 3–5 functional requirements, a "not in scope" list, non-functional ones: scale, latency, availability, consistency |
| 5–10 | **Estimation** | Peak QPS, storage per year, read:write ratio. Only numbers that change the design (see [H02](../H02-back-of-envelope/README.md)) |
| 10–15 | **API + data model** | 3–5 endpoints with request/response; main entities and the key you look them up by |
| 15–25 | **High-level design** | One end-to-end diagram. Walk one write and one read through it |
| 25–40 | **Deep dives** | 2–3 parts unique to this problem: the bottleneck, the consistency question, the hot key, the failure case |
| 40–45 | **Wrap-up** | Single points of failure, what breaks at 10×, metrics and alerts, what you'd do next |

Timings move. If the interviewer pulls you into a deep dive at minute 12, follow them, but keep the order in your head and come back to the diagram.

### Step 1: requirements (ask, do not assume)

| Ask about | Example question | Why it changes the design |
|---|---|---|
| Users and actions | "Top 3 things a user does?" | Decides the APIs and the hot path |
| Scale | "DAU? Peak vs average?" | One box vs many, cache vs no cache |
| Read vs write | "How often is a short URL read vs created?" | Read-heavy → cache + replicas; write-heavy → queue, sharding |
| Latency | "p99 target for the main read?" | Sync vs async, edge caching |
| Consistency | "Can a user see a stale balance for 1 s?" | Strong (SQL, leader reads) vs eventual |
| Availability | "Is 99.9% fine, or 99.99%?" | Multi-AZ, multi-region |
| Out of scope | "I'll skip auth and analytics unless you want them." | Protects your time |

Write the answers on the board as two lists: **functional** and **non-functional**.

### Step 2: estimation (only numbers that decide something)

End every number with a decision: "~12k peak reads/s, so one Postgres is not enough for reads; I'll put Redis in front." Defaults: peak ≈ 2–3× average; 1 day ≈ 10^5 s.

### Step 3: API and data model

Use real shapes: `POST /v1/urls {longUrl, customAlias?} → 201 {shortUrl}` and `GET /{code} → 302 Location`. Name the lookup key of each entity (`urls` by `code`). This drives the database choice.

### Step 4: the high-level design

```
 client ──> CDN / DNS ──> LB ──> API service (stateless, N copies)
                                    │        │           │
                                    ▼        ▼           ▼
                                 cache    database    queue ──> workers
```

Start simple: one stateless service and one database is fine. Then scale only the tiers the numbers say need it. Walk **one write** and **one read** through the diagram out loud.

### Step 5: deep dives (pick the parts unique to this problem)

| Problem | Good deep dives | Weak deep dive |
|---|---|---|
| URL shortener | Code generation without collisions, cache for hot links, 301 vs 302 | The load balancer |
| Payment system | Idempotency keys, ledger, reconciliation, provider failover | Generic "add Kafka" |
| Chat | Connection handling at 1M sockets, ordering, offline delivery | REST CRUD |
| News feed | Fan-out on write vs read, celebrity problem | Login |
| Rate limiter | Algorithm, distributed counters in Redis, race-free increments | UI |

### Step 6: wrap-up

For each box: stateless (restart, LB routes around it) or stateful (replica takes over, what data can be lost)? Then 10× load: which tier breaks first, and the fix. Then 3–4 metrics you would alert on.

### How to drive the conversation

- **Narrate.** "I'll pick Postgres because the ledger needs transactions."
- **Check in at transitions.** "I have the high-level design. Deeper on fan-out or on storage?"
- **Offer two options, then choose.** Never leave a choice open.
- **Park side topics.** "Good point on auth. I'll note it and come back."
- **Unknowns.** "I haven't run that in production. Here's how I'd reason about it."

### What interviewers score

| Signal | SDE-2 bar | Senior bar |
|---|---|---|
| Requirements | Asks the right questions with some prompting | Finds the hidden requirement alone (exactly-once payout) |
| Design | Correct, working, standard parts | Shaped by the numbers and constraints |
| Depth | Goes deep on 1–2 parts when asked | Picks the right parts without being asked |
| Trade-offs | Names one for each main choice | Compares with numbers and failure modes |
| Operations | Mentions monitoring and failures | Rollout, migration, multi-region, cost |
| Communication | Clear and structured | Leads; the interviewer mostly listens |

At SDE-2 the question is: "Can this person design a service end to end and defend each choice?" Correct and clear beats novel.

## In TypeScript

There is no runtime code in a process, but you can make the clock enforce it. [demo.ts](demo.ts) is a **mock-round timer**: it walks the six phases for a chosen problem, prints the checklist and the questions to ask in each, and flags overruns.

```ts
const PHASES = [
  { name: 'Requirements', mins: 5,  outputs: ['3-5 functional', 'non-functional', 'out of scope'] },
  { name: 'Estimation',   mins: 5,  outputs: ['peak QPS', 'storage/year', 'read:write'] },
  { name: 'API + data',   mins: 5,  outputs: ['3-5 endpoints', 'entities + lookup key'] },
  { name: 'High-level',   mins: 10, outputs: ['one diagram', '1 write + 1 read walk'] },
  { name: 'Deep dives',   mins: 15, outputs: ['2-3 problem-specific parts'] },
  { name: 'Wrap-up',      mins: 5,  outputs: ['SPOFs', '10x plan', 'metrics'] },
] as const;
```

## Trade-offs / when NOT to use it

| Style | Works when | Risk |
|---|---|---|
| Strict framework, step by step | Quiet interviewer who lets you lead | Robotic; ignores their hints |
| Follow the interviewer fully | They ask many targeted questions | No structure; diagram never finished |
| **Framework plus check-ins** | Almost always | Needs practice to keep time |
| Start with the deep dive | The hard part is obvious (stock-exchange matching engine) | No end-to-end picture |

Do not force the framework on a **product-design** or **"design the API"** round; there the API and data model take most of the time.

## Common mistakes

- Drawing before scoping. Ten minutes in, the interviewer says "actually, it's read-only".
- Estimating everything (bandwidth, memory, servers) when only peak QPS mattered.
- Technology bingo: "Kafka, Cassandra, Redis, Elasticsearch" with no reason.
- Deep-diving the generic parts (load balancer, auth) instead of the unique ones.
- Never saying a trade-off. Every choice has a cost; say it.
- Arguing with a hint. "Why not DynamoDB?" is usually an invitation, not an attack.
- Ending without failure cases or monitoring.

## Say this in the interview

> "Before I design, I'd like to spend a few minutes on requirements and scale. I'll focus on creating and redirecting short links; analytics and custom domains are out of scope unless you want them."

> "Let me do a quick estimate, only to decide whether one database is enough... About 12k peak reads per second, a 100:1 read-to-write ratio, so I'll put a cache in front of the database and keep writes on a single primary."

> "I have the end-to-end design. I think the interesting parts are code generation without collisions and handling hot links. Which would you like me to go deeper on?"

## Your experience hook

- Use the framework on your own systems: "Tell me about a system you designed" is the same six steps in past tense. The SFU video platform fits perfectly: requirements (N-party calls), estimate (mesh is N×(N−1) streams), design (gateway, signaling, media), deep dive (SFU vs MCU, gRPC 20–50 ms → 2–5 ms).
- Your golden rule from interview prep: **state the requirement → propose → name the trade-off → say what you'd do at 10×.** That is steps 1, 4, 5 and 6 in one sentence.

## Numbers to remember

| What | Value |
|---|---|
| Round length | 45 min (sometimes 60) |
| Requirements + estimation | ~10 min together |
| Functional requirements | 3–5; more means the scope is too big |
| Deep dives | 2–3; one good one beats five shallow ones |
| Peak / average | 2–3× typical; 10× for flash sales |
| Read:write defaults | feed ~100:1, URL shortener ~100:1, chat ~1:1, payments ~1:1 to 10:1 |
| One Postgres primary | a few thousand writes/s, ~10k+ simple reads/s |
| One Redis node | ~100k ops/s |

## Self-test

<details><summary>1. Minute 20 and no diagram yet. What went wrong and what do you do?</summary>

Too long on requirements or estimation. Say "Let me put up the high-level design now," draw the simplest end-to-end version in 3–4 minutes, then go to deep dives.
</details>

<details><summary>2. Name the three most common ways candidates fail an SDE-2 HLD round.</summary>

(1) No clarifying questions, so they solve the wrong problem. (2) Technologies named without reasons or trade-offs. (3) Bad time management: no end-to-end design, or no depth anywhere. Also: silence, over-engineering, ignoring failures.
</details>

<details><summary>3. The interviewer says "assume 1 billion users" for a simple CRUD app. What do you do with that?</summary>

Turn it into DAU, peak QPS and storage, and let the numbers decide. If peak writes exceed what one primary handles, shard; otherwise replicas and a cache are enough. No complexity the numbers do not need.
</details>

<details><summary>4. "What happens if this component goes down?" How do you answer for any box?</summary>

Say if it is stateless (LB health checks route around it, autoscaler replaces it) or stateful (a replica is promoted; say what data can be lost and for how long). Then the user impact during failover.
</details>

<details><summary>5. "How would this handle 10× traffic?"</summary>

Name the first bottleneck from your numbers, usually DB writes or one hot key, and the fix: cache, replicas, sharding, async through a queue. Never just "add more servers" without saying which tier.
</details>

<details><summary>6. Which deep dives would you pick for a payment system, and which would you avoid?</summary>

Pick idempotency, the double-entry ledger, reconciliation with the provider, and provider failover. Avoid the load balancer and generic auth.
</details>

## Go deeper

- [H02 Back-of-the-envelope estimation](../H02-back-of-envelope/README.md): step 2 in depth
- [H03 Networking basics](../H03-networking-basics/README.md): what happens between the client and your first box
- [H04 API design](../H04-api-design/README.md): step 3 in depth
- Case studies to practise the full framework: [URL shortener](../../case-studies/01-url-shortener/README.md), [Rate limiter](../../case-studies/02-rate-limiter/README.md), [Chat system](../../case-studies/06-chat-system/README.md)
- Archive: [HLD guide](../../../archive/notes/HLD-guide.md) (Part 4, the 5-step framework), [hld-parts/part5.md](../../../archive/notes/hld-parts/part5.md) (RADIO framework, clarifying-questions checklist, 45-minute breakdown)
- Book: Alex Xu, *System Design Interview* vol. 1, chapter 3
