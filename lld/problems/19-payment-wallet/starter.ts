// 19 · Payment Wallet: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/19-payment-wallet

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

export class Wallet {
  constructor(config: WalletConfig = {}) {
    // TODO: keep fee policy and clock; create the ledger, transactions and idempotency store.
    // EXTERNAL_ACCOUNT and FEES_ACCOUNT exist from the start.
  }

  openAccount(accountId: string): void {
    throw new Error('TODO');
  }

  /** EXTERNAL → accountId. */
  deposit(accountId: string, amountPaise: Paise, idempotencyKey: string): Transaction {
    throw new Error('TODO');
  }

  transfer(req: TransferRequest): Transaction {
    throw new Error('TODO: validate, check funds (amount + fee), then post balanced entries');
  }

  /** Refunds a transfer, fully (amount omitted) or in parts. The fee is not refunded. */
  refund(transactionId: string, idempotencyKey: string, amountPaise?: Paise): Transaction {
    throw new Error('TODO');
  }

  /** Derive it from the ledger entries. Credits add, debits subtract. */
  balance(accountId: string): Paise {
    throw new Error('TODO');
  }

  entries(accountId: string): LedgerEntry[] {
    throw new Error('TODO');
  }

  getTransaction(id: string): Transaction {
    throw new Error('TODO');
  }

  /** Sum of all debits and all credits across the whole ledger. */
  trialBalance(): { debits: Paise; credits: Paise } {
    throw new Error('TODO');
  }
}
