// H38 · Payments: idempotent create, UNKNOWN on timeout, forward-only state machine,
// deduped webhooks, double-entry ledger in paise (bigint), partial refund, reconciliation.
// Run: npx tsx hld/6-building-blocks/H38-payments-domain/demo.ts

type Status = 'CREATED' | 'PENDING' | 'UNKNOWN' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
const NEXT: Record<Status, Status[]> = {
  CREATED: ['PENDING'], PENDING: ['AUTHORIZED', 'CAPTURED', 'FAILED', 'UNKNOWN'], UNKNOWN: ['AUTHORIZED', 'CAPTURED', 'FAILED'],
  AUTHORIZED: ['CAPTURED', 'FAILED'], CAPTURED: ['REFUNDED'], FAILED: [], REFUNDED: [],
};
interface Payment { id: string; orderId: string; amount: bigint; status: Status; attemptId: string; refunded: bigint }
interface Entry { account: string; amount: bigint } // +debit, -credit, paise

const payments = new Map<string, Payment>();
const idemKeys = new Map<string, string>(); // Idempotency-Key -> payment id
const journal = new Set<string>(); // unique event keys
const ledger: { txn: string; entries: Entry[] }[] = [];
const rupees = (p: bigint) => `₹${(Number(p) / 100).toFixed(2)}`;

// ---- Idempotent create ----
function createPayment(idemKey: string, orderId: string, amount: bigint): Payment {
  const existing = idemKeys.get(idemKey);
  if (existing) { console.log(`  POST /payments key=${idemKey} -> replay, same payment ${existing}`); return payments.get(existing)!; }
  const p: Payment = { id: `pay_${payments.size + 1}`, orderId, amount, status: 'CREATED', attemptId: `att_${payments.size + 1}`, refunded: 0n };
  payments.set(p.id, p); idemKeys.set(idemKey, p.id);
  console.log(`  POST /payments key=${idemKey} -> created ${p.id} ${rupees(amount)}`);
  return p;
}

// ---- Forward-only transition + ledger posting keyed by event ----
function transition(p: Payment, to: Status, eventKey: string, entries: Entry[] = []): string {
  if (journal.has(eventKey)) return 'duplicate event, ignored';
  if (!NEXT[p.status].includes(to)) return `illegal ${p.status} -> ${to}, ignored`;
  const sum = entries.reduce((s, e) => s + e.amount, 0n);
  if (sum !== 0n) throw new Error(`unbalanced journal: ${sum}`);
  // In a real system: one DB transaction for status + journal + entries + outbox event.
  const from = p.status;
  p.status = to; journal.add(eventKey);
  if (entries.length) ledger.push({ txn: eventKey, entries });
  return `${from} -> ${to}`;
}

// Capture entries: 2% MDR, 18% GST on the fee.
function captureEntries(amount: bigint): Entry[] {
  const fee = (amount * 2n) / 100n;
  const gst = (fee * 18n) / 100n;
  return [
    { account: 'acquirer_receivable', amount },
    { account: 'merchant_payable', amount: -(amount - fee - gst) },
    { account: 'fee_revenue', amount: -fee },
    { account: 'gst_payable', amount: -gst },
  ];
}

// ---- A flaky PSP ----
const psp = new Map<string, Status>(); // what the PSP really did, by our attempt id
function callPsp(p: Payment, timeout: boolean): 'CAPTURED' | 'TIMEOUT' {
  psp.set(p.attemptId, 'CAPTURED'); // the charge actually went through
  return timeout ? 'TIMEOUT' : 'CAPTURED';
}

function balance(account: string): bigint {
  return ledger.flatMap((t) => t.entries).filter((e) => e.account === account).reduce((s, e) => s + e.amount, 0n);
}

function main(): void {
  console.log('== 1. Double click: same Idempotency-Key ==');
  const p = createPayment('chk_A', 'order_1', 100_000n); // ₹1,000.00
  createPayment('chk_A', 'order_1', 100_000n);

  console.log('\n== 2. PSP call times out: UNKNOWN, not FAILED ==');
  console.log('  ', transition(p, 'PENDING', `${p.id}:sent`));
  const r = callPsp(p, true);
  console.log(`   PSP said: ${r}`);
  console.log('  ', transition(p, 'UNKNOWN', `${p.id}:timeout`), '(user sees "processing", no retry with a new ref)');

  console.log('\n== 3. Poller asks the PSP by OUR attempt id ==');
  const real = psp.get(p.attemptId)!;
  console.log(`   GET /status?ref=${p.attemptId} -> ${real}`);
  console.log('  ', transition(p, 'CAPTURED', `${p.id}:captured`, captureEntries(p.amount)));

  console.log('\n== 4. Webhooks: duplicate and out-of-order ==');
  console.log('   webhook evt_9 captured  ->', transition(p, 'CAPTURED', `${p.id}:captured`, captureEntries(p.amount)));
  console.log('   webhook evt_7 failed    ->', transition(p, 'FAILED', `${p.id}:failed`));

  console.log('\n== 5. Ledger (double entry, sums to zero) ==');
  for (const t of ledger) for (const e of t.entries) console.log(`   ${t.txn.padEnd(16)} ${e.account.padEnd(20)} ${e.amount > 0n ? 'Dr' : 'Cr'} ${rupees(e.amount < 0n ? -e.amount : e.amount)}`);
  console.log(`   merchant payable balance: ${rupees(-balance('merchant_payable'))}`);

  console.log('\n== 6. Partial refund ₹300 (new movement, reversal entries) ==');
  const refund = 30_000n;
  if (p.refunded + refund > p.amount) throw new Error('refund exceeds capture');
  p.refunded += refund;
  ledger.push({ txn: `${p.id}:refund_1`, entries: [{ account: 'merchant_payable', amount: refund }, { account: 'acquirer_receivable', amount: -refund }] });
  journal.add(`${p.id}:refund_1`);
  console.log(`   refunded ${rupees(refund)}; merchant payable now ${rupees(-balance('merchant_payable'))}`);
  const all = ledger.flatMap((t) => t.entries).reduce((s, e) => s + e.amount, 0n);
  console.log(`   sum of ALL entries = ${all} (must be 0)`);

  console.log('\n== 7. Split ₹100 three ways in paise (no floats) ==');
  const total = 10_000n, n = 3n;
  const parts = Array.from({ length: 3 }, (_, i) => total / n + (BigInt(i) < total % n ? 1n : 0n));
  console.log(`   ${parts.join(' + ')} = ${parts.reduce((a, b) => a + b, 0n)} paise   (float: 0.1 + 0.2 = ${0.1 + 0.2})`);

  console.log('\n== 8. Nightly reconciliation: ledger vs PSP settlement file ==');
  const p2 = createPayment('chk_B', 'order_2', 49_900n);
  transition(p2, 'PENDING', `${p2.id}:sent`);
  transition(p2, 'UNKNOWN', `${p2.id}:timeout`); // webhook never arrived, poller gave up
  const ours = new Map([...payments.values()].map((x) => [x.attemptId, { status: x.status, amount: x.amount - x.refunded }]));
  const pspFile = [
    { ref: 'att_1', status: 'CAPTURED', amount: 70_000n },
    { ref: 'att_2', status: 'CAPTURED', amount: 49_900n },
    { ref: 'att_x', status: 'CAPTURED', amount: 12_000n },
  ];
  for (const row of pspFile) {
    const o = ours.get(row.ref);
    if (!o) console.log(`   ${row.ref}: in PSP, not in ledger -> investigate (missing record)`);
    else if (o.status === 'UNKNOWN') console.log(`   ${row.ref}: ours UNKNOWN, PSP ${row.status} -> fix status, post entries, fulfil`);
    else if (o.amount !== row.amount) console.log(`   ${row.ref}: amount ${rupees(o.amount)} vs ${rupees(row.amount)} -> adjustment`);
    else console.log(`   ${row.ref}: matched ${rupees(row.amount)}`);
  }
}

main();

export {};
