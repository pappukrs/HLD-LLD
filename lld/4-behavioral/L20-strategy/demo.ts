// L20 Strategy: split types for Splitwise, a payment-method registry, and functions as strategies.
// Run: npx tsx lld/4-behavioral/L20-strategy/demo.ts

// ---------- before: switch inside the service (floating point, no validation) ----------
function splitBefore(type: string, amount: number, users: string[], values: number[] = []): number[] {
  switch (type) {
    case 'EQUAL': return users.map(() => amount / users.length);
    case 'EXACT': return values;
    case 'PERCENT': return values.map((p) => (amount * p) / 100);
    default: throw new Error(`unknown split ${type}`);
  }
}

// ---------- after: one class per algorithm, integer paise ----------
type SplitType = 'EQUAL' | 'EXACT' | 'PERCENT' | 'SHARES';
interface SplitStrategy { split(amount: number, users: string[], values: number[]): Map<string, number> }

class EqualSplit implements SplitStrategy {
  split(amount: number, users: string[]): Map<string, number> {
    const base = Math.floor(amount / users.length);
    let rest = amount - base * users.length;
    return new Map(users.map((u) => [u, base + (rest-- > 0 ? 1 : 0)]));
  }
}
class ExactSplit implements SplitStrategy {
  split(amount: number, users: string[], values: number[]): Map<string, number> {
    const sum = values.reduce((s, v) => s + v, 0);
    if (values.length !== users.length || sum !== amount) throw new Error(`exact shares must add up to ${amount}, got ${sum}`);
    return new Map(users.map((u, i) => [u, values[i]!]));
  }
}
// Proportional split shared by PERCENT and SHARES: floor each share, remainder to the payer (first user).
function proportional(amount: number, users: string[], weights: number[]): Map<string, number> {
  const total = weights.reduce((s, w) => s + w, 0);
  const shares = users.map((u, i) => [u, Math.floor((amount * weights[i]!) / total)] as [string, number]);
  shares[0]![1] += amount - shares.reduce((s, [, v]) => s + v, 0);
  return new Map(shares);
}
class PercentSplit implements SplitStrategy {
  split(amount: number, users: string[], pcts: number[]): Map<string, number> {
    if (pcts.reduce((s, p) => s + p, 0) !== 100) throw new Error('percentages must add up to 100');
    return proportional(amount, users, pcts);
  }
}
class SharesSplit implements SplitStrategy { // added later: no change to ExpenseService
  split(amount: number, users: string[], shares: number[]): Map<string, number> { return proportional(amount, users, shares); }
}

class ExpenseService {
  constructor(private readonly strategies: Partial<Record<SplitType, SplitStrategy>>) {}
  addExpense(type: SplitType, amount: number, users: string[], values: number[] = []): Map<string, number> {
    const s = this.strategies[type];
    if (!s) throw new Error(`UNSUPPORTED_SPLIT ${type}`);
    return s.split(amount, users, values);
  }
}

// ---------- payment-method registry (factory picks the strategy from input) ----------
interface PaymentStrategy { pay(amount: number): string }
const registry: Record<string, () => PaymentStrategy> = {
  card: () => ({ pay: (a) => `card gateway charged Rs ${a / 100}` }),
  upi: () => ({ pay: (a) => `UPI collect request sent for Rs ${a / 100}` }),
  wallet: () => ({ pay: (a) => `wallet debited Rs ${a / 100}` }),
};
function strategyFor(method: string): PaymentStrategy {
  const make = registry[method];
  if (!make) throw new Error(`400 UnsupportedMethod '${method}'`);
  return make();
}
class CheckoutService { checkout(amount: number, s: PaymentStrategy): string { return s.pay(amount); } }

// ---------- functions as strategies ----------
type PricingFn = (minutes: number) => number;
const hourly = (rate: number): PricingFn => (m) => Math.max(1, Math.ceil(m / 60)) * rate;
const flat = (fee: number): PricingFn => () => fee;
const capped = (inner: PricingFn, cap: number): PricingFn => (m) => Math.min(inner(m), cap);

const show = (m: Map<string, number>) => [...m].map(([u, v]) => `${u}=${v}`).join(', ');

function main(): void {
  console.log('== 1. Before: switch in the service');
  console.log(`  EQUAL 100 / 3 -> ${splitBefore('EQUAL', 100, ['a', 'b', 'c']).join(', ')} (does not add up cleanly)`);
  console.log(`  EXACT 1000 with [700, 200] -> ${splitBefore('EXACT', 1000, ['a', 'b'], [700, 200]).join(', ')} (100 paise vanished, no check)`);

  console.log('\n== 2. After: strategies, amounts in paise');
  const svc = new ExpenseService({ EQUAL: new EqualSplit(), EXACT: new ExactSplit(), PERCENT: new PercentSplit() });
  console.log(`  EQUAL   100 / 3       : ${show(svc.addExpense('EQUAL', 100, ['asha', 'ravi', 'meena']))}`);
  console.log(`  EXACT   1000          : ${show(svc.addExpense('EXACT', 1000, ['asha', 'ravi'], [700, 300]))}`);
  console.log(`  PERCENT 999 (50/50)   : ${show(svc.addExpense('PERCENT', 999, ['asha', 'ravi'], [50, 50]))}`);
  for (const [t, vals] of [['EXACT', [700, 200]], ['PERCENT', [60, 30]]] as const) {
    try { svc.addExpense(t, 1000, ['asha', 'ravi'], [...vals]); } catch (e) { console.log(`  ${t} rejected: ${(e as Error).message}`); }
  }
  try { svc.addExpense('SHARES', 1200, ['asha', 'ravi', 'meena'], [2, 1, 1]); } catch (e) { console.log(`  ${(e as Error).message}`); }

  console.log('\n== 3. Add SHARES: one new class + one map entry, service untouched');
  const svc2 = new ExpenseService({ EQUAL: new EqualSplit(), EXACT: new ExactSplit(), PERCENT: new PercentSplit(), SHARES: new SharesSplit() });
  console.log(`  SHARES 1201 (2:1:1)   : ${show(svc2.addExpense('SHARES', 1201, ['asha', 'ravi', 'meena'], [2, 1, 1]))}`);

  console.log('\n== 4. Payment method picked at runtime from the request');
  const checkout = new CheckoutService();
  for (const method of ['upi', 'card', 'crypto']) {
    try { console.log(`  POST /checkout {method:'${method}'} -> ${checkout.checkout(49_900, strategyFor(method))}`); }
    catch (e) { console.log(`  POST /checkout {method:'${method}'} -> ${(e as Error).message}`); }
  }

  console.log('\n== 5. Functions as strategies (parking for 130 minutes)');
  const plans: Record<string, PricingFn> = { 'hourly 20': hourly(20), 'flat 50': flat(50), 'hourly 40, cap 100': capped(hourly(40), 100) };
  for (const [name, fn] of Object.entries(plans)) console.log(`  ${name.padEnd(20)} -> Rs ${fn(130)}`);

  console.log('\nTakeaway: the context delegates to an interface; variants are classes or functions; choose them at the boundary.');
}

main();

export {};
