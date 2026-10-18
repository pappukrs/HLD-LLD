// 12 · Library Management: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/12-library-management

export interface BookInput {
  isbn: string;
  title: string;
  author: string;
}

export interface BookView {
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly totalCopies: number;
  readonly availableCopies: number;
}

export interface Loan {
  readonly id: string;
  readonly copyId: string;
  readonly isbn: string;
  readonly memberId: string;
  readonly borrowedAt: number;
  readonly dueAt: number;
}

export interface ReturnReceipt {
  readonly loanId: string;
  readonly lateDays: number;
  readonly fine: number;
}

export type LibraryEvent =
  | { type: 'HOLD_READY'; memberId: string; isbn: string; copyId: string }
  | { type: 'FINE_CHARGED'; memberId: string; amount: number };

export type LibraryListener = (event: LibraryEvent) => void;

export interface FinePolicy {
  fine(lateDays: number): number;
}

export interface LibraryConfig {
  clock?: () => number;
  loanDays?: number; // default 14
  maxLoans?: number; // default 3
  finePolicy?: FinePolicy; // default PerDayFine(10)
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export class PerDayFine implements FinePolicy {
  constructor(private readonly perDay: number) {}

  fine(lateDays: number): number {
    throw new Error('TODO');
  }
}

export class Library {
  constructor(config: LibraryConfig = {}) {
    // TODO: keep clock, loanDays, maxLoans, finePolicy; set up your repositories
  }

  /** Adding an ISBN that exists adds more copies. */
  addBook(input: BookInput, copies = 1): void {
    throw new Error('TODO');
  }

  addMember(id: string, name: string): void {
    throw new Error('TODO');
  }

  /** Case-insensitive substring match. All given fields must match. Sorted by title. */
  search(query: { title?: string; author?: string }): BookView[] {
    throw new Error('TODO');
  }

  checkout(memberId: string, isbn: string): Loan {
    throw new Error('TODO: fines, loan limit, one copy per title, held copies');
  }

  returnCopy(copyId: string): ReturnReceipt {
    throw new Error('TODO: fine for late days (rounded up), then give the copy to the next reserver');
  }

  /** Join the FIFO wait list. Only allowed when no copy is free. */
  reserve(memberId: string, isbn: string): void {
    throw new Error('TODO');
  }

  loansOf(memberId: string): Loan[] {
    throw new Error('TODO');
  }

  finesOf(memberId: string): number {
    throw new Error('TODO');
  }

  payFine(memberId: string, amount: number): void {
    throw new Error('TODO');
  }

  /** Observer. Returns an unsubscribe function. */
  subscribe(listener: LibraryListener): () => void {
    throw new Error('TODO');
  }
}
