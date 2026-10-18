// P02 · Factory Method and Abstract Factory
// Run: npx tsx lld/concepts/patterns/p02-factory.ts

interface PaymentGateway {
  readonly name: string;
  charge(amount: number): Promise<string>;
}
class UpiGateway implements PaymentGateway {
  readonly name = 'UPI';
  async charge(amount: number) { return `upi_txn_${amount}`; }
}
class CardGateway implements PaymentGateway {
  readonly name = 'CARD';
  constructor(private readonly retries: number) {}
  async charge(amount: number) { return `card_txn_${amount}_r${this.retries}`; }
}
class NetBankingGateway implements PaymentGateway {
  readonly name = 'NETBANKING';
  async charge(amount: number) { return `nb_txn_${amount}`; }
}

// ---------- before: the if/else chain lives in every caller ----------
function createGatewayInline(method: string): PaymentGateway {
  if (method === 'UPI') return new UpiGateway();
  else if (method === 'CARD') return new CardGateway(3);
  else if (method === 'NETBANKING') return new NetBankingGateway();
  throw new Error(`Unknown method ${method}`);
}

// ---------- after (1): simple factory with a registry ----------
type Method = 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET';
class GatewayFactory {
  private creators = new Map<Method, () => PaymentGateway>();
  register(method: Method, creator: () => PaymentGateway): this {
    this.creators.set(method, creator);
    return this;
  }
  create(method: Method): PaymentGateway {
    const creator = this.creators.get(method);
    if (!creator) throw new Error(`No gateway registered for ${method}`);
    return creator();
  }
}

// ---------- after (2): Factory Method (subclass picks the product) ----------
interface Channel { deliver(to: string, msg: string): string }
class SmsChannel implements Channel {
  deliver(to: string, msg: string) { return `SMS to ${to}: ${msg}`; }
}
class EmailChannel implements Channel {
  deliver(to: string, msg: string) { return `EMAIL to ${to}: ${msg}`; }
}
abstract class NotificationSender {
  protected abstract createChannel(): Channel; // the factory method
  send(to: string, msg: string): string {
    const channel = this.createChannel();
    return channel.deliver(to, msg.trim().slice(0, 160));
  }
}
class SmsSender extends NotificationSender {
  protected createChannel() { return new SmsChannel(); }
}
class EmailSender extends NotificationSender {
  protected createChannel() { return new EmailChannel(); }
}

// ---------- after (3): Abstract Factory (a family that must match) ----------
interface PaymentClient { charge(amount: number): string }
interface WebhookVerifier { verify(body: string, signature: string): boolean }
interface ProviderKit {
  readonly provider: string;
  createClient(): PaymentClient;
  createWebhookVerifier(): WebhookVerifier;
}
class ProviderAKit implements ProviderKit {
  readonly provider = 'ProviderA';
  createClient() { return { charge: (a: number) => `A-order-${a}` }; }
  createWebhookVerifier() { return { verify: (b: string, s: string) => s === `A:${b.length}` }; }
}
class ProviderBKit implements ProviderKit {
  readonly provider = 'ProviderB';
  createClient() { return { charge: (a: number) => `B-intent-${a}` }; }
  createWebhookVerifier() { return { verify: (b: string, s: string) => s === `B:${b.length}` }; }
}
class PaymentService {
  private client: PaymentClient;
  private verifier: WebhookVerifier;
  constructor(private readonly kit: ProviderKit) {
    this.client = kit.createClient();
    this.verifier = kit.createWebhookVerifier();
  }
  pay(amount: number) { return `${this.kit.provider}: ${this.client.charge(amount)}`; }
  onWebhook(body: string, sig: string) { return this.verifier.verify(body, sig); }
}

async function main() {
  console.log('--- before: inline creation ---');
  console.log(await createGatewayInline('UPI').charge(500));

  console.log('\n--- after: registry factory ---');
  const factory = new GatewayFactory()
    .register('UPI', () => new UpiGateway())
    .register('CARD', () => new CardGateway(3))
    .register('NETBANKING', () => new NetBankingGateway());
  for (const m of ['UPI', 'CARD', 'NETBANKING'] as const) {
    const g = factory.create(m);
    console.log(`${g.name.padEnd(10)} -> ${await g.charge(1200)}`);
  }
  try {
    factory.create('WALLET');
  } catch (e) {
    console.log(`expected error: ${(e as Error).message}`);
  }

  console.log('\n--- Factory Method ---');
  const senders: NotificationSender[] = [new SmsSender(), new EmailSender()];
  for (const s of senders) console.log(s.send('user-42', '  Your order #981 is shipped  '));

  console.log('\n--- Abstract Factory ---');
  for (const kit of [new ProviderAKit(), new ProviderBKit()]) {
    const svc = new PaymentService(kit);
    const body = '{"event":"paid"}';
    const sig = `${kit.provider[8]}:${body.length}`;
    console.log(`${svc.pay(999)} | webhook valid: ${svc.onWebhook(body, sig)}`);
  }
}

await main();

export {};
