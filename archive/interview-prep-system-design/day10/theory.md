# SD Day 10 — Consistency Models (strong, eventual, read-your-writes, monotonic…)

*(~1 hr · yesterday you chose **AP/eventual** or **CP/strong** for a subsystem. Today is the zoom-in: "eventual" isn't one thing — it's a **menu** of guarantees, each fixing a specific way a user can get confused. Sits on top of Day 7 (replication) + Day 9 (CAP/PACELC); this is the vocabulary senior engineers use to say *exactly how* fresh a read is.)*

---

## 1. The one line that frames it

> **A consistency model is a promise the system makes about *what a read is allowed to return* —
> from "always the very latest write" (strong) down to "some past value, it'll catch up eventually"
> (eventual). The weaker the promise, the faster and more available the system; the stronger the
> promise, the more it costs in latency.**

Yesterday's "C vs A" was the *failure-mode* choice. Today is the *steady-state* dial: once you've
said "I'll allow stale reads," **how stale, and stale in what shape?** Each named model rules out one
specific weird thing a user could otherwise see.

Mental picture the whole day hangs on: **one writer, several replicas, async replication.** A write
lands on the leader and ripples out to followers over milliseconds-to-seconds. A read might hit a
follower that hasn't caught up yet. Every model below is a rule about *which* stale values are OK.

```
        write X=5
           │
       ┌───▼────┐   replicates (lag)    ┌─────────┐   ┌─────────┐
       │ leader │ ─────────────────────▶│follower1│   │follower2│
       │  X=5   │                        │ X=5 ✓   │   │ X=4 ✗   │  ← still catching up
       └────────┘                        └─────────┘   └─────────┘
   a read hitting follower2 sees the OLD value. Which models forbid that? read on…
```

---

## 2. The spectrum, top to bottom (strongest → weakest)

| Model | The promise (in one breath) | Cost / where it lives |
|---|---|---|
| **Linearizable (strong)** | every read sees the **latest** committed write, as if there's one single copy | slowest — quorum/leader wait; etcd, Spanner, single-leader sync RDBMS |
| **Sequential** | everyone sees writes in the **same one order** (but not necessarily *instantly* latest) | classic theory; rarer in practice |
| **Causal** | reads respect **cause→effect** order (if B was written after seeing A, no one sees B without A) | the sweet spot; many distributed DBs aim here |
| **Eventual** | if writes stop, **all replicas converge** to the same value… eventually. No ordering promise meanwhile | fastest/most available; DynamoDB default, Cassandra, DNS |

And layered **on top of eventual**, four *client-centric session guarantees* — small promises that kill
the most annoying user-visible glitches without paying for full strong consistency:

- **Read-your-writes** — *you* always see *your own* latest write.
- **Monotonic reads** — once you've seen a value, you never see an older one later.
- **Monotonic writes** — your writes apply in the order you made them.
- **Writes-follow-reads (causal-ish)** — a write you make after reading X lands *after* X everywhere.

---

## 3. Strong (linearizable) — "behave like a single copy"

The gold standard: the system *pretends* there's exactly one copy of the data. The instant a write
commits, **every** subsequent read anywhere returns it. No staleness window, ever.

- **How:** reads/writes go through a leader or a quorum; you **wait** for confirmation before
  answering. That wait is the latency cost (PACELC's "EC").
- **Use when:** correctness is non-negotiable — **balances, inventory counts, "is this seat booked?",
  distributed locks, leader election.** (etcd/ZooKeeper, Spanner, sync single-leader Postgres.)
- **Hook:** *"Looks like one machine even though it's twenty. You pay for the illusion in latency."*

---

## 4. Eventual — "everyone agrees… eventually"

The opposite end. A write spreads lazily. Replicas may **disagree for a while**; reads can return old
values. The *only* promise: **stop writing, wait long enough, and all replicas converge.**

- **How:** write to whoever's reachable, replicate in the background, resolve conflicts later
  (last-write-wins, vector clocks, CRDTs). No waiting → low latency, high availability (PACELC "EL").
- **Use when:** staleness is harmless and uptime/speed win — **like counts, view counts, "last seen,"
  feeds, DNS, your IoT telemetry.**
- **The catch it leaves open:** with *pure* eventual, weird things are legal — you might refresh and
  see your own comment **disappear**, or a counter **jump backwards**. §5–6 are the named fixes.
- **Hook:** *"No one's wrong forever, but everyone's a little wrong right now."*

---

## 5. Read-your-writes — the #1 fix you'll actually reach for

The classic bug on top of eventual: **you post a comment, the page refreshes off a lagging replica,
and your own comment is gone.** Infuriating — *you* know you just wrote it.

> **Read-your-writes guarantee:** a user is always guaranteed to see **their own** most recent write,
> even if everyone else still sees the old state for a moment.

- **How (cheap tricks):** after a user writes, **route their reads to the leader** for a few seconds;
  or **pin them to the replica that has their write**; or remember "this user's last write was at
  timestamp T, only read from a replica caught up past T."
- **Use when:** anything where a user edits then immediately views — **profile edits, posting a
  comment, updating settings, "your order" page.**
- **Hook:** *"Other people can lag. You can never lag behind yourself."*

---

## 6. Monotonic reads & the other two session promises

These all answer "what's the *minimum* I owe a single user's session so it doesn't feel broken?"

- **Monotonic reads** — *time never goes backwards for you.* Once you've seen X=5, a later read won't
  show X=4. Fix: **stick a user to one replica** (or one that's at least as fresh). Without it: you
  refresh and the new tweet you just saw vanishes, then comes back.
- **Monotonic writes** — *your writes apply in the order you issued them.* You set name then set
  avatar; the system won't apply avatar-then-name. Fix: serialize one user's writes through the same
  path/replica.
- **Writes-follow-reads** — *if you read X and then write Y, everyone who sees Y also sees X.* This is
  the **causal** glue at the session level: a reply can't show up somewhere the original comment
  hasn't (no orphan reply).

> **Causal consistency (§2) is essentially these stitched together globally:** preserve every
> cause→effect link, but don't bother ordering *unrelated* writes. That's why causal is the popular
> "strong enough to feel right, cheap enough to scale" target.

---

## 7. Map it to YOUR systems (interview gold)

- **Payments / ledger:** **strong (linearizable).** A balance read must reflect every committed
  debit/credit. No session-level shortcut is enough here.
- **Chat (your NestJS/Redis/WS):** **causal + read-your-writes.** A reply must never appear before the
  message it answers (causal); you must always see the message you *just sent* (read-your-writes).
  Global strong ordering across all rooms would be overkill and slow.
- **IoT "last seen" / telemetry (10k+ devices):** **eventual**, maybe **monotonic reads** on the
  dashboard so a device's status doesn't flicker newer→older→newer.
- **Social feed / view counts:** **eventual** is fine; add **read-your-writes** so a user sees their
  own just-posted item.

> The senior move: *"I don't run the whole platform at one consistency level. The ledger is
> linearizable; chat is causal with read-your-writes; telemetry is eventual with monotonic reads on
> the UI. I pay for strength only where a wrong/old answer actually hurts."*

---

## 8. How this connects to the knobs you already know

- **Quorums (`R + W > N`) from Day 9** are *how you dial this per query*: big R/W → closer to strong;
  small → eventual. Consistency models are the **names** for the behaviors those numbers produce.
- **Replication lag (Day 7)** is the *physical reason* weak models exist — the lag window is exactly
  when a follower can serve a stale read.
- **PACELC's "EL vs EC" (Day 9)** is the same trade in two words; today gives you the **fine-grained
  vocabulary** between the two extremes (causal, read-your-writes, monotonic) instead of just "strong
  or eventual."

---

## 9. The traps that catch people

1. **"Eventual = inconsistent/broken."** No — it's *converging*. The fix for its rough edges is the
   session guarantees (§5–6), not jumping all the way to strong.
2. **Confusing strong consistency with ACID.** Linearizability is about *replicas agreeing on the
   latest value across the network*; ACID is about *transaction guarantees on one logical store*.
   (Same trap as CAP-C vs ACID-C yesterday.)
3. **Thinking it's one global setting.** Like CAP, it's **per-operation / per-subsystem**. Picking one
   level for the whole product is the junior tell.
4. **Forgetting read-your-writes is usually the cheapest big win.** Most "the app feels buggy after I
   save" complaints are *just* a missing read-your-writes guarantee, not a call for strong
   consistency.

---

## 10. The whole day on one page (say it out loud)

> *"Consistency models are a spectrum of promises about what a read can return. Linearizable/strong
> means every read sees the latest write — correct but slow, so I use it for money, inventory, locks.
> Eventual means replicas converge over time — fast and available, great for feeds, telemetry,
> counts — but it allows ugly glitches: seeing your own write vanish, or values going backwards. I
> patch those with cheap session guarantees: read-your-writes (you always see your own latest write),
> monotonic reads (you never go backwards in time), monotonic writes, and writes-follow-reads —
> which together add up to causal consistency, the 'feels right and still scales' sweet spot. It's
> never one global setting: my ledger is linearizable, my chat is causal + read-your-writes, my IoT
> dashboard is eventual + monotonic reads. And `R + W > N` is how I dial the exact point per query."*

**Why it matters tomorrow:** Day 11 is **message queues deep — RabbitMQ vs Kafka** (the log model,
consumer groups, exactly-once). Ordering and delivery guarantees there are the *same ideas* — "in
what order do consumers see events, and can they see one twice?" — applied to streams instead of
reads.
