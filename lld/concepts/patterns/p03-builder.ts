// P03 · Builder
// Run: npx tsx lld/concepts/patterns/p03-builder.ts

interface PaymentOrder {
  readonly customerId: string;
  readonly amount: number; // in paise
  readonly currency: string;
  readonly autoCapture: boolean;
  readonly captureDeadlineMin?: number;
  readonly notes: Readonly<Record<string, string>>;
}

// ---------- before: positional constructor ----------
class PaymentOrderPositional {
  constructor(
    readonly customerId: string,
    readonly amount: number,
    readonly currency: string,
    readonly autoCapture: boolean,
    readonly captureDeadlineMin: number | undefined,
  ) {}
}

// ---------- after (1): fluent builder with validation in build() ----------
class PaymentOrderBuilder {
  private customerId?: string;
  private amount?: number;
  private currency = 'INR';
  private autoCapture = true;
  private captureDeadlineMin?: number;
  private notes: Record<string, string> = {};

  forCustomer(id: string): this { this.customerId = id; return this; }
  amountInPaise(p: number): this { this.amount = p; return this; }
  inCurrency(c: string): this { this.currency = c; return this; }
  manualCapture(deadlineMin: number): this {
    this.autoCapture = false;
    this.captureDeadlineMin = deadlineMin;
    return this;
  }
  note(k: string, v: string): this { this.notes[k] = v; return this; }

  build(): PaymentOrder {
    if (!this.customerId) throw new Error('customerId is required');
    if (!this.amount || this.amount <= 0) throw new Error('amount must be > 0');
    if (!/^[A-Z]{3}$/.test(this.currency)) throw new Error(`bad currency ${this.currency}`);
    return Object.freeze({
      customerId: this.customerId,
      amount: this.amount,
      currency: this.currency,
      autoCapture: this.autoCapture,
      captureDeadlineMin: this.captureDeadlineMin,
      notes: Object.freeze({ ...this.notes }),
    });
  }
}

// ---------- after (2): step builder, order enforced by types ----------
interface HttpRequest {
  url: string;
  method: 'GET' | 'POST';
  body?: string;
  headers: Record<string, string>;
  timeoutMs: number;
}
interface NeedsUrl { url(u: string): NeedsMethod }
interface NeedsMethod { get(): Optional; post(body: unknown): Optional }
interface Optional {
  header(k: string, v: string): Optional;
  timeout(ms: number): Optional;
  build(): HttpRequest;
}

function request(): NeedsUrl {
  const req: HttpRequest = { url: '', method: 'GET', headers: {}, timeoutMs: 5000 };
  const optional: Optional = {
    header(k, v) { req.headers[k] = v; return optional; },
    timeout(ms) { req.timeoutMs = ms; return optional; },
    build() { return { ...req, headers: { ...req.headers } }; },
  };
  const needsMethod: NeedsMethod = {
    get() { req.method = 'GET'; return optional; },
    post(body) {
      req.method = 'POST';
      req.body = JSON.stringify(body);
      req.headers['content-type'] = 'application/json';
      return optional;
    },
  };
  return { url(u) { req.url = u; return needsMethod; } };
}

function main() {
  console.log('--- before: which argument is which? ---');
  const p = new PaymentOrderPositional('cust_9', 49900, 'INR', false, 15);
  console.log(p);

  console.log('\n--- after: fluent builder ---');
  const order = new PaymentOrderBuilder()
    .forCustomer('cust_9')
    .amountInPaise(49900)
    .manualCapture(15)
    .note('cart', 'c_77')
    .build();
  console.log(order);
  console.log(`frozen: ${Object.isFrozen(order)}`);

  try {
    new PaymentOrderBuilder().amountInPaise(100).build();
  } catch (e) {
    console.log(`expected error: ${(e as Error).message}`);
  }

  console.log('\n--- options object (often enough in TS) ---');
  const createOrder = (o: { customerId: string; amount: number; currency?: string }) => ({
    currency: 'INR',
    ...o,
  });
  console.log(createOrder({ customerId: 'cust_1', amount: 1000 }));

  console.log('\n--- step builder ---');
  const req = request()
    .url('/v1/refunds')
    .post({ paymentId: 'pay_1', amount: 500 })
    .header('idempotency-key', 'rf_123')
    .timeout(2000)
    .build();
  console.log(req);
  // request().build();      // compile error: build() is not available yet
  // request().url('/x').build(); // compile error: choose get() or post() first
}

main();

export {};
