import * as starter from './starter';
import * as reference from './reference';
import type { SplitStrategy } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { Splitwise, EqualSplit, ExactSplit, PercentSplit } = (process.env.REF ? reference : starter) as typeof reference;

// Amounts are in paise: 30000 = ₹300.
function makeGroup(...users: string[]) {
  const sw = new Splitwise();
  for (const u of users) sw.addUser(u);
  return sw;
}

describe('09 · Splitwise', () => {
  describe('split types', () => {
    it('splits equally and records who owes the payer', () => {
      const sw = makeGroup('A', 'B', 'C');
      sw.addExpense({ paidBy: 'A', amount: 30000, split: new EqualSplit(['A', 'B', 'C']), description: 'Dinner' });
      expect(sw.owes('B', 'A')).toBe(10000);
      expect(sw.owes('C', 'A')).toBe(10000);
      expect(sw.owes('A', 'B')).toBe(0);
      expect(sw.balances()).toEqual({ A: 20000, B: -10000, C: -10000 });
    });

    it('gives leftover paise of an equal split to the first people in the list', () => {
      const sw = makeGroup('A', 'B', 'C');
      const e = sw.addExpense({ paidBy: 'A', amount: 100, split: new EqualSplit(['A', 'B', 'C']) });
      expect(e.shares).toEqual({ A: 34, B: 33, C: 33 });
    });

    it('splits by exact amounts and rejects amounts that do not add up', () => {
      const sw = makeGroup('A', 'B', 'C');
      sw.addExpense({ paidBy: 'A', amount: 1000, split: new ExactSplit({ B: 700, C: 300 }) });
      expect(sw.owes('B', 'A')).toBe(700);
      expect(() => sw.addExpense({ paidBy: 'A', amount: 1000, split: new ExactSplit({ B: 700, C: 200 }) })).toThrow();
    });

    it('splits by percent and rejects percentages that do not add up to 100', () => {
      const sw = makeGroup('A', 'B');
      sw.addExpense({ paidBy: 'A', amount: 2000, split: new PercentSplit({ A: 25, B: 75 }) });
      expect(sw.owes('B', 'A')).toBe(1500);
      expect(() => new PercentSplit({ A: 50, B: 40 })).toThrow();
    });

    it('rounds percent shares so they still add up to the amount', () => {
      const sw = makeGroup('A', 'B', 'C');
      const e = sw.addExpense({ paidBy: 'A', amount: 100, split: new PercentSplit({ A: 33.33, B: 33.33, C: 33.34 }) });
      expect(e.shares).toEqual({ A: 33, B: 33, C: 34 });
    });
  });

  describe('balances', () => {
    it('nets debts between two people across expenses', () => {
      const sw = makeGroup('A', 'B');
      sw.addExpense({ paidBy: 'A', amount: 10000, split: new ExactSplit({ B: 10000 }) });
      sw.addExpense({ paidBy: 'B', amount: 6000, split: new ExactSplit({ A: 6000 }) });
      expect(sw.owes('B', 'A')).toBe(4000);
      expect(sw.owes('A', 'B')).toBe(0);
      expect(sw.history()).toHaveLength(2);
    });

    it('settles a debt and rejects paying back more than is owed', () => {
      const sw = makeGroup('A', 'B');
      sw.addExpense({ paidBy: 'A', amount: 10000, split: new EqualSplit(['A', 'B']) });
      sw.settle('B', 'A', 3000);
      expect(sw.owes('B', 'A')).toBe(2000);
      expect(() => sw.settle('B', 'A', 2001)).toThrow();
      sw.settle('B', 'A', 2000);
      expect(sw.balance('A')).toBe(0);
    });

    it('rejects unknown users, bad amounts, duplicate users and bad splits', () => {
      const sw = makeGroup('A', 'B');
      expect(() => sw.addUser('A')).toThrow();
      expect(() => sw.addExpense({ paidBy: 'Z', amount: 100, split: new EqualSplit(['A']) })).toThrow();
      expect(() => sw.addExpense({ paidBy: 'A', amount: 100, split: new EqualSplit(['A', 'Z']) })).toThrow();
      expect(() => sw.addExpense({ paidBy: 'A', amount: 0, split: new EqualSplit(['A', 'B']) })).toThrow();
      expect(() => sw.addExpense({ paidBy: 'A', amount: 10.5, split: new EqualSplit(['A', 'B']) })).toThrow();
      expect(() => new EqualSplit([])).toThrow();
      expect(() => new EqualSplit(['A', 'A'])).toThrow();
      expect(sw.history()).toHaveLength(0);
    });
  });

  describe('simplify debts', () => {
    it('collapses a chain: C owes B, B owes A -> C pays A', () => {
      const sw = makeGroup('A', 'B', 'C');
      sw.addExpense({ paidBy: 'A', amount: 10000, split: new ExactSplit({ B: 10000 }) });
      sw.addExpense({ paidBy: 'B', amount: 10000, split: new ExactSplit({ C: 10000 }) });
      expect(sw.simplify()).toEqual([{ from: 'C', to: 'A', amount: 10000 }]);
    });

    it('settles everyone with at most n - 1 payments', () => {
      const users = ['A', 'B', 'C', 'D', 'E'];
      const sw = makeGroup(...users);
      sw.addExpense({ paidBy: 'A', amount: 50000, split: new EqualSplit(users) });
      sw.addExpense({ paidBy: 'B', amount: 12345, split: new EqualSplit(['B', 'C', 'D']) });
      sw.addExpense({ paidBy: 'E', amount: 9000, split: new PercentSplit({ A: 10, C: 40, D: 50 }) });
      sw.addExpense({ paidBy: 'C', amount: 3000, split: new ExactSplit({ E: 1000, B: 2000 }) });

      const before = sw.balances();
      expect(Object.values(before).reduce((s, v) => s + v, 0)).toBe(0); // money is never created

      const payments = sw.simplify();
      expect(payments.length).toBeLessThanOrEqual(users.length - 1);
      const after = { ...before };
      for (const p of payments) {
        expect(p.amount).toBeGreaterThan(0);
        after[p.from] += p.amount;
        after[p.to] -= p.amount;
      }
      expect(Object.values(after).every((v) => v === 0)).toBe(true);
    });
  });

  describe('extensibility', () => {
    it('accepts any SplitStrategy, for example split by shares (1:2)', () => {
      class ShareSplit implements SplitStrategy {
        constructor(private readonly weights: Record<string, number>) {}
        shares(amount: number) {
          const ids = Object.keys(this.weights);
          const total = ids.reduce((s, id) => s + this.weights[id], 0);
          const result = new Map(ids.map((id) => [id, Math.floor((amount * this.weights[id]) / total)]));
          const used = [...result.values()].reduce((s, v) => s + v, 0);
          result.set(ids[0], result.get(ids[0])! + amount - used);
          return result;
        }
      }
      const sw = makeGroup('A', 'B', 'C');
      sw.addExpense({ paidBy: 'A', amount: 9000, split: new ShareSplit({ B: 1, C: 2 }) });
      expect(sw.owes('B', 'A')).toBe(3000);
      expect(sw.owes('C', 'A')).toBe(6000);
    });

    it('rejects a custom strategy whose shares do not add up', () => {
      const broken: SplitStrategy = { shares: () => new Map([['B', 1]]) };
      const sw = makeGroup('A', 'B');
      expect(() => sw.addExpense({ paidBy: 'A', amount: 100, split: broken })).toThrow();
    });
  });
});
