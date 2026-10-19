// H14 · SQL vs NoSQL: the same data stored two ways on a 4-shard cluster.
// Shows: read cost (joins vs embedded docs), write cost (normalised vs duplicated),
// atomicity (transaction vs two separate writes), and a small "which store?" helper.
// Run: npx tsx hld/3-databases/H14-sql-vs-nosql/demo.ts
export {};

type Order = { orderId: string; userId: string; productId: string; productName: string; amount: number };
type UserDoc = { userId: string; name: string; orders: Order[] };

const SHARDS = 4;
const shardOf = (key: string): number => {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % SHARDS;
};

// ---- build the same dataset twice ----
const sqlUsers: Map<string, { name: string }>[] = Array.from({ length: SHARDS }, () => new Map());
const sqlOrders: Order[][] = Array.from({ length: SHARDS }, () => []); // sharded by orderId
const sqlProducts = new Map<string, string>([['p1', 'Phone'], ['p2', 'Laptop'], ['p3', 'Earbuds']]);
const docUsers: Map<string, UserDoc>[] = Array.from({ length: SHARDS }, () => new Map());

for (let u = 1; u <= 200; u++) {
  const userId = `u${u}`;
  sqlUsers[shardOf(userId)].set(userId, { name: `User ${u}` });
  const doc: UserDoc = { userId, name: `User ${u}`, orders: [] };
  for (let k = 0; k < 5; k++) {
    const productId = `p${((u + k) % 3) + 1}`;
    const o: Order = { orderId: `o${u}-${k}`, userId, productId, productName: sqlProducts.get(productId)!, amount: 100 + k };
    sqlOrders[shardOf(o.orderId)].push(o);
    doc.orders.push({ ...o });
  }
  docUsers[shardOf(userId)].set(userId, doc);
}

function readUserSql(userId: string): { hops: number; orders: number } {
  let hops = 1; // fetch the user row
  sqlUsers[shardOf(userId)].get(userId);
  let found = 0;
  for (const shard of sqlOrders) { hops++; found += shard.filter((o) => o.userId === userId).length; } // scatter-gather
  return { hops, orders: found };
}

function readUserDoc(userId: string): { hops: number; orders: number } {
  const doc = docUsers[shardOf(userId)].get(userId)!;
  return { hops: 1, orders: doc.orders.length };
}

function main(): void {
  console.log('== 1. Read "user u42 with all orders" on a 4-shard cluster ==');
  const a = readUserSql('u42');
  const b = readUserDoc('u42');
  console.log(`SQL (orders sharded by order_id): ${a.hops} shard hops, ${a.orders} orders  <- join = scatter-gather`);
  console.log(`Document (orders embedded):       ${b.hops} shard hop,  ${b.orders} orders  <- one partition read`);

  console.log('\n== 2. Write "rename product p2 to Laptop Pro" ==');
  sqlProducts.set('p2', 'Laptop Pro');
  console.log('SQL: 1 row updated in products (orders reference p2 by id, name is joined at read time)');
  let touchedDocs = 0, touchedShards = new Set<number>();
  docUsers.forEach((shard, i) => shard.forEach((doc) => {
    let hit = false;
    for (const o of doc.orders) if (o.productId === 'p2') { o.productName = 'Laptop Pro'; hit = true; }
    if (hit) { touchedDocs++; touchedShards.add(i); }
  }));
  console.log(`Document: ${touchedDocs} documents rewritten across ${touchedShards.size} shards (duplicated data must be kept in sync)`);

  console.log('\n== 3. Move Rs 500 from A to B, and the process crashes half-way ==');
  const sqlBal = { A: 1000, B: 0 };
  const tx = { ...sqlBal };
  tx.A -= 500; // inside BEGIN ... COMMIT
  const crashed = true;
  if (!crashed) Object.assign(sqlBal, tx); // COMMIT never ran, so nothing is applied
  console.log(`SQL transaction:  A=${sqlBal.A} B=${sqlBal.B} total=${sqlBal.A + sqlBal.B}  <- rolled back, invariant holds`);
  const kv = { A: 1000, B: 0 };
  kv.A -= 500; // write 1 lands on its own
  // crash here: write 2 (kv.B += 500) never happens
  console.log(`Two KV writes:    A=${kv.A} B=${kv.B} total=${kv.A + kv.B}  <- Rs 500 vanished; app must add saga/outbox`);

  console.log('\n== 4. Which store? (decision axes) ==');
  type Need = { name: string; money?: boolean; byKeyOnly?: boolean; writesPerSec: number; graph?: boolean; textSearch?: boolean; flexibleSchema?: boolean };
  const pick = (n: Need): string => {
    if (n.money) return 'Postgres/MySQL (ACID, constraints)';
    if (n.textSearch) return 'Elasticsearch fed by CDC (never source of truth)';
    if (n.graph) return 'Graph DB (Neo4j/Neptune)';
    if (n.writesPerSec > 50_000) return 'Wide-column (Cassandra/Scylla), partition by key + time bucket';
    if (n.byKeyOnly) return n.writesPerSec > 5_000 ? 'DynamoDB' : 'Redis (if it fits in RAM) or DynamoDB';
    if (n.flexibleSchema) return 'MongoDB or Postgres JSONB';
    return 'Postgres (the default)';
  };
  const needs: Need[] = [
    { name: 'Wallet ledger', money: true, writesPerSec: 2_000 },
    { name: 'Session store', byKeyOnly: true, writesPerSec: 3_000 },
    { name: 'IoT telemetry (10k devices x 10/s)', writesPerSec: 100_000 },
    { name: 'Product search box', textSearch: true, writesPerSec: 200 },
    { name: 'People you may know', graph: true, writesPerSec: 500 },
    { name: 'Catalog, per-category attributes', flexibleSchema: true, writesPerSec: 100 },
    { name: 'Admin CRUD app', writesPerSec: 50 },
  ];
  for (const n of needs) console.log(`${n.name.padEnd(36)} -> ${pick(n)}`);
  console.log('\nTakeaway: denormalising buys one-hop reads and easy sharding; you pay in duplicated writes and lost atomicity.');
}

main();
