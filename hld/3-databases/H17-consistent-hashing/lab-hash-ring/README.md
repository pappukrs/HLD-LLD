# 01 · Consistent hash ring with virtual nodes

> Time box: **60 min**
> Concept: [Consistent hashing](../README.md) · Visual: [v04 consistent hashing](../visual.html)

## What it is

A hash ring maps keys to servers. Servers and keys are hashed onto the same circle of `2^32` positions. A key belongs to the first server position clockwise from it. When you add or remove a server, only about `1/N` of the keys move. With `hash(key) % N`, almost all keys move.

Each physical server is placed on the ring many times ("virtual nodes"). This evens out the load and spreads a dead server's keys over many servers, not just one neighbour.

## Where it is used

- **DynamoDB, Cassandra, Riak**: decide which nodes own a partition key. The replica set is the next N distinct nodes clockwise.
- **Memcached clients (ketama), Redis client-side sharding**: pick a cache server per key.
- **Load balancers and CDNs**: sticky routing (same user, same backend) that survives scaling.
- **Discord, Akamai**: route sessions and content to servers.

## API to implement (`starter.ts`)

```ts
type HashFn = (key: string) => number;          // unsigned 32-bit int

function defaultHash(key: string): number;       // any good 32-bit hash

const ring = new ConsistentHashRing({ vnodes: 100, hash: defaultHash }); // both optional
ring.addNode('cache-a');        // adds 100 points, hashed as 'cache-a#0' .. 'cache-a#99'
ring.removeNode('cache-a');     // removes all its points
ring.hasNode('cache-a');        // → boolean
ring.nodes();                   // → physical nodes, sorted by name
ring.getNode('user:42');        // → owner node
ring.getNodes('user:42', 3);    // → owner + next 2 DISTINCT physical nodes clockwise
```

Rules the tests check:

| Rule | Detail |
|---|---|
| Virtual node names | Point `i` of node `X` is `hash(\`${X}#${i}\`)`. The tests use this with a fake hash. |
| Ownership | First point with position `>= hash(key)`. If none, wrap to the first point. |
| Errors | `getNode` on an empty ring throws. Adding an existing node throws. Removing an unknown node throws. |
| `getNodes(key, n)` | Returns `min(n, nodeCount)` nodes. No duplicates. `[0]` equals `getNode(key)`. |
| Order independence | The same nodes added in a different order give the same answers. |

## Complexity

Let `V = nodes × vnodes`.

| Operation | Time |
|---|---|
| `getNode` | `O(log V)` binary search |
| `getNodes(key, n)` | `O(log V + steps)`; steps are small in practice |
| `addNode` | `O(V log V)` if you re-sort, `O(V)` if you merge |
| `removeNode` | `O(V)` |
| Memory | `O(V)` |

## Hints

<details>
<summary>Hint 1: data structure</summary>

Keep one array of `{ hash, node }` sorted by `hash`. A sorted array plus binary search is enough. You do not need a tree. Membership changes are rare; lookups are very frequent.

</details>

<details>
<summary>Hint 2: binary search with wrap-around</summary>

Find the first index where `points[i].hash >= h` (a "lower bound" search). If that index equals `points.length`, the answer is index `0`.

</details>

<details>
<summary>Hint 3: replicas on distinct machines</summary>

From the owner's index, walk forward with `i = (i + 1) % points.length`. Keep a `Set` of nodes you already took. Skip a point if its node is in the set. Stop when you have `min(n, nodeCount)` nodes.

</details>

<details>
<summary>Hint 4: a bad hash ruins the balance</summary>

Names like `A#1`, `A#2` differ by one character. A weak hash puts them close together on the ring. Add a "finalizer" step (for example the murmur3 `fmix32`) after FNV-1a to mix the bits. Use `Math.imul` for 32-bit multiply and `>>> 0` to get an unsigned result.

</details>

<details>
<summary>Hint 5: hash collisions</summary>

Two points can get the same hash. Sort by `hash`, then by node name, so the result does not depend on insertion order.

</details>

## Extensions interviewers ask

1. **Weighted nodes.** A bigger machine gets more virtual nodes (for example `vnodes × weight`).
2. **Rebalancing data.** After `addNode`, which keys do you copy, and from where? Only keys in the arcs the new node now owns. They come from the old owner of each arc.
3. **Replicas across racks or zones.** Skip nodes in a zone you already used, not just the same node.
4. **Jump consistent hash or rendezvous hashing.** No ring at all. When are they better?
5. **Hot keys.** Consistent hashing does not fix one very hot key. You need key splitting or a cache in front.

## Related

- [Partitioning and sharding](../../H16-partitioning-sharding/README.md) · [Quorums and leaderless replication](../../H19-quorum-merkle/README.md)
- HLD problems: [Distributed key-value store](../../../case-studies/04-key-value-store/README.md) · [Distributed cache](../../../case-studies/17-distributed-cache/README.md)
