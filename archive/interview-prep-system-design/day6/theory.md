# SD Day 6 — SQL vs NoSQL Decision Framework
*(Jun 11, 2026 · ~1 hr · never "which is better" — it's "can I reason about the trade-off"; my Mongo→MySQL migration is the war story)*

---

## 1. The question is a trap — don't have a favorite

Junior: "NoSQL is faster and scales better." → **fails** (implies there's a winner).
Senior: **"It depends on access patterns, consistency needs, and scale — let me ask."**
They're testing whether you decide by **requirements**, not fashion. This topic is a
**decision framework**, not a fact list.

## 2. "NoSQL" is not one thing — it's FOUR databases

SQL ≈ one model (relational tables). NoSQL = umbrella over four very different stores:

| Family | Examples | Shape | Killer use case |
|---|---|---|---|
| **Key-Value** | Redis, DynamoDB | key → blob | cache, sessions, fetch by exact key |
| **Document** | MongoDB, Couchbase | nested JSON, flexible schema | self-contained records (catalog, content) |
| **Wide-Column** | Cassandra, Bigtable, HBase | rows partitioned by key, huge writes | time-series, event logs, write scale |
| **Graph** | Neo4j | nodes + edges first-class | social graph, recommendations, fraud |

> "Should I use NoSQL?" → first ask **"which one?"** — they solve different problems.

## 3. What relational gives you (what you lose by leaving)

- **ACID transactions** — all-or-nothing (payments: debit + credit both or neither). The big one.
- **Joins** — store once (normalized), assemble at query time.
- **Schema + constraints** — DB enforces correctness (types, NOT NULL, FK, unique); bad data rejected.
- **Ad-hoc queries** — answer questions you didn't pre-plan, because SQL + joins compose.
- **Maturity** — planner, tooling, everyone knows it.

> Default: **"Start with Postgres unless there's a specific reason to leave."** Relational +
> JSONB + scales further than people think. Defaulting to it is a senior signal.

## 4. Why NoSQL scales horizontally — the MECHANISM (not just "it does")

**Joins are the enemy of sharding.** Shard SQL → rows split across machines → a join needs
rows from different tables now on **different machines** → cross-shard joins are slow/painful.
SQL's best feature fights horizontal scale.

NoSQL sidesteps it by **denormalizing**: store a self-contained document (user with orders
**embedded**) instead of two tables joined at query time. Everything a query needs lives
together → on **one shard** → spread shards over 1000 machines, no cross-machine joins.

> **The trade:** NoSQL gives up joins + (often) strong consistency to make records
> self-contained → painless horizontal scale. Not free — you pay in **data duplication** and
> the burden of **keeping copies in sync**.

**ACID vs BASE:** SQL = ACID. Classic NoSQL = **BASE** (Basically Available, Soft state,
Eventual consistency) — favors availability + partition tolerance, accepts briefly-stale reads.
(CAP theorem = Day 9; flag here, go deep then.)

## 5. The decision axes — the framework to say out loud

1. **Access patterns** (#1) — always by known key → KV/document; varied ad-hoc + joins →
   relational. **Model around how you query, not how you think about entities.**
2. **Relationships** — many-to-many / lots of joins → SQL; self-contained → document; network
   of connections → graph DB.
3. **Consistency** — money/inventory/booking need ACID → SQL; "like count off by a few for a
   second" → BASE fine.
4. **Scale & writes** — >1-cluster write volume → wide-column (Cassandra); otherwise Postgres
   handles far more than assumed.
5. **Schema stability** — fields change constantly / vary per record → document flexibility;
   stable domain → relational schema as a safety net.

Most systems don't need extreme scale → honest default is Postgres. "We don't have the scale to
justify NoSQL's complexity here" is itself a strong answer.

## 6. My war story — Mongo → MySQL (own it)

> "Started on MongoDB for early-stage schema flexibility (fields changing weekly). As the
> product matured the domain became **relational** — entities referenced each other, we were
> **faking joins in app code**, and needed **transactional consistency**. The flexibility was
> now costing us: app-side joins, no FK integrity, consistency bugs. Migrated to MySQL: stable
> schema, real joins, ACID. Lesson: **NoSQL's flexibility is a loan you repay once access
> patterns stabilize and turn relational.**"

⚠️ **Trap the story exposes:** "schemaless = no design needed" is false. You still design hard —
around **access patterns** instead of normalization. "Schemaless" moves the schema from the DB
**into your app code**; it doesn't delete it. Relational data in a document store = rebuilding
joins badly in the app.

## 7. Modern nuance (wins points)

- **Polyglot persistence** — real systems use several: Postgres (truth) + Redis (cache/session)
  + Elasticsearch (search) + S3 (blobs). "SQL or NoSQL" is often a false binary → right store
  per access pattern.
- **The line blurs** — Postgres **`JSONB`** = document flexibility *inside* relational, indexable;
  DynamoDB added transactions. "I need flexible fields" no longer forces you out of Postgres.
  JSONB = "document when I want it, without losing joins + ACID."

## 8. The interview line

> "I pick by access patterns, not hype. Default Postgres — ACID, joins, JSONB for flexible bits,
> scales further than people assume. I leave relational for a specific reason: huge key-value →
> DynamoDB/Redis; write volume beyond one cluster → Cassandra; a true graph → Neo4j. NoSQL's
> horizontal scale comes from denormalizing away joins — paid for in duplication + eventual
> consistency — so I take that deal only when the access pattern needs it. I lived this:
> Mongo→MySQL once our data turned relational and we were faking joins in app code."

---

### Half-page summary (the version to remember)

> Never "which is better" — a decision framework by access patterns, consistency, scale.
> "NoSQL" = four different DBs: key-value (Redis/DynamoDB, fetch by key), document
> (MongoDB, self-contained records), wide-column (Cassandra, write scale), graph (Neo4j,
> relationships). Relational gives ACID + joins + enforced schema + ad-hoc queries; default to
> Postgres unless a specific reason. NoSQL scales horizontally because denormalized,
> self-contained records avoid cross-shard joins — the trade is data duplication + eventual
> consistency (BASE vs ACID). Decision axes: access patterns (#1), relationships, consistency,
> write scale, schema stability. War story: Mongo→MySQL once the domain turned relational and we
> were faking joins in app code — flexibility is a loan repaid when access patterns stabilize.
> Modern reality: polyglot persistence + Postgres JSONB blurs the line (document flexibility
> without losing joins/ACID). Trap: "schemaless = no design" is false — it moves the schema into
> your app.
