// 09 · Splitwise: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/09-splitwise
// All money is an integer number of paise. Never use floats for money.

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

export class EqualSplit implements SplitStrategy {
  constructor(participants: string[]) {
    // TODO: reject an empty list or duplicates
  }

  shares(amount: number): Map<string, number> {
    throw new Error('TODO: leftover paise go to the first people in the list');
  }
}

export class ExactSplit implements SplitStrategy {
  constructor(amounts: Record<string, number>) {
    // TODO
  }

  shares(amount: number): Map<string, number> {
    throw new Error('TODO: throw if the shares do not add up to amount');
  }
}

export class PercentSplit implements SplitStrategy {
  constructor(percents: Record<string, number>) {
    // TODO: percentages must add up to 100
  }

  shares(amount: number): Map<string, number> {
    throw new Error('TODO: floor each share, give leftover paise to the largest fractions');
  }
}

export class Splitwise {
  addUser(id: string): void {
    throw new Error('TODO');
  }

  addExpense(input: ExpenseInput): Expense {
    throw new Error('TODO');
  }

  /** `from` pays `to` back. Cannot pay more than `from` owes `to`. */
  settle(from: string, to: string, amount: number): void {
    throw new Error('TODO');
  }

  /** How much `from` owes `to` after netting. Never negative. */
  owes(from: string, to: string): number {
    throw new Error('TODO');
  }

  /** Positive = the group owes this user. Negative = this user owes the group. */
  balance(userId: string): number {
    throw new Error('TODO');
  }

  balances(): Record<string, number> {
    throw new Error('TODO');
  }

  /** Fewer payments that settle everyone. At most (people - 1) payments. */
  simplify(): Debt[] {
    throw new Error('TODO');
  }

  history(): readonly Expense[] {
    throw new Error('TODO');
  }
}
