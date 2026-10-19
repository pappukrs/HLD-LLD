// H13 · Data modelling and normalization
// Run: npx tsx hld/3-databases/H13-data-modeling/demo.ts
// Shows: functional dependencies on a flat table, the update anomaly, the normalized fix,
// and why a price snapshot on order_items is a separate fact, not duplication.

type Cell = string | number;
type Row = Record<string, Cell>;

function header(t: string): void {
  console.log('\n== ' + t + ' ' + '='.repeat(Math.max(0, 60 - t.length)));
}

// lhs → rhs holds if equal lhs values always give the same rhs value.
function holds(rows: Row[], lhs: string[], rhs: string): boolean {
  const seen = new Map<string, Cell>();
  for (const r of rows) {
    const k = lhs.map((c) => String(r[c])).join('|');
    const prev = seen.get(k);
    if (prev !== undefined && prev !== r[rhs]) return false;
    seen.set(k, r[rhs]);
  }
  return true;
}

// ---------- 1. The flat 1NF table (key = order_id + product_id) ----------
const flat: Row[] = [];
const catalog: Record<string, { name: string; price: number }> = {
  P1: { name: 'Pen', price: 1000 }, P2: { name: 'Book', price: 25000 }, P3: { name: 'Bag', price: 90000 },
};
const people: Record<string, string> = { C1: 'asha@x.in', C2: 'ravi@y.in' };
// Asha (C1) places 20 orders, Ravi (C2) places 5. Each order has 2 lines.
let orderId = 100;
for (const [cust, n] of [['C1', 20], ['C2', 5]] as const) {
  for (let i = 0; i < n; i++) {
    orderId++;
    for (const [j, pid] of (i % 2 === 0 ? ['P1', 'P2'] : ['P1', 'P3']).entries()) {
      flat.push({ order_id: orderId, product_id: pid, product_name: catalog[pid].name,
        price_paise: catalog[pid].price, qty: 1 + ((i + j) % 3), cust_id: cust, email: people[cust] });
    }
  }
}

function main(): void {
  header('1. Functional dependencies in the flat table');
  console.log(`rows: ${flat.length}, key: (order_id, product_id)`);
  const checks: [string[], string, string][] = [
    [['product_id'], 'product_name', 'partial dependency -> breaks 2NF -> move to products'],
    [['product_id'], 'price_paise', 'partial dependency -> breaks 2NF -> move to products'],
    [['order_id'], 'cust_id', 'partial dependency -> breaks 2NF -> move to orders'],
    [['cust_id'], 'email', 'transitive (order -> cust -> email) -> breaks 3NF -> move to customers'],
    [['order_id'], 'qty', 'does NOT hold: qty needs the whole key, so it stays in order_items'],
  ];
  for (const [lhs, rhs, note] of checks) {
    console.log(`  ${lhs.join(',').padEnd(10)} -> ${rhs.padEnd(12)} ${holds(flat, lhs, rhs) ? 'holds ' : 'fails '} ${note}`);
  }

  header('2. Update anomaly: change Asha\'s email in the flat table');
  const ashaRows = flat.filter((r) => r.cust_id === 'C1');
  console.log(`Asha's email is stored ${ashaRows.length} times.`);
  // The update job crashes after 30 rows (no transaction, or a batched script).
  let written = 0;
  for (const r of ashaRows) {
    if (written === 30) break;
    r.email = 'asha@new.in';
    written++;
  }
  const emails = new Set(ashaRows.map((r) => r.email));
  console.log(`job crashed after ${written} rows -> Asha now has ${emails.size} emails: ${[...emails].join(', ')}`);
  console.log(`cust_id -> email still holds? ${holds(flat, ['cust_id'], 'email')}  (the data now disagrees with itself)`);

  header('3. Normalize to 3NF');
  const customers = new Map<string, { email: string }>();
  const products = new Map<string, { name: string; price_paise: number }>();
  const orders = new Map<number, { cust_id: string; total_paise: number }>();
  const orderItems: { order_id: number; product_id: string; qty: number; unit_price_paise: number }[] = [];
  for (const r of flat) {
    customers.set(String(r.cust_id), { email: people[String(r.cust_id)] });
    products.set(String(r.product_id), { name: String(r.product_name), price_paise: Number(r.price_paise) });
    const o = orders.get(Number(r.order_id)) ?? { cust_id: String(r.cust_id), total_paise: 0 };
    o.total_paise += Number(r.price_paise) * Number(r.qty); // derived, cached in the same transaction
    orders.set(Number(r.order_id), o);
    orderItems.push({ order_id: Number(r.order_id), product_id: String(r.product_id),
      qty: Number(r.qty), unit_price_paise: Number(r.price_paise) });
  }
  console.log(`customers: ${customers.size} rows | products: ${products.size} | orders: ${orders.size} | order_items: ${orderItems.length}`);
  customers.get('C1')!.email = 'asha@new.in';
  console.log('Change Asha\'s email now: UPDATE customers SET email=... WHERE cust_id=\'C1\' -> 1 row touched.');

  header('4. Read path: the order page is a join');
  const id = 101;
  const ord = orders.get(id)!;
  console.log(`order ${id} for ${customers.get(ord.cust_id)!.email}`);
  for (const it of orderItems.filter((x) => x.order_id === id)) {
    console.log(`  ${products.get(it.product_id)!.name.padEnd(5)} x${it.qty}  @ Rs ${(it.unit_price_paise / 100).toFixed(2)}`);
  }
  console.log(`  total Rs ${(ord.total_paise / 100).toFixed(2)}  (4 tables, 3 joins, all on indexed keys)`);

  header('5. Price change: snapshot vs live join');
  products.get('P1')!.price_paise = 1500; // Pen goes from Rs 10 to Rs 15
  const line = orderItems.find((x) => x.order_id === id && x.product_id === 'P1')!;
  const live = products.get('P1')!.price_paise * line.qty;
  const snap = line.unit_price_paise * line.qty;
  console.log(`Pen line on old order ${id}: snapshot Rs ${(snap / 100).toFixed(2)} vs live join Rs ${(live / 100).toFixed(2)}`);
  console.log('The invoice must show the snapshot. unit_price is "price paid", a different fact from "price today".');

  header('6. Cost of copying a mutable column');
  for (const copies of [1, 1_000, 1_000_000]) {
    console.log(`  name copied into ${String(copies).padStart(9)} rows -> ${String(copies).padStart(9)} writes per rename`);
  }
  console.log('Copy only data that rarely changes or must be frozen, and write down who syncs it.');
}

main();

export {};
