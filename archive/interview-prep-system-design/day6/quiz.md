# SD Day 6 — Quiz (answer OUT LOUD, then check theory.md)

> Speaking the answer is the rep. Reading it is not.

---

## Q1 — The opening trap
Interviewer: "Would you use SQL or NoSQL for this?" — before you know anything about the
system.
(a) What's the WRONG instinct, and why does naming a winner fail the question?
(b) What three things do you ask back before answering?
(c) What's your honest default and the one-line reason it's a *senior* default, not a lazy one?

---

## Q2 — "NoSQL" is not one thing
A candidate says "let's use NoSQL because we need scale." Name the **four** NoSQL families,
one example + one killer use case each, and explain why "use NoSQL" is an incomplete
sentence.

---

## Q3 — The mechanism question (this is the real one)
Interviewer: "Everyone says NoSQL scales horizontally better than SQL. *Why* — mechanically?"
(a) Explain why **joins** are the enemy of sharding.
(b) Explain how denormalization / embedding sidesteps it.
(c) Name exactly what you give up to get that scale (two things).

---

## Q4 — Your migration, interview-style
"Tell me about a database decision you got wrong or had to reverse."
Tell the Mongo→MySQL story in STAR-ish shape: why Mongo first, what specifically started
hurting as the product matured, why MySQL fixed it, and the one-sentence lesson about what
NoSQL flexibility actually *is*.

---

## Q5 — Choose and justify (rapid-fire)
For each, name the store family AND the deciding axis (one sentence each):
1. User sessions, looked up by session-id, must be fast, fine to lose on restart
2. A bank ledger — debits and credits that must always balance
3. 50,000 IoT sensor readings per second, write-heavy, rarely updated
4. "People you may know" on a social network
5. A product catalog where every category has wildly different attributes

Bonus: for #5, what Postgres feature might let you keep it relational anyway?
