# H02 · Back-of-the-envelope estimation

> **Time:** ~40 min · **Visual:** [visual.html](visual.html) (walkthrough + calculator) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/1-basics/H02-back-of-envelope/demo.ts`)
> **Builds on:** [H01 How to approach an HLD round](../H01-approach-hld-round/README.md) · **Used in:** minutes 5–10 of every case study; best practice: [URL shortener](../../case-studies/01-url-shortener/README.md), [Chat system](../../case-studies/06-chat-system/README.md), [News feed](../../case-studies/07-news-feed/README.md), [Photo sharing](../../case-studies/16-photo-sharing/README.md), [Video streaming](../../case-studies/14-video-streaming/README.md)

## The idea in one line

Turn users and actions into **peak QPS, storage, bandwidth and cache size** with rounded numbers, then **use each number to make a design decision**: one database or many, cache or not, CDN or not, shard now or later.

## Why it matters (the problem it solves)

Without numbers, every choice is a guess. "Do we need sharding?" depends on whether you write 100 rows per second or 100,000. The interviewer does not want precision. They want to see you **use** the numbers. An estimate that does not change the design is wasted time, and a design with no numbers looks like technology bingo.

## How it works

### The seven steps

1. **Say assumptions out loud**: DAU, actions per user per day, object size, read:write ratio, retention, replication.
2. **QPS**: `per day / 10^5` (86,400 s ≈ 10^5). Then **× 2–3 for peak** (×10 for a sale or an IPL final).
3. **Storage**: `new objects/day × size × 365 × years × replication` (+20–50% for indexes).
4. **Bandwidth**: `QPS × object size`, ingress and egress separately; × 8 for bits/s.
5. **Cache memory**: `daily reads × hot fraction × size` (80/20 rule: 20% is an upper bound).
6. **Machines**: `peak QPS / per-node capacity`, run at 50–70%, plus one spare (N+1).
7. **Decide**: "writes fit one primary, reads need a cache", "20 TB/day goes to object storage".

### Formulas

```
avg QPS       = DAU × actions per user per day / 86,400   (≈ / 10^5)
peak QPS      = avg QPS × 2..3
storage/year  = writes per day × bytes per write × 365 × replication
bandwidth     = QPS × bytes per request         (bytes/s; × 8 = bits/s)
cache size    = daily reads × hot fraction × bytes per object
servers       = peak QPS / per-node QPS / target utilisation (0.6) + 1
```

### Conversions you do in your head

| Per day | Per second (÷ 10^5) |
|---|---|
| 1 M | ≈ 12 |
| 10 M | ≈ 120 |
| 100 M | ≈ 1,200 |
| 1 B | ≈ 12,000 |
| 10 B | ≈ 120,000 |

| Power of 2 | ≈ | Name |
|---|---|---|
| 2^10 | 10^3 | KB |
| 2^20 | 10^6 | MB |
| 2^30 | 10^9 | GB |
| 2^40 | 10^12 | TB |
| 2^50 | 10^15 | PB |
| 2^32 | 4.3 × 10^9 | IPv4 space, uint32 |
| 2^64 | 1.8 × 10^19 | uint64 (Snowflake ids) |

### Latency numbers (orders of magnitude)

| Operation | Time | Take-away |
|---|---|---|
| L1 cache | ~1 ns | |
| Main memory | ~100 ns | RAM is ~1000× faster than an SSD random read |
| Compress 1 KB | ~2–10 µs | Compression is cheap vs the network |
| Send 1 KB over 1 Gbps | ~10 µs | |
| SSD random 4 KB read | ~20–150 µs | |
| Read 1 MB from memory | ~250 µs | |
| Round trip in one data centre | ~0.5 ms | A few calls per request is fine |
| Read 1 MB from SSD | ~1 ms | |
| HDD seek | ~10 ms | Avoid random disk I/O on the hot path |
| Mumbai ↔ US round trip | ~150–250 ms | Keep cross-region calls off the hot path |

### Worked example 1: URL shortener

Assume 100 M new links/day, 100:1 read:write, 500 B per row, kept 5 years.

```
writes  = 10^8 / 10^5          = 1,000/s      peak ~3,000/s
reads   = 100 × writes          = 100,000/s    peak ~300,000/s
storage = 10^8 × 500 B          = 50 GB/day  → 18 TB/year → ~90 TB in 5 years (× 3 replicas = 270 TB)
cache   = 10^10 reads × 20% × 500 B = 1 TB upper bound (real hot set: a few hundred GB)
```

**Decisions:** 3k writes/s fits one primary today, 90 TB does not, so plan to shard by short code. 300k reads/s needs Redis in front (Redis ~100k ops/s per node, so a small cluster) plus a CDN for the hottest links.

### Worked example 2: chat (WhatsApp-like)

500 M DAU × 40 messages × 100 B.

```
messages = 2 × 10^10/day / 10^5  = 200,000/s     peak ~500,000/s
storage  = 2 × 10^10 × 100 B     = 2 TB/day → 730 TB/year → × 3 ≈ 2.2 PB/year
sockets  = 500 M DAU, ~20% online at peak = 100 M connections; at ~100k/box = 1,000 gateway boxes
```

**Decisions:** write-heavy, partition by conversation id in a wide-column store (Cassandra-style); a WebSocket gateway fleet; Redis pub/sub or a broker to route between gateways.

### Worked example 3: photo sharing bandwidth

10 M uploads/day at 2 MB; 1 B views/day at 200 KB (resized).

```
ingress = 2 × 10^13 B/day / 10^5 = 200 MB/s ≈ 1.6 Gbps
egress  = 2 × 10^14 B/day / 10^5 = 2 GB/s   ≈ 16 Gbps average, ~50 Gbps peak
storage = 20 TB/day of originals → ~7 PB/year
```

**Decisions:** blobs in object storage (S3), egress through a CDN, only metadata in a DB.

### Per-node capacity (say these are assumptions)

| Component | Rough limit per node | If you need more |
|---|---|---|
| Stateless Node API | ~1k–10k req/s (depends on work per request) | More pods behind an LB |
| Postgres/MySQL primary | ~5k–10k simple writes/s; reads scale with RAM, indexes, replicas | Replicas for reads, shards for writes |
| Redis | ~100k ops/s; ~100 GB used comfortably | Redis Cluster |
| Kafka broker | ~100 MB/s+ sequential writes | More partitions and brokers |
| Cassandra node | ~10k+ writes/s, near-linear scaling | Add nodes |
| WebSocket gateway | ~50k–100k idle connections (tuned) | More boxes, route by user |

## In TypeScript

[demo.ts](demo.ts) is the same calculator as the visual, as code: it takes assumptions, prints every intermediate number with its formula, and ends with the decisions.

```ts
function estimate(a: Assumptions) {
  const writesDay = a.dau * a.writesPerUser;
  const wPeak = (writesDay / 86_400) * a.peak;
  const rPeak = wPeak * a.readsPerWrite;
  const storage = writesDay * a.bytes * 365 * a.years * a.replicas;
  const decisions = [
    wPeak > 5_000 ? 'writes exceed one primary: shard or queue' : 'writes fit one primary',
    rPeak > 10_000 ? 'reads need a cache + replicas' : 'replicas are enough',
    storage > 10e12 ? 'more than ~10 TB: shard / object storage' : 'fits one node',
  ];
  return { wPeak, rPeak, storage, decisions };
}
```

## Trade-offs / when NOT to use it

| Approach | Use when | Weakness |
|---|---|---|
| Powers of ten, 1 significant figure | Almost always | Off by 2–3×; fine for decisions |
| Exact arithmetic | Never in interviews | Burns minutes, invites mistakes |
| Skip it | Interviewer says "don't worry about scale" | You lose the reason for each scaling choice |
| Only the bottleneck | Time is short | Can miss a storage or bandwidth surprise |

Do not estimate what does not decide anything. For an internal admin tool with 200 users, one sentence ("tiny scale, one DB") is enough.

## Common mistakes

- Forgetting the peak factor, then sizing for the quiet hours.
- Mixing bits and bytes: 1 Gbps is 125 MB/s, not 1 GB/s.
- Forgetting replication (×3) and index overhead in storage.
- Computing numbers and never saying what they decide.
- Precise arithmetic (86,400 instead of 10^5) that eats 5 minutes.
- Treating the 80/20 cache number as exact; it is an upper bound because hot items repeat.
- Quoting per-node capacity as fact instead of "an assumption I'd load-test".

## Say this in the interview

> "Let me assume 50 million DAU, each doing about 20 reads and 2 writes a day. That's 10^9 reads a day, so about 10k reads per second on average, maybe 30k at peak. Writes are about 1k per second."

> "One Postgres primary handles 1k writes per second, so I won't shard on day one. 30k reads per second is too much for the database alone, so I'll put Redis in front. Storage is 10^8 writes a day at 1 KB, 100 GB a day, about 36 TB a year, so I'll plan sharding by year two."

## Your experience hook

- Matriot IoT: 10k devices sending a reading every few seconds is a real estimate. At 1 msg / 5 s that is 2k writes/s; batching through a Redis queue turned it into far fewer, larger DB writes. Use it as your "the number changed the design" story.
- Chesa cache-aside: 400 ms → 160 ms average. Tie the latency table to it: a Redis hit is a sub-millisecond in-DC round trip, while the slow dashboard query was disk and join work.
- SFU: mesh needs N×(N−1) streams; at N = 10 that is 90 streams vs 10 up + 90 down through the SFU. An estimate that justified the architecture.

## Numbers to remember

| Fact | Value |
|---|---|
| Seconds per day | 86,400 ≈ 10^5 |
| Seconds per year | ≈ 3 × 10^7 |
| 1 M/day | ≈ 12/s |
| 1 B/day | ≈ 12k/s |
| Peak factor | 2–3× (events 10×+) |
| 1 Gbps | 125 MB/s |
| UUID | 16 B binary, 36 chars text |
| DB metadata row | 100 B – 1 KB |
| Compressed image | 100 KB – 2 MB |
| 1 min of 720p video | ~5–20 MB |
| Replication factor | 3 |
| Target utilisation | 50–70% |

## Self-test

<details><summary>1. 20 M orders per day. Average and peak writes per second?</summary>

2 × 10^7 / 10^5 = 200/s average; ~400–600/s peak. One primary handles it.
</details>

<details><summary>2. 1 B log lines a day at 200 B, kept 30 days, replication 3. Storage?</summary>

10^9 × 200 B = 200 GB/day × 30 = 6 TB × 3 = 18 TB.
</details>

<details><summary>3. 5,000 req/s with 50 KB responses. Egress?</summary>

5,000 × 50 KB = 250 MB/s = 2 Gbps. A strong hint to cache at the edge or use a CDN.
</details>

<details><summary>4. Why multiply by 2–3 for peak?</summary>

Traffic follows the day and spikes on events. Size for the peak, not the average, or the system fails exactly when most users are online. Autoscale or pre-warm for known events.
</details>

<details><summary>5. 30k peak reads/s, Node pods do ~2k req/s each. How many pods?</summary>

30k / 2k = 15 at 100%; at 60% target utilisation 25; plus one spare ≈ 26 pods. Say you'd load-test the 2k.
</details>

<details><summary>6. Why is the 80/20 cache size an upper bound?</summary>

It assumes every cached read is a different object. Real reads repeat (a viral post is read millions of times but stored once), so the working set is usually much smaller.
</details>

<details><summary>7. Is 1.6 PB too much for one database?</summary>

Yes. One machine holds a few TB to tens of TB. Shard across many nodes or use a store built for it (Cassandra, DynamoDB, S3 for blobs), and tier old data to cheaper storage.
</details>

## Go deeper

- [H01 How to approach an HLD round](../H01-approach-hld-round/README.md): where estimation sits in the 45 minutes
- [H07 Scaling stateless services](../../2-scaling/H07-scaling-stateless/README.md) and [H16 Partitioning and sharding](../../3-databases/H16-partitioning-sharding/README.md): what the numbers trigger
- [H09 Caching](../../2-scaling/H09-caching/README.md) and [H10 CDN](../../2-scaling/H10-cdn/README.md): the usual answers to big read and egress numbers
- Archive: [hld-parts/part5.md](../../../archive/notes/hld-parts/part5.md) (back-of-envelope mental maths), [HLD guide](../../../archive/notes/HLD-guide.md) (step 2 capacity estimation)
- Alex Xu, *System Design Interview* vol. 1, chapter 2; Jeff Dean, "Numbers Everyone Should Know"
