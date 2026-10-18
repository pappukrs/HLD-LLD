# 34 · Data Modelling at Scale (Fan-out, Hot Keys, Counters)

> **Read time:** 35 min · **Visual:** [v15 feed fan-out: push vs pull](../../visuals/v15-feed-fanout.html), [v06 sharding strategies](../../visuals/v06-sharding.html) · **Code it:** none (model the tables for one problem below)
> **Shows up in:** news feed, chat system, live comments and viewer count, real-time leaderboard, photo sharing (likes), ticket booking (hot events), food delivery (popular restaurants)

## The idea in one line

At scale you design tables around the **queries** you must serve, pick partition keys that spread load evenly and keep a query on one partition, and handle the few extreme keys (celebrities, viral posts, flash sales) with special paths.

## The problem it solves

A normalised schema works until:
- "Home feed" needs a join across follows and posts for 100M users, each refresh.
- One celebrity post gets 2M likes in an hour, and every like does `UPDATE posts SET likes = likes + 1 WHERE id = ?` on **one row**.
- A Cassandra partition for a busy group chat grows to 5 GB and every read times out.
- A global secondary index on `status` makes every write touch a hot index partition.

## How it works

### 1. Start from access patterns

Write down each query with its rate and latency target before you draw tables:

| Query | Rate | Key |
|---|---|---|
| Get messages in channel C, newest first, page by 50 | 100k/s | `channel_id` |
| Send message to channel C | 20k/s | `channel_id` |
| Get user's channels with unread counts | 30k/s | `user_id` |

Then build one table (or one item type, in DynamoDB single-table design) per pattern. **Denormalise**: duplicate data so each query reads one partition. You pay with more writes and consistency work on updates.

### 2. Partition key and clustering key

- **Partition key**: decides which node holds the data. Needs high cardinality and even traffic.
- **Clustering / sort key**: orders rows inside a partition, so range reads are sequential.

```sql
-- Cassandra: messages
CREATE TABLE messages (
  channel_id  bigint,
  bucket      int,          -- e.g. 10-day time bucket, caps partition size
  message_id  bigint,       -- Snowflake id: time-sortable
  author_id   bigint,
  body        text,
  PRIMARY KEY ((channel_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
```

**Time bucketing** keeps partitions bounded: a busy channel spreads over many `(channel_id, bucket)` partitions instead of one huge one.

### 3. Fan-out: push vs pull

| | Fan-out on write (push) | Fan-out on read (pull) |
|---|---|---|
| On post | Write post id into each follower's feed list | Write once to author's timeline |
| On read | Read one precomputed list | Fetch from every followee and merge |
| Good for | Normal users (hundreds of followers) | Celebrities (millions of followers) |
| Problem | 10M writes for one celebrity post | Slow reads for users following thousands |

**Hybrid**: push for normal authors; for authors above a follower threshold, don't push; merge their recent posts at read time. Store feeds as lists of ids (Redis list or a wide row), then hydrate posts from a cache.

### 4. Hot keys

- **Detect**: per-key request metrics, Redis `--hotkeys` (with LFU policy), or sampling at the client.
- **Hot reads**: local in-process cache with a short TTL (1–5 s) in front of Redis; replicate the key to several cache nodes and read from any; serve from CDN when public.
- **Hot writes**: **split the key**. Write to `likes:post123#0..#15` chosen at random; read by summing the 16 shards. Or buffer increments in memory/Kafka and flush aggregated counts every second.
- **Hot events** (a flash sale, a Coldplay concert on a booking site): queue users at the edge (virtual waiting room), pre-split inventory into buckets, and keep the critical decrement atomic in one place.

### 5. Counters

| Need | Approach |
|---|---|
| Exact, low rate | DB row with `UPDATE … SET n = n + 1` |
| Exact, high rate | Sharded counter rows or Redis `INCR`, periodically persisted |
| Approximate distinct (views by unique users) | HyperLogLog ([29](29-probabilistic-data-structures.md)) |
| Very high rate, shown as "1.2M" | Batch increments in a stream job, write aggregated totals |

The **like table** (`user_id, post_id` unique) is the source of truth that stops double likes. The count is a derived, cached number.

### 6. Secondary indexes and pagination

- **Local index** (per partition): cheap writes, but a query without the partition key hits all partitions.
- **Global index** (partitioned by the indexed value): one-partition reads, but writes are cross-partition and usually async (DynamoDB GSIs are eventually consistent).
- Low-cardinality index keys (`status = 'ACTIVE'`) create hot index partitions. Add a suffix or avoid them.
- Paginate with a **cursor** (keyset: `WHERE message_id < :last ORDER BY message_id DESC LIMIT 50`), never `OFFSET 100000`.

## Numbers to remember

- DynamoDB: max **3,000 RCU and 1,000 WCU per partition**; max item size **400 KB**. One hot key can be throttled while the table has spare capacity.
- Cassandra: keep partitions well under **~100 MB** (a common guideline) and avoid unbounded growth.
- Fan-out cost: 1 post × 500 followers = 500 feed writes. At 10k posts/s that's 5M writes/s, which is why the threshold matters.
- A Redis key handles ~100k simple ops/s on one core; past that, split the key.

## Trade-offs and when not to use it

| Option | Use when | Weakness |
|---|---|---|
| Normalised SQL | Moderate scale; many ad-hoc queries; strong consistency | Joins at scale; hard to shard |
| Denormalised per-query tables | Known, high-rate access patterns | Write amplification; update all copies |
| Push fan-out | Most authors have few followers; reads ≫ writes | Celebrity writes; storage per follower |
| Pull fan-out | Few readers per author, or very large authors | Slow, expensive reads |
| Key splitting | Hot write counters | Reads must sum shards |
| Local cache for hot reads | Celebrity or viral keys | Slight staleness |
| Time bucketing | Append-heavy per-entity data (chat, events) | Reads may cross buckets |

## In real systems

- **Discord**: messages in Cassandra (later ScyllaDB) partitioned by `(channel_id, bucket)` with Snowflake message ids.
- **Twitter**: hybrid fan-out; home timelines precomputed in Redis; very large accounts merged at read time.
- **Instagram**: denormalised like counts with the like table as source of truth.
- **DynamoDB single-table design**: common at AWS-heavy companies; one table, overloaded keys, one query per access pattern.
- **Ticketing sites**: virtual waiting rooms before high-demand on-sales.

## What to say in the interview

"I'll list the access patterns first. Messages are read by channel newest-first, so the partition key is `(channel_id, 10-day bucket)` and the clustering key is a Snowflake message id, descending. That bounds partition size and makes each page one sequential read. For the feed, I'll push post ids into followers' Redis lists, except for authors above 100k followers; their posts are merged at read time. Like counts for viral posts are split across 16 counter keys and summed on read, while the likes table with a unique `(user_id, post_id)` remains the source of truth."

## Common follow-ups

<details><summary>How do you choose the celebrity threshold for hybrid fan-out?</summary>

From the cost: write cost = followers per post; read cost = number of pulled authors per feed read. Start with something like 10k–100k followers, measure feed read latency and write load, and tune. Some systems also skip pushing to inactive followers.
</details>

<details><summary>A user edits their display name. It's copied into 10M messages. What do you do?</summary>

Don't copy mutable profile data into messages. Store `author_id` and look up names from a cached user service at read time. Denormalise only data that rarely changes or that should be frozen (an order's price at purchase time).
</details>

<details><summary>How do you keep a denormalised copy in sync?</summary>

Change events from the owner (outbox/CDC) with idempotent consumers that update each copy, plus a periodic repair job. Accept that copies lag by seconds.
</details>

## Self-test (answer before opening)

<details><summary>1. Why is `status` a bad partition key?</summary>

Low cardinality: a handful of values, so most rows and traffic land on one or two partitions.
</details>

<details><summary>2. A post gets 50k likes per second on one Redis key. Two fixes?</summary>

Split into N sub-keys and sum on read; or buffer likes in Kafka/memory and apply aggregated increments every second.
</details>

<details><summary>3. Push or pull for a user who follows 3 people with 200 followers each?</summary>

Push. Each post writes to few feeds, and reads are a single list fetch.
</details>

## Go deeper

- Alex DeBrie, *The DynamoDB Book* (access-pattern-first modelling, single-table design)
- Discord engineering blog: "How Discord Stores Billions of Messages" and "How Discord Stores Trillions of Messages"
- DDIA, chapter 1 (Twitter home timeline example) and chapter 6 ("Skewed Workloads and Relieving Hot Spots")
- Practice: [hld/problems/07-news-feed](../problems/07-news-feed/README.md), [hld/problems/06-chat-system](../problems/06-chat-system/README.md), [hld/problems/27-live-comments](../problems/27-live-comments/README.md), [hld/problems/21-leaderboard](../problems/21-leaderboard/README.md)
- Older notes in this repo: `archive/notes/hld-parts/part7.md`, "1. Feed Generation Architectures"; `archive/notes/hld-parts/part6b.md`, "1.1 Push vs Pull (Fan-out)" and "3.1 Scaling Writing (Hotspots)"; `archive/notes/hld-parts/part1.md`, "Normalization vs Denormalization"
