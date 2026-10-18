// P14 · Chain of Responsibility
// Run: npx tsx lld/concepts/patterns/p14-chain-of-responsibility.ts

interface PaymentRequest { userId: string; token?: string; amount: number }
type Result = { ok: true; txnId: string } | { ok: false; error: string };

// ---------- before: all checks in one function ----------
async function createPaymentBefore(req: PaymentRequest): Promise<Result> {
  if (!req.token) return { ok: false, error: 'unauthorized' };
  if (req.amount <= 0 || req.amount > 200_000) return { ok: false, error: 'invalid amount' };
  return { ok: true, txnId: `txn_${req.userId}` };
}

// ---------- after (1): middleware-style chain (like Express / Koa) ----------
type Handler = (req: PaymentRequest, next: () => Promise<Result>) => Promise<Result>;

function chain(handlers: Handler[], final: (req: PaymentRequest) => Promise<Result>) {
  return (req: PaymentRequest): Promise<Result> => {
    const run = (i: number): Promise<Result> =>
      i === handlers.length ? final(req) : handlers[i]!(req, () => run(i + 1));
    return run(0);
  };
}

const logTiming: Handler = async (req, next) => {
  const res = await next(); // Koa-style: work after next() runs on the way back
  console.log(`    [log] ${req.userId} amount=${req.amount} -> ${res.ok ? 'ok' : res.error}`);
  return res;
};
const auth: Handler = async (req, next) => (req.token ? next() : { ok: false, error: 'unauthorized' });
const amountLimits: Handler = async (req, next) =>
  req.amount > 0 && req.amount <= 200_000 ? next() : { ok: false, error: 'invalid amount' };
const requestsByUser = new Map<string, number>();
const rateLimit: Handler = async (req, next) => {
  const n = (requestsByUser.get(req.userId) ?? 0) + 1;
  requestsByUser.set(req.userId, n);
  return n <= 2 ? next() : { ok: false, error: 'rate limited' };
};
const charge = async (req: PaymentRequest): Promise<Result> => ({ ok: true, txnId: `txn_${req.userId}_${req.amount}` });

// ---------- after (2): GoF object chain, ATM cash dispenser ----------
abstract class CashHandler {
  private next?: CashHandler;
  setNext(h: CashHandler): CashHandler { this.next = h; return h; }
  plan(amount: number, out: Map<number, number>): void {
    const left = this.handle(amount, out);
    if (left === 0) return;
    if (!this.next) throw new Error(`Cannot dispense remaining ${left}`);
    this.next.plan(left, out);
  }
  protected abstract handle(amount: number, out: Map<number, number>): number;
}

class NoteHandler extends CashHandler {
  constructor(readonly note: number, public available: number) { super(); }
  protected handle(amount: number, out: Map<number, number>): number {
    const count = Math.min(Math.floor(amount / this.note), this.available);
    if (count > 0) out.set(this.note, count);
    return amount - count * this.note;
  }
}

class Atm {
  constructor(private readonly first: CashHandler, private readonly all: NoteHandler[]) {}
  withdraw(amount: number): Map<number, number> {
    const out = new Map<number, number>();
    this.first.plan(amount, out); // plan first: throws before any note is removed
    for (const h of this.all) h.available -= out.get(h.note) ?? 0;
    return out;
  }
}

function fmt(m: Map<number, number>) { return [...m].map(([n, c]) => `${c} x ${n}`).join(', '); }

async function main() {
  console.log('--- before ---');
  console.log(' ', await createPaymentBefore({ userId: 'u1', token: 't', amount: 500 }));

  console.log('\n--- after: middleware chain ---');
  const createPayment = chain([logTiming, auth, rateLimit, amountLimits], charge);
  const refund = chain([logTiming, auth], async (r) => ({ ok: true, txnId: `rf_${r.userId}` })); // reuses handlers
  await createPayment({ userId: 'u1', token: 't', amount: 500 });
  await createPayment({ userId: 'u2', amount: 500 });
  await createPayment({ userId: 'u1', token: 't', amount: 900_000 });
  await createPayment({ userId: 'u1', token: 't', amount: 100 });
  await refund({ userId: 'u3', token: 't', amount: 100 });

  console.log('\n--- after: ATM note chain ---');
  const handlers = [new NoteHandler(2000, 2), new NoteHandler(500, 5), new NoteHandler(200, 5), new NoteHandler(100, 10)];
  for (let i = 0; i < handlers.length - 1; i++) handlers[i]!.setNext(handlers[i + 1]!);
  const atm = new Atm(handlers[0]!, handlers);
  console.log(`  withdraw 3700 -> ${fmt(atm.withdraw(3700))}`);
  console.log(`  withdraw 4800 -> ${fmt(atm.withdraw(4800))}`);
  try {
    atm.withdraw(50);
  } catch (e) {
    console.log(`  withdraw 50 -> expected error: ${(e as Error).message}`);
  }
  console.log(`  notes left: ${handlers.map((h) => `${h.note}:${h.available}`).join(' ')}`);
}

await main();

export {};
