# 01 · How to Approach an HLD Round

> **Read time:** 30 min · **Visual:** [v01 life of a request](../../visuals/v01-request-lifecycle.html) · **Code it:** none (this is a process card)
> **Shows up in:** every HLD round. Practise it on [URL shortener](../problems/01-url-shortener/README.md) first.

## The idea in one line

An HLD round is a 45-minute guided conversation. You win by clarifying scope, giving a simple working design early, and then going deep on the one or two parts that matter, while saying your trade-offs out loud.

## The problem it solves

Most candidates who fail know enough. They fail because of process:

- They start drawing boxes before they know what to build.
- They spend 20 minutes on requirements and never reach a deep dive.
- They list technologies ("Kafka, Redis, Cassandra") without saying why.
- They go silent while thinking, so the interviewer cannot give credit.

A fixed framework stops these mistakes. You don't need to invent the shape of the interview each time.

## How it works

### The 45-minute framework

| Minute | Step | What you produce |
|---|---|---|
| 0–5 | **Requirements** | 3–5 functional requirements, a "not in scope" list, and the non-functional ones (scale, latency, availability, consistency) |
| 5–10 | **Estimation** | QPS (average and peak), storage per year, read:write ratio. Only the numbers that change the design |
| 10–15 | **API and data model** | 3–5 endpoints with request/response, main entities and the key you will look them up by |
| 15–25 | **High-level design** | One end-to-end diagram: client → LB → services → DB/cache/queue. Walk one read and one write through it |
| 25–40 | **Deep dives** | 2–3 hard parts: the bottleneck, the consistency question, the hot key, the failure case |
| 40–45 | **Wrap-up** | Bottlenecks, failure modes, monitoring, what you'd do with more time |

Timings move. If the interviewer pulls you into a deep dive at minute 12, follow them. But keep the order.

### Step details

1. **Requirements.** Ask, don't assume. "Who are the users? What are the top 3 actions? Is this read-heavy? Do we need strong consistency for X?" Write the answers on the board. Say what you will *not* cover.
2. **Estimation.** Round hard (see [back-of-envelope](./02-back-of-envelope.md)). End each number with a decision: "~12k peak reads/s, so one DB is not enough; I'll add a cache."
3. **API.** Use real shapes: `POST /v1/payments {amount, currency, idempotencyKey}` → `201 {paymentId, status}`. This shows you think about clients.
4. **High-level design.** Start simple. One service and one database is fine at first. Then scale the parts the numbers say need scaling.
5. **Deep dives.** Pick the parts unique to *this* problem. For a payment system: idempotency, ledger, and reconciliation. For a chat system: connection handling and message ordering. Not the load balancer.
6. **Wrap-up.** Single points of failure, what breaks at 10× load, the metrics and alerts you would add.

### How to drive the conversation

- **Narrate.** Say what you are doing and why: "I'll pick Postgres here because we need transactions on the ledger."
- **Check in at transitions.** "I have the high-level design. Should I go deeper on the feed generation or on storage?" This lets the interviewer steer you to what they score.
- **Offer options, then choose.** "Two options: push or pull fan-out. Push is fast to read but costly for celebrities. I'll use a hybrid." Never leave a choice open.
- **Park side topics.** "Good point on auth. I'll note it and come back if we have time."

### What interviewers score

| Signal | SDE-2 bar | Senior (SDE-3+) bar |
|---|---|---|
| Requirements | Asks the right questions with some prompting | Finds the hidden requirement alone (e.g. exactly-once payout) |
| Design | A correct, working design with standard parts | A design shaped by the numbers and the constraints |
| Depth | Goes deep on 1–2 parts when asked | Picks the right parts to go deep on without being asked |
| Trade-offs | Names a trade-off for each main choice | Compares options with numbers and failure modes |
| Operations | Mentions monitoring and failures | Covers rollout, migration, multi-region, cost |
| Communication | Clear and structured | Leads the conversation; the interviewer mostly listens |

At SDE-2 the main question is: "Can this person design a service end to end and defend each choice?" You don't need novel ideas. You need correct ones, explained clearly.

## Numbers to remember

- 45 minutes total. About **5 min** requirements, **5 min** estimation, **25 min** design plus deep dives combined.
- 3–5 functional requirements. More than that means the scope is too big.
- 2–3 deep dives. One good deep dive beats five shallow ones.
- Default read:write ratios: social feed ~100:1, URL shortener ~100:1, payments ~1:1 to 10:1, chat ~1:1.

## Trade-offs: styles of running the round

| Style | Works when | Risk |
|---|---|---|
| Strict framework, step by step | Interviewer is quiet and lets you lead | Feels robotic if you ignore their hints |
| Follow the interviewer fully | Interviewer asks many targeted questions | You lose structure and never finish the diagram |
| **Framework plus check-ins** | Almost always | Needs practice to keep time |
| Start with the deep dive | You know the hard part early (e.g. a stock exchange matching engine) | No end-to-end picture; looks like you skipped basics |

## In real systems

Real design reviews follow the same order: a design doc starts with goals and non-goals, then capacity planning, then APIs, then architecture, then alternatives considered, then rollout and monitoring. Interviewers at Razorpay, Flipkart and Uber often ask "what would your design doc say about X?" The interview is a compressed design review.

## What to say in the interview

Useful phrases:

- Opening: "Before I design, I'd like to spend a few minutes on requirements and scale. Is that okay?"
- Scope: "I'll focus on sending and receiving messages. Group calls and media are out of scope unless you want them."
- Estimation: "Let me do a quick estimate, only to decide if one database is enough."
- Choice: "I'm choosing X over Y because of Z. The cost is W, and I accept it because …"
- Check-in: "Does this level of detail work, or should I go deeper here?"
- Unknown: "I haven't used that in production. My understanding is … Here's how I'd reason about it."
- Wrap-up: "The main risks left are A and B. With more time I'd add C."

## Common follow-ups

<details><summary>"What happens if this component goes down?"</summary>

Answer for each box: is it stateless (restart, LB routes around it) or stateful (replica takes over; what data can be lost)? Say the detection (health checks), the failover, and the user impact during failover.
</details>

<details><summary>"How would this handle 10× traffic?"</summary>

Find the first bottleneck from your numbers: usually the database writes or a hot key. Then say the fix: cache, read replicas, sharding, async processing through a queue. Don't say "add more servers" without saying which tier.
</details>

<details><summary>"Why not just use X?" (e.g. "Why not DynamoDB?")</summary>

Treat it as a real option, not an attack. Compare against your requirements: access pattern, consistency need, transactions, cost, team skill. It's fine to say "X also works; I'd pick it if Y were true."
</details>

## Self-test (answer before opening)

<details><summary>1. It's minute 20 and you have no diagram yet. What went wrong and what do you do now?</summary>

Too long on requirements or estimation. Say "Let me put up the high-level design now," draw the simplest end-to-end version in 3–4 minutes, then go into deep dives.
</details>

<details><summary>2. Name the three most common ways candidates fail an SDE-2 HLD round.</summary>

(1) Jumping into a design without clarifying requirements, then solving the wrong problem. (2) Naming technologies without reasons or trade-offs. (3) Bad time management: no end-to-end design, or no depth anywhere. Others: going silent, over-engineering for a scale that wasn't asked, ignoring failure cases, and arguing with the interviewer's hints.
</details>

<details><summary>3. The interviewer says "assume 1 billion users" for a simple CRUD app. What do you do with the estimate?</summary>

Turn it into DAU, QPS and storage, then let the numbers decide: if peak writes exceed what one primary handles (a few thousand writes/s for a typical OLTP DB), you need sharding; otherwise replicas and a cache are enough. Don't add complexity the numbers don't need.
</details>

## Go deeper

- *System Design Interview* (Alex Xu), vol. 1, chapter 3: "A Framework for System Design Interviews"
- Older notes in this repo: `archive/notes/hld-parts/part5.md`, sections "1. The RADIO Framework (Your North Star)", "3. Clarifying Questions Checklist", "4. Interview Execution Strategy (45-Minute Breakdown)" and "5. Common Mistakes to Avoid"
- Next: [back-of-envelope estimation](./02-back-of-envelope.md)
