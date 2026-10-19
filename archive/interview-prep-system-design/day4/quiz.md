# SD Day 4 — Quiz (answer OUT LOUD, then check theory.md)

> Speaking the answer is the rep. Reading it is not.

---

## Q1 — The breach question
A junior adds `Cache-Control: public, max-age=300` to *every* response to "speed things
up," including `GET /api/me` (the logged-in user's profile). A week later, users report
seeing **other people's names and emails**.
(a) Explain the exact mechanic — why does one user see another's data?
(b) What header(s) should those responses have had instead?
(c) Why does this NOT happen for `/logo.png` with the same header?

---

## Q2 — Invalidation showdown
You ship a CSS bug fix. Two strategies: (A) deploy, then call the CDN's "purge
/style.css" API; (B) build emits `style.<hash>.css` and you cache it `immutable` for a
year. Walk through what happens at the edge in BOTH, and explain why a senior engineer
prefers B — including what B lets you set that A never safely could.

---

## Q3 — Video platform design check
You're asked to design video for a product that has (1) live 1-on-1 doctor consults and
(2) a library of recorded health webinars users replay.
(a) Which of the two belongs on a CDN and which does NOT — and why?
(b) For the CDN one, what are you actually caching (be specific about the file unit)?
(c) Bonus: name the connection-level reason a CDN still helps even the part you said
    "doesn't belong on a CDN."

---

## Q4 — The origin meltdown
A celebrity tweets your homepage link. Traffic 100×. Your CDN hit ratio is 96%, yet your
origin still falls over for 30 seconds right at the spike.
(a) The 4% is killing you — name the mechanic (what are all those edges doing to origin
    at the same instant?).
(b) Name the CDN feature that fixes it and explain how it collapses the load.
(c) Which Day 3 failure mode is this the geographic cousin of?

---

## Q5 — "Dynamic content can't be cached, so a CDN is useless here" — true?
An interviewer claims a CDN adds nothing for a fully-personalized, uncacheable API.
Argue back: give TWO concrete ways the request still gets faster by going through the
CDN even with a 0% cache hit ratio. (Hint: one is about TLS/connections, one is about
running code somewhere new.)
