# 25 · Unique ID Generation

> **Read time:** 30 min · **Visual:** none (bit layout below) · **Code it:** [hld/code/04-snowflake-id](../code/04-snowflake-id/README.md), [hld/code/05-base62-shortener](../code/05-base62-shortener/README.md)
> **Shows up in:** unique ID generator, URL shortener, chat system (message ids), news feed, payment system (payment and order ids), any sharded database

## The idea in one line

Make ids unique without a central bottleneck, and usually roughly time-ordered, by packing a timestamp, a machine id and a counter into 64 bits (Snowflake), or by using a time-ordered UUID.

## The problem it solves

`AUTO_INCREMENT` works on one database. After sharding, two shards both create order `1001`. A single "id DB" for everyone is a bottleneck and a single point of failure. Random UUIDs fix uniqueness, but they are 128 bits, they don't sort by time, and random inserts spread across a B-tree index, which hurts write speed and cache hit rate.

Most systems want ids that are:
- unique across all machines, with no coordination per id
- sortable by creation time (pagination, "latest messages", index locality)
- 64-bit if possible (fits a `BIGINT`, smaller indexes)
- created at high rate with low latency

## How it works

### Option 1: database sequences, made distributed

- **Multi-master with step**: 2 servers, one gives odd ids, the other even (`auto_increment_increment = 2`). Flickr's "ticket servers" did this. Hard to add a third server later.
- **Range (segment) allocation**: a central table hands out blocks. Each app server takes `[1,000,001 – 1,001,000]` and uses them from memory. One DB call per 1,000 ids. Pre-fetch the next block before the current one runs out.

### Option 2: UUIDs

| Version | Content | Sortable |
|---|---|---|
| UUIDv4 | 122 random bits | No |
| UUIDv7 (RFC 9562, 2024) | 48-bit Unix ms timestamp + random bits | Yes, by ms |
| ULID | 48-bit ms timestamp + 80 random bits, Crockford base32 | Yes |

No coordination at all. 128 bits. UUIDv7 or ULID fix the index-locality problem of v4.

### Option 3: Snowflake (Twitter, 2010)

```
| 1 bit  |      41 bits            |   10 bits   |   12 bits    |
| sign=0 | ms since custom epoch   | machine id  | sequence     |
```

- **41 bits of milliseconds** ≈ 69 years from your chosen epoch.
- **10 bits machine id** = 1,024 generators (often split as 5 bits datacenter + 5 bits worker).
- **12 bits sequence** = 4,096 ids per millisecond per generator. If it overflows, wait for the next millisecond.

```ts
next(): bigint {
  let now = Date.now();
  if (now < this.lastMs) throw new Error('clock moved backwards');
  if (now === this.lastMs) {
    this.seq = (this.seq + 1) & 0xfff;
    if (this.seq === 0) while ((now = Date.now()) <= this.lastMs) {}   // wait for next ms
  } else this.seq = 0;
  this.lastMs = now;
  return (BigInt(now - EPOCH) << 22n) | (BigInt(this.machineId) << 12n) | BigInt(this.seq);
}
```

**Assigning machine ids**: a lease from ZooKeeper or etcd, a Kubernetes StatefulSet ordinal, or a row in a DB claimed at boot. Two generators with the same machine id **will** create duplicates.

**Clock moving backwards** (NTP step): refuse to generate, or wait until the clock passes `lastMs`. Run NTP in slew mode so it adjusts gradually.

**Node.js warning**: JavaScript `Number` is exact only up to `2^53 − 1`. A 64-bit Snowflake does not fit. Use `BigInt` in code and send ids as **strings** in JSON. Twitter's API added `id_str` for exactly this reason.

### Short, user-facing ids

For URLs and referral codes, encode a numeric id in **base62** (`[0-9a-zA-Z]`). 7 characters give 62⁷ ≈ 3.5 trillion values. Sequential ids are guessable, so shuffle them (a bijective scramble or a keyed cipher) if that matters.

## Numbers to remember

- Snowflake: 41 + 10 + 12 bits → **~69 years**, **1,024** generators, **4,096 ids/ms** each (~4M ids/s per generator).
- UUID: 128 bits, 36 characters as text. UUIDv4 has 122 random bits; collisions are not a practical concern.
- Base62: 6 chars ≈ 56.8 billion, 7 chars ≈ 3.5 trillion.
- `2^53 − 1` = 9,007,199,254,740,991: the largest exact integer in a JS `Number`.

## Trade-offs and when not to use it

| Option | Use when | Weakness |
|---|---|---|
| DB auto-increment | One DB, small scale | Doesn't work across shards; leaks business volume |
| Range allocation | You want short, dense numeric ids (URL shortener) | Central allocator (cheap, but must be HA); ids not strictly time-ordered across servers |
| UUIDv4 | Simplicity, ids made on clients, offline creation | 128 bits; random index inserts; not sortable |
| UUIDv7 / ULID | Need sortable ids with no coordination | 128 bits; ms-level ordering only |
| Snowflake | High volume, 64-bit, time-sortable | Machine id assignment; clock skew |
| Instagram-style (time + shard id + seq, made inside Postgres) | Id should tell you which shard holds the row | Ties ids to the shard layout |

Time-sorted ids give **rough** order across machines, not exact order. Two ids from different machines in the same millisecond can be in either order. Don't use them as a strict event sequence.

## In real systems

- **Twitter Snowflake**: the original 64-bit design. **Discord** uses Snowflake ids with its own epoch (2015).
- **Instagram**: 41 bits time + 13 bits logical shard id + 10 bits sequence, generated by a PL/pgSQL function inside each Postgres shard.
- **Flickr**: ticket servers with `REPLACE INTO` on two MySQL hosts (odd/even).
- **Meituan Leaf**: an open-source generator offering both segment (range) and Snowflake modes.
- **MongoDB ObjectId**: 12 bytes = 4-byte timestamp + 5-byte random value + 3-byte counter.

## What to say in the interview

"I'll use a Snowflake-style 64-bit id: 41 bits of milliseconds, 10 bits of worker id, 12 bits of sequence. Each app pod generates ids locally with no network call. Worker ids are leased from etcd at startup, so no two pods share one. If the clock goes backwards, the generator refuses until it catches up. Ids are roughly time-sorted, so they work for keyset pagination and keep B-tree inserts at the right end. I return them as strings in JSON because a JavaScript Number can't hold 64 bits."

## Common follow-ups

<details><summary>Why are random UUIDv4 primary keys slow in MySQL/InnoDB?</summary>

InnoDB clusters rows by primary key. Random keys insert into random pages, causing page splits and a working set that doesn't fit in the buffer pool. Time-ordered keys always append near the right edge of the B-tree.
</details>

<details><summary>You need more than 1,024 generators. What do you change?</summary>

Re-split the bits: for example 39 bits of time units of 10 ms (Sonyflake uses 10 ms units), more worker bits, fewer sequence bits. Pick based on expected ids per ms per worker and service lifetime.
</details>

<details><summary>Can you get globally strict ordering?</summary>

Only with a single sequencer (one Kafka partition, one DB sequence) or a consensus log. That limits throughput to one leader. Most systems need order per entity (per chat, per account), which a per-entity sequence or a partition key gives you.
</details>

## Self-test (answer before opening)

<details><summary>1. A Snowflake generator gets 6,000 requests in one millisecond. What happens?</summary>

The first 4,096 get ids. The sequence wraps to 0, and the generator waits for the next millisecond to issue the rest.
</details>

<details><summary>2. You send `{"id": 1541815603606036480}` to a browser. What can go wrong?</summary>

`JSON.parse` turns it into a `Number`, which rounds anything above 2^53. The id changes silently. Send it as a string.
</details>

<details><summary>3. URL shortener: Snowflake or range allocation?</summary>

Range allocation (or a counter) + base62. It gives short, dense codes (7 chars). A 64-bit Snowflake in base62 is ~11 characters.
</details>

## Go deeper

- Alex Xu, *System Design Interview* Vol. 1, chapter 7: "Design a Unique ID Generator in Distributed Systems"
- RFC 9562 (UUID versions, including v7); Instagram engineering blog: "Sharding & IDs at Instagram"
- Practice: [hld/problems/03-unique-id-generator](../problems/03-unique-id-generator/README.md), [hld/problems/01-url-shortener](../problems/01-url-shortener/README.md)
- Older notes in this repo: `archive/notes/hld-parts/part6a.md`, "1.1 ID Generation Strategies - The Core Problem" and "1.2 Base62 Encoding - Making IDs URL-Safe"; `archive/notes/hld-parts/part6b.md`, "3.1 Global Uniqueness without Coordination"
