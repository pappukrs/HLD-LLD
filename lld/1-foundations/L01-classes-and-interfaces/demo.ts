// L01 demo: classes, interfaces and types on a tiny payments domain.
// Run: npx tsx lld/1-foundations/L01-classes-and-interfaces/demo.ts
export {};

type Receipt = { readonly id: string; readonly amount: number };

// 1. Interface: a contract. Erased by tsc.
interface PaymentGateway {
  readonly name: string;
  charge(amount: number): Promise<Receipt>;
}

// 2. Abstract class: shared code + one abstract step.
abstract class BaseGateway implements PaymentGateway {
  abstract readonly name: string;
  #calls = 0; // runtime-private counter
  protected abstract doCharge(amount: number): Promise<string>;

  async charge(amount: number): Promise<Receipt> {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error(`invalid amount ${amount}`);
    this.#calls++;
    return { id: await this.doCharge(amount), amount };
  }
  get calls(): number { return this.#calls; }
}

class RazorpayGateway extends BaseGateway {
  readonly name = 'razorpay';
  constructor(private readonly apiKey: string) { super(); } // parameter property
  protected async doCharge(amount: number) { return `rzp_${this.apiKey.slice(0, 4)}_${amount}`; }
}

class StripeGateway extends BaseGateway {
  readonly name = 'stripe';
  protected async doCharge(amount: number) { return `pi_${amount}`; }
}

// 3. Discriminated union: invalid states cannot be written.
type Payment =
  | { status: 'CREATED'; id: string; amount: number }
  | { status: 'CAPTURED'; id: string; amount: number; txnId: string }
  | { status: 'FAILED'; id: string; amount: number; reason: string };

function describe(p: Payment): string {
  switch (p.status) {
    case 'CREATED': return `${p.id}: pending ${p.amount}`;
    case 'CAPTURED': return `${p.id}: paid, txn ${p.txnId}`;
    case 'FAILED': return `${p.id}: failed (${p.reason})`;
    default: { const missed: never = p; return missed; }
  }
}

// 4. Generic repository: one class for any entity with an id.
interface Repository<T extends { id: string }> {
  save(item: T): void;
  findById(id: string): T | undefined;
  all(): readonly T[];
}
class InMemoryRepo<T extends { id: string }> implements Repository<T> {
  private items = new Map<string, T>();
  save(item: T) { this.items.set(item.id, item); }
  findById(id: string) { return this.items.get(id); }
  all() { return [...this.items.values()]; }
}

// 5. A service that depends only on contracts.
class CheckoutService {
  constructor(private readonly gateway: PaymentGateway, private readonly repo: Repository<Payment>) {}
  async pay(id: string, amount: number): Promise<Payment> {
    this.repo.save({ status: 'CREATED', id, amount });
    try {
      const r = await this.gateway.charge(amount);
      const p: Payment = { status: 'CAPTURED', id, amount, txnId: r.id };
      this.repo.save(p);
      return p;
    } catch (e) {
      const p: Payment = { status: 'FAILED', id, amount, reason: (e as Error).message };
      this.repo.save(p);
      return p;
    }
  }
}

async function main() {
  console.log('--- 1. one class, many objects ---');
  const live = new RazorpayGateway('live_key');
  const test = new RazorpayGateway('test_key');
  console.log('same charge() on both objects?', live.charge === test.charge, '(methods live on the prototype)');
  console.log('own fields:', Object.keys(live), 'vs', Object.keys(test));

  console.log('\n--- 2. private vs #private ---');
  console.log('(live as any).apiKey =', (live as any).apiKey, '<- TS private is compile-time only');
  console.log("'#calls' visible via keys?", Object.keys(live).includes('#calls'), '<- #field is real runtime privacy');

  console.log('\n--- 3. structural typing: a plain object is a valid gateway ---');
  const fake: PaymentGateway = { name: 'fake', charge: async (amount) => ({ id: 'fake_1', amount }) };
  console.log('fake gateway works:', (await fake.charge(10)).id);

  console.log('\n--- 4. service + generic repo + discriminated union ---');
  const repo = new InMemoryRepo<Payment>();
  const viaRazorpay = new CheckoutService(live, repo);
  const viaStripe = new CheckoutService(new StripeGateway(), repo);
  await viaRazorpay.pay('P1', 499);
  await viaStripe.pay('P2', 1200);
  await viaStripe.pay('P3', -5); // fails validation in BaseGateway
  repo.all().forEach((p) => console.log(' ', describe(p)));
  console.log('razorpay calls counted inside #calls:', live.calls);

  console.log('\n--- 5. what tsc would reject (shown as comments) ---');
  console.log("  const bad: Payment = { status: 'CAPTURED', id: 'x', amount: 1 }  // error: txnId is missing");
  console.log("  new BaseGateway()                                            // error: cannot create an abstract class");
  console.log("  live.apiKey                                                  // error: 'apiKey' is private");
}

main().catch((e) => { console.error(e); process.exit(1); });
