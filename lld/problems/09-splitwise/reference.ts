// 09 · Splitwise: reference solution.
// Read this only after your own attempt passes (or after 75 minutes).
// All money is an integer number of paise. Floats lose paise: 0.1 + 0.2 !== 0.3.

export interface SplitStrategy {
  /** userId -> share in paise. The shares must add up to `amount`. */
  shares(amount: number): Map<string, number>;
}

export interface ExpenseInput {
  paidBy: string;
  amount: number; // paise, positive integer
  split: SplitStrategy;
  description?: string;
}

export interface Expense {
  readonly id: string;
  readonly description: string;
  readonly paidBy: string;
  readonly amount: number;
  readonly shares: Readonly<Record<string, number>>;
}

export interface Debt {
  readonly from: string;
  readonly to: string;
  readonly amount: number;
}

function assertPaise(name: string, value: number, allowZero = false): void {
  if (!Number.isInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${name} must be a ${allowZero ? 'non-negative' : 'positive'} integer in paise`);
  }
}

function assertUnique(ids: string[]): void {
  if (ids.length === 0) throw new Error('A split needs at least one person');
  if (new Set(ids).size !== ids.length) throw new Error('A person appears twice in the split');
}

export class EqualSplit implements SplitStrategy {
  constructor(private readonly participants: string[]) {
    assertUnique(participants);
  }

  // 100 paise / 3 = 34, 33, 33. The leftover paise go to the first people in the list,
  // so the result is the same every time.
  shares(amount: number): Map<string, number> {
    const n = this.participants.length;
    const base = Math.floor(amount / n);
    const extra = amount - base * n;
    return new Map(this.participants.map((id, i) => [id, base + (i < extra ? 1 : 0)]));
  }
}

export class ExactSplit implements SplitStrategy {
  constructor(private readonly amounts: Record<string, number>) {
    assertUnique(Object.keys(amounts));
    for (const [id, a] of Object.entries(amounts)) assertPaise(`Share of ${id}`, a, true);
  }

  shares(amount: number): Map<string, number> {
    const total = Object.values(this.amounts).reduce((s, a) => s + a, 0);
    if (total !== amount) throw new Error(`Exact shares add up to ${total}, not ${amount}`);
    return new Map(Object.entries(this.amounts));
  }
}

export class PercentSplit implements SplitStrategy {
  constructor(private readonly percents: Record<string, number>) {
    assertUnique(Object.keys(percents));
    const total = Object.values(percents).reduce((s, p) => s + p, 0);
    if (Object.values(percents).some((p) => p < 0) || Math.abs(total - 100) > 1e-9) {
      throw new Error(`Percentages must be >= 0 and add up to 100, got ${total}`);
    }
  }

  // Largest remainder method: floor every share, then give the leftover paise
  // to the people with the biggest fractional part (ties: list order).
  shares(amount: number): Map<string, number> {
    const rows = Object.entries(this.percents).map(([id, p], index) => {
      const exact = (amount * p) / 100;
      return { id, index, share: Math.floor(exact), fraction: exact - Math.floor(exact) };
    });
    let left = amount - rows.reduce((s, r) => s + r.share, 0);
    const byFraction = [...rows].sort((a, b) => b.fraction - a.fraction || a.index - b.index);
    for (const r of byFraction) {
      if (left === 0) break;
      r.share++;
      left--;
    }
    return new Map(rows.map((r) => [r.id, r.share]));
  }
}

export class Splitwise {
  private readonly users = new Set<string>();
  private readonly expenses: Expense[] = [];
  // Net pairwise debt. Key "a|b" with a < b. Positive = a owes b, negative = b owes a.
  private readonly ledger = new Map<string, number>();
  private nextId = 1;

  addUser(id: string): void {
    if (this.users.has(id)) throw new Error(`User ${id} already exists`);
    this.users.add(id);
  }

  addExpense(input: ExpenseInput): Expense {
    const { paidBy, amount, split } = input;
    this.assertUser(paidBy);
    assertPaise('Amount', amount);

    const shares = split.shares(amount);
    let total = 0;
    for (const [id, share] of shares) {
      this.assertUser(id);
      assertPaise(`Share of ${id}`, share, true);
      total += share;
    }
    // Checked here too, so a buggy custom strategy cannot create or lose money.
    if (total !== amount) throw new Error(`Shares add up to ${total}, not ${amount}`);

    for (const [id, share] of shares) if (id !== paidBy && share > 0) this.addDebt(id, paidBy, share);

    const expense: Expense = {
      id: `E${this.nextId++}`,
      description: input.description ?? '',
      paidBy,
      amount,
      shares: Object.fromEntries(shares),
    };
    this.expenses.push(expense);
    return expense;
  }

  /** `from` pays `to` back. Cannot pay more than `from` owes `to`. */
  settle(from: string, to: string, amount: number): void {
    this.assertUser(from);
    this.assertUser(to);
    assertPaise('Amount', amount);
    const owed = this.owes(from, to);
    if (amount > owed) throw new Error(`${from} owes ${to} only ${owed}`);
    this.addDebt(to, from, amount); // the opposite direction cancels the debt
  }

  /** How much `from` owes `to` after netting. Never negative. */
  owes(from: string, to: string): number {
    if (from === to) return 0;
    const [a, b] = from < to ? [from, to] : [to, from];
    const net = this.ledger.get(`${a}|${b}`) ?? 0;
    const fromOwes = from === a ? net : -net;
    return Math.max(0, fromOwes);
  }

  /** Positive = the group owes this user. Negative = this user owes the group. */
  balance(userId: string): number {
    this.assertUser(userId);
    return this.balances()[userId];
  }

  balances(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const u of this.users) result[u] = 0;
    for (const [key, net] of this.ledger) {
      const [a, b] = key.split('|');
      result[a] -= net;
      result[b] += net;
    }
    return result;
  }

  /**
   * Fewer payments that settle everyone. Greedy: the biggest debtor pays the biggest creditor.
   * At most (people - 1) payments. Finding the true minimum is NP-hard, so greedy is the usual answer.
   */
  simplify(): Debt[] {
    const sortDesc = (xs: { id: string; amount: number }[]) =>
      xs.sort((x, y) => y.amount - x.amount || x.id.localeCompare(y.id));
    const entries = Object.entries(this.balances());
    const creditors = sortDesc(entries.filter(([, v]) => v > 0).map(([id, v]) => ({ id, amount: v })));
    const debtors = sortDesc(entries.filter(([, v]) => v < 0).map(([id, v]) => ({ id, amount: -v })));

    const debts: Debt[] = [];
    while (creditors.length > 0 && debtors.length > 0) {
      const c = creditors[0];
      const d = debtors[0];
      const pay = Math.min(c.amount, d.amount);
      debts.push({ from: d.id, to: c.id, amount: pay });
      c.amount -= pay;
      d.amount -= pay;
      if (c.amount === 0) creditors.shift();
      if (d.amount === 0) debtors.shift();
      sortDesc(creditors);
      sortDesc(debtors);
    }
    return debts;
  }

  history(): readonly Expense[] {
    return [...this.expenses];
  }

  private addDebt(from: string, to: string, amount: number): void {
    const [a, b, sign] = from < to ? [from, to, 1] : [to, from, -1];
    const key = `${a}|${b}`;
    const net = (this.ledger.get(key) ?? 0) + sign * amount;
    if (net === 0) this.ledger.delete(key);
    else this.ledger.set(key, net);
  }

  private assertUser(id: string): void {
    if (!this.users.has(id)) throw new Error(`Unknown user ${id}`);
  }
}
