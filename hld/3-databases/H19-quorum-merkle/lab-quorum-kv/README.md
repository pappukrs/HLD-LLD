# 08 · Quorum replicated KV (N, R, W) simulation

> Time box: **60 min**
> Concept: [Quorums and leaderless replication](../README.md) · Visual: [v08 quorum reads and writes](../visual.html)

## What it is

A leaderless key-value store keeps each key on **N** replicas. There is no leader. Any node can take a request and act as the coordinator.

- A **write** succeeds when **W** replicas confirm it.
- A **read** asks **R** replicas and returns the value with the **highest version** ("last write wins").
- If **R + W > N**, every read set overlaps every write set in at least one replica. So a read always sees the latest successful write.
- When a read finds a replica with an old value, it writes the new value back to it. This is **read repair**.

| N, R, W | Behaviour |
|---|---|
| 3, 2, 2 | Common default. Survives 1 node down for both reads and writes. |
| 3, 1, 3 | Fast reads. One node down blocks all writes. |
| 3, 3, 1 | Fast writes. One node down blocks all reads. |
| 3, 1, 1 | Fastest, but reads can be stale. |

You build a single-process simulation: N in-memory replicas, a coordinator, and switches to fail and recover nodes.

## Where it is used

- **Amazon Dynamo** (the 2007 paper), **Cassandra** (`QUORUM`, `ONE`, `ALL` consistency levels), **Riak**, **ScyllaDB**, **Voldemort**.
- DynamoDB's "strongly consistent read" option is the same trade-off, made with a leader per partition instead.

## API to implement (`starter.ts`)

```ts
const kv = new QuorumKV({ n: 3, r: 2, w: 2 });
kv.isStronglyConsistent;        // → r + w > n
kv.put('cart:1', '{...}');      // → version (number). Throws QuorumError if fewer than W up.
kv.get('cart:1');               // → { value, version } | undefined. Throws QuorumError if fewer than R up.
kv.failNode(0);                 // node ids are 0..n-1
kv.recoverNode(0);
kv.isUp(0);
kv.peek(0, 'cart:1');           // → what one replica holds (even if down). For tests.
```

Rules the tests check:

| Rule | Detail |
|---|---|
| Config | `n >= 1`. `r` and `w` are integers in `1..n`. Otherwise throw. |
| Versions | Each successful `put` gets a version larger than all earlier ones. |
| Write | If fewer than W replicas are up, throw `QuorumError` and write **nothing**. Else write to **every** up replica. |
| Read set | The first R up replicas, lowest id first. |
| Read result | The value with the highest version among them, or `undefined`. |
| Read repair | Each replica you read that is missing the key or has an older version gets the winner. Replicas you did not read are not touched. |
| Replica rule | A replica ignores a write whose version is not newer than what it has. |
| Recovery | A recovered node keeps its old data. It does not catch up by itself. |

The fixed read order (lowest ids first) is a simplification. It makes stale reads easy to show in tests. A real coordinator picks replicas by latency.

## Complexity

| Operation | Time (simulation) | Messages (real system) |
|---|---|---|
| `put` | `O(N)` | N requests, wait for W acks |
| `get` | `O(N)` to find up nodes, `O(R)` to read | R requests (often N, using the first R replies) |

## Hints

<details>
<summary>Hint 1: the replica</summary>

A replica is `{ up: boolean, data: Map<string, Versioned> }` with one rule: `write` keeps the new value only if `version > current.version`. Put this rule in the replica, not in the coordinator. Then read repair and normal writes both get it for free.

</details>

<details>
<summary>Hint 2: where versions come from</summary>

Use a counter in the coordinator: `++lastVersion`. It stands in for a timestamp. Real systems use wall-clock timestamps (Cassandra), hybrid logical clocks, or vector clocks (Dynamo, Riak) that can detect two concurrent writes instead of silently dropping one.

</details>

<details>
<summary>Hint 3: read repair</summary>

First find the newest value among the R replies. Then loop over the same R replicas again and write it to each one that is behind. Return a copy, not the stored object.

</details>

<details>
<summary>Hint 4: why R + W > N works</summary>

A successful write reached at least W replicas. A read asks R replicas. If `R + W > N`, the two sets cannot be disjoint: at least one replica in the read set has the latest version. The property test checks this under random failures.

</details>

## Extensions interviewers ask

1. **Partial writes.** Here a write with too few nodes up writes nothing. In Dynamo the coordinator sends to all and the write may land on some replicas and still "fail". What can a later read return?
2. **Sloppy quorum and hinted handoff.** When a home replica is down, write to another node with a "hint", and hand it back later. Better availability, weaker guarantees.
3. **Anti-entropy.** Read repair only fixes keys that are read. Merkle trees compare replicas in the background and fix the rest.
4. **Concurrent writes.** Two clients write at the same time. Last write wins drops one. Vector clocks keep both as "siblings" for the app to merge (the shopping cart example).
5. **Combine with consistent hashing.** Use [H17 · consistent hashing](../../H17-consistent-hashing/lab-hash-ring/README.md) `getNodes(key, N)` to pick the N replicas per key.

## Related

- [Replication](../../H15-replication/README.md) · [CAP, PACELC and consistency](../../H18-cap-pacelc-consistency/README.md)
- HLD problem: [Distributed key-value store](../../../case-studies/04-key-value-store/README.md)
