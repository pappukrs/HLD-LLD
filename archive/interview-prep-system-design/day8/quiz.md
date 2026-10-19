# SD Day 8 — Quiz (answer OUT LOUD, then check theory.md)

> Speaking the answer is the rep. Reading it is not.

---

## Q1 — Sharding vs replication (the framing)
(a) One sentence each: what does sharding split, what does replication copy?
(b) Replicas scale reads and give HA — so what *exactly* can replication NOT solve that forces
you to shard?
(c) Do sharding and replication coexist, or do you pick one? Describe the combined shape.

---

## Q2 — The key choice (range vs hash)
Interviewer: "How would you partition this data?"
(a) Describe **range** partitioning — its one big win and its one big failure mode.
(b) Describe **hash** partitioning — its win and what it destroys.
(c) Give the one-line rule for choosing between them based on access pattern.

---

## Q3 — Hot keys (the probe)
"You hashed the partition key, so load is evenly spread — why is one shard still on fire?"
(a) Explain the difference between *even key distribution* and a *hot key*.
(b) Why doesn't hashing fix a hot key?
(c) Name two mitigations.

---

## Q4 — Cross-shard pain
Once data is split across shards:
(a) What happens to joins, and how do you design around it?
(b) What happens to ACID transactions across shards — name the two heavy options.
(c) So what's the rule for *which* key you shard by?

---

## Q5 — Resharding
"You add a node to the cluster. Walk me through what happens to the data."
(a) Why is `hash(key) % N` a trap when N changes?
(b) Name the two real solutions and what each one moves when you add a node.
(c) Which one does Redis Cluster use, and what's the magic number?

---

## Q6 — The senior move + your war story
(a) Make the case for **NOT** sharding — what cheaper levers do you exhaust first, and why is
sharding a "one-way door"?
(b) Tell the IoT telemetry story: what's the naive partition key, why does it hotspot, and what
do you partition by instead?
