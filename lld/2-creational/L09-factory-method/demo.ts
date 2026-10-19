// L09 · Simple Factory and Factory Method: run with `npx tsx lld/2-creational/L09-factory-method/demo.ts`
// Domain: payment gateways (simple factory with a registry) and notification senders (GoF Factory Method).

export {};

const section = (t: string) => console.log(`\n=== ${t} ===`);

// ---------- products ----------
interface PaymentGateway {
  readonly name: string;
  charge(paise: number): Promise<string>;
}
class UpiGateway implements PaymentGateway {
  readonly name = 'UPI';
  constructor(private key: string) {}
  async charge(paise: number) { return `upi_txn_${paise}`; }
}
class CardGateway implements PaymentGateway {
  readonly name = 'CARD';
  constructor(private key: string, private opts: { retries: number }) {}
  async charge(paise: number) { return `card_txn_${paise}_r${this.opts.retries}`; }
}
class NetBankingGateway implements PaymentGateway {
  readonly name = 'NETBANKING';
  async charge(paise: number) { return `nb_txn_${paise}`; }
}

// ---------- before: the chain is copied into every caller ----------
function checkoutBefore(method: string, paise: number) {
  let gw: PaymentGateway;
  if (method === 'UPI') gw = new UpiGateway('upi_key');
  else if (method === 'CARD') gw = new CardGateway('card_key', { retries: 3 });
  else throw new Error(`Unknown method ${method}`);
  return gw.charge(paise);
}
// refundBefore(), reconcileBefore() would repeat the same if/else.

// ---------- after: one simple factory with a registry ----------
class UnsupportedMethodError extends Error {
  readonly status = 400;
  constructor(method: string) { super(`unsupported payment method: ${method}`); }
}
class GatewayFactory {
  private creators = new Map<string, () => PaymentGateway>();
  register(method: string, make: () => PaymentGateway): this {
    this.creators.set(method, make);
    return this;
  }
  create(method: string): PaymentGateway {
    const make = this.creators.get(method);
    if (!make) throw new UnsupportedMethodError(method);
    return make();
  }
}

class PaymentService {
  constructor(private factory: GatewayFactory) {}
  checkout(method: string, paise: number) { return this.factory.create(method).charge(paise); }
  refund(method: string, paise: number) { return `refund of ${paise} paise via ${this.factory.create(method).name}`; }
}

// ---------- GoF Factory Method: subclass decides the product ----------
interface Channel { deliver(to: string, msg: string): string }
class SmsChannel implements Channel { deliver(to: string, msg: string) { return `SMS -> ${to}: ${msg}`; } }
class EmailChannel implements Channel { deliver(to: string, msg: string) { return `EMAIL -> ${to}: ${msg}`; } }

abstract class NotificationSender {
  protected abstract createChannel(): Channel; // the factory method
  send(to: string, msg: string): string {
    const text = msg.trim();
    if (!text) throw new Error('empty message');
    return this.createChannel().deliver(to, text); // fixed algorithm, varying product
  }
}
class SmsSender extends NotificationSender { protected createChannel() { return new SmsChannel(); } }
class EmailSender extends NotificationSender { protected createChannel() { return new EmailChannel(); } }

async function main() {
  section('1. Before: if/else inside the caller');
  console.log(await checkoutBefore('UPI', 49900));
  try { await checkoutBefore('NETBANKING', 49900); } catch (e) { console.log('NETBANKING ->', (e as Error).message, '(edit every caller to add it)'); }

  section('2. After: one registry, callers only know the interface');
  const factory = new GatewayFactory()
    .register('UPI', () => new UpiGateway('upi_key'))
    .register('CARD', () => new CardGateway('card_key', { retries: 3 }));
  const payments = new PaymentService(factory);
  console.log('checkout UPI  ->', await payments.checkout('UPI', 49900));
  console.log('refund   CARD ->', payments.refund('CARD', 49900));

  section('3. Add NETBANKING: one class + one register() line');
  factory.register('NETBANKING', () => new NetBankingGateway());
  console.log('checkout NETBANKING ->', await payments.checkout('NETBANKING', 120000));
  console.log('PaymentService changed: 0 lines');

  section('4. Unknown method fails fast at the boundary');
  try {
    await payments.checkout('CRYPTO', 100);
  } catch (e) {
    if (e instanceof UnsupportedMethodError) console.log(`HTTP ${e.status}: ${e.message}`);
  }

  section('5. Factory Method: same send(), subclass picks the channel');
  const senders: NotificationSender[] = [new SmsSender(), new EmailSender()];
  for (const s of senders) console.log(s.constructor.name.padEnd(12), '->', s.send(s instanceof SmsSender ? '+919800000000' : 'pappu@example.in', '  OTP 4821  '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
