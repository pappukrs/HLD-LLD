# H28 · Unique ID generation (Snowflake, Base62)

> **Time:** ~40 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/5-reliability/H28-unique-ids/demo.ts`) · **Labs:** [lab-snowflake](lab-snowflake/README.md), [lab-base62](lab-base62/README.md)
> **Builds on:** [H11 Indexing](../../3-databases/H11-indexing/README.md) (B-tree insert locality) · [H16 Partitioning and sharding](../../3-databases/H16-partitioning-sharding/README.md) · **Used in:** [Unique ID generator](../../case-studies/03-unique-id-generator/README.md), [URL shortener](../../case-studies/01-url-shortener/README.md), [Chat system](../../case-studies/06-chat-system/README.md), [News feed](../../case-studies/07-news-feed/README.md), [Payment system](../../case-studies/08-payment-system/README.md)

## The idea in one line

Make ids unique without a central bottleneck, and roughly sorted by time, by packing a timestamp, a machine id and a counter into 64 bits (Snowflake), or by using a time-ordered UUID (v7 / ULID); for short public codes, write a number in base62.

## Why it matters (the problem it solves)

`AUTO_INCREMENT` works on one database. After sharding, shard 1 and shard 2 both create order `1001`. A single "id database" for everyone is a bottleneck and a single point of failure. Random UUIDv4 fixes uniqueness, but it is 128 bits, does not sort by time, and random inserts land all over the B-tree index, which hurts write speed and cache hit rate.

Most systems want ids that are:
- **unique** across all machines, with no network call per id
- **sortable by creation time** (keyset pagination, "latest messages first", index locality)
- **64-bit** if possible (fits a `BIGINT`, half the index size of a UUID)
- **fast**: thousands per millisecond per machine

## How it works

### Option 1: database sequences, made distributed

| Way | How | Catch |
|---|---|---|
| Multi-master with step | 2 servers: one gives odd ids, one even (`auto_increment_increment = 2`). Flickr's "ticket servers" | Hard to add a 3rd server later |
| Range (segment) allocation | A central counter hands out blocks: server A takes 1,000,001–1,001,000 and uses them from memory | One DB call per 1,000 ids; ids from different servers are not time-ordered |

Range allocation is what the [base62 lab](lab-base62/README.md) builds. Prefetch the next block at ~80% use so there is no pause. If a server dies, the rest of its block is lost: gaps are fine, duplicates are not.

### Option 2: UUIDs

| Version | Content | Sortable | Size |
|---|---|---|---|
| UUIDv4 | 122 random bits | No | 128 bits, 36 chars |
| UUIDv7 (RFC 9562, 2024) | 48-bit Unix ms + random bits | Yes, by ms | 128 bits |
| ULID | 48-bit ms + 80 random bits, Crockford base32 | Yes | 128 bits, 26 chars |
| MongoDB ObjectId | 4 B seconds + 5 B random + 3 B counter | Roughly | 96 bits |

No coordination at all, can be made on a phone offline. UUIDv7 / ULID fix the index-locality problem of v4. Collisions in 122 random bits are not a practical concern.

### Option 3: Snowflake (Twitter, 2010)

```
 bit 63  62 .................................. 22  21 .......... 12  11 ........... 0
┌──────┬───────────────────────────────────────┬─────────────────┬──────────────────┐
│ 0    │ 41 bits: ms since custom epoch         │ 10 bits: worker │ 12 bits: sequence│
└──────┴───────────────────────────────────────┴─────────────────┴──────────────────┘
          2^41 ms ≈ 69.7 years                   1,024 workers     4,096 ids per ms
```

```
id = (now − EPOCH) << 22  |  workerId << 12  |  sequence
```

Generator rules:
1. Same millisecond as last id → `seq++`. New millisecond → `seq = 0`.
2. `seq` passes 4,095 → **wait** for the next millisecond (spin until `now > lastMs`).
3. Clock went **backwards** (NTP step, VM migration) → refuse, or wait until the clock passes `lastMs`. Never issue ids with an old time: they may repeat.

**Assigning worker ids** is the real design question. Two generators with the same worker id **will** make duplicates.
- A lease from **etcd / ZooKeeper** at boot (ephemeral node, renewed while alive).
- A **Kubernetes StatefulSet** ordinal (`pod-0`, `pod-1`…).
- A DB row claimed at boot with a heartbeat column.

Common split of the 10 bits: 5 datacenter + 5 worker. If you need more than 1,024 generators, re-split: Sonyflake uses 39 bits of 10 ms units (174 years), 8 bits sequence, 16 bits machine.

**Order is rough, not strict.** Two ids from different workers in the same ms can be in either order, and clocks differ by a few ms. Fine for "sort the feed", wrong for "exact event order". Exact order needs one sequencer (one Kafka partition, one DB sequence) per entity.

### The JavaScript trap

`Number` is exact only up to `2^53 − 1` = 9,007,199,254,740,991. A Snowflake id is up to `2^63`. `JSON.parse('{"id":1851234567890123777}')` silently rounds the last digits. Use `BigInt` in code and send ids **as strings** in JSON. Twitter's API added `id_str` for exactly this reason. Discord sends all its snowflakes as strings.

### Short, user-facing ids: base62

For URLs and referral codes, write a numeric id in base62 (`0-9a-zA-Z`):

```
id = 125            125 = 2×62 + 1   → "21"
62^6 ≈ 56.8 billion     62^7 ≈ 3.52 trillion     (7 chars is enough for a URL shortener)
```

A 64-bit Snowflake in base62 is 10–11 characters, so short links use a **counter / range allocator + base62** instead. Sequential codes are guessable (`/abc124` after `/abc123`). If that matters, scramble the number first with a keyed bijection (e.g. multiply by a large number coprime to 62, mod 62^7, or a small Feistel cipher) so codes look random but stay unique.

### Picking one

```
Need ids on the client / offline?            → UUIDv7 or ULID
Need 64-bit, time-sorted, very high rate?    → Snowflake (lease worker ids)
Need short, dense codes (URL shortener)?     → range allocator + base62 (+ scramble)
Need the shard inside the id?                → Instagram style: time + shard id + seq
One DB, small scale?                         → plain BIGSERIAL, you are done
```

## In TypeScript

```ts
const EPOCH = 1704067200000n; // 2024-01-01 UTC, your own epoch

class Snowflake {
  private lastMs = -1n;
  private seq = 0n;
  constructor(private worker: bigint, private clock: () => bigint = () => BigInt(Date.now())) {
    if (worker < 0n || worker > 1023n) throw new Error('worker id must fit in 10 bits');
  }
  next(): bigint {
    let now = this.clock();
    if (now < this.lastMs) throw new Error(`clock moved back ${this.lastMs - now} ms`);
    if (now === this.lastMs) {
      this.seq = (this.seq + 1n) & 4095n;
      if (this.seq === 0n) while ((now = this.clock()) <= this.lastMs) { /* wait for next ms */ }
    } else this.seq = 0n;
    this.lastMs = now;
    return ((now - EPOCH) << 22n) | (this.worker << 12n) | this.seq;
  }
}

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function toBase62(n: bigint): string {
  let s = '';
  do { s = ALPHABET[Number(n % 62n)] + s; n /= 62n; } while (n > 0n);
  return s;
}
```

[demo.ts](demo.ts) generates ids, decodes them, shows sequence overflow, the clock-backwards guard, the `Number` precision bug, and base62 with a range allocator.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| DB auto-increment | One DB, small scale | Breaks across shards; leaks business volume (order #1043 = you are small) |
| Range allocation | Short, dense numeric ids (URL shortener) | Central allocator must be HA; not time-ordered across servers |
| UUIDv4 | Simplicity, ids made on clients | 128 bits; random index inserts; not sortable |
| UUIDv7 / ULID | Sortable ids with zero coordination | 128 bits; only ms-level order |
| Snowflake | High volume, 64-bit, time-sortable | Worker id assignment; clock skew |
| Instagram style (time + shard + seq in Postgres) | The id should tell you which shard holds the row | Ties ids to the shard layout |

Do not build Snowflake if one Postgres `BIGSERIAL` is enough. Do not use time-sorted ids where the creation time is a secret (they reveal it). Do not expose sequential ids in URLs if enumeration is a risk.

## Common mistakes

- Two pods with the same worker id (copy-pasted config, or a hash of the hostname that collides).
- Ignoring the clock going backwards.
- Sending 64-bit ids as JSON numbers to a browser or Node client.
- Using Snowflake + base62 for a URL shortener and getting 10–11-char codes.
- Claiming Snowflake ids give strict global order. They give rough order.
- UUIDv4 as the InnoDB primary key on a write-heavy table, then wondering why inserts slowed down.
- Forgetting that the epoch choice sets the lifetime: 41 bits from 1970 already ends in 2039.

## Say this in the interview

> "I'll use a Snowflake-style 64-bit id: 41 bits of milliseconds since our own epoch, 10 bits of worker id, 12 bits of sequence. Each pod generates ids in memory with no network call, up to 4,096 per millisecond. Worker ids are leased from etcd at startup, so no two live pods share one. If the clock moves backwards, the generator waits instead of issuing an id."

> "The ids are roughly time-sorted, so B-tree inserts stay at the right edge and we can paginate with `WHERE id < :cursor`. I return them as strings in JSON, because a JavaScript Number cannot hold 64 bits. For the short link itself, I use a range allocator plus base62, which gives 7-character codes for 3.5 trillion links."

## Your experience hook

- **Payment orchestration**: payment intents and idempotency keys need unique ids that are safe to make on any pod. Mention how the client-generated UUID idempotency key differs from the server's time-sorted payment id.
- **IoT, 10k devices + MongoDB → MySQL migration**: Mongo's ObjectId is already time-ordered (4-byte timestamp first). Moving to MySQL with a random UUID primary key would hurt inserts; a time-ordered BIGINT keeps InnoDB appends sequential.

## Numbers to remember

- Snowflake: 41 + 10 + 12 bits → **~69 years**, **1,024** workers, **4,096 ids/ms** each (~4M/s per worker).
- `2^53 − 1` = **9,007,199,254,740,991**: largest exact integer in a JS `Number`.
- UUID: 128 bits, 36 chars as text. ULID: 26 chars.
- Base62: 6 chars ≈ **56.8 billion**, 7 chars ≈ **3.5 trillion**, 11 chars cover any 64-bit number.
- Range allocation with blocks of 1,000: one DB write per 1,000 ids.

## Self-test

<details><summary>1. A Snowflake generator gets 6,000 requests in one millisecond. What happens?</summary>

The first 4,096 get ids with sequence 0–4,095. The sequence wraps, so the generator waits for the next millisecond and issues the rest with sequence 0, 1, 2…
</details>

<details><summary>2. You send {"id": 1851234567890123777} to a browser. What goes wrong?</summary>

`JSON.parse` makes it a `Number`, which rounds anything above 2^53. The id changes silently and the next API call uses the wrong id. Send it as a string.
</details>

<details><summary>3. URL shortener: Snowflake or range allocation?</summary>

Range allocation (or a counter) + base62. It gives short, dense codes (7 chars). A 64-bit Snowflake in base62 is 10–11 chars.
</details>

<details><summary>4. Why are random UUIDv4 primary keys slow in MySQL InnoDB?</summary>

InnoDB clusters rows by primary key. Random keys insert into random pages, causing page splits and a working set that does not fit in the buffer pool. Time-ordered keys always append at the right edge.
</details>

<details><summary>5. NTP moves the clock back 20 ms. What should the generator do, and why?</summary>

Refuse (or wait) until the clock passes `lastMs`. With the same worker id and an earlier time, it could repeat a (time, seq) pair it already used, which means a duplicate id.
</details>

<details><summary>6. How do you give 300 pods unique worker ids?</summary>

Lease them from etcd or ZooKeeper at startup (ephemeral key, renewed while alive), or use a StatefulSet ordinal. Never derive them from a random number or a hostname hash.
</details>

<details><summary>7. Can you get strict global order from ids?</summary>

Only with a single sequencer (one DB sequence, one Kafka partition) or a consensus log, which caps throughput at one leader. Most systems only need order per entity (per chat, per account), which a per-entity sequence or partition key gives.
</details>

## Go deeper

- Labs: [lab-snowflake](lab-snowflake/README.md) (bit packing, overflow, clock guard, decode) and [lab-base62](lab-base62/README.md) (encode/decode + range allocator)
- Case studies: [Unique ID generator](../../case-studies/03-unique-id-generator/README.md), [URL shortener](../../case-studies/01-url-shortener/README.md)
- Related: [H29 Consensus and locks](../H29-consensus-locks/README.md) (leasing worker ids from etcd)
- Archive notes: [hld-parts/part6a.md](../../../archive/notes/hld-parts/part6a.md) ("ID Generation Strategies", "Base62 Encoding"), [hld-parts/part6b.md](../../../archive/notes/hld-parts/part6b.md) ("Global Uniqueness without Coordination")
- Alex Xu, *System Design Interview* Vol. 1, ch. 7; RFC 9562 (UUIDv7); Instagram engineering, "Sharding & IDs at Instagram"
