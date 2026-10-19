// L10 · Abstract Factory: run with `npx tsx lld/2-creational/L10-abstract-factory/demo.ts`
// Domain: payment providers. Each provider is a family: client + webhook verifier + refunder.

import { createHmac } from 'node:crypto';

const section = (t: string) => console.log(`\n=== ${t} ===`);

// ---------- product interfaces ----------
interface PaymentClient { charge(orderId: string, paise: number): string }
interface WebhookVerifier { verify(body: string, signature: string): boolean }
interface Refunder { refund(paymentId: string): string }

const hmac = (secret: string, body: string) => createHmac('sha256', secret).update(body).digest('hex');

// ---------- Razorpay family ----------
class RazorpayClient implements PaymentClient {
  charge(orderId: string, paise: number) { return `pay_rzp_${orderId}_${paise}`; }
}
class RazorpayVerifier implements WebhookVerifier {
  constructor(private secret: string) {}
  verify(body: string, sig: string) { return hmac(this.secret, body) === sig; }
}
class RazorpayRefunder implements Refunder { refund(id: string) { return `rfnd_rzp_${id}`; } }

// ---------- Stripe family (different secret and signature format) ----------
class StripeClient implements PaymentClient {
  charge(orderId: string, paise: number) { return `pi_stripe_${orderId}_${paise}`; }
}
class StripeVerifier implements WebhookVerifier {
  constructor(private secret: string) {}
  verify(body: string, sig: string) { return `v1=${hmac(this.secret, body)}` === sig; }
}
class StripeRefunder implements Refunder { refund(id: string) { return `re_stripe_${id}`; } }

// ---------- Fake family for tests ----------
class FakeClient implements PaymentClient {
  calls: string[] = [];
  charge(orderId: string, paise: number) { this.calls.push(orderId); return `fake_${orderId}`; }
}
class FakeVerifier implements WebhookVerifier { verify(_b: string, sig: string) { return sig === 'valid'; } }
class FakeRefunder implements Refunder { refund(id: string) { return `fake_refund_${id}`; } }

// ---------- the abstract factory ----------
interface ProviderKit {
  readonly name: string;
  createClient(): PaymentClient;
  createWebhookVerifier(): WebhookVerifier;
  createRefunder(): Refunder;
}
const SECRETS = { razorpay: 'rzp_whsec_123', stripe: 'whsec_stripe_456' };

class RazorpayKit implements ProviderKit {
  readonly name = 'RazorpayKit';
  createClient() { return new RazorpayClient(); }
  createWebhookVerifier() { return new RazorpayVerifier(SECRETS.razorpay); }
  createRefunder() { return new RazorpayRefunder(); }
}
class StripeKit implements ProviderKit {
  readonly name = 'StripeKit';
  createClient() { return new StripeClient(); }
  createWebhookVerifier() { return new StripeVerifier(SECRETS.stripe); }
  createRefunder() { return new StripeRefunder(); }
}
class FakeKit implements ProviderKit {
  readonly name = 'FakeKit';
  readonly client = new FakeClient();
  createClient() { return this.client; }
  createWebhookVerifier() { return new FakeVerifier(); }
  createRefunder() { return new FakeRefunder(); }
}

type Provider = 'razorpay' | 'stripe' | 'fake';
const kits: Record<Provider, () => ProviderKit> = {
  razorpay: () => new RazorpayKit(),
  stripe: () => new StripeKit(),
  fake: () => new FakeKit(),
};

// ---------- the client code: knows only interfaces ----------
class PaymentService {
  constructor(private kit: ProviderKit) {}
  charge(orderId: string, paise: number) { return this.kit.createClient().charge(orderId, paise); }
  onWebhook(body: string, sig: string) { return this.kit.createWebhookVerifier().verify(body, sig) ? 'PAID' : 'REJECTED (bad signature)'; }
  refund(paymentId: string) { return this.kit.createRefunder().refund(paymentId); }
}

// What each provider would actually send us
const webhookFrom = {
  razorpay: (body: string) => hmac(SECRETS.razorpay, body),
  stripe: (body: string) => `v1=${hmac(SECRETS.stripe, body)}`,
};

function main() {
  const body = JSON.stringify({ event: 'payment.captured', orderId: 'ord_81' });

  section('1. Before: two independent factories, two config values');
  const client: PaymentClient = new StripeClient(); // from PAYMENT_PROVIDER=stripe
  const verifier: WebhookVerifier = new RazorpayVerifier(SECRETS.razorpay); // from an old WEBHOOK_PROVIDER=razorpay
  console.log('charge  :', client.charge('ord_81', 49900));
  console.log('webhook :', verifier.verify(body, webhookFrom.stripe(body)) ? 'PAID' : 'REJECTED (mixed families!)');

  section('2. After: one kit chosen once in main()');
  for (const p of ['razorpay', 'stripe'] as const) {
    const svc = new PaymentService(kits[p]());
    const payId = svc.charge('ord_81', 49900);
    console.log(`${p.padEnd(8)} charge=${payId}  webhook=${svc.onWebhook(body, webhookFrom[p](body))}  refund=${svc.refund(payId)}`);
  }

  section('3. Tests: inject FakeKit, no network, no keys');
  const fake = kits.fake() as FakeKit;
  const svc = new PaymentService(fake);
  svc.charge('ord_t1', 100);
  console.log('fake client calls:', fake.client.calls, ' webhook:', svc.onWebhook('{}', 'valid'));

  section('4. The cost');
  console.log('New family (PayU)       -> add PayUKit + 3 product classes. Nothing else changes.');
  console.log('New product (payouts)   -> add createPayoutApi() to ProviderKit AND to every kit (3 edits).');
}

main();
