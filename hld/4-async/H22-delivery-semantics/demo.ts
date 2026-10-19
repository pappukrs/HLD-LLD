// H22 · Delivery semantics and idempotency
// Run: npx tsx hld/4-async/H22-delivery-semantics/demo.ts
// Part 1: one wallet, three consumer styles, the same crashes.
// Part 2: an Idempotency-Key API with a saved response, 409 on a concurrent retry, 422 on a reused key.
export {};

type Msg = { id: string; orderId: string; amount: number };
type Style = 'ack-then-work' | 'work-then-ack' | 'dedupe-tx-then-ack';
type Crash = 'none' | 'mid' | 'ack-lost';

// A toy DB where a "transaction" is all-or-nothing.
class WalletDb {
  balance = 1000;
  processed = new Set<string>();
  tx(fn: (t: { insertKey(k: string): boolean; debit(n: number): void }) => void): void {
    const snap = { balance: this.balance, processed: new Set(this.processed) };
    try {
      fn({
        insertKey: (k) => { if (this.processed.has(k)) return false; this.processed.add(k); return true; },
        debit: (n) => { this.balance -= n; },
      });
    } catch (e) {
      this.balance = snap.balance; this.processed = snap.processed; // rollback
      throw e;
    }
  }
}

// Runs one delivery. Returns true if the broker saw an ack.
function deliver(db: WalletDb, m: Msg, style: Style, crash: Crash, attempt: number): boolean {
  const crashNow = crash === 'mid' && attempt === 1;
  const ackLost = crash === 'ack-lost' && attempt === 1;
  if (style === 'ack-then-work') {
    if (crashNow) return true; // acked, then died before the work
    db.balance -= m.amount;
    return !ackLost;
  }
  if (style === 'work-then-ack') {
    db.balance -= m.amount;
    return !(crashNow || ackLost);
  }
  db.tx((t) => {
    if (!t.insertKey(m.orderId)) return; // duplicate → skip the effect
    t.debit(m.amount);
  });
  return !(crashNow || ackLost);
}

function runBroker(style: Style, crash: Crash): string {
  const db = new WalletDb();
  const m: Msg = { id: 'm1', orderId: 'order-41', amount: 100 };
  let attempt = 0;
  let acked = false;
  while (!acked && attempt < 5) acked = deliver(db, m, style, crash, ++attempt); // broker redelivers until acked
  const charges = (1000 - db.balance) / 100;
  const verdict = charges === 1 ? 'OK once' : charges === 0 ? 'LOST' : `DUPLICATE x${charges}`;
  return `${style.padEnd(19)} crash=${crash.padEnd(8)} deliveries=${attempt} balance=${db.balance} → ${verdict}`;
}

// ---- Part 2: Idempotency-Key API ----
type KeyRow = { status: 'IN_PROGRESS' | 'COMPLETED'; hash: string; response?: { code: number; body: string } };

class PaymentsApi {
  keys = new Map<string, KeyRow>(); // stands in for a table with PRIMARY KEY (merchant_id, idem_key)
  charges = 0;

  begin(scope: string, key: string, body: string): { code: number; body: string } | 'run' {
    const k = `${scope}:${key}`;
    const row = this.keys.get(k);
    if (!row) { this.keys.set(k, { status: 'IN_PROGRESS', hash: body }); return 'run'; } // insert won the unique race
    if (row.hash !== body) return { code: 422, body: 'key reused with a different request' };
    if (row.status === 'IN_PROGRESS') return { code: 409, body: 'request with this key is in progress' };
    return row.response!; // replay the saved response
  }
  finish(scope: string, key: string): { code: number; body: string } {
    this.charges++;
    const response = { code: 201, body: `payment pay_${this.charges} created` };
    const row = this.keys.get(`${scope}:${key}`)!;
    row.status = 'COMPLETED'; row.response = response;
    return response;
  }
  post(scope: string, key: string, body: string): string {
    const r = this.begin(scope, key, body);
    const res = r === 'run' ? this.finish(scope, key) : r;
    return `${res.code} ${res.body}`;
  }
}

function main(): void {
  console.log('=== Part 1: same crash, three consumer styles (charge 100 from 1000) ===');
  const styles: Style[] = ['ack-then-work', 'work-then-ack', 'dedupe-tx-then-ack'];
  const crashes: Crash[] = ['none', 'mid', 'ack-lost'];
  for (const s of styles) for (const c of crashes) console.log('  ' + runBroker(s, c));
  console.log('  → only "dedupe + work in one transaction, then ack" is OK in every row.');

  console.log('\n=== Part 2: POST /payments with Idempotency-Key ===');
  const api = new PaymentsApi();
  const body = JSON.stringify({ amount: 499, currency: 'INR' });
  console.log('  first call            :', api.post('merchant_7', 'k-abc', body));
  console.log('  retry, same key       :', api.post('merchant_7', 'k-abc', body), '(saved response, no new charge)');
  console.log('  same key, new amount  :', api.post('merchant_7', 'k-abc', JSON.stringify({ amount: 999, currency: 'INR' })));
  console.log('  same key, other merchant:', api.post('merchant_9', 'k-abc', body), '(keys are scoped per client)');

  // Two concurrent retries: the first insert wins, the second sees IN_PROGRESS.
  const first = api.begin('merchant_7', 'k-xyz', body);
  const second = api.begin('merchant_7', 'k-xyz', body);
  console.log('  concurrent #1         :', first === 'run' ? 'won the insert, charging…' : first);
  console.log('  concurrent #2         :', second === 'run' ? 'run' : `${second.code} ${second.body}`);
  const done = api.finish('merchant_7', 'k-xyz');
  console.log('  #1 finishes           :', `${done.code} ${done.body}`);
  console.log(`  total charges         : ${api.charges} for 6 requests`);
}

main();
