# SD Day 15 — Consistent Hashing

*(~1 hr · start of the "building blocks" block. Days 1–14 were fundamentals; now we learn the
*mechanisms* the later designs are built from. Day 8 asked "how do I split data across N shards?" and
left a problem hanging: **what happens when N changes?** Today answers it. Pairs with Day 3 (cache
clusters), Day 8 (sharding/partitioning), Day 13 (distributed rate limiting), and Day 27 (Redis at
scale — Redis Cluster uses a cousin of this). You've run Redis clusters and sharded Mongo/MySQL — today
names the algorithm that keeps a cluster from melting down when a node joins or dies.)*

---

## 1. The problem: `hash(key) % N` is a trap

You have a key (a user id, a cache key, a session) and **N** servers. The obvious way to pick a server:

```
server = hash(key) % N
```

This is **fast, even, and stateless** — and it's a **time bomb**. The moment **N changes** (a node
crashes, you add capacity, an autoscaler reacts), `% N` becomes `% (N±1)` and **almost every key now
maps to a different server.**

> Concrete: with 4 servers, `hash=100 → 100 % 4 = 0`. Add one server → `100 % 5 = 0`… but
> `hash=101 → 101 % 4 = 1` vs `101 % 5 = 1`; do the arithmetic across a range and you find **~75–80%
> of keys move** when you go 4→5. With a cache, that means a near-total **cache miss storm** — every
> moved key misses, all traffic stampedes the database at once (Day 3's **cache stampede**, but
> cluster-wide). For a sharded DB it means a massive, near-total **data reshuffle**.

> **One line:** *`hash % N` distributes evenly but remaps almost everything when N changes — useless
> for a cluster whose size actually changes.*

What we want: when a node joins or leaves, **only the keys that *have* to move, move** — roughly
**1/N of them** — and everyone else stays put. That's exactly what **consistent hashing** buys.

---

## 2. The idea: a hash ring

Stop thinking "modulo." Think of the hash space — say `0 … 2³²−1` — bent into a **circle** (a **ring**),
where the largest value wraps around to `0`.

1. **Place the servers on the ring:** hash each server's id (e.g. `hash("node-A")`) to a point on the
   circle. Now A, B, C sit at fixed angles.
2. **Place a key on the ring:** hash the key to a point too.
3. **Walk clockwise** from the key until you hit the first server. **That server owns the key.**

```
            0 / 2³²
              ●  ← key k1 lands here
        A ◐        ◑ B
              ●  ← walk clockwise from k1 → first node hit is B → B owns k1
        C ◐        
```

Each server is responsible for the **arc** of the ring **between the previous node (going
counter-clockwise) and itself** — i.e. all keys that land in the slice leading up to it.

> **Mental model:** a clock face. Keys are timestamps; each server "owns" everything from the previous
> server's mark up to its own mark. To find a key's owner, start at the key and go clockwise to the
> next server.

---

## 3. Why it survives add/remove (the whole point)

**Remove a node** (B crashes): only the keys B owned now walk one step further clockwise to the **next**
node (C). **A's and C's existing keys don't move.** You lose ~**1/N** of the placements, not 80% of
them.

**Add a node** (insert D between A and B): D claims only the arc **between A and D**. Those keys (which
used to belong to B) move to D. **Every other key stays exactly where it was.**

> So a join or leave reshuffles only ≈ **K/N keys** (K = total keys), versus ≈ **K keys** with
> `hash % N`. That's the difference between a 5-second blip and a database-melting cache stampede.

> **Hook:** *"`% N` moves everyone when N changes; the ring moves only the dead node's neighbors."*

This is *the* reason every distributed cache (Memcached clients, DynamoDB, Cassandra, Riak) and Redis
Cluster (via hash slots — §6) uses this family of algorithms instead of plain modulo.

---

## 4. The flaw and the fix: virtual nodes

Naïve ring has two real problems, both from **placing each server at a single random point**:

1. **Uneven load.** Random points don't split the circle evenly — one server can land on a huge arc
   and get far more keys than another. (Statistically the largest arc can be several× the average.)
2. **Lumpy rebalancing.** When a node dies, **all** of its load dumps onto its **single** clockwise
   neighbor — which can then tip over (cascading failure), instead of the load spreading out.

**Fix — virtual nodes (vnodes):** place each physical server on the ring at **many** points (say
100–200) by hashing `hash("node-A#0")`, `hash("node-A#1")`, … Each physical node becomes a swarm of
small arcs **scattered around the whole ring**.

Now:
- **Even load:** the law of large numbers smooths it out — more vnodes per server → tighter balance.
  (~100–200 vnodes/server gets the spread within a few percent.)
- **Smooth rebalancing:** when a node dies, its many little arcs are scattered, so its load is picked
  up by **many** different neighbors, not one. No single node absorbs the whole loss.
- **Heterogeneous hardware:** give a beefier server **more** vnodes → it gets a proportionally larger
  share. Weighting for free.

> **One line:** *Virtual nodes = each server sits at many points on the ring, so load is even and a
> failure's load spreads across many nodes instead of crushing one neighbor.*

> **Hook:** *"One point per node is lumpy; scatter each node as 150 vnodes and the ring balances."*

---

## 5. Replication on the ring (how real systems use it)

Consistent hashing doesn't just pick **one** owner — it naturally gives you the **replica set**: to
store a key on **R** replicas, walk clockwise from the key and take the **first R *distinct physical*
nodes** you encounter. (Skip extra vnodes of a node you already picked — replicas must be distinct
machines, ideally distinct racks/AZs.)

That "next R nodes clockwise" set is Dynamo's **preference list**. It's how Cassandra/DynamoDB place a
row and its copies, and it composes with the consistency knobs from Days 9–10: **quorum** reads/writes
(`R + W > N`) over that replica set give you tunable consistency. So one elegant idea — a hash ring with
vnodes — gives you **placement, replication, and the basis for quorum** all at once.

---

## 6. Variants you should be able to name

- **Hash-slot / fixed-bucket (Redis Cluster):** instead of an abstract continuous ring, define a fixed
  number of **slots** — Redis uses **16384** (`CRC16(key) % 16384`). Each slot is *assigned* to a node.
  Adding a node = **move some slots** to it; the slot→node map is explicit and gossiped. It's
  consistent hashing's spirit (move ~1/N of data, not all) with **simpler, explicit ownership** you can
  inspect and rebalance deliberately. (This is the model you actually operated when you ran Redis
  Cluster — worth saying out loud.)
- **Rendezvous hashing (HRW — Highest Random Weight):** for each key, compute `hash(key, node)` for
  **every** node and pick the **max**. No ring to maintain; add/remove a node and only that node's keys
  move. Simpler to reason about, naturally weightable; cost is **O(N) per lookup** (fine for small N).
- **Jump consistent hash (Google):** a tiny, fast function mapping a key to one of N buckets with
  minimal movement and **no memory** — but buckets must be numbered `0…N−1` (you can only remove the
  *last* one), so it fits stateless shard counts, not arbitrary node-id churn.

> Interview-safe summary: *"Classic consistent hashing = a hash ring with virtual nodes. Redis Cluster
> uses the fixed-slot variant (16384 slots); Dynamo/Cassandra use the ring with vnodes + a clockwise
> preference list for replicas; rendezvous hashing is the ring-free alternative for small N."*

---

## 7. Where it shows up (so you can drop it naturally)

- **Distributed caches:** spread keys across cache nodes so adding/removing a node doesn't cold-start
  the whole cache (Day 3). The canonical use.
- **Sharded databases:** place rows/partitions across shards with cheap resharding (Day 8 — this is the
  missing piece from that day).
- **Distributed rate limiting (Day 13):** route a given user/API-key's counter consistently to the same
  limiter node so the token-bucket state lives in one place.
- **Sticky routing / sessions:** consistently map a user to the same backend (e.g. a stateful
  WebSocket/SFU node) — relevant to your **Mediasoup** work: you want a given room's participants to
  land on the **same media node**, and consistent hashing on `roomId` gives you that without a central
  lookup, while still letting you add media nodes.
- **Service meshes / load balancers:** consistent-hash load balancing (Envoy/Nginx `hash` upstreams) to
  maximize cache hit ratios on the backend.

---

## 8. Back-of-envelope intuition (say the numbers)

- **Keys moved on a join/leave:** ≈ **K / N** (one node's share), vs ≈ **K** for `% N`. With 10 nodes,
  adding one moves ~**9–10%** of keys, not ~**90%**.
- **Vnodes per server:** ~**100–200** is the usual sweet spot — enough to balance within a few percent,
  not so many that the routing table is huge.
- **Lookup cost:** find the key's point, then the next vnode clockwise → a **binary search over a sorted
  ring** = **O(log V)** (V = total vnodes). Cheap.

---

## 9. The traps that catch people

1. **Proposing `hash % N` for a cluster that scales.** The instant the interviewer says "now add a
   node," you must already be reaching for the ring. Naming the **stampede / full-reshuffle** failure is
   the senior move.
2. **Forgetting virtual nodes.** A plain ring has uneven load *and* dumps a dead node's whole load on
   one neighbor. If you say "consistent hashing" without "vnodes," expect "won't node sizes drift?"
3. **Thinking it gives perfectly even load.** It gives *good* balance with enough vnodes, not perfect —
   **hot keys** still exist (a single celebrity key can't be split by hashing alone; you need
   replication/splitting on top — Day 8's hot-key problem).
4. **Confusing it with a load balancer's job.** Consistent hashing answers *"which node owns this
   **key**?"*; round-robin/least-connections (Day 2) answer *"which node takes this **request**?"* —
   related but different questions.
5. **Not mentioning replication.** "Walk clockwise to the next **R distinct physical** nodes" is the
   detail that shows you know how real stores (Dynamo/Cassandra) place replicas, not just toy single-copy
   placement.

---

## 10. The whole day on one page (say it out loud)

> *"If you place keys with `hash(key) % N`, the distribution is even but **brittle**: change N by one
> and almost every key remaps, which for a cache is a cluster-wide miss storm and for a DB is a full
> reshuffle. **Consistent hashing** fixes this by hashing both keys and nodes onto a **ring** (a
> circular hash space); a key is owned by the **first node clockwise**. Now a join or leave only moves
> the **~1/N keys** between two neighbors — everyone else stays put. The naïve ring is lumpy, so each
> physical node is scattered as **100–200 virtual nodes**, which evens out load and spreads a failed
> node's work across **many** survivors instead of crushing one. To replicate, walk clockwise to the
> next **R distinct physical** nodes — that 'preference list' is how Dynamo/Cassandra place copies and
> run quorums. Redis Cluster uses the close cousin: **16384 fixed hash slots** assigned to nodes, so
> rebalancing is just moving slots. I'd use it for distributed caches, sharded DBs, sticky routing, and
> distributed rate-limit counters — anywhere the node count actually changes."*

**Why it matters next:** consistent hashing is the placement layer under the next building blocks —
**bloom filters / count-min sketch** (cheap membership & frequency, often *per shard*), then **unique ID
generation (Snowflake)** for keys that are time-ordered *and* shardable. By the mock-design phase, "how
do you shard and rebalance this?" should reflexively pull up the ring.
