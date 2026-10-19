# SD Day 3 — Quiz (answer OUT LOUD, then check theory.md)

> Rule from Day 1: speaking the answer is the rep. Reading the answer is not.

---

## Q1 — Pattern choice under fire
You're designing the product page of an e-commerce site (read-heavy), the "like"
counter on posts (write firehose, losable), and the wallet balance after a payment
(must never be wrong). Which caching pattern for each, and what is the ONE-line
justification per choice?

*(Hint shape: cache-aside / write-behind / write-through-or-no-cache — and why the
write-behind ack is a lie you can only afford for likes.)*

---

## Q2 — The interviewer pushes on invalidation
You drew cache-aside and said "on write: update DB, then DEL the key."
Interviewer: **"Why DEL? Just SET the new value — saves the next reader a miss."**
Walk through the exact two-request interleaving where SET leaves the cache stale
*forever*, then name the safety net that bounds staleness even if everything else fails.

---

## Q3 — Production incident reconstruction
3:00 PM: your DB CPU spikes to 100% for 40 seconds, then recovers on its own.
Logs show thousands of identical `SELECT ... WHERE id = 'homepage-config'` in that
window. Redis was healthy the whole time.
(a) Name the failure mode. (b) Explain the mechanics second-by-second.
(c) Give TWO fixes and say which you'd ship first and why.
(d) Bonus: how would the incident look DIFFERENT if it were an avalanche instead?

---

## Q4 — The mystery logout bug
Support tickets: "users get randomly logged out, mostly during peak hours."
Auth code is unchanged for months. Sessions live in Redis — the SAME instance the
product cache uses, configured `maxmemory 2gb`, `maxmemory-policy allkeys-lru`.
Explain the bug, why it only happens at peak, and two correct fixes.

---

## Q5 — Attack triage (rapid-fire definitions)
An attacker scripts requests to `/api/users/<random-9-digit-number>`. Your cache hit
ratio doesn't move, but DB load climbs linearly with attack traffic.
(a) Stampede, avalanche, or penetration — which one and why do the OTHER two not fit?
(b) Two defenses, including the one that answers "definitely not in DB" without
touching the DB at all.
