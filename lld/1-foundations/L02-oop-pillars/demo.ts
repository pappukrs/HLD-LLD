// L02 demo: the four OOP pillars on a checkout flow.
// Run: npx tsx lld/1-foundations/L02-oop-pillars/demo.ts
export {};

// ---------- Encapsulation: the wallet guards its own rule ----------
class Wallet {
  #balance: number;
  constructor(opening: number) { this.#balance = opening; }
  get balance(): number { return this.#balance; }
  credit(amount: number): void {
    if (amount <= 0) throw new Error('Amount must be positive');
    this.#balance += amount;
  }
  debit(amount: number): void {
    if (amount > this.#balance) throw new Error(`Insufficient funds: have ${this.#balance}, need ${amount}`);
    this.#balance -= amount;
  }
}

// ---------- Abstraction: the contract checkout sees ----------
interface PaymentMethod {
  readonly name: string;
  pay(amount: number): Promise<string>;
}

// ---------- Inheritance: shared validation, one abstract step ----------
abstract class BasePaymentMethod implements PaymentMethod {
  abstract readonly name: string;
  protected abstract doPay(amount: number): Promise<string>;
  async pay(amount: number): Promise<string> {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error(`Invalid amount: ${amount}`);
    return this.doPay(amount);
  }
}

class UpiPayment extends BasePaymentMethod {
  readonly name = 'UPI';
  constructor(private readonly vpa: string) { super(); }
  protected async doPay(amount: number) { return `upi_${this.vpa}_${amount}`; }
}

class CardPayment extends BasePaymentMethod {
  readonly name = 'CARD';
  constructor(private readonly last4: string) { super(); }
  protected async doPay(amount: number) { return `card_${this.last4}_${amount}`; }
}

class WalletPayment extends BasePaymentMethod {
  readonly name = 'WALLET';
  constructor(private readonly wallet: Wallet) { super(); } // HAS-A wallet
  protected async doPay(amount: number) {
    this.wallet.debit(amount);
    return `wal_${amount}`;
  }
}

// ---------- Polymorphism: one call site, many behaviours ----------
class CheckoutService {
  async pay(method: PaymentMethod, amount: number): Promise<string> {
    try {
      const txn = await method.pay(amount);
      return `ok    ${method.name.padEnd(9)} ${String(amount).padStart(5)} -> ${txn}`;
    } catch (e) {
      return `fail  ${method.name.padEnd(9)} ${String(amount).padStart(5)} -> ${(e as Error).message}`;
    }
  }
}

async function main() {
  console.log('--- 1. Encapsulation ---');
  const wallet = new Wallet(500);
  console.log('wallet.balance =', wallet.balance, "(read-only getter; 'wallet.balance = -500' would not compile)");
  try { wallet.debit(700); } catch (e) { console.log('debit(700) blocked:', (e as Error).message); }
  wallet.debit(200);
  console.log('debit(200) ok, balance =', wallet.balance);

  console.log('\n--- 2 + 3 + 4. Abstraction, inheritance, polymorphism ---');
  const checkout = new CheckoutService();
  const methods: PaymentMethod[] = [new UpiPayment('pappu@okaxis'), new CardPayment('4242'), new WalletPayment(wallet)];
  for (const m of methods) console.log(' ', await checkout.pay(m, 250));
  console.log(' ', await checkout.pay(methods[2], 250), '(wallet has only', wallet.balance + ')');
  console.log(' ', await checkout.pay(methods[0], -1), '(shared rule in the base class)');

  console.log('\n--- 5. Add a new method: a new class, checkout unchanged ---');
  class PayLaterPayment extends BasePaymentMethod {
    readonly name = 'PAY_LATER';
    protected async doPay(amount: number) { return `bnpl_${amount}`; }
  }
  console.log(' ', await checkout.pay(new PayLaterPayment(), 999));

  console.log('\n--- 6. Dynamic dispatch: where JS finds the methods ---');
  const wp = methods[2];
  let proto = Object.getPrototypeOf(wp);
  while (proto && proto !== Object.prototype) {
    const own = Object.getOwnPropertyNames(proto).filter((k) => k !== 'constructor');
    console.log(`  ${proto.constructor.name}.prototype has: ${own.join(', ')}`);
    proto = Object.getPrototypeOf(proto);
  }
  console.log('  -> pay() is found on BasePaymentMethod, doPay() on WalletPayment');
}

main().catch((e) => { console.error(e); process.exit(1); });
