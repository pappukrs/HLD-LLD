// 12 · Library Management: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

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
    return lateDays * this.perDay;
  }
}

// ---------- Storage: one small generic repository ----------
// The Library talks to repositories, so swapping Maps for a DB touches one class.

class InMemoryRepository<T extends { id: string }> {
  private readonly items = new Map<string, T>();

  constructor(private readonly kind: string) {}

  find(id: string): T | undefined {
    return this.items.get(id);
  }

  get(id: string): T {
    const item = this.items.get(id);
    if (!item) throw new Error(`Unknown ${this.kind} ${id}`);
    return item;
  }

  save(item: T): void {
    this.items.set(item.id, item);
  }

  delete(id: string): void {
    this.items.delete(id);
  }

  all(): T[] {
    return [...this.items.values()];
  }
}

interface Book extends BookInput {
  id: string; // = isbn
  copyIds: string[];
  holdQueue: string[]; // member ids, FIFO
}

type CopyStatus = { kind: 'AVAILABLE' } | { kind: 'ON_LOAN'; loanId: string } | { kind: 'ON_HOLD'; memberId: string };

interface Copy {
  id: string;
  isbn: string;
  status: CopyStatus;
}

interface Member {
  id: string;
  name: string;
  fines: number;
  loanIds: Set<string>;
}

export class Library {
  private readonly books = new InMemoryRepository<Book>('book');
  private readonly copies = new InMemoryRepository<Copy>('copy');
  private readonly members = new InMemoryRepository<Member>('member');
  private readonly loans = new InMemoryRepository<Loan>('loan');
  private readonly listeners = new Set<LibraryListener>();

  private readonly clock: () => number;
  private readonly loanDays: number;
  private readonly maxLoans: number;
  private readonly finePolicy: FinePolicy;
  private nextLoan = 1;

  constructor(config: LibraryConfig = {}) {
    this.clock = config.clock ?? Date.now;
    this.loanDays = config.loanDays ?? 14;
    this.maxLoans = config.maxLoans ?? 3;
    this.finePolicy = config.finePolicy ?? new PerDayFine(10);
  }

  /** Adding an ISBN that exists adds more copies. */
  addBook(input: BookInput, copies = 1): void {
    if (copies < 1) throw new Error('Need at least one copy');
    const book = this.books.find(input.isbn) ?? { ...input, id: input.isbn, copyIds: [], holdQueue: [] };
    for (let i = 0; i < copies; i++) {
      const copy: Copy = { id: `${book.isbn}-${book.copyIds.length + 1}`, isbn: book.isbn, status: { kind: 'AVAILABLE' } };
      this.copies.save(copy);
      book.copyIds.push(copy.id);
    }
    this.books.save(book);
  }

  addMember(id: string, name: string): void {
    if (this.members.find(id)) throw new Error(`Member ${id} already exists`);
    this.members.save({ id, name, fines: 0, loanIds: new Set() });
  }

  /** Case-insensitive substring match. All given fields must match. Sorted by title. */
  search(query: { title?: string; author?: string }): BookView[] {
    const has = (field: string, q?: string) => !q || field.toLowerCase().includes(q.toLowerCase());
    return this.books
      .all()
      .filter((b) => has(b.title, query.title) && has(b.author, query.author))
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((b) => this.view(b));
  }

  checkout(memberId: string, isbn: string): Loan {
    const member = this.members.get(memberId);
    const book = this.books.get(isbn);

    if (member.fines > 0) throw new Error(`Member ${memberId} has unpaid fines`);
    if (member.loanIds.size >= this.maxLoans) throw new Error(`Member ${memberId} reached the loan limit`);
    if (this.activeLoans(member).some((l) => l.isbn === isbn)) throw new Error(`Member ${memberId} already has ${isbn}`);

    // A copy held for this member wins. Otherwise any free copy. Held copies are never given to others.
    const copy =
      this.copiesOf(book).find((c) => c.status.kind === 'ON_HOLD' && c.status.memberId === memberId) ??
      this.copiesOf(book).find((c) => c.status.kind === 'AVAILABLE');
    if (!copy) throw new Error(`No copy of ${isbn} available. Reserve it instead`);

    const now = this.clock();
    const loan: Loan = {
      id: `L${this.nextLoan++}`,
      copyId: copy.id,
      isbn,
      memberId,
      borrowedAt: now,
      dueAt: now + this.loanDays * DAY_MS,
    };
    copy.status = { kind: 'ON_LOAN', loanId: loan.id };
    this.loans.save(loan);
    member.loanIds.add(loan.id);
    return loan;
  }

  returnCopy(copyId: string): ReturnReceipt {
    const copy = this.copies.get(copyId);
    if (copy.status.kind !== 'ON_LOAN') throw new Error(`Copy ${copyId} is not on loan`);

    const loan = this.loans.get(copy.status.loanId);
    const member = this.members.get(loan.memberId);
    const late = this.clock() - loan.dueAt;
    const lateDays = late > 0 ? Math.ceil(late / DAY_MS) : 0;
    const fine = lateDays > 0 ? this.finePolicy.fine(lateDays) : 0;

    member.loanIds.delete(loan.id);
    this.loans.delete(loan.id);
    if (fine > 0) {
      member.fines += fine;
      this.emit({ type: 'FINE_CHARGED', memberId: member.id, amount: fine });
    }

    const book = this.books.get(copy.isbn);
    const next = book.holdQueue.shift();
    if (next) {
      copy.status = { kind: 'ON_HOLD', memberId: next };
      this.emit({ type: 'HOLD_READY', memberId: next, isbn: book.isbn, copyId: copy.id });
    } else {
      copy.status = { kind: 'AVAILABLE' };
    }
    return { loanId: loan.id, lateDays, fine };
  }

  /** Join the FIFO wait list. Only allowed when no copy is free. */
  reserve(memberId: string, isbn: string): void {
    const member = this.members.get(memberId);
    const book = this.books.get(isbn);
    if (this.copiesOf(book).some((c) => c.status.kind === 'AVAILABLE')) {
      throw new Error(`A copy of ${isbn} is available. Borrow it instead`);
    }
    const alreadyWaiting =
      book.holdQueue.includes(memberId) ||
      this.copiesOf(book).some((c) => c.status.kind === 'ON_HOLD' && c.status.memberId === memberId);
    if (alreadyWaiting) throw new Error(`Member ${memberId} already reserved ${isbn}`);
    if (this.activeLoans(member).some((l) => l.isbn === isbn)) throw new Error(`Member ${memberId} already has ${isbn}`);
    book.holdQueue.push(memberId);
  }

  loansOf(memberId: string): Loan[] {
    return this.activeLoans(this.members.get(memberId));
  }

  finesOf(memberId: string): number {
    return this.members.get(memberId).fines;
  }

  payFine(memberId: string, amount: number): void {
    const member = this.members.get(memberId);
    if (amount <= 0 || amount > member.fines) throw new Error(`Invalid payment ${amount}`);
    member.fines -= amount;
  }

  /** Observer. Returns an unsubscribe function. */
  subscribe(listener: LibraryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: LibraryEvent): void {
    for (const l of this.listeners) l(event);
  }

  private copiesOf(book: Book): Copy[] {
    return book.copyIds.map((id) => this.copies.get(id));
  }

  private activeLoans(member: Member): Loan[] {
    return [...member.loanIds].map((id) => this.loans.get(id));
  }

  private view(book: Book): BookView {
    const copies = this.copiesOf(book);
    return {
      isbn: book.isbn,
      title: book.title,
      author: book.author,
      totalCopies: copies.length,
      availableCopies: copies.filter((c) => c.status.kind === 'AVAILABLE').length,
    };
  }
}
