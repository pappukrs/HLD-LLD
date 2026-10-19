// L04 demo: SRP and OCP on an order flow with coupons.
// Run: npx tsx lld/1-foundations/L04-solid-srp-ocp/demo.ts
export {};

type OrderInput = { id: string; amount: number; email: string; coupon?: string };

// ---------- Before: one class, five reasons to change ----------
class GodOrderService {
  readonly log: string[] = [];
  placeOrder(o: OrderInput): number {
    if (o.amount <= 0) throw new Error('bad amount');      // product
    let total = o.amount;
    if (o.coupon === 'FLAT100') total -= 100;               // marketing
    else if (o.coupon === 'TENPCT') total = Math.round(total * 0.9);
    this.log.push(`POST /pay ${total}`);                    // finance
    this.log.push(`INSERT orders ${o.id}`);                 // DBA
    this.log.push(`email ${o.email}: Paid ${total}`);       // CRM
    return total;
  }
}

// ---------- After: one class per reason to change ----------
class OrderValidator {
  validate(o: OrderInput) { if (!Number.isInteger(o.amount) || o.amount <= 0) throw new Error(`bad amount ${o.amount}`); }
}

interface Discount { readonly code: string; apply(total: number): number; }
class FlatDiscount implements Discount {
  constructor(readonly code: string, private readonly off: number) {}
  apply(total: number) { return Math.max(0, total - this.off); }
}
class PercentDiscount implements Discount {
  constructor(readonly code: string, private readonly pct: number) {}
  apply(total: number) { return Math.round(total * (1 - this.pct / 100)); }
}

class PricingService {
  private readonly byCode = new Map<string, Discount>();
  register(d: Discount): this { this.byCode.set(d.code, d); return this; }
  price(amount: number, code?: string): number {
    const d = code ? this.byCode.get(code) : undefined;
    return d ? d.apply(amount) : amount;
  }
}

interface PaymentGateway { charge(amount: number): Promise<string>; }
interface OrderRepository { save(row: { id: string; total: number; txnId: string }): Promise<void>; }
interface Notifier { notify(to: string, msg: string): Promise<void>; }

class OrderService {
  constructor(
    private readonly validator: OrderValidator,
    private readonly pricing: PricingService,
    private readonly gateway: PaymentGateway,
    private readonly repo: OrderRepository,
    private readonly notifier: Notifier,
  ) {}
  async placeOrder(o: OrderInput) {
    this.validator.validate(o);
    const total = this.pricing.price(o.amount, o.coupon);
    const txnId = await this.gateway.charge(total);
    await this.repo.save({ id: o.id, total, txnId });
    await this.notifier.notify(o.email, `Paid ${total}`);
    return { orderId: o.id, total, txnId };
  }
}

async function main() {
  console.log('--- Before: the god class ---');
  const god = new GodOrderService();
  console.log('  total =', god.placeOrder({ id: 'O1', amount: 1000, email: 'a@x.in', coupon: 'TENPCT' }));
  god.log.forEach((l) => console.log('   ', l));
  console.log('  to add a coupon, a new channel or a new DB: edit GodOrderService every time');

  console.log('\n--- After: SRP split + OCP pricing ---');
  const rows: string[] = [];
  let n = 0;
  const pricing = new PricingService().register(new FlatDiscount('FLAT100', 100)).register(new PercentDiscount('TENPCT', 10));
  const service = new OrderService(
    new OrderValidator(),
    pricing,
    { charge: async (amt) => `txn_${++n}_${amt}` },
    { save: async (r) => { rows.push(`${r.id}=${r.total}`); } },
    { notify: async (to, msg) => console.log(`    notify ${to}: ${msg}`) },
  );
  for (const o of [
    { id: 'O1', amount: 1000, email: 'a@x.in', coupon: 'TENPCT' },
    { id: 'O2', amount: 1000, email: 'b@x.in', coupon: 'FLAT100' },
    { id: 'O3', amount: 1000, email: 'c@x.in' },
  ]) console.log('  ', await service.placeOrder(o));

  console.log('\n--- OCP: marketing adds "buy one get one" ---');
  class BuyOneGetOne implements Discount {
    readonly code = 'BOGO';
    apply(total: number) { return Math.ceil(total / 2); }
  }
  pricing.register(new BuyOneGetOne()); // composition root: 1 new line
  console.log('  ', await service.placeOrder({ id: 'O4', amount: 1000, email: 'd@x.in', coupon: 'BOGO' }));
  console.log('  files edited: 0 (OrderService, PricingService untouched); files added: 1 (BuyOneGetOne)');

  console.log('\n--- SRP: each concern is testable alone ---');
  console.log('  PricingService alone: 1000 with FLAT100 ->', pricing.price(1000, 'FLAT100'));
  try { new OrderValidator().validate({ id: 'X', amount: -5, email: '' }); } catch (e) { console.log('  OrderValidator alone:', (e as Error).message); }
  console.log('  rows saved by the fake repo:', rows.join(', '));
}

main().catch((e) => { console.error(e); process.exit(1); });
