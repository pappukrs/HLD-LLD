// L33 · Domain modelling in TS: value objects, branded ids, unions for state, typed errors.
// Run: npx tsx lld/5-machine-coding/L33-domain-modeling/demo.ts

// ---------- typed errors ----------
abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  constructor(message: string) { super(message); this.name = new.target.name; }
}
class ValidationError extends DomainError { readonly code = 'VALIDATION'; readonly httpStatus = 400; }
class NotFoundError extends DomainError { readonly code = 'NOT_FOUND'; readonly httpStatus = 404; }
class ConflictError extends DomainError { readonly code = 'CONFLICT'; readonly httpStatus = 409; }
class InsufficientFundsError extends DomainError { readonly code = 'INSUFFICIENT_FUNDS'; readonly httpStatus = 422; }

// ---------- branded ids ----------
type PaymentId = string & { readonly __brand: 'PaymentId' };
type WalletId = string & { readonly __brand: 'WalletId' };
const PaymentId = (s: string) => s as PaymentId;
const WalletId = (s: string) => s as WalletId;

// ---------- value object: Money ----------
type Currency = 'INR' | 'USD';
class Money {
  private constructor(readonly paise: bigint, readonly currency: Currency) {}
  static of(amount: number, currency: Currency = 'INR') {
    if (!Number.isFinite(amount) || amount < 0) throw new ValidationError(`invalid amount ${amount}`);
    return new Money(BigInt(Math.round(amount * 100)), currency);
  }
  static zero(currency: Currency = 'INR') { return new Money(0n, currency); }
  add(o: Money) { this.same(o); return new Money(this.paise + o.paise, this.currency); }
  subtract(o: Money) {
    this.same(o);
    if (o.paise > this.paise) throw new ValidationError('money cannot go negative');
    return new Money(this.paise - o.paise, this.currency);
  }
  lessThan(o: Money) { this.same(o); return this.paise < o.paise; }
  equals(o: Money) { return this.paise === o.paise && this.currency === o.currency; }
  toString() {
    const sign = this.currency === 'INR' ? '₹' : '$';
    return `${sign}${this.paise / 100n}.${(this.paise % 100n).toString().padStart(2, '0')}`;
  }
  private same(o: Money) {
    if (o.currency !== this.currency) throw new ValidationError(`cannot mix ${this.currency} and ${o.currency}`);
  }
}

// ---------- state as a discriminated union ----------
type Payment =
  | { status: 'CREATED'; id: PaymentId; amount: Money }
  | { status: 'CAPTURED'; id: PaymentId; amount: Money; txnId: string }
  | { status: 'FAILED'; id: PaymentId; amount: Money; reason: string }
  | { status: 'REFUNDED'; id: PaymentId; amount: Money; txnId: string; refundId: string };

const NEXT: Record<Payment['status'], ReadonlyArray<Payment['status']>> = {
  CREATED: ['CAPTURED', 'FAILED'], CAPTURED: ['REFUNDED'], FAILED: [], REFUNDED: [],
};
function assertCanMove(p: Payment, to: Payment['status']) {
  if (!NEXT[p.status].includes(to)) throw new ConflictError(`${p.id}: ${p.status} → ${to} not allowed`);
}
function capture(p: Payment, txnId: string): Payment {
  assertCanMove(p, 'CAPTURED');
  return { status: 'CAPTURED', id: p.id, amount: p.amount, txnId };
}
function refund(p: Payment, refundId: string): Payment {
  assertCanMove(p, 'REFUNDED');
  if (p.status !== 'CAPTURED') throw new ConflictError('unreachable'); // narrows p for the compiler
  return { ...p, status: 'REFUNDED', refundId };
}
function label(p: Payment): string {
  switch (p.status) {
    case 'CREATED': return `${p.id} pending ${p.amount}`;
    case 'CAPTURED': return `${p.id} paid ${p.amount} (txn ${p.txnId})`;
    case 'FAILED': return `${p.id} failed: ${p.reason}`;
    case 'REFUNDED': return `${p.id} refunded ${p.amount} (refund ${p.refundId})`;
    default: { const never: never = p; return never; }   // add a state, forget it here → compile error
  }
}

// ---------- entity: Wallet guards its own rules ----------
class Wallet {
  private balance = Money.zero('INR');
  private status: 'ACTIVE' | 'FROZEN' = 'ACTIVE';
  constructor(readonly id: WalletId) {}
  credit(m: Money) { this.balance = this.balance.add(m); }
  debit(m: Money) {
    if (this.status === 'FROZEN') throw new ConflictError(`wallet ${this.id} is frozen`);
    if (this.balance.lessThan(m)) throw new InsufficientFundsError(`balance ${this.balance}, need ${m}`);
    this.balance = this.balance.subtract(m);
  }
  freeze() { this.status = 'FROZEN'; }
  get current() { return this.balance; }
}

// ---------- boundary: one catch maps every DomainError ----------
function http(fn: () => unknown): string {
  try { const v = fn(); return `200 ${String(v ?? 'ok')}`; }
  catch (e) {
    if (e instanceof DomainError) return `${e.httpStatus} ${e.code}: ${e.message}`;
    throw e;  // a real bug: let it crash loudly
  }
}

function main() {
  console.log('=== Money: floats vs paise ===');
  console.log('0.1 + 0.2 as numbers =', 0.1 + 0.2);
  console.log('Money(0.1) + Money(0.2) =', Money.of(0.1).add(Money.of(0.2)).toString());
  console.log('equal by value:', Money.of(5).equals(Money.of(5)), '| same object:', Money.of(5) === Money.of(5));
  console.log('mix currencies ->', http(() => Money.of(10, 'INR').add(Money.of(1, 'USD'))));
  console.log('negative       ->', http(() => Money.of(-5)));

  console.log('\n=== Payment states: discriminated union + transition table ===');
  let p: Payment = { status: 'CREATED', id: PaymentId('pay_1'), amount: Money.of(499) };
  console.log(label(p));
  p = capture(p, 'txn_razorpay_77');
  console.log(label(p));
  console.log('capture again ->', http(() => capture(p, 'txn_dup')));   // late duplicate webhook
  p = refund(p, 'rfnd_9');
  console.log(label(p));
  console.log('refund again  ->', http(() => refund(p, 'rfnd_10')));

  console.log('\n=== Wallet entity: rules live inside it ===');
  const w = new Wallet(WalletId('w_pappu'));
  console.log('credit ₹1000  ->', http(() => { w.credit(Money.of(1000)); return w.current; }));
  console.log('debit ₹250.75 ->', http(() => { w.debit(Money.of(250.75)); return w.current; }));
  console.log('debit ₹5000   ->', http(() => w.debit(Money.of(5000))));
  w.freeze();
  console.log('debit frozen  ->', http(() => w.debit(Money.of(1))));
  console.log('unknown id    ->', http(() => { throw new NotFoundError('wallet w_ghost'); }));

  console.log('\n=== Branded ids (compile-time only) ===');
  // const bad: PaymentId = WalletId('w1');   // ← uncomment: TS2322, a WalletId is not a PaymentId
  console.log('WalletId and PaymentId are both strings at runtime, but cannot be swapped in code.');
}

main();

export {};
