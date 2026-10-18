// P12 · State
// Run: npx tsx lld/concepts/patterns/p12-state.ts

type Status = 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
type PaymentEvent = 'authorize' | 'capture' | 'fail' | 'refund';

// ---------- before: status checks everywhere ----------
class PaymentBefore {
  status: string = 'CREATED';
  refund() {
    if (this.status === 'CAPTURED') this.status = 'REFUNDED';
    // FAILED payment: silently does nothing
  }
}

// ---------- after (A): GoF state classes ----------
interface PaymentState {
  readonly name: Status;
  authorize(p: Payment): void;
  capture(p: Payment): void;
  fail(p: Payment, reason: string): void;
  refund(p: Payment): void;
}

abstract class BaseState implements PaymentState {
  abstract readonly name: Status;
  authorize(_p: Payment): void { this.reject('authorize'); }
  capture(_p: Payment): void { this.reject('capture'); }
  fail(_p: Payment, _reason: string): void { this.reject('fail'); }
  refund(_p: Payment): void { this.reject('refund'); }
  protected reject(event: string): never {
    throw new Error(`Cannot ${event} when ${this.name}`);
  }
}

class Created extends BaseState {
  readonly name = 'CREATED';
  authorize(p: Payment) { p.setState(States.AUTHORIZED); }
  fail(p: Payment, reason: string) { p.failureReason = reason; p.setState(States.FAILED); }
}
class Authorized extends BaseState {
  readonly name = 'AUTHORIZED';
  capture(p: Payment) { p.setState(States.CAPTURED); }
  fail(p: Payment, reason: string) { p.failureReason = reason; p.setState(States.FAILED); }
}
class Captured extends BaseState {
  readonly name = 'CAPTURED';
  capture(_p: Payment) { /* duplicate webhook: idempotent no-op */ }
  refund(p: Payment) { p.setState(States.REFUNDED); }
}
class Failed extends BaseState { readonly name = 'FAILED'; }
class Refunded extends BaseState { readonly name = 'REFUNDED'; }

// stateless, so one shared instance per state
const States = {
  CREATED: new Created(),
  AUTHORIZED: new Authorized(),
  CAPTURED: new Captured(),
  FAILED: new Failed(),
  REFUNDED: new Refunded(),
} as const;

class Payment {
  private state: PaymentState = States.CREATED;
  failureReason?: string;
  readonly history: Status[] = ['CREATED'];
  constructor(readonly id: string, readonly amount: number) {}

  get status(): Status { return this.state.name; }
  setState(s: PaymentState) { this.state = s; this.history.push(s.name); }

  authorize() { this.state.authorize(this); }
  capture() { this.state.capture(this); }
  fail(reason: string) { this.state.fail(this, reason); }
  refund() { this.state.refund(this); }
}

// ---------- after (B): transition table ----------
const transitions: Record<Status, Partial<Record<PaymentEvent, Status>>> = {
  CREATED: { authorize: 'AUTHORIZED', fail: 'FAILED' },
  AUTHORIZED: { capture: 'CAPTURED', fail: 'FAILED' },
  CAPTURED: { capture: 'CAPTURED', refund: 'REFUNDED' },
  FAILED: {},
  REFUNDED: {},
};
function next(current: Status, event: PaymentEvent): Status {
  const to = transitions[current][event];
  if (!to) throw new Error(`Cannot ${event} when ${current}`);
  return to;
}

function attempt(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ${label}: ok`);
  } catch (e) {
    console.log(`  ${label}: rejected -> ${(e as Error).message}`);
  }
}

function main() {
  console.log('--- before ---');
  const old = new PaymentBefore();
  old.status = 'FAILED';
  old.refund();
  console.log(`  refund on FAILED did nothing, no error. status=${old.status}`);

  console.log('\n--- after (A): state classes ---');
  const p = new Payment('pay_1', 49900);
  attempt('authorize', () => p.authorize());
  attempt('capture', () => p.capture());
  attempt('capture again (duplicate webhook)', () => p.capture());
  attempt('authorize after capture', () => p.authorize());
  attempt('refund', () => p.refund());
  console.log(`  history: ${p.history.join(' -> ')}`);

  const q = new Payment('pay_2', 1000);
  attempt('fail', () => q.fail('card declined'));
  attempt('refund failed payment', () => q.refund());
  console.log(`  ${q.id}: ${q.status} (${q.failureReason})`);

  console.log('\n--- after (B): transition table ---');
  let s: Status = 'CREATED';
  for (const e of ['authorize', 'capture', 'refund'] as const) {
    s = next(s, e);
    console.log(`  ${e} -> ${s}`);
  }
  attempt('capture on REFUNDED', () => next('REFUNDED', 'capture'));
}

main();

export {};
