# H37 · Data at scale: fan-out, hot keys, counters

> **Time:** ~50 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/6-building-blocks/H37-data-at-scale/demo.ts`)
> **Builds on:** [H13 Data modelling](../../3-databases/H13-data-modeling/README.md) · [H16 Partitioning and sharding](../../3-databases/H16-partitioning-sharding/README.md) · [H09 Caching](../../2-scaling/H09-caching/README.md) · [H20 Message queues](../../4-async/H20-message-queues/README.md) · **Used in:** News feed, Chat system, Live comments, Leaderboard, Photo sharing (likes), Ticket booking (hot events)

## The idea in one line

At scale you design tables around the **queries** you serve, pick partition keys that spread load and keep each query on one partition, and give the few extreme keys (celebrities, viral posts, flash sales) a **special path**: hybrid fan-out, split keys, buffered counters.

## Why it matters (the problem it solves)

A clean normalised schema works until:

- "Home feed" needs a join of follows and posts for 100M users on every refresh.
- One celebrity post gets 2M likes in an hour, and every like runs `UPDATE posts SET likes = likes + 1 WHERE id = ?` on **one row**. Row lock contention, one hot shard, timeouts.
- A Cassandra partition for a busy group chat grows to 5 GB and every read times out.
- A global index on `status` sends most writes to one index partition.

Averages lie. The **average** user has 200 followers; the **max** has 100M. You design for the tail.

## How it works

### 1. Start from access patterns, then denormalise

Write each query with its rate before drawing tables:

| Query | Rate | Partition key |
|---|---|---|
| Messages in channel C, newest first, 50 per page | 100k/s | `channel_id` (+ time bucket) |
| Send message to channel C | 20k/s | `channel_id` |
| My channels with unread counts | 30k/s | `user_id` |
| Home feed for user U | 200k/s | `user_id` |

Then build one table (or one item type in DynamoDB single-table design) per pattern. **Denormalise**: copy data so each query reads one partition. You pay with more writes and with keeping copies in sync (outbox/CDC to update copies, plus a repair job).

Do not copy **mutable** data that many rows share (a display name into 10M messages). Store `author_id` and look the name up from a cached user service. Copy data that is frozen by meaning (price at purchase time) or rarely changes.

### 2. Partition key, clustering key, time buckets

```sql
-- Cassandra / ScyllaDB: chat messages (Discord-style)
CREATE TABLE messages (
  channel_id  bigint,
  bucket      int,          -- 10-day time bucket: caps partition size
  message_id  bigint,       -- Snowflake id, time-sortable
  author_id   bigint,
  body        text,
  PRIMARY KEY ((channel_id, bucket), message_id)
) WITH CLUSTERING ORDER BY (message_id DESC);
```

- **Partition key** picks the node. Needs high cardinality and even traffic. `status` or `country` are bad keys.
- **Clustering key** orders rows inside the partition, so "newest 50" is one sequential read.
- **Time bucketing** stops unbounded partitions: a busy channel spreads across many `(channel_id, bucket)` partitions.
- **Pagination** with a cursor: `WHERE message_id < :last ORDER BY message_id DESC LIMIT 50`. Never `OFFSET 100000`.

### 3. Feed fan-out: push, pull, hybrid

```
PUSH (fan-out on write)                     PULL (fan-out on read)
Alice posts a1                              Alice posts a1 -> posts table only
  -> queue -> workers                       Bob opens feed:
  -> LPUSH tl:bob a1                          follows(Bob) = 300 accounts
  -> LPUSH tl:cara a1                         query 300 timelines, merge by time
  -> ... one write per follower               -> slow, every single open
Bob opens feed: LRANGE tl:bob 0 19 (1 read)
```

| | Push | Pull | Hybrid |
|---|---|---|---|
| Work per post | One write per follower | One row | Push for normal authors, nothing for celebrities |
| Work per feed open | One list read | One query per followee, then merge | One list read + a few celebrity queries |
| Weak spot | Celebrity: 50M writes for one post | Heavy readers, slow feeds | Two code paths and a merge |

**Hybrid** (Twitter, Instagram): authors above a threshold (say 10k to 100k followers) are not fanned out. At read time, take the cached list and merge the recent posts of the few celebrities the reader follows. Extras that matter:

- Timeline stores **ids only**, capped (`LTRIM 0 799`): 800 x 8 B ≈ 6.4 KB per user. Bodies come from a post cache, so edits and deletes touch one place.
- **Skip inactive users** during fan-out; rebuild their timeline with a pull when they log in.
- Fan-out is **async** through a queue. A few seconds of feed delay is fine; a slow "Post" button is not.

### 4. Hot keys

**Detect**: per-key request metrics, Redis `--hotkeys` (needs an LFU eviction policy), client-side sampling, or a Count-Min sketch over the request stream ([H35](../H35-probabilistic-ds/README.md)).

**Hot reads** (a celebrity profile, a viral post):
- In-process local cache with a 1 to 5 s TTL in front of Redis. 1,000 app pods each make 1 request per second instead of 50k/s to one Redis key.
- Replicate the key to N cache nodes (`post:s1#r0..#r3`) and read a random copy.
- Serve public data from the CDN.
- Request coalescing (single flight) so one miss does not become 10k DB queries.

**Hot writes** (likes on a viral post, a flash-sale stock counter):

```
before:  INCR likes:s1                     -> one key, one shard, one core: ~100k ops/s max
after:   INCR likes:s1#{rand(0..15)}       -> 16 keys spread over shards
read:    MGET likes:s1#0 .. likes:s1#15    -> sum = total
```

- **Split the key** into N sub-keys. Writes pick one at random; reads sum all N. N = expected peak / safe rate per key.
- **Buffer and aggregate**: collect +1s in memory or Kafka and write one `+1,437` per second per post. Turns 50k writes/s into 1.
- **Hot events** (a Coldplay on-sale on a booking site): a virtual waiting room at the edge, inventory pre-split into buckets, and the critical decrement atomic in one place (Redis `DECR` or a Lua script, or a DB row with a conditional update).

### 5. Counters: pick by need

| Need | Approach |
|---|---|
| Exact, low rate | DB row `UPDATE ... SET n = n + 1` |
| Exact, high rate | Split counter keys or Redis `INCR`, persisted periodically |
| Approximate distinct (unique viewers) | HyperLogLog: 12 KB per counter, ~0.8% error |
| Huge rate, shown as "1.2M" | Batch increments in a stream job, write aggregated totals |
| Live viewer count | Per-server counts pushed every few seconds, summed |

The **like table** with a unique `(user_id, post_id)` is the source of truth: it stops double likes and lets you rebuild the count. The count is a **derived, cached number** that a job can repair.

### 6. Secondary indexes

- **Local index** (per partition): cheap writes, but a query without the partition key hits every partition (scatter-gather).
- **Global index** (partitioned by the indexed value): reads hit one partition, but writes are cross-partition and usually async (DynamoDB GSIs are eventually consistent).
- Low-cardinality index keys (`status = 'ACTIVE'`) make hot index partitions. Add a suffix shard or avoid them.

## In TypeScript

```ts
// Hybrid fan-out
async function onPost(post: Post) {
  await posts.insert(post);
  const author = await users.get(post.authorId);
  if (author.followers >= CELEB_LIMIT) return;                 // celebrities: pull at read time
  for await (const batch of followers.activeOf(author.id, 1000)) {
    await redis.pipeline(batch.map((f) => ['lpush', `tl:${f}`, post.id], ['ltrim', `tl:${f}`, 0, 799]));
  }
}
async function readFeed(userId: string) {
  const ids = await redis.lrange(`tl:${userId}`, 0, 199);
  const celebs = await follows.celebritiesOf(userId);          // usually a handful
  const pulled = await Promise.all(celebs.map((c) => posts.recentIds(c, 20)));
  return mergeByTime(ids, pulled.flat()).slice(0, 20);
}

// Split counter for a hot key
const SHARDS = 16;
const like = (postId: string) => redis.incr(`likes:${postId}#${Math.floor(Math.random() * SHARDS)}`);
async function likeCount(postId: string) {
  const vals = await redis.mget(...Array.from({ length: SHARDS }, (_, i) => `likes:${postId}#${i}`));
  return vals.reduce((sum, v) => sum + Number(v ?? 0), 0);
}
```

[demo.ts](demo.ts) simulates push vs pull vs hybrid costs for a small social graph with one celebrity, a hot key spread over shards, a buffered counter, and a like table that rejects double likes.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Normalised SQL | Moderate scale, ad-hoc queries, strong consistency | Joins at scale, hard to shard |
| Denormalised per-query tables | Known, high-rate access patterns | Write amplification, keeping copies in sync |
| Push fan-out | Most authors have few followers; reads far more than writes | Celebrity writes, memory per follower |
| Pull fan-out | Small graphs, or very large authors | Slow, expensive reads |
| Split keys | Hot write counters | Reads sum N keys; exact "read your own like" is harder |
| Buffered counters | Very high rate, slight delay OK | Lose up to one flush interval on a crash, unless buffered in Kafka |
| Local cache for hot reads | Celebrity or viral keys | Seconds of staleness |

Do not do any of this on day one. A single Postgres with good indexes handles tens of thousands of QPS. Split keys and hybrid fan-out are answers to measured hot spots.

## Common mistakes

- Designing tables first and queries later. In NoSQL that gives you scatter-gather everywhere.
- Partition keys with low cardinality (`status`, `country`) or a monotonically increasing key on a range-partitioned store (all writes hit the last partition).
- Pure push fan-out with no celebrity plan. One post from a 50M account stalls the workers for everyone.
- Storing post bodies in every timeline. Edits and deletes then touch millions of lists.
- Treating the like counter as the truth. Keep the like table; the count is derived.
- "Just add more Redis nodes" for a hot key. One key lives on one node; adding nodes does not help until you split or replicate the key.
- Unbounded partitions (all messages of a channel forever under one key).
- OFFSET pagination on big tables.

## Say this in the interview

> "I list the access patterns first. Messages are read by channel, newest first, so the partition key is (channel_id, 10-day bucket) and the clustering key is a Snowflake id descending. That bounds partition size and makes each page one sequential read."

> "For the home feed I fan out on write: workers push post ids into each active follower's Redis list, capped at 800 ids. Authors above about 100k followers are not pushed; their recent posts are merged at read time. So both the post path and the read path stay cheap."

> "For a viral post, likes go to 16 split counter keys chosen at random, and reads sum them, with a 1-second local cache in front. The likes table with a unique (user_id, post_id) stays the source of truth, and a job can rebuild the count from it."

## Your experience hook

- IoT platform (Matriot, 10k+ devices): Redis queue plus batch processing to absorb high-frequency writes is exactly the "buffer and aggregate" fix for hot writes. Say: "We turned thousands of small writes per second into a few large batched writes."
- Socket.io with the Redis adapter: broadcasting one event to every socket in a room is fan-out. A room with 10k viewers is a hot key; you shard rooms across nodes and batch emits.
- Mediasoup SFU: one upstream, many downstreams is the same push-vs-pull trade-off as a feed. Mesh is pull from everyone; SFU is push through one forwarder.

## Numbers to remember

| Fact | Value |
|---|---|
| DynamoDB per-partition limit | 3,000 RCU and 1,000 WCU; item max 400 KB |
| Cassandra partition guideline | keep well under ~100 MB |
| One Redis key (one core) | ~100k simple ops/s |
| Timeline cache | 800 ids x 8 B ≈ 6.4 KB per user; 100M users ≈ 640 GB |
| Push cost | 10k posts/s x 500 followers = 5M list writes/s |
| Celebrity threshold | typically 10k to 100k followers, tuned by measurement |
| HyperLogLog | 12 KB per counter, ~0.81% standard error |

## Self-test

<details><summary>1. Why is status a bad partition key?</summary>

Low cardinality: a handful of values, so most rows and traffic land on one or two partitions.
</details>

<details><summary>2. A post gets 50k likes per second on one Redis key. Two fixes?</summary>

Split it into N sub-keys and sum on read; or buffer likes in memory/Kafka and apply one aggregated increment per second. Keep the like table as the source of truth.
</details>

<details><summary>3. Push or pull for a user who follows 3 people with 200 followers each?</summary>

Push. Each post costs few writes and the read is one list fetch.
</details>

<details><summary>4. How do you pick the celebrity threshold?</summary>

From cost: push costs one write per follower per post; pull costs one query per celebrity per feed open. Start around 10k to 100k followers, measure fan-out lag and feed latency, and tune.
</details>

<details><summary>5. A post that was pushed to 2,000 timelines is deleted. What do you do?</summary>

Mark it deleted in the posts store. Hydration skips missing or deleted ids. Clean the lists lazily. Because timelines store ids only, nothing else changes.
</details>

<details><summary>6. Adding Redis nodes did not help the hot key. Why?</summary>

A key hashes to one slot on one node. More nodes spread other keys, not this one. Split or replicate the key, or cache it locally.
</details>

<details><summary>7. Why time-bucket the messages partition?</summary>

Without it a busy channel's partition grows forever, which makes reads, compaction and repair slow. Buckets cap partition size; reads usually need only the newest bucket.
</details>

## Go deeper

- Case studies: [News feed](../../case-studies/07-news-feed/README.md) · [Chat system](../../case-studies/06-chat-system/README.md) · [Live comments](../../case-studies/27-live-comments/README.md) · [Leaderboard](../../case-studies/21-leaderboard/README.md) · [Ticket booking](../../case-studies/09-ticket-booking/README.md)
- Related: [H35 HyperLogLog and Count-Min](../H35-probabilistic-ds/README.md) · [H36 Batch and stream](../H36-batch-stream/README.md)
- Archive notes: [hld-parts/part7.md](../../../archive/notes/hld-parts/part7.md) (feed generation) · [hld-parts/part6b.md](../../../archive/notes/hld-parts/part6b.md) (push vs pull, write hotspots) · [hld-parts/part1.md](../../../archive/notes/hld-parts/part1.md) (normalisation vs denormalisation)
- Alex DeBrie, *The DynamoDB Book*; Discord blog "How Discord Stores Trillions of Messages"; DDIA ch. 1 (Twitter timelines) and ch. 6 (skewed workloads)
