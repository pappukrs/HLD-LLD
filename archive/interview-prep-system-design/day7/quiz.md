# SD Day 7 — Quiz (answer OUT LOUD, then check theory.md)

> Speaking the answer is the rep. Reading it is not.

---

## Q1 — Replication vs sharding (the definition trap)
(a) In one sentence each, what's the difference between replication and sharding?
(b) Name the **three** reasons you replicate at all.
(c) Why is "make a copy" the easy part — what's the actual hard problem?

---

## Q2 — The leader-follower model
Draw it out loud: where do writes go, where do reads go, and how does data get from the
leader to the followers (name the mechanism in Postgres *and* MySQL)?
Bonus: name the two non-default topologies and the one thing each buys you / costs you.

---

## Q3 — The real one: sync vs async
Interviewer: "When the leader gets a write, should it wait for the followers before confirming
to the client?"
(a) Give the durability/latency/risk tradeoff for **synchronous** and for **asynchronous**.
(b) Why is fully-synchronous-to-all impractical in one sentence?
(c) What's the usual production compromise, and why?
(d) Which kind of data forces you toward sync/semi-sync, and which is fine async?

---

## Q4 — Replication lag
"A user updates their profile, immediately reloads, and sees the OLD data. What happened, and
how do you fix it?"
Name the mechanism causing it, the consistency guarantee you're violating, and **two named
fixes** (one is the common one).
Bonus: what's *monotonic reads* and the bug it prevents?

---

## Q5 — Failover
The leader just died.
(a) Walk the three steps to recover.
(b) Name the three things that can go wrong — and the guard against split-brain specifically.
(c) Why is the failure-detection timeout a genuine tradeoff, not a set-and-forget config?

---

## Q6 — Your war story, interview-style
"Tell me about a time you scaled a database."
Tell the read-replica story: what you moved to replicas, what stayed on the primary, the bug
you hit, and the one-line name of the fix. Then connect it: Redis and MongoDB use the *same*
model under different names — what are they called there?
