// H23 · Distributed transactions: 2PC, Saga, Outbox
// Run: npx tsx hld/4-async/H23-distributed-transactions/demo.ts
// 1. An orchestrated checkout saga: happy path, then a declined card with compensations in reverse.
// 2. A transactional outbox: one local tx, a relay that crashes after publishing, and an inbox that dedupes.
export {};

// ---------- 1. Saga ----------
type Step = { name: string; run: () => void; compensate?: () => void };

const inventory = { available: 5, reserved: 0 };
const orders = new Map<string, string>();
let walletCharged = 0;

function retry(label: string, fn: () => void, attempts = 3): void {
  for (let i = 1; i <= attempts; i++) {
    try { fn(); return; } catch (e) {
      console.log(`    ${label} attempt ${i} failed: ${(e as Error).message}`);
    }
  }
  console.log(`    ${label} → NEEDS_ATTENTION (ops queue)`);
}

function runSaga(id: string, steps: Step[]): string {
  const done: Step[] = [];
  for (const s of steps) {
    try {
      s.run();
      done.push(s);
      console.log(`  ✓ ${s.name}`);
    } catch (e) {
      console.log(`  ✗ ${s.name}: ${(e as Error).message} → compensating in reverse`);
      for (const d of done.reverse()) {
        if (d.compensate) { retry(`undo ${d.name}`, d.compensate); console.log(`  ↺ undo ${d.name}`); }
      }
      return `saga ${id}: COMPENSATED`;
    }
  }
  return `saga ${id}: COMPLETED`;
}

function checkout(id: string, qty: number, cardOk: boolean, flakyRelease = false): string {
  let releaseFailures = flakyRelease ? 1 : 0;
  return runSaga(id, [
    { name: 'T1 order PENDING', run: () => orders.set(id, 'PENDING'), compensate: () => orders.set(id, 'CANCELLED') },
    {
      name: `T2 reserve ${qty}`,
      run: () => {
        // atomic check-and-reserve: UPDATE stock SET reserved = reserved + qty WHERE available - reserved >= qty
        if (inventory.available - inventory.reserved < qty) throw new Error('out of stock');
        inventory.reserved += qty;
      },
      compensate: () => {
        if (releaseFailures-- > 0) throw new Error('inventory timeout');
        inventory.reserved -= qty;
      },
    },
    {
      name: 'T3 charge ₹500 (pivot)',
      run: () => { if (!cardOk) throw new Error('card declined'); walletCharged += 500; },
      compensate: () => { walletCharged -= 500; },
    },
    { name: 'T4 confirm order', run: () => orders.set(id, 'CONFIRMED') },
  ]);
}

// ---------- 2. Outbox ----------
type OutboxRow = { id: string; type: string; aggregate: string; publishedAt?: number };
const db = { orders: new Map<string, string>(), outbox: [] as OutboxRow[] };
const kafka: OutboxRow[] = [];
const inbox = new Set<string>();
let emailsSent = 0;

function placeOrderTx(orderId: string, eventId: string): void {
  // One local transaction: both rows or neither.
  const staged = { order: [orderId, 'PENDING'] as const, event: { id: eventId, type: 'OrderCreated', aggregate: orderId } };
  db.orders.set(...staged.order);
  db.outbox.push(staged.event);
}

function relayOnce(crashAfterPublish: boolean): void {
  for (const row of db.outbox.filter((r) => r.publishedAt === undefined)) {
    kafka.push({ ...row }); // publish (key = aggregate id keeps per-order order)
    console.log(`  relay published ${row.id}`);
    if (crashAfterPublish) { console.log('  relay CRASHED before marking it sent'); return; }
    row.publishedAt = Date.now();
  }
}

function consumeAll(): void {
  for (const evt of kafka.splice(0)) {
    // inbox insert + side effect in one consumer-side transaction
    if (inbox.has(evt.id)) { console.log(`  consumer: ${evt.id} already in inbox → skip`); continue; }
    inbox.add(evt.id);
    emailsSent++;
    console.log(`  consumer: ${evt.id} processed → email #${emailsSent}`);
  }
}

function main(): void {
  console.log('=== 1a. Saga happy path ===');
  console.log(' ', checkout('o-41', 2, true));
  console.log(`  state: order=${orders.get('o-41')} reserved=${inventory.reserved} total charged=₹${walletCharged}`);

  console.log('\n=== 1b. Card declined at the pivot: compensate in reverse ===');
  console.log(' ', checkout('o-42', 2, false, true));
  console.log(`  state: order=${orders.get('o-42')} reserved=${inventory.reserved} total charged=₹${walletCharged}`);
  console.log('  (o-42 was visible as PENDING for a moment: sagas have no isolation)');

  console.log('\n=== 1c. Two sagas race for the last stock ===');
  console.log(' ', checkout('o-43', 3, true));
  console.log(' ', checkout('o-44', 1, true), '→ the atomic reserve stopped an oversell');
  console.log(`  state: reserved=${inventory.reserved}/${inventory.available}`);

  console.log('\n=== 2. Outbox: save + publish without a dual write ===');
  placeOrderTx('o-45', 'e7');
  console.log(`  tx committed: orders has o-45=${db.orders.get('o-45')}, outbox has ${db.outbox.length} row`);
  relayOnce(true);
  consumeAll();
  console.log('  relay restarts…');
  relayOnce(false);
  consumeAll();
  console.log(`  result: e7 delivered twice, emails sent = ${emailsSent} (inbox made it exactly-once in effect)`);
}

main();
