// L07 demo: coupling ripple, Law of Demeter, DRY and cohesion on a checkout.
// Run: npx tsx lld/1-foundations/L07-design-principles/demo.ts
export {};

// ---------- 1. Coupling: how far does a change ripple? ----------
// edges: A -> B means "A breaks if B's internals change"
type Graph = Record<string, string[]>;
function ripple(g: Graph, changed: string): string[] {
  const broken = new Set<string>();
  const queue = [changed];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [mod, deps] of Object.entries(g)) {
      if (deps.includes(cur) && !broken.has(mod)) { broken.add(mod); queue.push(mod); }
    }
  }
  return [...broken];
}
// Tight: three services read wallet.balance directly.
const tight: Graph = { Checkout: ['Wallet', 'Customer'], Invoice: ['Wallet'], Refund: ['Wallet'], Customer: ['Wallet'] };
// Loose: only Wallet's public methods are used, by Customer only. A change *inside* Wallet ripples nowhere.
const loose: Graph = { Checkout: ['Customer.api'], Invoice: ['Customer.api'], Refund: ['Customer.api'], Customer: ['Wallet.api'] };

console.log('--- 1. Wallet switches from a balance field to a ledger ---');
console.log('  tight design breaks:', ripple(tight, 'Wallet').join(', '));
console.log('  loose design breaks:', ripple(loose, 'Wallet').join(', ') || '(nothing: the change stayed inside Wallet)');

// ---------- 2. Law of Demeter: tell, don't ask ----------
class Wallet {
  #entries: number[] = []; // after the refactor: a ledger, not a balance field
  credit(a: number) { this.#entries.push(a); }
  has(a: number) { return this.#entries.reduce((s, x) => s + x, 0) >= a; }
  debit(a: number) { if (!this.has(a)) throw new Error('Insufficient funds'); this.#entries.push(-a); }
}
class Customer {
  constructor(readonly name: string, private readonly wallet: Wallet) {}
  canAfford(a: number) { return this.wallet.has(a); }
  pay(a: number) { this.wallet.debit(a); }
}
class Order {
  constructor(private readonly customer: Customer, private readonly subtotal: number) {}
  total() { return this.subtotal; }
  canPay(a: number) { return this.customer.canAfford(a); }
  pay(a: number) { this.customer.pay(a); }
}

// ---------- 3. DRY: one owner for the tax rule ----------
class TaxPolicy {
  constructor(private readonly gst: number) {}
  addTax(a: number) { return Math.round(a * (1 + this.gst)); }
}

class CheckoutService {
  constructor(private readonly tax: TaxPolicy) {}
  checkout(order: Order): string {
    const payable = this.tax.addTax(order.total());
    if (!order.canPay(payable)) return `rejected: needs ${payable}`; // one hop, no reaching into Wallet
    order.pay(payable);
    return `paid ${payable}`;
  }
}

console.log('\n--- 2. Demeter: checkout talks only to Order ---');
const w = new Wallet();
w.credit(1000);
const order = new Order(new Customer('Pappu', w), 500);
const checkout = new CheckoutService(new TaxPolicy(0.18));
console.log('  checkout(500 + GST):', checkout.checkout(order));
console.log('  checkout again     :', checkout.checkout(order));
console.log("  (Wallet now stores a ledger; CheckoutService never knew it had a 'balance')");

console.log('\n--- 3. DRY: GST changes from 18% to 12% ---');
const copies = { cart: (a: number) => Math.round(a * 1.12), invoice: (a: number) => Math.round(a * 1.18) /* forgot this copy */, refund: (a: number) => Math.round(a * 1.12) };
console.log('  copied rule  -> cart', copies.cart(1000), '| invoice', copies.invoice(1000), '| refund', copies.refund(1000), ' <- invoice disagrees');
const policy = new TaxPolicy(0.12);
console.log('  one TaxPolicy-> cart', policy.addTax(1000), '| invoice', policy.addTax(1000), '| refund', policy.addTax(1000), ' <- always agree');

// ---------- 4. Cohesion: which methods share fields? ----------
// LCOM-style score: fraction of method pairs that share no field (0 = cohesive, 1 = junk drawer).
function lackOfCohesion(methods: Record<string, string[]>): number {
  const names = Object.keys(methods);
  let pairs = 0, disjoint = 0;
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    pairs++;
    if (!methods[names[i]].some((f) => methods[names[j]].includes(f))) disjoint++;
  }
  return pairs ? disjoint / pairs : 0;
}
console.log('\n--- 4. Cohesion score (0 = cohesive, 1 = junk drawer) ---');
const orderUtils = { formatDate: ['locale'], calcGst: ['gstRate'], sendSms: ['smsClient'], hashPassword: ['salt'] };
const taxPolicy = { addTax: ['gstRate'], removeTax: ['gstRate'], rateFor: ['gstRate', 'hsnTable'] };
console.log('  OrderUtils:', lackOfCohesion(orderUtils).toFixed(2), '-> split by theme');
console.log('  TaxPolicy :', lackOfCohesion(taxPolicy).toFixed(2), '-> one theme, keep together');

// ---------- 5. KISS / YAGNI ----------
console.log('\n--- 5. KISS / YAGNI ---');
console.log('  one provider today  -> class RazorpayClient { charge() }            (1 class)');
console.log('  "plugin-ready" design -> Manager + Registry + Factory + AbstractPlugin + RazorpayPlugin (5 classes, same behaviour)');
console.log('  add the interface when the second provider is a real requirement');
