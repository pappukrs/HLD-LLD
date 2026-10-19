# SD Day 15 — Quiz: Consistent Hashing

*Answer each OUT LOUD, in your own words, before expanding. If you fumble, re-read that section.
Target: explain **why `% N` fails** (Q1), **how the ring limits movement to ~1/N** (Q3), and **what
virtual nodes fix** (Q5) cold — those three are the whole differentiator.*

---

**Q1. What's wrong with `server = hash(key) % N`, and why is it especially dangerous for a cache?**

<details><summary>answer</summary>

It's even and fast but **brittle to N changing**. When a node joins/leaves, `% N` becomes `% (N±1)`
and **~75–80% of keys remap** to a different server. For a **cache** that's a cluster-wide **miss
storm**: every moved key now misses, so all that traffic stampedes the database at once (a cluster-scale
**cache stampede**). For a sharded DB it's a near-total **data reshuffle**. We want only the keys that
*must* move (≈ **1/N**) to move when N changes.
</details>

---

**Q2. Describe the hash ring and how a key finds its owning node.**

<details><summary>answer</summary>

Take the hash space (e.g. `0…2³²−1`) and bend it into a **circle** where the max wraps to 0. **Hash
each node** to a point on the ring, and **hash each key** to a point too. To find a key's owner, start
at the key and **walk clockwise** to the **first node** you hit — that node owns the key. Equivalently,
each node owns the **arc** from the previous node up to itself.
</details>

---

**Q3. When a node is added or removed, roughly how many keys move, and which ones?**

<details><summary>answer</summary>

About **K/N** (one node's share), not K. **Remove** a node → only **its** keys walk clockwise to the
next node; everyone else stays. **Add** a node between A and B → it claims only the arc **between A and
the new node** (keys that used to belong to B); every other key is untouched. So a join/leave is a small
local reshuffle, not a global one.
</details>

---

**Q4. The naïve ring (one point per node) has two problems. Name them.**

<details><summary>answer</summary>

(1) **Uneven load** — random single points don't split the circle evenly, so one node can land on a
huge arc and get disproportionate traffic. (2) **Lumpy rebalancing** — when a node dies, **all** its
load dumps onto its **single** clockwise neighbor, which can then tip over (cascading failure) instead
of the load spreading out.
</details>

---

**Q5. What are virtual nodes and which problems do they fix?**

<details><summary>answer</summary>

Each **physical** server is placed on the ring at **many** points (≈100–200), by hashing `node#0`,
`node#1`, …, so each server is a swarm of small arcs scattered around the whole ring. This fixes both
problems: **even load** (law of large numbers smooths the distribution) and **smooth rebalancing** (a
dead node's many little arcs are absorbed by **many** different neighbors, not one). Bonus: give beefier
hardware **more** vnodes to weight its share.
</details>

---

**Q6. How do you place R replicas of a key on the ring, and what's that set called?**

<details><summary>answer</summary>

Walk clockwise from the key and take the **first R *distinct physical* nodes** (skip extra vnodes of a
node you've already chosen — replicas must be different machines/racks/AZs). That clockwise set is
Dynamo's **preference list**. It composes with quorum (`R + W > N`, Days 9–10) for tunable consistency —
so the ring gives you placement, replication, and quorum from one structure.
</details>

---

**Q7. How does Redis Cluster do this, and how does it differ from the abstract ring?**

<details><summary>answer</summary>

Redis Cluster uses **fixed hash slots**: **16384** of them, `slot = CRC16(key) % 16384`, and each slot
is **explicitly assigned** to a node (the map is gossiped between nodes). Adding a node = **move some
slots** to it. Same spirit as consistent hashing (move ~1/N of data, not all) but with **explicit,
inspectable ownership** you can rebalance deliberately — instead of an abstract continuous ring of
arcs.
</details>

---

**Q8. Name an alternative to the ring and its trade-off.**

<details><summary>answer</summary>

**Rendezvous hashing (HRW):** for a key, compute `hash(key, node)` for **every** node and pick the
**max** — only that node's keys move on add/remove, no ring to maintain, naturally weightable; cost is
**O(N) per lookup** (fine for small N). Or **jump consistent hash**: tiny, no memory, minimal movement,
but buckets must be `0…N−1` (you can only drop the *last* bucket) — good for stateless shard counts, not
arbitrary node churn.
</details>

---

**Q9. Does consistent hashing solve hot keys? What's the limit?**

<details><summary>answer</summary>

No. It gives **good balance of *distinct* keys** with enough vnodes, but a **single hot key** (a
celebrity, one viral item) still hashes to **one** node — hashing can't split a single key. You need
extra tactics on top: **replicate** the hot key across nodes, **split** it (key suffixing/sharding the
counter), or cache it at the edge. (This is Day 8's hot-key problem resurfacing.)
</details>

---

**Q10. What's the difference between consistent hashing and a load balancer's algorithm?**

<details><summary>answer</summary>

They answer different questions. Consistent hashing answers *"which node **owns this key/data**?"*
(stateful placement — caches, shards, counters). A load balancer's **round-robin / least-connections**
(Day 2) answers *"which node should take **this request**?"* (stateless distribution of work). You can
combine them — e.g. a **consistent-hash load balancer** routes by a key to maximize backend cache hits —
but don't conflate placement with request distribution.
</details>

---

**Q11 (interview close). In 30 seconds: why consistent hashing, and how does it actually work?**

<details><summary>answer</summary>

"`hash % N` is even but brittle — change N by one and ~80% of keys remap, melting a cache or
reshuffling a DB. **Consistent hashing** hashes keys *and* nodes onto a **ring**; a key is owned by the
**first node clockwise**, so a join/leave only moves the **~1/N keys** between two neighbors. I scatter
each physical node as **~150 virtual nodes** so load is even and a failure spreads across many survivors,
and I replicate by taking the **next R distinct physical nodes** clockwise — Dynamo's preference list.
Redis Cluster is the fixed-slot cousin: **16384 slots** moved between nodes. I'd use it for distributed
caches, sharded DBs, sticky routing, and distributed rate-limit counters."
</details>

---

> Next (building blocks): **bloom filters & count-min sketch** — probabilistic structures for cheap
> *membership* ("is this key definitely-not / maybe present?") and *frequency* at scale, often applied
> **per shard** placed by today's ring — then **unique ID generation (Snowflake)** for keys that are
> time-ordered and shard-friendly.
