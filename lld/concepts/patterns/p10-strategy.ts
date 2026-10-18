// P10 · Strategy
// Run: npx tsx lld/concepts/patterns/p10-strategy.ts

// ---------- before: switch inside the service ----------
function splitBefore(type: string, amount: number, users: string[], values: number[] = []): Record<string, number> {
  const out: Record<string, number> = {};
  switch (type) {
    case 'EQUAL': users.forEach((u) => (out[u] = amount / users.length)); break;
    case 'EXACT': users.forEach((u, i) => (out[u] = values[i] ?? 0)); break;
    case 'PERCENT': users.forEach((u, i) => (out[u] = (amount * (values[i] ?? 0)) / 100)); break;
    default: throw new Error(`unknown split ${type}`);
  }
  return out;
}

// ---------- after: one class per algorithm (amounts in integer paise) ----------
type SplitType = 'EQUAL' | 'EXACT' | 'PERCENT';
interface SplitStrategy {
  split(amount: number, users: string[], values: number[]): Map<string, number>;
}

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
    if (values.length !== users.length || sum !== amount) {
      throw new Error(`exact shares must add up to ${amount}, got ${sum}`);
    }
    return new Map(users.map((u, i) => [u, values[i]!]));
  }
}

class PercentSplit implements SplitStrategy {
  split(amount: number, users: string[], values: number[]): Map<string, number> {
    if (values.reduce((s, v) => s + v, 0) !== 100) throw new Error('percentages must add up to 100');
    const shares = users.map((u, i) => [u, Math.floor((amount * values[i]!) / 100)] as [string, number]);
    const diff = amount - shares.reduce((s, [, v]) => s + v, 0);
    shares[0]![1] += diff; // rounding remainder goes to the payer (first user)
    return new Map(shares);
  }
}

class ExpenseService {
  constructor(private readonly strategies: Record<SplitType, SplitStrategy>) {}
  addExpense(type: SplitType, amount: number, users: string[], values: number[] = []): Map<string, number> {
    return this.strategies[type].split(amount, users, values);
  }
}

// ---------- functions as strategies ----------
type PricingFn = (minutes: number) => number;
const hourly = (rate: number): PricingFn => (m) => Math.max(1, Math.ceil(m / 60)) * rate;
const flat = (fee: number): PricingFn => () => fee;
const capped = (inner: PricingFn, cap: number): PricingFn => (m) => Math.min(inner(m), cap);

function show(m: Map<string, number>): string {
  return [...m].map(([u, v]) => `${u}=${v}`).join(', ');
}

function main() {
  console.log('--- before ---');
  console.log('  EQUAL 100 / 3:', splitBefore('EQUAL', 100, ['a', 'b', 'c']), '(floating point, does not add up cleanly)');

  console.log('\n--- after: strategies ---');
  const service = new ExpenseService({
    EQUAL: new EqualSplit(),
    EXACT: new ExactSplit(),
    PERCENT: new PercentSplit(),
  });
  console.log('  EQUAL 100 / 3      :', show(service.addExpense('EQUAL', 100, ['asha', 'ravi', 'meena'])));
  console.log('  EXACT 1000         :', show(service.addExpense('EXACT', 1000, ['asha', 'ravi'], [700, 300])));
  console.log('  PERCENT 999 (50/50):', show(service.addExpense('PERCENT', 999, ['asha', 'ravi'], [50, 50])));
  try {
    service.addExpense('PERCENT', 500, ['asha', 'ravi'], [60, 30]);
  } catch (e) {
    console.log(`  expected error: ${(e as Error).message}`);
  }

  console.log('\n--- functions as strategies (parking price for 130 minutes) ---');
  const plans: Record<string, PricingFn> = {
    'hourly 20': hourly(20),
    'flat 50': flat(50),
    'hourly 40, cap 100': capped(hourly(40), 100),
  };
  for (const [name, fn] of Object.entries(plans)) console.log(`  ${name.padEnd(20)} -> ${fn(130)}`);
}

main();

export {};
