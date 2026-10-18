# 04 · Snowflake ID generator

> Time box: **45 min**
> Concept: [Unique ID generation](../../concepts/25-unique-id-generation.md)

## What it is

A Snowflake id is a 64-bit number that each server can generate **alone**, with no coordination and no database round trip. Ids are unique and roughly sorted by time.

```
 63   62 ............................ 22   21 ........ 12   11 ........ 0
| 0 | 41 bits: ms since custom epoch    | 10 bits: worker | 12 bits: seq  |
```

| Part | Bits | Range | Meaning |
|---|---|---|---|
| Sign | 1 | always 0 | Keeps the id positive in signed 64-bit (Java `long`, Postgres `bigint`) |
| Timestamp | 41 | `2^41` ms ≈ 69.7 years | Milliseconds since your own epoch |
| Worker id | 10 | 0..1023 | Which generator made it. Unique per process |
| Sequence | 12 | 0..4095 | Counter inside one millisecond |

One worker can make 4096 ids per ms, about 4 million per second.

## Where it is used

- **Twitter / X**: tweet ids (the original Snowflake, 2010).
- **Discord**: message and user ids (epoch 2015-01-01).
- **Instagram**: a variant with a shard id, generated inside Postgres.
- **Sony Sonyflake, Baidu UidGenerator, MongoDB ObjectId**: the same idea with other bit splits.
- Good for primary keys you want **time-ordered** (B-tree friendly, "newest first" by id), unlike random UUIDv4.

## API to implement (`starter.ts`)

```ts
const gen = new Snowflake({ workerId: 7, epoch: DEFAULT_EPOCH, clock: () => Date.now() }); // epoch and clock optional
const id: bigint = gen.nextId();
parseSnowflake(id);            // → { timestamp, workerId, sequence }  (timestamp is Unix ms)
parseSnowflake(id, epoch);     // pass the epoch if you used a custom one
```

Rules the tests check:

| Rule | Detail |
|---|---|
| Layout | `id = (now - epoch) << 22 \| workerId << 12 \| sequence`, as a `bigint` |
| Worker id | Integer in `0..1023`, else the constructor throws |
| Same ms | `sequence + 1` |
| New ms | `sequence = 0` |
| Rollover | After sequence 4095 in one ms, **keep calling `clock()`** until it returns a later ms. Then use sequence 0. |
| Clock goes back | `now < last ms` → throw `ClockMovedBackwardsError`. Never return a duplicate. |
| Range | `now < epoch` throws. `now - epoch >= 2^41` throws. |
| Order | Ids from one worker are strictly increasing. |

## Complexity

`nextId` is `O(1)`. In the worst case it waits less than 1 ms. Memory is `O(1)`: the last ms and the sequence.

## Hints

<details>
<summary>Hint 1: why bigint</summary>

JS numbers are exact only up to `2^53`. A Snowflake id needs 63 bits. Use `bigint` for the id (`5n << 22n`). Keep the clock and sequence as normal numbers and convert with `BigInt(x)` at the end.
When you send the id in JSON, send it as a **string**. `JSON.parse` would lose digits on a number this big.

</details>

<details>
<summary>Hint 2: the state you need</summary>

Only two fields: `lastMs` and `sequence`. Compare `now` with `lastMs` on every call.

</details>

<details>
<summary>Hint 3: the rollover</summary>

`sequence = (sequence + 1) & 4095`. If the result is 0, the ms is full. Loop: `while (now <= lastMs) now = clock()`. The test clock stays on the same ms for a few calls and then moves on, so your loop must call `clock()` again each time.

</details>

<details>
<summary>Hint 4: the clock moving backwards</summary>

NTP can move the system clock back. If you keep going, you can repeat an old `(timestamp, sequence)` pair and produce a duplicate id. Throwing is the safe default. Real systems also: wait if the jump is small (a few ms), or switch to a spare worker id.

</details>

## Extensions interviewers ask

1. **Who assigns worker ids?** Static config, ZooKeeper/etcd sequential nodes, or a lease in Redis/DB. What if two processes get the same id?
2. **Different split.** Fewer worker bits and more sequence bits? Add a datacenter field (Twitter used 5 + 5)?
3. **Sorted across machines?** Only roughly ("k-sorted"). Clocks on two machines differ by some ms.
4. **Ids leak information.** Anyone can read the creation time and the rough volume. Is that a problem for your product?
5. **Compare** with UUIDv4, UUIDv7, ULID, DB auto-increment, and ticket servers (Flickr).

## Related

- HLD problems: [Unique ID generator](../../problems/03-unique-id-generator/README.md) · [URL shortener](../../problems/01-url-shortener/README.md)
- Next: [Base62 shortener and ID ranges](../05-base62-shortener/README.md)
