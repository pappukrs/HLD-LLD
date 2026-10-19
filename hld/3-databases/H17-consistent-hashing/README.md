# H17 · Consistent hashing

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/3-databases/H17-consistent-hashing/demo.ts`) · **Lab:** [lab-hash-ring](lab-hash-ring/README.md)
> **Builds on:** [H16 Partitioning and sharding](../H16-partitioning-sharding/README.md) · [H09 Caching](../../2-scaling/H09-caching/) · [H08 Load balancing](../../2-scaling/H08-load-balancing/) · **Used in:** Key-value store, Distributed cache, URL shortener, Rate limiter, Chat system, Distributed message queue

## The idea in one line

Put servers and keys on the same hash circle and give each key to the first server clockwise. When a server joins or leaves, only the keys in one arc move (about `1/N` of them), not almost all of them.

## Why it matters (the problem it solves)

The obvious way to spread keys over N servers is `server = hash(key) % N`. It is even and O(1). But it breaks the moment N changes:

| Change | Keys that move with `% N` | Keys that move with a ring |
|---|---|---|
| 4 → 5 nodes (scale out) | ~80% (`1 - 1/5`) | ~20% (only the new node's share) |
| 10 → 9 nodes (one dies) | ~90% | ~10% (only the dead node's keys) |

(`demo.ts` measures these on 100k keys: 79.9% vs 18.5%.)

Why that hurts:
- **Cache cluster:** 80% of keys now point to a node that does not have them. Almost every request misses at the same time and the database takes the full load. This is a cluster-wide cache stampede.
- **Sharded datastore:** 80% of the data has to be copied over the network before the cluster is healthy again.
- **Sticky routing:** 80% of users land on a new backend. WebSocket sessions drop and reconnect together.

Nodes change all the time: autoscaling, deploys, crashes. We want a placement where a change of one node moves only the keys that have to move.

## How it works

### 1. The ring

Take the hash output space, `0 .. 2^32 - 1`, and bend it into a circle so the largest value wraps to 0.

1. Hash each server id onto the ring: `hash("cache-a")`.
2. Hash each key with the **same** function: `hash("user:42")`.
3. Owner = the first server position **at or after** the key, going clockwise. If you pass the end, wrap to the first position.

```
                    0
                ●  A (30°)
     C (262°) ●          ● k2 (47°) ──┐ walk clockwise
                                       ▼
               ring              ● B (150°)  owner(k2) = B
          k7 ●
                    ● k5 (167°) → walks on to C
```

Each server owns the **arc from the previous server (exclusive) to itself (inclusive)**.

### 2. Lookup is a binary search

Keep every server position in a **sorted array**. For a key, find the first position `>= hash(key)` (a lower-bound search). If the index is past the end, use index 0.

| Ring size | Comparisons per lookup |
|---|---|
| 3 servers × 1 point | 2 |
| 100 servers × 150 vnodes = 15,000 points | ~14 |

The whole ring for 15,000 points is about 240 KB, so every client or proxy can keep its own copy.

### 3. Adding and removing a node

```
Add D at 95°:                         Remove B:
  before:  A(30) ......... B(150)       before: A(30) .... B(150) .... C(262)
  after:   A(30) ..D(95).. B(150)       after:  A(30) ............... C(262)
  keys in (30, 95] move B → D           keys in (30, 150] move B → C
  every other key stays                 every other key stays
```

- **Join:** the new node takes over one arc. All moved keys come from **one** old owner (its clockwise neighbour).
- **Leave:** the dead node's arc goes to its clockwise neighbour.
- Moved keys ≈ `K / N`. Everything else is untouched.

### 4. The flaw: one point per server is lumpy

With few random points, arcs are very uneven:
- **Uneven load:** one server can own 40% of the ring while another owns 10%. `demo.ts` shows 1.70× vs 0.58× of the average with 4 nodes.
- **Lumpy failover:** when a node dies, **all** its load goes to **one** neighbour. That neighbour may now be at 2× load and fall over too (a cascading failure).

### 5. The fix: virtual nodes (vnodes)

Put each physical server on the ring **many times**: hash `cache-a#0`, `cache-a#1`, … `cache-a#149`. Each server becomes many small arcs spread all over the ring.

| Vnodes per server (4 servers) | Busiest node | Idlest node |
|---|---|---|
| 1 | 1.70× avg | 0.58× avg |
| 10 | 1.32× | 0.61× |
| 50–150 | ~1.05–1.10× | ~0.90× |
| 500 | 1.09× | 0.94× |

What vnodes give you:
- **Even load.** Many small arcs average out. The spread shrinks roughly as `1/sqrt(vnodes)`.
- **Smooth failover.** A dead node's many small arcs are taken by many different neighbours. In `demo.ts`, with 150 vnodes each survivor takes about one third. With 1 vnode, one neighbour takes 100%.
- **Weights for free.** A machine with 2× RAM gets 2× vnodes and so 2× the keys.

Cost: a bigger sorted array (still small) and more, smaller ranges to stream when a node joins.

### 6. Replication: the preference list

To keep R copies, walk clockwise from the key and take the **first R distinct physical nodes**. Skip a vnode if its physical server is already in the list. Also skip a server if its rack or AZ is already used, so one AZ outage cannot take all copies.

```
key k5 at 167°  →  D#3 (175°)  →  A#2 (190°)  →  D#2 (220°) skip, D already used  →  C#1 (262°)
preference list = [D, A, C]
```

This is the **preference list** from Amazon's Dynamo paper. Cassandra and Riak do the same. It plugs straight into quorums: with N=3 replicas, write to W=2 and read from R=2 so `R + W > N` (see [H19](../H19-quorum-merkle/)).

### 7. Who knows the ring?

The ring is metadata that every router must agree on.

| Approach | Example | How a change spreads |
|---|---|---|
| Client-side ring | Memcached ketama clients, Redis client sharding | Each client is configured with the node list |
| Gossip | Cassandra, Riak | Nodes gossip token ownership; clients learn from any node |
| Coordinator | ZooKeeper / etcd watched by routers | A watch fires; routers rebuild the ring |
| Redirect on miss | Redis Cluster `MOVED` | Wrong node answers "go to X"; client updates its map |

### 8. Moving data when a node joins

1. Add the new node to the ring as "joining". It does not own anything yet.
2. It streams the keys of its future arcs from the current owners. Old owners keep serving.
3. When it has caught up, flip ownership in the metadata.
4. Old owners delete the moved keys later.

For a pure cache you can skip the streaming: just add the node and accept ~1/N misses, which warm up quickly.

### 9. Related schemes you should be able to name

| Scheme | How | Good for | Weak spot |
|---|---|---|---|
| `hash % N` | Modulo | N never changes (e.g. a fixed 1024 logical shards) | Changing N moves almost everything |
| Ring + vnodes | Clockwise owner on a sorted ring | Nodes come and go: caches, Dynamo-style stores | No range queries; ring metadata must be shared |
| **Fixed hash slots** | Redis Cluster: `CRC16(key) % 16384` slots, slot → node map | Explicit, inspectable moves of whole slots | Needs a slot map (gossiped) |
| Rendezvous (HRW) | Pick the node with the highest `hash(key, node)` | Small N, no ring to keep, easy weights | O(N) per lookup |
| Jump consistent hash | Tiny function, buckets `0..N-1` | Numbered shards that only grow at the end | Cannot remove an arbitrary node |

**Trap:** "Redis Cluster uses consistent hashing." Not exactly. It uses 16,384 fixed slots. Same goal (move only a slice), different mechanism.

Kafka and Elasticsearch use the same "fixed partitions, move whole partitions" idea: the number of partitions is fixed, and only the partition → broker map changes.

## In TypeScript

The core is a sorted array and a lower-bound binary search. The full version (vnodes, replicas, measurements) is in [demo.ts](demo.ts). The lab builds a tested version.

```ts
class Ring {
  private points: { pos: number; node: string }[] = [];
  constructor(private readonly vnodes = 150) {}

  add(node: string): void {
    for (let i = 0; i < this.vnodes; i++) this.points.push({ pos: hash32(`${node}#${i}`), node });
    this.points.sort((a, b) => a.pos - b.pos);
  }

  owner(key: string): string {
    const h = hash32(key);
    let lo = 0, hi = this.points.length;
    while (lo < hi) {                       // first point with pos >= h
      const mid = (lo + hi) >>> 1;
      if (this.points[mid].pos < h) lo = mid + 1; else hi = mid;
    }
    return this.points[lo === this.points.length ? 0 : lo].node; // wrap around
  }
}
```

Replicas: start at the owner's index, walk `i = (i + 1) % points.length`, and collect nodes you have not seen until you have R.

## Trade-offs / when NOT to use it

- **You need range scans.** Hashing destroys key order. `WHERE ts BETWEEN a AND b` has to ask every node. Use range partitioning instead (see [H16](../H16-partitioning-sharding/README.md)).
- **The node count is fixed.** If you pre-split into 1024 logical shards and only move shards between machines, plain `% 1024` plus a shard → node map is simpler and easier to operate.
- **You want explicit control.** Fixed slots (Redis Cluster) let an operator say "move slots 0–500 to node 7". A ring decides arcs by hash.
- **Hot keys are not fixed.** One celebrity key still lands on one node, however many vnodes you have. Add replication of hot keys, key salting (`counter#0..#9`), or a local cache in front.
- **Small N and simple code.** Rendezvous hashing has no ring at all and is fine for 5–20 nodes.
- **A bad hash ruins it.** `A#1` and `A#2` differ by one character. A weak hash (or `String.hashCode`) puts them next to each other on the ring. Use a hash with good mixing (murmur3, xxhash, FNV + finalizer).

## Common mistakes

- Saying "consistent hashing" and **forgetting virtual nodes**. Without vnodes the load is uneven and failover overloads one neighbour. Always say the number: "100–200 vnodes per node".
- Claiming it **balances hot keys**. It balances many distinct keys. It cannot split a single key.
- Picking replicas as "the next R points" without skipping vnodes of the **same physical node**. Then two "replicas" are the same machine.
- Saying Redis Cluster uses a ring. It uses **16,384 hash slots**.
- Mixing it up with **load balancing**. Round robin answers "who takes this request?". Consistent hashing answers "who **owns** this key?". A consistent-hash load balancer combines both, to keep per-backend caches warm.
- Forgetting the **metadata** question: how do all clients agree on the ring, and what happens to a request that reaches the old owner?
- Forgetting that a join needs **data movement** for a datastore (stream the arc, then flip ownership).

## Say this in the interview

> "With `hash % N`, going from 4 to 5 nodes remaps about 80% of keys. For a cache that is a miss storm on the database. So I'll use consistent hashing: nodes and keys go on one hash ring, and a key belongs to the first node clockwise. A join or leave moves only about 1/N of the keys, and only between neighbours."

> "I'll give each physical node about 150 virtual nodes. That keeps the load within roughly 10% of even, spreads a failed node's keys over all survivors instead of one, and lets me weight bigger machines with more vnodes. For replication, each key goes to the next 3 distinct physical nodes clockwise, in different AZs. That is Dynamo's preference list, and I can run quorum reads and writes on it."

> "The ring map lives in etcd or is gossiped, and every client caches it. Consistent hashing does not fix a single hot key, so for those I'd add a local cache or split the key."

## Your experience hook

- **IoT WebSocket fleet (10k+ devices):** you ran Nginx `ip_hash` for sticky sessions. That is modulo-style hashing: adding a WebSocket node moves most devices, so they all reconnect at once. Nginx's `hash $remote_addr consistent;` (ketama) would move only ~1/N of devices. Good story: "what I would change at 10×".
- **Redis cache-aside (dashboard latency 400 ms → 160 ms):** if that cache grows into several Redis nodes, client-side consistent hashing (or Redis Cluster slots) keeps a node add from wiping the hit rate.
- **Socket.IO + Redis adapter:** the adapter broadcasts across nodes, so placement of a socket matters less. Contrast it: consistent hashing is about placing **state**, the adapter is about **delivering** messages wherever the state lives.

## Numbers to remember

| Fact | Value |
|---|---|
| Keys moved, N → N+1, modulo | ~`N/(N+1)` (4→5: 80%) |
| Keys moved, N → N+1, ring | ~`1/(N+1)` (4→5: 20%) |
| Vnodes per node | 100–200 (Cassandra old default 256, now 16 with a smarter token allocator) |
| Lookup | `O(log(N × vnodes))`: 15k points ≈ 14 comparisons |
| Ring memory | 15k points ≈ 240 KB |
| Redis Cluster | 16,384 slots, `CRC16(key) % 16384` |
| Typical replication | R = 3 distinct nodes across AZs |

## Self-test

<details><summary>1. 10 cache nodes, one dies. Roughly what share of keys miss with modulo vs a ring?</summary>

Modulo: about 90% (`% 10` becomes `% 9`). Ring: about 10%, only the dead node's keys.
</details>

<details><summary>2. A new node joins between A and B. Which keys move, and from where?</summary>

Only the keys in the arc from A up to the new node. They all used to belong to B (the next node clockwise). Nothing else moves.
</details>

<details><summary>3. Name the two problems of one point per node, and how vnodes fix each.</summary>

Uneven arcs (uneven load) and lumpy failover (one neighbour takes all of a dead node's load). Vnodes give each server many small arcs, so the load averages out and a dead node's arcs are spread over many survivors.
</details>

<details><summary>4. How do you place 3 replicas of a key, and what is that list called?</summary>

Walk clockwise from the key and take the first 3 distinct physical nodes, skipping extra vnodes of nodes already picked (and ideally nodes in an AZ already used). It is Dynamo's preference list.
</details>

<details><summary>5. Does Redis Cluster use a hash ring?</summary>

No. It uses 16,384 fixed hash slots, `CRC16(key) % 16384`, and an explicit slot → node map. Adding a node means moving some slots to it. A client hitting the wrong node gets a `MOVED` redirect.
</details>

<details><summary>6. You need `SELECT ... WHERE created_at BETWEEN a AND b`. Is consistent hashing a good partitioning choice?</summary>

No. Hashing destroys order, so a range query must go to every node. Use range partitioning, with a compound key (for example `tenant_id, created_at`) to avoid one hot "latest" partition.
</details>

<details><summary>7. One key gets 50k reads/sec. Does adding more vnodes help?</summary>

No. One key always hashes to one owner. Cache it locally or at the edge, read from all of its replicas, or split it into `key#0..key#9` for write-heavy counters.
</details>

<details><summary>8. When is rendezvous hashing a better choice than a ring?</summary>

When N is small (say under 20) and you want simple code with no ring to build or sync. Each lookup scores every node, so it is O(N), which is fine for small N. Only the removed node's keys move, and weights are easy.
</details>

## Go deeper

- Build and test it yourself: [lab-hash-ring](lab-hash-ring/README.md) (`starter.ts`, tests, `reference.ts`)
- Where the ring lives in a full design: [Key-value store](../../case-studies/04-key-value-store/README.md) · [Distributed cache](../../case-studies/17-distributed-cache/README.md) · [Distributed message queue](../../case-studies/18-distributed-message-queue/README.md) · [Rate limiter](../../case-studies/02-rate-limiter/README.md) · [Chat system](../../case-studies/06-chat-system/README.md) · [URL shortener](../../case-studies/01-url-shortener/README.md)
- Next concepts: [H19 Quorums and Merkle trees](../H19-quorum-merkle/) (quorums on the preference list) · [H18 CAP and PACELC](../H18-cap-pacelc-consistency/)
- Old long-form notes: [archive/notes/hld-parts/part2.md](../../../archive/notes/hld-parts/part2.md), section "Consistent Hashing (Deep Dive)"
- Papers: Karger et al. 1997 (the original), Amazon Dynamo 2007 (section 4.2), Lamping & Veach 2014 (jump consistent hash). DDIA chapter 6, "Rebalancing partitions".
