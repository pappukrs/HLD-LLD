// L26 Template Method: one fixed webhook flow, provider-specific steps.
// Run: npx tsx lld/4-behavioral/L26-template-method/demo.ts

export {}; // module scope: keeps names local to this file

type Status = 'PENDING' | 'SUCCESS' | 'FAILED';
interface RawWebhook { headers: Record<string, string>; body: string }
interface PaymentEvent { eventId: string; paymentId: string; status: Status }

const db = new Map<string, Status>([['pay_1', 'PENDING'], ['pay_2', 'PENDING']]);
const seenEvents = new Set<string>();

abstract class WebhookHandler {
  // The template method. Fixed order. Subclasses must not override it.
  handle(raw: RawWebhook): string {
    if (!this.verifySignature(raw)) return this.reply(401, 'bad signature');
    const event = this.parse(raw.body);
    if (seenEvents.has(event.eventId)) return this.reply(200, `duplicate ${event.eventId}, ignored`);
    seenEvents.add(event.eventId);
    db.set(event.paymentId, event.status);
    this.afterApply(event); // hook
    return this.reply(200, `${event.paymentId} -> ${event.status}`);
  }

  protected abstract readonly name: string;
  protected abstract verifySignature(raw: RawWebhook): boolean; // required step
  protected abstract parse(body: string): PaymentEvent;          // required step
  protected afterApply(_e: PaymentEvent): void {}                // hook: empty by default
  protected reply(code: number, msg: string): string {           // default step
    return `[${this.name}] ${code} ${msg}`;
  }
}

class RazorpayHandler extends WebhookHandler {
  protected readonly name = 'razorpay';
  protected verifySignature(raw: RawWebhook) { return raw.headers['x-razorpay-signature'] === 'ok'; }
  protected parse(body: string): PaymentEvent {
    const j = JSON.parse(body) as { id: string; payload: { payment: { id: string; status: string } } };
    const s = j.payload.payment.status;
    return { eventId: j.id, paymentId: j.payload.payment.id, status: s === 'captured' ? 'SUCCESS' : 'FAILED' };
  }
}

class StripeHandler extends WebhookHandler {
  protected readonly name = 'stripe';
  protected verifySignature(raw: RawWebhook) { return raw.headers['stripe-signature']?.startsWith('t=') ?? false; }
  protected parse(body: string): PaymentEvent {
    const j = JSON.parse(body) as { id: string; type: string; data: { object: { metadata: { paymentId: string } } } };
    const status: Status = j.type === 'payment_intent.succeeded' ? 'SUCCESS' : 'FAILED';
    return { eventId: j.id, paymentId: j.data.object.metadata.paymentId, status };
  }
  // Uses the hook: Stripe failures also raise an alert.
  protected afterApply(e: PaymentEvent) {
    if (e.status === 'FAILED') console.log(`   hook: alert on-call, ${e.paymentId} failed`);
  }
}

// The same idea with composition: the skeleton is a function, the steps are passed in.
interface Steps { verify(raw: RawWebhook): boolean; parse(body: string): PaymentEvent }
function handleWith(steps: Steps, raw: RawWebhook): string {
  if (!steps.verify(raw)) return '401';
  const e = steps.parse(raw.body);
  return `200 ${e.paymentId} -> ${e.status} (not applied, demo only)`;
}

function main(): void {
  const rzp = new RazorpayHandler();
  const stripe = new StripeHandler();

  console.log('== 1. Razorpay webhook: same flow, Razorpay steps ==');
  const rzpBody = JSON.stringify({ id: 'evt_r1', payload: { payment: { id: 'pay_1', status: 'captured' } } });
  console.log(rzp.handle({ headers: { 'x-razorpay-signature': 'ok' }, body: rzpBody }));

  console.log('\n== 2. Same event retried by the provider: dedupe runs for free ==');
  console.log(rzp.handle({ headers: { 'x-razorpay-signature': 'ok' }, body: rzpBody }));

  console.log('\n== 3. Stripe webhook with a failure: the hook fires ==');
  const stBody = JSON.stringify({ id: 'evt_s1', type: 'payment_intent.payment_failed', data: { object: { metadata: { paymentId: 'pay_2' } } } });
  console.log(stripe.handle({ headers: { 'stripe-signature': 't=1,v1=abc' }, body: stBody }));

  console.log('\n== 4. Bad signature: rejected before parse ==');
  console.log(stripe.handle({ headers: {}, body: stBody }));

  console.log('\n== 5. DB state after all webhooks ==');
  for (const [id, s] of db) console.log(`   ${id}: ${s}`);
  console.log(`   events seen: ${[...seenEvents].join(', ')}`);

  console.log('\n== 6. Composition version (template as a function) ==');
  console.log('  ', handleWith({ verify: () => true, parse: () => ({ eventId: 'e9', paymentId: 'pay_9', status: 'SUCCESS' }) }, { headers: {}, body: '' }));
}

main();
