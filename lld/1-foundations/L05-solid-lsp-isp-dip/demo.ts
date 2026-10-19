// L05 demo: LSP, ISP and DIP on payments.
// Run: npx tsx lld/1-foundations/L05-solid-lsp-isp-dip/demo.ts
export {};

// ---------- LSP broken: a subtype that cannot keep the promise ----------
interface FatPaymentMethod { readonly name: string; pay(amount: number): Promise<string>; refund(txnId: string): Promise<void>; }
class FatCard implements FatPaymentMethod {
  readonly name = 'card';
  async pay(a: number) { return `card_${a}`; }
  async refund(id: string) { console.log(`    refunded ${id}`); }
}
class FatGiftCard implements FatPaymentMethod {
  readonly name = 'giftcard';
  async pay(a: number) { return `gc_${a}`; }
  async refund(): Promise<void> { throw new Error('Gift cards cannot be refunded'); }
}

// ---------- LSP classic: Square extends Rectangle ----------
class Rectangle {
  constructor(protected w: number, protected h: number) {}
  setWidth(w: number) { this.w = w; }
  setHeight(h: number) { this.h = h; }
  area() { return this.w * this.h; }
}
class Square extends Rectangle {
  override setWidth(w: number) { this.w = w; this.h = w; }
  override setHeight(h: number) { this.w = h; this.h = h; }
}
const resize = (r: Rectangle) => { r.setWidth(5); r.setHeight(4); return r.area(); };

// ---------- ISP: small role interfaces ----------
interface Payable { readonly name: string; pay(amount: number): Promise<string>; }
interface Refundable { readonly name: string; refund(txnId: string): Promise<void>; }
class CardPayment implements Payable, Refundable {
  readonly name = 'card';
  async pay(a: number) { return `card_${a}`; }
  async refund(id: string) { console.log(`    card refund ${id} ok`); }
}
class UpiPayment implements Payable, Refundable {
  readonly name = 'upi';
  async pay(a: number) { return `upi_${a}`; }
  async refund(id: string) { console.log(`    upi refund ${id} ok`); }
}
class GiftCardPayment implements Payable {
  readonly name = 'giftcard';
  async pay(a: number) { return `gc_${a}`; }
}
async function refundAll(items: { method: Refundable; txnId: string }[]) {
  for (const it of items) await it.method.refund(it.txnId);
}

// ---------- DIP: the domain owns the interfaces ----------
type Payment = { userId: string; amount: number; txnId: string };
interface PaymentRepo { save(p: Payment): Promise<void>; count(): Promise<number>; }
interface Notifier { send(to: string, msg: string): Promise<void>; }

class PaymentService {
  constructor(private readonly repo: PaymentRepo, private readonly notifier: Notifier) {}
  async pay(method: Payable, user: { id: string; email: string }, amount: number) {
    const txnId = await method.pay(amount);
    await this.repo.save({ userId: user.id, amount, txnId });
    await this.notifier.send(user.email, `Paid ${amount} via ${method.name}`);
    return txnId;
  }
}

// "infra" implementations (simulated)
class PostgresRepo implements PaymentRepo {
  private rows = 0;
  async save(p: Payment) { this.rows++; console.log(`    [postgres] INSERT INTO payments VALUES ('${p.userId}', ${p.amount}, '${p.txnId}')`); }
  async count() { return this.rows; }
}
class SmtpNotifier implements Notifier {
  async send(to: string, msg: string) { console.log(`    [smtp] to ${to}: ${msg}`); }
}
// test implementations
class InMemoryRepo implements PaymentRepo {
  readonly rows: Payment[] = [];
  async save(p: Payment) { this.rows.push(p); }
  async count() { return this.rows.length; }
}
class FakeNotifier implements Notifier {
  readonly sent: string[] = [];
  async send(to: string, msg: string) { this.sent.push(`${to}|${msg}`); }
}

async function main() {
  console.log('--- LSP broken: refund job trusts the fat interface ---');
  for (const [m, id] of [[new FatCard(), 't1'], [new FatGiftCard(), 't2']] as const) {
    try { await m.refund(id); } catch (e) { console.log(`    ${m.name}: CRASH -> ${(e as Error).message}`); }
  }

  console.log('\n--- LSP classic: resize(r) expects area 20 ---');
  console.log(`    Rectangle: ${resize(new Rectangle(1, 1))}   Square: ${resize(new Square(1, 1))}  <- Square broke the promise`);

  console.log('\n--- ISP fix: RefundJob takes Refundable[] ---');
  await refundAll([{ method: new CardPayment(), txnId: 't1' }, { method: new UpiPayment(), txnId: 't3' }]);
  console.log("    refundAll([{ method: new GiftCardPayment(), ... }])  // compile error: 'refund' is missing");

  console.log('\n--- DIP: production wiring (composition root) ---');
  const prod = new PaymentService(new PostgresRepo(), new SmtpNotifier());
  await prod.pay(new CardPayment(), { id: 'u1', email: 'pappu@x.in' }, 499);

  console.log('\n--- DIP: test wiring, same PaymentService code ---');
  const repo = new InMemoryRepo();
  const notifier = new FakeNotifier();
  const svc = new PaymentService(repo, notifier);
  const t0 = performance.now();
  await svc.pay(new GiftCardPayment(), { id: 'u2', email: 't@x.in' }, 250);
  const ms = (performance.now() - t0).toFixed(2);
  console.log(`    rows=${await repo.count()} sent=${JSON.stringify(notifier.sent)} in ${ms} ms, no network`);
  console.log('    assert:', repo.rows[0].txnId === 'gc_250' ? 'PASS' : 'FAIL');
}

main().catch((e) => { console.error(e); process.exit(1); });
