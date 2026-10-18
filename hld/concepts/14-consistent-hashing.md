# 14 · Consistent Hashing

> **Read time:** 35 min · **Visual:** [v04 consistent hashing](../../visuals/v04-consistent-hashing.html) · **Code it:** [hld/code/01-consistent-hashing](../code/01-consistent-hashing/README.md)
> **Shows up in:** key-value store, distributed cache, sharded DBs, sticky load balancing, CDN routing

## The idea in one line

Put servers and keys on the same hash circle and send each key to the first server clockwise. Adding or removing a server then moves only the keys in one arc, about `K/N`.

## The problem it solves

`server = hash(key) % N` is perfectly even, but when N changes (a scale-out or a crash), **almost every key moves**:

| Keys | N=3 → N=4 | Moved |
|---|---|---|
| 1,000,000 | `% 3` → `% 4` | ~750,000 (75%) |

For a cache, that means a near-total miss storm that lands on the database. For a datastore, it means moving most of your data over the network.

## How it works

1. Hash every server id to a position on a ring of `2^32` (or `2^64`) positions.
2. Hash every key with the **same** function.
3. Owner = the first server position `>=` the key's position, wrapping to the start of the ring.
4. Keep the server positions in a **sorted array** and binary-search it: `O(log V)` per lookup.

```
         0
     C3 ●   ● A        key k lands here ─┐
   k9                                    ▼
  A3 ●       ring      ● D     owner(k) = next ● clockwise
     C ●             ● C2
        D3 ● ● A2
```

**Adding server D** takes over only the arc `(previous server, D]`. **Removing B** hands B's arc to the next server clockwise.

### Virtual nodes (always mention them)

With only a few positions, the arcs are very uneven. One server can own 40% of the ring. Fix: put each server on the ring **100–200 times** (`A#0 … A#199`).

- The load evens out (the standard deviation falls roughly as `1/√vnodes`).
- When a server dies, its load is shared across **many** servers, not dumped on one neighbour.
- **Heterogeneous hardware**: give a 2× machine 2× the vnodes.

### Replication on the ring

Store each key on the next **R distinct physical servers** clockwise, skipping vnodes that belong to a server already chosen. Dynamo calls this the *preference list*. Spreading replicas across racks or AZs means also skipping servers in the same AZ.

## Numbers to remember

- Keys that move when going from N to N+1 servers: **~1/(N+1)**, versus **~N/(N+1)** with modulo.
- Lookup: binary search over `N × vnodes` positions. 100 servers × 200 vnodes = 20k entries, about 15 comparisons.
- Ring memory: 20k × (8B hash + pointer) ≈ a few hundred KB, so every client can hold it.

## Trade-offs and when not to use it

| Option | Use when | Weakness |
|---|---|---|
| `hash % N` | N never changes (a fixed shard count, e.g. 1024 logical shards) | Resharding moves everything |
| **Consistent hashing + vnodes** | Nodes come and go (caches, Dynamo-style stores) | Ring metadata must be shared; range queries are impossible |
| Fixed logical partitions → node map (Kafka, Elasticsearch, Redis Cluster's 16384 slots) | You want to move whole partitions explicitly | Need a control plane / directory |
| Jump consistent hash | Shards are numbered 0..N-1 and only added at the end | Can't remove an arbitrary node |
| Rendezvous (HRW) hashing | Small N; you want no ring at all | O(N) per lookup |
| Range partitioning | You need range scans (time series, ordered keys) | Hot spots on sequential keys |

**Redis Cluster does not use a ring.** It uses 16384 hash slots (`CRC16(key) % 16384`) assigned to nodes. This is a common follow-up trap.

## In real systems

- **DynamoDB / Cassandra / Riak**: a token ring with vnodes, plus replication to the next R nodes.
- **Memcached clients (ketama)**: client-side consistent hashing.
- **Envoy / Nginx `hash … consistent`**: sticky routing to upstreams.
- **Discord**: routes guilds to session servers with a ring.

## What to say in the interview

"I'll partition keys with consistent hashing and about 150 virtual nodes per server. That way, adding a node moves only about 1/N of the keys and the load stays even. Each key is replicated to the next 3 distinct physical nodes clockwise, across availability zones. The ring map lives in a config service like ZooKeeper or etcd, or is spread by gossip, and every client caches it."

## Common follow-ups

<details><summary>How do clients learn about ring changes?</summary>

Gossip (Cassandra), or a coordination service such as ZooKeeper or etcd that clients watch (many internal systems). Clients cache the ring. A request that reaches the wrong node gets a redirect (`MOVED` in Redis Cluster) or is forwarded.
</details>

<details><summary>What about hot keys? Consistent hashing doesn't fix them.</summary>

Right. One celebrity key still lands on one node. Fixes: replicate hot keys to several nodes and read from any of them; key-salting (`key#0..key#9`) for write-heavy counters; and a local in-process cache in front.
</details>

<details><summary>How do you move the data when a node joins?</summary>

The new node streams its arc from the current owners while they keep serving. When it has caught up, ownership flips in the ring metadata. Reads during the move can go to the old owner, or to both.
</details>

## Self-test (answer before opening)

<details><summary>1. 10 cache nodes, one dies. Roughly what share of keys miss with modulo vs ring?</summary>

Modulo: ~90% (N/(N+1) as N goes 10→9). Ring: ~10%, only the dead node's keys.
</details>

<details><summary>2. Why do virtual nodes help when a node fails?</summary>

The dead node's many small arcs are taken over by many different neighbours, so no single server gets double load.
</details>

<details><summary>3. You need `SELECT … WHERE ts BETWEEN a AND b`. Is consistent hashing a good partitioning choice?</summary>

No. Hashing destroys ordering, so a range scan has to ask every node. Use range partitioning (with a compound key to avoid hot spots).
</details>

## Go deeper

- DDIA, chapter 6 (Partitioning): "Partitioning by Hash of Key" and "Rebalancing"
- Amazon's Dynamo paper (2007), section 4.2
- Older notes in this repo: `archive/notes/hld-parts/part2.md`, the "Consistent Hashing (Deep Dive)" section
