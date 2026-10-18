// 11 · ATM: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

export type AtmStateName = 'IDLE' | 'CARD_INSERTED' | 'AUTHENTICATED';
export type PinResult = 'OK' | 'WRONG' | 'BLOCKED';

/** Denomination → number of notes, e.g. { 2000: 1, 500: 2 }. */
export type NoteCounts = Record<number, number>;

/** What the ATM needs from the bank. The ATM never sees balances or PINs directly. */
export interface BankService {
  cardExists(cardNumber: string): boolean;
  isBlocked(cardNumber: string): boolean;
  verifyPin(cardNumber: string, pin: string): PinResult;
  balance(cardNumber: string): number;
  /** Throws if the balance is too low. */
  debit(cardNumber: string, amount: number): void;
  credit(cardNumber: string, amount: number): void;
}

export interface AccountSeed {
  cardNumber: string;
  pin: string;
  balance: number;
}

export interface WithdrawResult {
  readonly amount: number;
  readonly notes: NoteCounts;
  readonly balance: number;
}

export interface AtmConfig {
  bank: BankService;
  /** Notes loaded in the machine. */
  cash: NoteCounts;
}

// ---------- Bank ----------

interface Account {
  pin: string;
  balance: number;
  failedPins: number;
  blocked: boolean;
}

export class InMemoryBank implements BankService {
  private readonly accounts = new Map<string, Account>();

  constructor(private readonly maxPinAttempts = 3) {}

  addAccount(seed: AccountSeed): void {
    if (this.accounts.has(seed.cardNumber)) throw new Error(`Card ${seed.cardNumber} already exists`);
    this.accounts.set(seed.cardNumber, { pin: seed.pin, balance: seed.balance, failedPins: 0, blocked: false });
  }

  cardExists(cardNumber: string): boolean {
    return this.accounts.has(cardNumber);
  }

  isBlocked(cardNumber: string): boolean {
    return this.account(cardNumber).blocked;
  }

  // Attempts are counted by the bank, not the ATM, so moving to another ATM doesn't reset them.
  verifyPin(cardNumber: string, pin: string): PinResult {
    const acc = this.account(cardNumber);
    if (acc.blocked) return 'BLOCKED';
    if (acc.pin === pin) {
      acc.failedPins = 0;
      return 'OK';
    }
    acc.failedPins++;
    if (acc.failedPins >= this.maxPinAttempts) {
      acc.blocked = true;
      return 'BLOCKED';
    }
    return 'WRONG';
  }

  balance(cardNumber: string): number {
    return this.account(cardNumber).balance;
  }

  debit(cardNumber: string, amount: number): void {
    const acc = this.account(cardNumber);
    if (amount > acc.balance) throw new Error('Insufficient balance');
    acc.balance -= amount;
  }

  credit(cardNumber: string, amount: number): void {
    this.account(cardNumber).balance += amount;
  }

  private account(cardNumber: string): Account {
    const acc = this.accounts.get(cardNumber);
    if (!acc) throw new Error(`Unknown card ${cardNumber}`);
    return acc;
  }
}

// ---------- Cash dispenser: Chain of Responsibility ----------

// Each handler pays what it can with its own note and passes the rest down the chain.
class NoteHandler {
  constructor(
    readonly denomination: number,
    public count: number,
    readonly next: NoteHandler | null,
  ) {}

  /** Fills `out` and returns the amount nobody could pay. Doesn't change any counts. */
  plan(amount: number, out: NoteCounts): number {
    const use = Math.min(Math.floor(amount / this.denomination), this.count);
    if (use > 0) out[this.denomination] = use;
    const rest = amount - use * this.denomination;
    return rest > 0 && this.next ? this.next.plan(rest, out) : rest;
  }
}

class CashDispenser {
  private readonly head: NoteHandler | null;

  constructor(cash: NoteCounts) {
    const denominations = Object.keys(cash)
      .map(Number)
      .sort((a, b) => a - b); // build from the smallest so the head is the largest
    this.head = denominations.reduce<NoteHandler | null>((next, d) => new NoteHandler(d, cash[d], next), null);
  }

  /** Throws if the loaded notes can't make the amount exactly. */
  plan(amount: number): NoteCounts {
    const notes: NoteCounts = {};
    const rest = this.head ? this.head.plan(amount, notes) : amount;
    if (rest !== 0) throw new Error(`ATM cannot dispense ${amount} with the notes it has`);
    return notes;
  }

  dispense(notes: NoteCounts): void {
    for (let h = this.head; h; h = h.next) {
      const n = notes[h.denomination] ?? 0;
      if (n > h.count) throw new Error('Dispenser out of notes');
      h.count -= n;
    }
  }

  total(): number {
    let sum = 0;
    for (let h = this.head; h; h = h.next) sum += h.denomination * h.count;
    return sum;
  }
}

// ---------- ATM: State pattern ----------

interface AtmContext {
  readonly bank: BankService;
  readonly dispenser: CashDispenser;
  card: string | null;
  state: AtmState;
}

// Default behaviour: every action is invalid. Each state overrides only what it allows.
abstract class AtmState {
  abstract readonly name: AtmStateName;

  insertCard(ctx: AtmContext, cardNumber: string): void {
    this.reject('insert a card');
  }
  enterPin(ctx: AtmContext, pin: string): boolean {
    return this.reject('enter a PIN');
  }
  balance(ctx: AtmContext): number {
    return this.reject('check balance');
  }
  withdraw(ctx: AtmContext, amount: number): WithdrawResult {
    return this.reject('withdraw');
  }
  deposit(ctx: AtmContext, amount: number): number {
    return this.reject('deposit');
  }
  ejectCard(ctx: AtmContext): void {
    this.reject('eject a card');
  }

  protected reject(action: string): never {
    throw new Error(`Cannot ${action} in state ${this.name}`);
  }

  protected eject(ctx: AtmContext): void {
    ctx.card = null;
    ctx.state = IDLE;
  }
}

class IdleState extends AtmState {
  readonly name = 'IDLE';

  insertCard(ctx: AtmContext, cardNumber: string): void {
    if (!ctx.bank.cardExists(cardNumber)) throw new Error('Unknown card');
    if (ctx.bank.isBlocked(cardNumber)) throw new Error('Card is blocked');
    ctx.card = cardNumber;
    ctx.state = CARD_INSERTED;
  }
}

class CardInsertedState extends AtmState {
  readonly name = 'CARD_INSERTED';

  enterPin(ctx: AtmContext, pin: string): boolean {
    const result = ctx.bank.verifyPin(ctx.card!, pin);
    if (result === 'OK') {
      ctx.state = AUTHENTICATED;
      return true;
    }
    if (result === 'BLOCKED') this.eject(ctx); // real ATMs keep the card
    return false;
  }

  ejectCard(ctx: AtmContext): void {
    this.eject(ctx);
  }
}

class AuthenticatedState extends AtmState {
  readonly name = 'AUTHENTICATED';

  balance(ctx: AtmContext): number {
    return ctx.bank.balance(ctx.card!);
  }

  withdraw(ctx: AtmContext, amount: number): WithdrawResult {
    assertPositiveInteger(amount);
    const card = ctx.card!;

    // Check the machine can pay BEFORE moving money. Plan doesn't change note counts.
    const notes = ctx.dispenser.plan(amount);
    ctx.bank.debit(card, amount);
    try {
      ctx.dispenser.dispense(notes);
    } catch (err) {
      ctx.bank.credit(card, amount); // compensate: the customer never got the cash
      throw err;
    }
    return { amount, notes, balance: ctx.bank.balance(card) };
  }

  deposit(ctx: AtmContext, amount: number): number {
    assertPositiveInteger(amount);
    ctx.bank.credit(ctx.card!, amount);
    return ctx.bank.balance(ctx.card!);
  }

  ejectCard(ctx: AtmContext): void {
    this.eject(ctx);
  }
}

const IDLE = new IdleState();
const CARD_INSERTED = new CardInsertedState();
const AUTHENTICATED = new AuthenticatedState();

function assertPositiveInteger(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error(`Invalid amount ${amount}`);
}

export class ATM {
  private readonly ctx: AtmContext;

  constructor(config: AtmConfig) {
    this.ctx = { bank: config.bank, dispenser: new CashDispenser(config.cash), card: null, state: IDLE };
  }

  get state(): AtmStateName {
    return this.ctx.state.name;
  }

  insertCard(cardNumber: string): void {
    this.ctx.state.insertCard(this.ctx, cardNumber);
  }

  /** Returns false on a wrong PIN. After too many wrong PINs the card is blocked and ejected. */
  enterPin(pin: string): boolean {
    return this.ctx.state.enterPin(this.ctx, pin);
  }

  balance(): number {
    return this.ctx.state.balance(this.ctx);
  }

  withdraw(amount: number): WithdrawResult {
    return this.ctx.state.withdraw(this.ctx, amount);
  }

  /** Returns the new balance. */
  deposit(amount: number): number {
    return this.ctx.state.deposit(this.ctx, amount);
  }

  ejectCard(): void {
    this.ctx.state.ejectCard(this.ctx);
  }

  cashAvailable(): number {
    return this.ctx.dispenser.total();
  }
}
