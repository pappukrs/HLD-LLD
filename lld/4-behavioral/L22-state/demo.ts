// L22 · State: a payment lifecycle driven by out-of-order, duplicated provider webhooks.
// Run: npx tsx lld/4-behavioral/L22-state/demo.ts

export {}; // module scope: keeps these names out of the global (DOM) namespace

type Status = 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';

class InvalidTransition extends Error {
  constructor(event: string, status: Status) {
    super(`cannot ${event} when ${status}`);
  }
}

// ---- Option A: one class per state (GoF State) ----
interface PaymentState {
  readonly name: Status;
  authorize(p: Payment): void;
  capture(p: Payment): void;
  fail(p: Payment, reason: string): void;
  refund(p: Payment): void;
}

// The base class rejects everything. Each state overrides only what is legal for it.
abstract class BaseState implements PaymentState {
  abstract readonly name: Status;
  authorize(_p: Payment): void { throw new InvalidTransition('authorize', this.name); }
  capture(_p: Payment): void { throw new InvalidTransition('capture', this.name); }
  fail(_p: Payment, _reason: string): void { throw new InvalidTransition('fail', this.name); }
  refund(_p: Payment): void { throw new InvalidTransition('refund', this.name); }
}

class Created extends BaseState {
  readonly name = 'CREATED' as const;
  authorize(p: Payment) { p.setState(STATES.AUTHORIZED); }
  fail(p: Payment, reason: string) { p.failureReason = reason; p.setState(STATES.FAILED); }
}
class Authorized extends BaseState {
  readonly name = 'AUTHORIZED' as const;
  authorize(_p: Payment) { /* duplicate webhook: idempotent no-op */ }
  capture(p: Payment) { p.setState(STATES.CAPTURED); }
  fail(p: Payment, reason: string) { p.failureReason = reason; p.setState(STATES.FAILED); }
}
class Captured extends BaseState {
  readonly name = 'CAPTURED' as const;
  capture(_p: Payment) { /* duplicate capture: idempotent no-op */ }
  refund(p: Payment) { p.setState(STATES.REFUNDED); }
}
class Failed extends BaseState { readonly name = 'FAILED' as const; }
class Refunded extends BaseState { readonly name = 'REFUNDED' as const; }

// States hold no per-payment data, so one shared instance each is enough.
const STATES = {
  CREATED: new Created(), AUTHORIZED: new Authorized(), CAPTURED: new Captured(),
  FAILED: new Failed(), REFUNDED: new Refunded(),
} satisfies Record<Status, PaymentState>;

class Payment {
  private state: PaymentState = STATES.CREATED;
  failureReason?: string;
  readonly history: string[] = ['CREATED'];
  constructor(readonly id: string, readonly amountPaise: number) {}
  get status(): Status { return this.state.name; }
  setState(next: PaymentState) {
    if (next !== this.state) this.history.push(next.name);
    this.state = next;
  }
  // The context only delegates. No if/switch on status here.
  authorize() { this.state.authorize(this); }
  capture() { this.state.capture(this); }
  fail(reason: string) { this.state.fail(this, reason); }
  refund() { this.state.refund(this); }
}

// ---- Option B: the same rules as data (a transition table) ----
type Event = 'authorize' | 'capture' | 'fail' | 'refund';
const TABLE: Record<Status, Partial<Record<Event, Status>>> = {
  CREATED: { authorize: 'AUTHORIZED', fail: 'FAILED' },
  AUTHORIZED: { authorize: 'AUTHORIZED', capture: 'CAPTURED', fail: 'FAILED' },
  CAPTURED: { capture: 'CAPTURED', refund: 'REFUNDED' },
  FAILED: {},
  REFUNDED: {},
};
function next(status: Status, event: Event): Status {
  const to = TABLE[status][event];
  if (!to) throw new InvalidTransition(event, status);
  return to;
}

// ---- Option B in a DB: a compare-and-set update protects against two webhooks racing ----
class FakeDb {
  private rows = new Map<string, Status>();
  insert(id: string) { this.rows.set(id, 'CREATED'); }
  // UPDATE payments SET status=$to WHERE id=$id AND status=$from  → returns rowCount
  updateIf(id: string, from: Status, to: Status): number {
    if (this.rows.get(id) !== from) return 0;
    this.rows.set(id, to);
    return 1;
  }
  get(id: string) { return this.rows.get(id); }
}

function main() {
  console.log('== 1. State classes: drive one payment ==');
  const p = new Payment('pay_1', 49_900);
  const webhooks: Array<[string, () => void]> = [
    ['capture (arrives too early)', () => p.capture()],
    ['authorize', () => p.authorize()],
    ['authorize (duplicate)', () => p.authorize()],
    ['capture', () => p.capture()],
    ['capture (duplicate)', () => p.capture()],
    ['fail (late, after capture)', () => p.fail('timeout')],
    ['refund', () => p.refund()],
    ['refund (again)', () => p.refund()],
  ];
  for (const [label, fire] of webhooks) {
    try {
      fire();
      console.log(`  ${label.padEnd(30)} ok        → ${p.status}`);
    } catch (e) {
      console.log(`  ${label.padEnd(30)} rejected  (${(e as Error).message})`);
    }
  }
  console.log('  history:', p.history.join(' → '));

  console.log('\n== 2. Transition table: same rules as data ==');
  let s: Status = 'CREATED';
  for (const ev of ['authorize', 'capture', 'refund'] as Event[]) {
    const to = next(s, ev);
    console.log(`  ${s.padEnd(10)} --${ev}--> ${to}`);
    s = to;
  }
  try { next('FAILED', 'capture'); } catch (e) { console.log('  FAILED --capture--> rejected:', (e as Error).message); }

  console.log('\n== 3. Two capture webhooks race in the database ==');
  const db = new FakeDb();
  db.insert('pay_2');
  db.updateIf('pay_2', 'CREATED', 'AUTHORIZED');
  const a = db.updateIf('pay_2', 'AUTHORIZED', next('AUTHORIZED', 'capture'));
  const b = db.updateIf('pay_2', 'AUTHORIZED', next('AUTHORIZED', 'capture'));
  console.log(`  worker A rowCount=${a} (wins, sends receipt)`);
  console.log(`  worker B rowCount=${b} (loses, does nothing)`);
  console.log('  final status:', db.get('pay_2'));
}

main();
