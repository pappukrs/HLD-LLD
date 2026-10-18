// 11 · ATM: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/11-atm

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

export class InMemoryBank implements BankService {
  constructor(private readonly maxPinAttempts = 3) {}

  addAccount(seed: AccountSeed): void {
    throw new Error('TODO');
  }

  cardExists(cardNumber: string): boolean {
    throw new Error('TODO');
  }

  isBlocked(cardNumber: string): boolean {
    throw new Error('TODO');
  }

  verifyPin(cardNumber: string, pin: string): PinResult {
    throw new Error('TODO: count wrong attempts; block at maxPinAttempts; reset on success');
  }

  balance(cardNumber: string): number {
    throw new Error('TODO');
  }

  debit(cardNumber: string, amount: number): void {
    throw new Error('TODO');
  }

  credit(cardNumber: string, amount: number): void {
    throw new Error('TODO');
  }
}

export class ATM {
  constructor(config: AtmConfig) {
    // TODO: keep the bank, build the cash dispenser chain, start in IDLE
  }

  get state(): AtmStateName {
    throw new Error('TODO');
  }

  insertCard(cardNumber: string): void {
    throw new Error('TODO');
  }

  /** Returns false on a wrong PIN. After too many wrong PINs the card is blocked and ejected. */
  enterPin(pin: string): boolean {
    throw new Error('TODO');
  }

  balance(): number {
    throw new Error('TODO');
  }

  withdraw(amount: number): WithdrawResult {
    throw new Error('TODO: check the ATM can pay BEFORE you debit the account');
  }

  /** Returns the new balance. */
  deposit(amount: number): number {
    throw new Error('TODO');
  }

  ejectCard(): void {
    throw new Error('TODO');
  }

  cashAvailable(): number {
    throw new Error('TODO');
  }
}
