// 19 · Payment Wallet: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

export type TransactionType = 'DEPOSIT' | 'TRANSFER' | 'REFUND';
export type Direction = 'DEBIT' | 'CREDIT';

/** Money is always an integer number of paise. ₹1 = 100 paise. */
export type Paise = number;

export interface LedgerEntry {
  readonly transactionId: string;
  readonly accountId: string;
  readonly direction: Direction;
  readonly amountPaise: Paise;
  readonly at: number;
}

export interface Transaction {
  readonly id: string;
  readonly type: TransactionType;
  readonly from: string;
  readonly to: string;
  readonly amountPaise: Paise;
  readonly feePaise: Paise;
  readonly at: number;
  readonly refundOf: string | null;
}

export interface TransferRequest {
  from: string;
  to: string;
  amountPaise: Paise;
  idempotencyKey: string;
}

export interface FeePolicy {
  feeFor(amountPaise: Paise): Paise;
}

export interface WalletConfig {
  feePolicy?: FeePolicy;
  clock?: () => number;
}

/** Money enters the system from here (bank, UPI). It may go negative. */
export const EXTERNAL_ACCOUNT = 'EXTERNAL';
/** Transfer fees are credited here. */
export const FEES_ACCOUNT = 'FEES';

const SYSTEM_ACCOUNTS = new Set([EXTERNAL_ACCOUNT, FEES_ACCOUNT]);

export class NoFee implements FeePolicy {
  feeFor(): Paise {
    return 0;
  }
}

interface Posting {
  accountId: string;
  direction: Direction;
  amountPaise: Paise;
}

interface IdempotencyRecord {
  fingerprint: string;
  transaction: Transaction;
}

function assertPaise(amount: number, label = 'Amount'): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error(`${label} must be a positive integer number of paise, got ${amount}`);
  }
}

export class Wallet {
  private readonly feePolicy: FeePolicy;
  private readonly clock: () => number;
  private readonly accounts = new Set<string>(SYSTEM_ACCOUNTS);
  private readonly ledger: LedgerEntry[] = []; // append-only; the only source of truth for balances
  private readonly transactions = new Map<string, Transaction>();
  private readonly refunded = new Map<string, Paise>(); // original txn id → total refunded
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private nextTxn = 1;

  constructor(config: WalletConfig = {}) {
    this.feePolicy = config.feePolicy ?? new NoFee();
    this.clock = config.clock ?? Date.now;
  }

  openAccount(accountId: string): void {
    if (this.accounts.has(accountId)) throw new Error(`Account ${accountId} already exists`);
    this.accounts.add(accountId);
  }

  deposit(accountId: string, amountPaise: Paise, idempotencyKey: string): Transaction {
    return this.once(idempotencyKey, ['DEPOSIT', accountId, amountPaise], () => {
      this.assertUserAccount(accountId);
      assertPaise(amountPaise);
      return this.post('DEPOSIT', EXTERNAL_ACCOUNT, accountId, amountPaise, 0, null, [
        { accountId: EXTERNAL_ACCOUNT, direction: 'DEBIT', amountPaise },
        { accountId, direction: 'CREDIT', amountPaise },
      ]);
    });
  }

  transfer(req: TransferRequest): Transaction {
    const { from, to, amountPaise, idempotencyKey } = req;
    return this.once(idempotencyKey, ['TRANSFER', from, to, amountPaise], () => {
      this.assertUserAccount(from);
      this.assertUserAccount(to);
      if (from === to) throw new Error('Cannot transfer to the same account');
      assertPaise(amountPaise);

      const fee = this.feePolicy.feeFor(amountPaise);
      if (!Number.isSafeInteger(fee) || fee < 0) throw new Error(`Bad fee ${fee}`);
      this.assertFunds(from, amountPaise + fee);

      const postings: Posting[] = [
        { accountId: from, direction: 'DEBIT', amountPaise: amountPaise + fee },
        { accountId: to, direction: 'CREDIT', amountPaise },
      ];
      if (fee > 0) postings.push({ accountId: FEES_ACCOUNT, direction: 'CREDIT', amountPaise: fee });
      return this.post('TRANSFER', from, to, amountPaise, fee, null, postings);
    });
  }

  /** Refunds a transfer, fully or in parts. The fee is not refunded. */
  refund(transactionId: string, idempotencyKey: string, amountPaise?: Paise): Transaction {
    return this.once(idempotencyKey, ['REFUND', transactionId, amountPaise ?? 'ALL'], () => {
      const original = this.getTransaction(transactionId);
      if (original.type !== 'TRANSFER') throw new Error(`Only transfers can be refunded, not ${original.type}`);

      const remaining = original.amountPaise - (this.refunded.get(original.id) ?? 0);
      const amount = amountPaise ?? remaining;
      assertPaise(amount);
      if (amount > remaining) throw new Error(`Refund ${amount} exceeds refundable ${remaining}`);
      this.assertFunds(original.to, amount);

      const txn = this.post('REFUND', original.to, original.from, amount, 0, original.id, [
        { accountId: original.to, direction: 'DEBIT', amountPaise: amount },
        { accountId: original.from, direction: 'CREDIT', amountPaise: amount },
      ]);
      this.refunded.set(original.id, (this.refunded.get(original.id) ?? 0) + amount);
      return txn;
    });
  }

  /** Derived from the ledger every time. There is no stored balance to drift. */
  balance(accountId: string): Paise {
    this.assertAccount(accountId);
    let total = 0;
    for (const e of this.ledger) {
      if (e.accountId === accountId) total += e.direction === 'CREDIT' ? e.amountPaise : -e.amountPaise;
    }
    return total;
  }

  entries(accountId: string): LedgerEntry[] {
    this.assertAccount(accountId);
    return this.ledger.filter((e) => e.accountId === accountId).map((e) => ({ ...e }));
  }

  getTransaction(id: string): Transaction {
    const t = this.transactions.get(id);
    if (!t) throw new Error(`Unknown transaction ${id}`);
    return t;
  }

  /** Sum of all debits and all credits. In a correct ledger they are always equal. */
  trialBalance(): { debits: Paise; credits: Paise } {
    let debits = 0;
    let credits = 0;
    for (const e of this.ledger) {
      if (e.direction === 'DEBIT') debits += e.amountPaise;
      else credits += e.amountPaise;
    }
    return { debits, credits };
  }

  // Same key + same request → the stored result. Same key + different request → error.
  // Failed attempts are not stored, so the client can retry with the same key after a top-up.
  private once(key: string, request: unknown[], run: () => Transaction): Transaction {
    if (!key) throw new Error('Idempotency key is required');
    const fingerprint = JSON.stringify(request);
    const seen = this.idempotency.get(key);
    if (seen) {
      if (seen.fingerprint !== fingerprint) throw new Error(`Idempotency key ${key} reused with a different request`);
      return seen.transaction;
    }
    const txn = run();
    this.idempotency.set(key, { fingerprint, transaction: txn });
    return txn;
  }

  // All checks happen before this call. Entries are appended together, so a transaction is all or nothing.
  private post(
    type: TransactionType,
    from: string,
    to: string,
    amountPaise: Paise,
    feePaise: Paise,
    refundOf: string | null,
    postings: Posting[],
  ): Transaction {
    const debits = postings.filter((p) => p.direction === 'DEBIT').reduce((s, p) => s + p.amountPaise, 0);
    const credits = postings.filter((p) => p.direction === 'CREDIT').reduce((s, p) => s + p.amountPaise, 0);
    if (debits !== credits) throw new Error('Unbalanced posting'); // a bug guard, never a user error

    const at = this.clock();
    const txn: Transaction = { id: `T${this.nextTxn++}`, type, from, to, amountPaise, feePaise, at, refundOf };
    this.ledger.push(...postings.map((p) => ({ transactionId: txn.id, at, ...p })));
    this.transactions.set(txn.id, txn);
    return txn;
  }

  private assertFunds(accountId: string, needed: Paise): void {
    const available = this.balance(accountId);
    if (available < needed) throw new Error(`Insufficient funds in ${accountId}: has ${available}, needs ${needed}`);
  }

  private assertAccount(accountId: string): void {
    if (!this.accounts.has(accountId)) throw new Error(`Unknown account ${accountId}`);
  }

  private assertUserAccount(accountId: string): void {
    this.assertAccount(accountId);
    if (SYSTEM_ACCOUNTS.has(accountId)) throw new Error(`${accountId} is a system account`);
  }
}
