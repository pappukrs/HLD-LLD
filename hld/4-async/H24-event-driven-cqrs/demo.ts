// H24 · Event-driven architecture, CQRS, event sourcing
// Run: npx tsx hld/4-async/H24-event-driven-cqrs/demo.ts
// 1. CQRS: a write model emits versioned events; two projectors build read models; duplicates are skipped;
//    a new projector rebuilds from offset 0.
// 2. Event sourcing: a wallet stream with expected-version appends, a race, snapshots and time travel.
export {};

// ---------- 1. CQRS ----------
type OrderEvent = { orderId: string; version: number; type: 'OrderPlaced' | 'OrderPaid' | 'OrderCancelled'; amount: number };

const log: OrderEvent[] = []; // stands in for a Kafka topic (outbox → relay → here)
const writeDb = new Map<string, { status: string; version: number; amount: number }>();

function handleCommand(cmd: { kind: 'Place' | 'Pay' | 'Cancel'; orderId: string; amount?: number }): void {
  const cur = writeDb.get(cmd.orderId);
  // Business rules live on the write side only.
  if (cmd.kind === 'Pay' && cur?.status !== 'PLACED') throw new Error(`cannot pay ${cmd.orderId} in ${cur?.status}`);
  const version = (cur?.version ?? 0) + 1;
  const type = cmd.kind === 'Place' ? 'OrderPlaced' : cmd.kind === 'Pay' ? 'OrderPaid' : 'OrderCancelled';
  const status = { OrderPlaced: 'PLACED', OrderPaid: 'PAID', OrderCancelled: 'CANCELLED' }[type];
  const amount = cmd.amount ?? cur?.amount ?? 0;
  writeDb.set(cmd.orderId, { status, version, amount });
  log.push({ orderId: cmd.orderId, version, type, amount }); // same local tx as the row, via the outbox
}

class Projector<V> {
  offset = 0;
  lastVersion = new Map<string, number>();
  skipped = 0;
  constructor(readonly name: string, public view: V, private apply: (v: V, e: OrderEvent) => void) {}
  catchUp(): void {
    for (; this.offset < log.length; this.offset++) {
      const e = log[this.offset];
      if (e.version <= (this.lastVersion.get(e.orderId) ?? 0)) { this.skipped++; continue; } // idempotent
      this.lastVersion.set(e.orderId, e.version);
      this.apply(this.view, e);
    }
  }
}

const statusView = new Projector('order-status', new Map<string, string>(), (v, e) => v.set(e.orderId, e.type));
const revenueView = new Projector('revenue', { paidOrders: 0, revenue: 0 }, (v, e) => {
  if (e.type === 'OrderPaid') { v.paidOrders++; v.revenue += e.amount; }
});

// ---------- 2. Event sourcing ----------
type WalletEvent = { version: number; type: 'Opened' | 'Deposited' | 'Withdrew'; amount: number };

class EventStore {
  private streams = new Map<string, WalletEvent[]>();
  snapshots = new Map<string, { version: number; balance: number }>();
  load(id: string): WalletEvent[] { return [...(this.streams.get(id) ?? [])]; }
  append(id: string, e: Omit<WalletEvent, 'version'>, expectedVersion: number): number {
    const s = this.streams.get(id) ?? [];
    if (s.length !== expectedVersion) throw new Error(`ConcurrencyError: expected v${expectedVersion}, stream is at v${s.length}`);
    s.push({ ...e, version: expectedVersion + 1 });
    this.streams.set(id, s);
    return expectedVersion + 1;
  }
}

const apply = (bal: number, e: WalletEvent) => (e.type === 'Withdrew' ? bal - e.amount : bal + e.amount);

function state(store: EventStore, id: string, asOf = Infinity): { balance: number; version: number; read: number } {
  const snap = store.snapshots.get(id);
  const useSnap = snap && snap.version <= asOf ? snap : undefined;
  const events = store.load(id).filter((e) => e.version > (useSnap?.version ?? 0) && e.version <= asOf);
  const balance = events.reduce(apply, useSnap?.balance ?? 0);
  return { balance, version: events.at(-1)?.version ?? useSnap?.version ?? 0, read: events.length };
}

function withdraw(store: EventStore, id: string, amount: number, loadedAt: { balance: number; version: number }): string {
  if (loadedAt.balance < amount) return `rejected: InsufficientFunds (₹${loadedAt.balance})`;
  try {
    return `ok → v${store.append(id, { type: 'Withdrew', amount }, loadedAt.version)}`;
  } catch (e) {
    const fresh = state(store, id); // reload and re-check
    return `${(e as Error).message}; reloaded ₹${fresh.balance} → ${fresh.balance < amount ? 'rejected' : 'retry'}`;
  }
}

function main(): void {
  console.log('=== 1. CQRS: commands write, projectors read ===');
  handleCommand({ kind: 'Place', orderId: 'o-1', amount: 500 });
  handleCommand({ kind: 'Place', orderId: 'o-2', amount: 1200 });
  handleCommand({ kind: 'Pay', orderId: 'o-1' });
  console.log(`  log: ${log.map((e) => `${e.orderId}:${e.type}@v${e.version}`).join('  ')}`);
  console.log(`  read before projecting: status(o-1) = ${statusView.view.get('o-1') ?? 'missing'} (read-model lag)`);
  statusView.catchUp(); revenueView.catchUp();
  console.log(`  read after projecting : status(o-1) = ${statusView.view.get('o-1')}, revenue = ₹${revenueView.view.revenue}`);
  try { handleCommand({ kind: 'Pay', orderId: 'o-1' }); } catch (e) { console.log(`  write side rejects: ${(e as Error).message}`); }

  console.log('\n  relay crashes and re-publishes o-1 v2 (at-least-once)');
  log.push({ ...log[2] });
  revenueView.catchUp();
  console.log(`  revenue still ₹${revenueView.view.revenue}; duplicates skipped = ${revenueView.skipped}`);

  console.log('\n  new "big orders" view, a year later: replay from offset 0');
  const bigOrders = new Projector('big-orders', [] as string[], (v, e) => { if (e.type === 'OrderPlaced' && e.amount >= 1000) v.push(e.orderId); });
  bigOrders.catchUp();
  console.log(`  big orders = [${bigOrders.view.join(', ')}], read ${bigOrders.offset} events, no change to the write side`);

  console.log('\n=== 2. Event-sourced wallet acct-7 ===');
  const store = new EventStore();
  let v = store.append('acct-7', { type: 'Opened', amount: 0 }, 0);
  v = store.append('acct-7', { type: 'Deposited', amount: 1000 }, v);
  v = store.append('acct-7', { type: 'Withdrew', amount: 300 }, v);
  const s3 = state(store, 'acct-7');
  console.log(`  fold → balance ₹${s3.balance} at v${s3.version}`);

  console.log('\n  two requests loaded v3 (₹700) and both withdraw ₹500:');
  console.log(`  A: ${withdraw(store, 'acct-7', 500, s3)}`);
  console.log(`  B: ${withdraw(store, 'acct-7', 500, s3)}`);

  for (let i = 0; i < 6; i++) store.append('acct-7', { type: 'Deposited', amount: 100 }, state(store, 'acct-7').version);
  const before = state(store, 'acct-7');
  store.snapshots.set('acct-7', { version: 8, balance: state(store, 'acct-7', 8).balance });
  const after = state(store, 'acct-7');
  console.log(`\n  snapshot at v8: load reads ${before.read} events without it, ${after.read} with it; balance ₹${after.balance} both ways`);
  console.log(`  time travel: balance as of v2 = ₹${state(store, 'acct-7', 2).balance}, as of v4 = ₹${state(store, 'acct-7', 4).balance}`);
}

main();
