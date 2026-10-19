// L11 · Builder: run with `npx tsx lld/2-creational/L11-builder/demo.ts`
// Domain: a payment order (fluent builder with validation), a snake-and-ladder board, and a step builder.

export {};

const section = (t: string) => console.log(`\n=== ${t} ===`);

class ValidationError extends Error { override name = 'ValidationError'; }

// ---------- the product ----------
interface PaymentOrder {
  readonly customerId: string;
  readonly amount: number; // paise
  readonly currency: 'INR' | 'USD';
  readonly capture: 'auto' | 'manual';
  readonly captureWithinH?: number;
  readonly notes: Readonly<Record<string, string>>;
}
type Draft = { -readonly [K in keyof PaymentOrder]?: PaymentOrder[K] } & { notes: Record<string, string> };

// ---------- the builder ----------
class PaymentOrderBuilder {
  private o: Draft = { currency: 'INR', capture: 'auto', notes: {} };

  forCustomer(id: string) { this.o.customerId = id; return this; }
  amountInPaise(p: number) { this.o.amount = p; return this; }
  inCurrency(c: 'INR' | 'USD') { this.o.currency = c; return this; }
  manualCapture() { this.o.capture = 'manual'; return this; }
  captureWithin(hours: number) { this.o.captureWithinH = hours; return this; }
  note(k: string, v: string) { this.o.notes[k] = v; return this; }

  build(): PaymentOrder {
    const o = this.o;
    if (!o.customerId) throw new ValidationError('customerId is required');
    if (!o.amount || o.amount <= 0) throw new ValidationError('amount must be > 0');
    if (o.capture === 'manual' && !o.captureWithinH) throw new ValidationError('manual capture needs captureWithin');
    if (o.captureWithinH && o.captureWithinH > 120) throw new ValidationError('capture window max is 120h');
    return Object.freeze({
      customerId: o.customerId, amount: o.amount, currency: o.currency ?? 'INR', capture: o.capture ?? 'auto',
      captureWithinH: o.captureWithinH, notes: Object.freeze({ ...o.notes }),
    });
  }
}

// ---------- a board builder: rules between parts ----------
class BoardBuilder {
  private snakes = new Map<number, number>();
  private ladders = new Map<number, number>();
  constructor(private size = 100) {}
  snake(from: number, to: number) { this.snakes.set(from, to); return this; }
  ladder(from: number, to: number) { this.ladders.set(from, to); return this; }
  build() {
    for (const [f, t] of this.snakes) if (t >= f) throw new ValidationError(`snake ${f}->${t} must go down`);
    for (const [f, t] of this.ladders) if (t <= f) throw new ValidationError(`ladder ${f}->${t} must go up`);
    for (const f of this.snakes.keys()) if (this.ladders.has(f)) throw new ValidationError(`cell ${f} has a snake and a ladder`);
    if (this.snakes.has(this.size)) throw new ValidationError('no snake on the last cell');
    return Object.freeze({ size: this.size, jumps: new Map([...this.snakes, ...this.ladders]) });
  }
}

// ---------- step builder: required steps checked by the compiler ----------
interface NeedsUrl { url(u: string): NeedsMethod }
interface NeedsMethod { get(): Optional; post(body: unknown): Optional }
interface Optional { header(k: string, v: string): Optional; timeout(ms: number): Optional; build(): HttpRequest }
interface HttpRequest { url: string; method: 'GET' | 'POST'; body?: unknown; headers: Record<string, string>; timeoutMs: number }

function request(): NeedsUrl {
  const r: HttpRequest = { url: '', method: 'GET', headers: {}, timeoutMs: 5000 };
  const opt: Optional = {
    header(k, v) { r.headers[k] = v; return opt; },
    timeout(ms) { r.timeoutMs = ms; return opt; },
    build: () => Object.freeze({ ...r, headers: { ...r.headers } }),
  };
  return { url(u) { r.url = u; return { get: () => opt, post(b) { r.method = 'POST'; r.body = b; return opt; } }; } };
}

function tryBuild(label: string, fn: () => unknown) {
  try { console.log(`${label}: OK`, fn()); } catch (e) { console.log(`${label}: ${(e as Error).name} -> ${(e as Error).message}`); }
}

function main() {
  section('1. Before: 10 positional args');
  console.log("new PaymentOrder('ord_1', 49900, 'INR', undefined, undefined, true, 3, 'cust_9', undefined, 'n')");
  console.log('-> is `true` autoCapture? is `3` retries or hours? swapping them still compiles.');

  section('2. Fluent builder, a rule fails');
  const b = new PaymentOrderBuilder().forCustomer('cust_9').amountInPaise(49900).manualCapture().note('cart', 'c_77');
  tryBuild('build() without captureWithin', () => b.build());

  section('3. Fix and build: frozen result');
  const order = b.captureWithin(24).build();
  console.log(order, 'frozen:', Object.isFrozen(order));
  b.note('later', 'x'); // does not leak into the built object
  console.log('notes after builder.note():', order.notes);
  try { (order as { amount: number }).amount = 1; } catch (e) { console.log('mutation blocked:', (e as Error).constructor.name); }

  section('4. Board builder: rules between parts');
  tryBuild('valid board', () => new BoardBuilder(100).snake(99, 7).ladder(3, 38).build().jumps.size + ' jumps');
  tryBuild('snake going up', () => new BoardBuilder(100).snake(10, 40).build());
  tryBuild('snake + ladder same cell', () => new BoardBuilder(100).snake(50, 5).ladder(50, 80).build());

  section('5. Step builder: order enforced by types');
  const req = request().url('https://api.example.in/orders').post({ id: 81 }).header('Idempotency-Key', 'k_81').timeout(3000).build();
  console.log(req);
  // request().build();        // TS2339: Property 'build' does not exist on type 'NeedsUrl'
  // request().url('x').build() // TS2339: Property 'build' does not exist on type 'NeedsMethod'

  section('6. Often enough: an options object');
  const createOrder = (o: { customerId: string; amount: number; capture?: 'auto' | 'manual' }) => ({ capture: 'auto', ...o });
  console.log(createOrder({ customerId: 'cust_9', amount: 49900 }));
}

main();
