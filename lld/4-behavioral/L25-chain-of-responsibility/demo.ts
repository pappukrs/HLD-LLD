// L25 · Chain of Responsibility: a payment middleware chain, then a GoF ATM note chain.
// Run: npx tsx lld/4-behavioral/L25-chain-of-responsibility/demo.ts

interface PaymentRequest { userId: string; token?: string; amount: number; trace: string[] }
type Result = { ok: true; txnId: string } | { ok: false; error: string; by: string };

// ---------- 1. Middleware chain (Express / Koa / NestJS style) ----------
type Next = () => Promise<Result>;
type Middleware = { name: string; run: (req: PaymentRequest, next: Next) => Promise<Result> };

function compose(mws: Middleware[], final: (req: PaymentRequest) => Promise<Result>) {
  return (req: PaymentRequest): Promise<Result> => {
    const step = (i: number): Promise<Result> => {
      if (i === mws.length) { req.trace.push(final.name); return final(req); }
      const mw = mws[i]!;
      req.trace.push(mw.name);
      return mw.run(req, () => step(i + 1));
    };
    return step(0);
  };
}

const reject = (by: string, error: string): Result => ({ ok: false, error, by });

const timing: Middleware = {
  name: 'timing',
  async run(req, next) {
    const res = await next(); // onion: this line runs on the way back
    req.trace.push('timing(after)');
    return res;
  },
};
const auth: Middleware = { name: 'auth', run: async (req, next) => (req.token === 'valid' ? next() : reject('auth', '401 unauthorized')) };

const hits = new Map<string, number>();
const rateLimit: Middleware = {
  name: 'rateLimit',
  async run(req, next) {
    const n = (hits.get(req.userId) ?? 0) + 1;
    hits.set(req.userId, n);
    return n <= 2 ? next() : reject('rateLimit', '429 too many requests');
  },
};
const amountLimits: Middleware = {
  name: 'amount',
  run: async (req, next) => (req.amount > 0 && req.amount <= 200_000 ? next() : reject('amount', '400 amount out of range')),
};
const fraud: Middleware = {
  name: 'fraud',
  run: async (req, next) => (req.amount > 150_000 && req.userId.startsWith('new') ? reject('fraud', '403 risk score 0.93') : next()),
};

let seq = 0;
const charge = async (req: PaymentRequest): Promise<Result> => ({ ok: true, txnId: `txn_${++seq}_${req.amount}` });
const refundCharge = async (req: PaymentRequest): Promise<Result> => ({ ok: true, txnId: `rfnd_${++seq}_${req.amount}` });

// Same links, two different chains.
const createPayment = compose([timing, auth, rateLimit, amountLimits, fraud], charge);
const createRefund = compose([auth, amountLimits], refundCharge);

// ---------- 2. GoF object chain: ATM note dispensers ----------
abstract class NoteHandler {
  private next?: NoteHandler;
  setNext(h: NoteHandler): NoteHandler { this.next = h; return h; }
  plan(amount: number, out: Map<number, number>): void {
    const left = this.take(amount, out);
    if (left === 0) return;
    if (!this.next) throw new Error(`cannot dispense remaining ₹${left}`);
    this.next.plan(left, out);
  }
  protected abstract take(amount: number, out: Map<number, number>): number;
}

class Cassette extends NoteHandler {
  constructor(readonly note: number, public count: number) { super(); }
  protected take(amount: number, out: Map<number, number>): number {
    const n = Math.min(Math.floor(amount / this.note), this.count);
    if (n > 0) out.set(this.note, n);
    return amount - n * this.note;
  }
}

function withdraw(first: NoteHandler, cassettes: Cassette[], amount: number): void {
  const plan = new Map<number, number>();
  try {
    first.plan(amount, plan); // plan first, change nothing yet
  } catch (e) {
    console.log(`  ₹${amount}: REJECTED (${(e as Error).message}); cassettes untouched`);
    return;
  }
  for (const c of cassettes) c.count -= plan.get(c.note) ?? 0; // commit only when the whole plan works
  const notes = [...plan].map(([note, n]) => `${n} x ${note}`).join(' + ');
  console.log(`  ₹${amount}: ${notes}   left: ${cassettes.map((c) => `${c.note}:${c.count}`).join(' ')}`);
}

async function main(): Promise<void> {
  console.log('=== 1. Payment chain: timing -> auth -> rateLimit -> amount -> fraud -> charge ===');
  const cases: [string, Omit<PaymentRequest, 'trace'>][] = [
    ['happy path', { userId: 'pappu', token: 'valid', amount: 5_000 }],
    ['no token', { userId: 'pappu', amount: 5_000 }],
    ['amount too big', { userId: 'pappu', token: 'valid', amount: 5_00_000 }],
    ['new user, big amount', { userId: 'new_42', token: 'valid', amount: 1_80_000 }],
    ['3rd call (limit 2)', { userId: 'pappu', token: 'valid', amount: 100 }],
  ];
  for (const [label, r] of cases) {
    const req: PaymentRequest = { ...r, trace: [] };
    const res = await createPayment(req);
    const out = res.ok ? `OK ${res.txnId}` : `STOP at ${res.by}: ${res.error}`;
    console.log(`- ${label.padEnd(22)} ${out}`);
    console.log(`    path: ${req.trace.join(' -> ')}`);
  }

  console.log('\n=== 2. Refund reuses the links, skips rateLimit and fraud ===');
  const rq: PaymentRequest = { userId: 'new_42', token: 'valid', amount: 1_80_000, trace: [] };
  const rr = await createRefund(rq);
  console.log(`- refund ₹1,80,000 by new_42: ${rr.ok ? 'OK ' + rr.txnId : rr.error}   path: ${rq.trace.join(' -> ')}`);

  console.log('\n=== 3. ATM: 2000 -> 500 -> 200 -> 100 (each takes what it can, passes the rest) ===');
  const c2000 = new Cassette(2000, 2), c500 = new Cassette(500, 3), c200 = new Cassette(200, 5), c100 = new Cassette(100, 2);
  c2000.setNext(c500).setNext(c200).setNext(c100);
  const all = [c2000, c500, c200, c100];
  withdraw(c2000, all, 3_700);
  withdraw(c2000, all, 2_600);
  withdraw(c2000, all, 1_150);
  withdraw(c2000, all, 9_000);
}

main().catch((e) => { console.error(e); process.exit(1); });

export {}; // make this file a module so its names stay local
