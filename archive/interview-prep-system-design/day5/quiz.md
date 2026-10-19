# SD Day 5 — Quiz (answer OUT LOUD, then check theory.md)

> Speaking the answer is the rep. Reading it is not.

---

## Q1 — Why not a binary tree?
An index gives O(log n) lookups. A balanced **binary** search tree is also O(log₂ n).
So why does every database use a B+tree instead?
(a) Give the disk-level reason in one sentence.
(b) Concretely: for 10M rows, roughly how many disk reads does a binary tree need vs a
    B+tree with fan-out ~500, and why is that gap the whole point?
(c) What do the "+"/leaf-chain of a B+tree buy you that a plain B-tree doesn't?

---

## Q2 — The Postgres curveball
Interviewer: "In MySQL InnoDB, the primary key is a clustered index. What's the
equivalent in Postgres?"
(a) Answer the trap honestly — what does Postgres actually do?
(b) Define `ctid` and explain the "two-hop" lookup for a query on a non-PK column.
(c) Bonus (senior): why does MVCC sometimes force Postgres to visit the heap even during
    an "index-only" scan?

---

## Q3 — The composite index that doesn't work
You created `INDEX ON employees(department, salary)`. These two queries have wildly
different performance:
```sql
A:  WHERE department = 'Eng' AND salary > 100000
B:  WHERE salary > 100000
```
(a) Which one uses the index, which doesn't, and what's the rule's name?
(b) Use the phone-book analogy to explain WHY B can't use it.
(c) If query B is your most important query, what do you change?

---

## Q4 — "I added an index and the query got slower / ignored it"
Two separate complaints from a teammate:
(a) "I indexed `is_premium` (a boolean) and `EXPLAIN` still shows a Seq Scan — broken?"
    Explain why the planner is *correct* to ignore it.
(b) "My write throughput dropped 30% after we added 5 indexes for the analytics team."
    Explain the mechanism and state the core trade-off in one sentence.

---

## Q5 — Debug the dead index
A query `WHERE email = ?` is fast, but these three are doing full Seq Scans despite an
index on `email`. For EACH, name why the index can't be used and the fix:
```sql
1:  WHERE lower(email) = 'pappu@x.com'
2:  WHERE email LIKE '%@gmail.com'
3:  WHERE email = 90000           -- (email is a text column)
```
Bonus: which single command would you run first to diagnose all of these?
