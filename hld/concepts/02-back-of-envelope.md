# 02 · Back-of-the-Envelope Estimation

> **Read time:** 35 min · **Visual:** [v19 estimation calculator](../../visuals/v19-estimation-calculator.html) · **Code it:** none (practise on paper)
> **Shows up in:** the first 10 minutes of every HLD round; [URL shortener](../problems/01-url-shortener/README.md), [chat system](../problems/06-chat-system/README.md), [photo sharing](../problems/16-photo-sharing/README.md)

## The idea in one line

Turn users and actions into QPS, storage and bandwidth with rounded numbers, so you can decide how many machines, which database, and whether you need a cache, a CDN or sharding.

## The problem it solves

Without numbers, every design choice is a guess. "Do we need sharding?" depends on whether you write 100 rows per second or 100,000. The interviewer does not want precision. They want to see you **use** the numbers to make a decision. An estimate that does not change the design is wasted time.

## How it works

1. **State assumptions** out loud: DAU, actions per user per day, object size, read:write ratio, retention.
2. **QPS:** `daily requests / 10^5`. Multiply by **2–3×** for peak (more for flash sales or IPL-style events).
3. **Storage:** `new objects per day × size × days of retention × replication factor`.
4. **Bandwidth:** `QPS × object size` for ingress and egress separately.
5. **Cache memory:** `hot objects × object size` (often "20% of the day's reads" as an upper bound).
6. **Servers:** `peak QPS / QPS per server` (state the per-server number as an assumption).
7. **Decide:** "So writes fit on one primary, but reads need a cache," or "20 TB per day must go to object storage."

### Formulas

```
avg QPS      = DAU × actions per user per day / 86,400   (use 10^5)
peak QPS     = avg QPS × 2..3
storage/year = writes per day × bytes per write × 365 × replication
bandwidth    = QPS × bytes per request        (bytes/s; × 8 for bits/s)
cache size   = daily reads × hot fraction × bytes per object
servers      = peak QPS / per-server QPS  (+ headroom, e.g. run at 50–70%)
```

### Powers of two

| Power | Exact | Approx | Name |
|---|---|---|---|
| 2^10 | 1,024 | 10^3 | 1 KB |
| 2^20 | 1,048,576 | 10^6 | 1 MB |
| 2^30 | ~1.07 × 10^9 | 10^9 | 1 GB |
| 2^40 | ~1.1 × 10^12 | 10^12 | 1 TB |
| 2^50 | ~1.13 × 10^15 | 10^15 | 1 PB |
| 2^32 | ~4.3 × 10^9 | 4 billion | IPv4 space, unsigned 32-bit int |
| 2^64 | ~1.8 × 10^19 | | unsigned 64-bit int |

### Latency numbers every engineer should know

Order of magnitude only. The original list is from Jeff Dean and Peter Norvig; modern hardware is faster on some rows (NVMe SSDs especially), but the ratios still hold.

| Operation | Time |
|---|---|
| L1 cache reference | ~1 ns |
| Branch mispredict | ~5 ns |
| L2 cache reference | ~5–10 ns |
| Main memory reference | ~100 ns |
| Compress 1 KB (fast codec) | ~2–10 µs |
| Send 1 KB over a 1 Gbps network | ~10 µs |
| Random 4 KB read from SSD | ~20–150 µs |
| Read 1 MB sequentially from memory | ~250 µs |
| Round trip inside one data centre | ~0.5 ms |
| Read 1 MB sequentially from SSD | ~1 ms |
| Disk (HDD) seek | ~10 ms |
| Read 1 MB sequentially from HDD | ~20 ms |
| Round trip across continents (e.g. India ↔ US) | ~150–250 ms |

What to take from it: memory is ~1000× faster than an SSD random read; a network hop inside a DC costs about the same as several SSD reads; cross-region calls are expensive, so keep them off the hot path.

## Numbers to remember

### One-glance cheat table

| Fact | Value | Use |
|---|---|---|
| Seconds per day | 86,400 ≈ **10^5** | QPS = per-day / 10^5 |
| Seconds per month | ~2.6 M ≈ 2.5 × 10^6 | monthly quotas |
| Seconds per year | ~31.5 M ≈ **3 × 10^7** | yearly totals |
| 1 M requests/day | ≈ **12/s** | |
| 100 M requests/day | ≈ **1,200/s** | |
| 1 B requests/day | ≈ **12,000/s** | |
| Peak factor | 2–3× average | normal days |
| ASCII char | 1 byte | |
| int / long / timestamp | 4 / 8 / 8 bytes | |
| UUID | 16 bytes binary, 36 chars as text | |
| Typical DB row (metadata) | 100 B – 1 KB | |
| Image (compressed) | 100 KB – 2 MB | |
| 1 minute of video (720p) | ~5–20 MB | |
| 1 Gbps | 125 MB/s | |

### Rough capacity per node (state these as assumptions)

- Redis: on the order of **100k simple ops/s** per node.
- One Postgres/MySQL primary: **a few thousand to ~10k** simple writes/s, depending on hardware and row size. Reads scale with replicas.
- A stateless API instance: assume **~1k req/s** for a typical JSON API that calls a DB, then say you would load-test.
- A Kafka broker: **hundreds of MB/s** of sequential writes.

## Worked examples

**1. URL shortener.** 100 M new links/day, 100:1 read:write, 500 B per record, keep 5 years.
- Writes: 10^8 / 10^5 = **1,000/s**, peak ~3,000/s. Reads: **100,000/s**, peak ~300k/s.
- Storage: 10^8 × 500 B = 50 GB/day → ~18 TB/year → ~90 TB in 5 years (before replication).
- Decision: 3k writes/s fits one primary today, but 90 TB will not, so plan to shard by key. Reads need a cache. Cache 20% of daily reads: 10^10 × 0.2 × 500 B = 1 TB upper bound; in practice the hot set is much smaller, so a few hundred GB of Redis.

**2. Chat (WhatsApp-like).** 500 M DAU, 40 messages per user per day, 100 B per message.
- Messages: 2 × 10^10/day → **200,000/s**, peak ~500k/s.
- Storage: 2 × 10^10 × 100 B = 2 TB/day → ~730 TB/year, ×3 replication ≈ **2.2 PB/year**.
- Decision: a write-heavy, horizontally scalable store (Cassandra/HBase-style), partitioned by conversation id.

**3. Photo sharing bandwidth.** 10 M uploads/day at 2 MB; 1 B photo views/day at 200 KB (resized).
- Ingress: 2 × 10^13 B/day / 10^5 = 200 MB/s ≈ **1.6 Gbps**.
- Egress: 2 × 10^14 B/day / 10^5 = 2 GB/s ≈ **16 Gbps** average, more at peak.
- Storage: 20 TB/day of originals → ~7 PB/year.
- Decision: object storage (S3) for blobs, a CDN for egress, metadata in a DB.

## Trade-offs: how precise to be

| Approach | Use when | Weakness |
|---|---|---|
| Powers of ten, 1 significant figure | Almost always in interviews | Can be off by 2–3×; fine for design decisions |
| Exact arithmetic | Never in interviews | Wastes minutes, easy to make mistakes |
| Skip estimation | Interviewer says "don't worry about scale" | You lose the reason for each scaling choice |
| Estimate only the bottleneck | Time is short | May miss storage or bandwidth surprises |

## In real systems

Teams do the same maths in capacity planning before a launch or a sale (Big Billion Days, IPL final). They then load-test to replace the assumptions with measured per-server numbers, and keep 30–50% headroom for spikes and for losing one availability zone.

## What to say in the interview

"Let me assume 50 M DAU, each doing about 20 reads and 2 writes a day. That's 10^9 reads/day, so about 10k reads/s average, maybe 30k at peak. Writes are 1k/s. One Postgres primary handles 1k writes/s, so I won't shard on day one. 30k reads/s is too much for the DB alone, so I'll put Redis in front. Storage is 10^8 writes/day × 1 KB = 100 GB/day, about 36 TB/year, so I'll plan sharding by year two."

## Common follow-ups

<details><summary>Why multiply by 2–3 for peak?</summary>

Traffic is not flat. Daily peaks are often 2–3× the average; events (sales, cricket matches, New Year messages) can be 10× or more. You size for the peak, not the average, and autoscale or pre-warm for known events.
</details>

<details><summary>How many servers do you need?</summary>

`peak QPS / per-server QPS`, then add headroom (run at 50–70% CPU) and N+1 or one-AZ-loss capacity. Say the per-server number is an assumption you would confirm with a load test.
</details>

<details><summary>Do you include replication and indexes in storage?</summary>

Yes. Multiply by the replication factor (usually 3) and add ~20–50% for indexes and overhead. Mention compression if the data is text-heavy.
</details>

## Self-test (answer before opening)

<details><summary>1. 20 M orders per day. Average and peak writes per second?</summary>

2 × 10^7 / 10^5 = 200/s average; ~400–600/s peak. One primary handles it.
</details>

<details><summary>2. 1 B log lines a day at 200 B each, kept for 30 days with replication 3. Storage?</summary>

10^9 × 200 B = 200 GB/day × 30 = 6 TB × 3 = 18 TB.
</details>

<details><summary>3. 5,000 req/s, each response 50 KB. Egress bandwidth?</summary>

5,000 × 50 KB = 250 MB/s = 2 Gbps. That's a strong hint to cache at the edge or a CDN.
</details>

## Go deeper

- *System Design Interview* (Alex Xu), vol. 1, chapter 2: "Back-of-the-envelope Estimation"
- Jeff Dean, "Numbers Everyone Should Know" (talk slides)
- Older notes in this repo: `archive/notes/hld-parts/part5.md`, sections "2. Back-of-Envelope Calculations (Mental Math Mastery)" and "Module 5.2: Estimation & Capacity Planning (Deep Dive)"
- Next: [networking basics](./03-networking-basics.md)
