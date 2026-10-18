// P06 · Decorator
// Run: npx tsx lld/concepts/patterns/p06-decorator.ts

interface PaymentGateway {
  charge(orderId: string, amount: number): Promise<string>;
}

// a flaky gateway: fails the first `failures` calls
class FlakyUpiGateway implements PaymentGateway {
  private calls = 0;
  constructor(private readonly failures: number) {}
  async charge(orderId: string, amount: number): Promise<string> {
    this.calls++;
    if (this.calls <= this.failures) throw new Error(`timeout on attempt ${this.calls}`);
    return `upi_${orderId}_${amount}`;
  }
}

// ---------- after: decorators share the interface ----------
abstract class GatewayDecorator implements PaymentGateway {
  constructor(protected readonly inner: PaymentGateway) {}
  abstract charge(orderId: string, amount: number): Promise<string>;
}

class RetryGateway extends GatewayDecorator {
  constructor(inner: PaymentGateway, private readonly attempts: number) { super(inner); }
  async charge(orderId: string, amount: number): Promise<string> {
    let lastErr: unknown;
    for (let i = 1; i <= this.attempts; i++) {
      try {
        return await this.inner.charge(orderId, amount);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }
}

class LoggingGateway extends GatewayDecorator {
  constructor(inner: PaymentGateway, private readonly label: string) { super(inner); }
  async charge(orderId: string, amount: number): Promise<string> {
    console.log(`  [${this.label}] charge ${orderId} amount=${amount}`);
    try {
      const txn = await this.inner.charge(orderId, amount);
      console.log(`  [${this.label}] ok ${txn}`);
      return txn;
    } catch (e) {
      console.log(`  [${this.label}] failed: ${(e as Error).message}`);
      throw e;
    }
  }
}

class MetricsGateway extends GatewayDecorator {
  readonly stats = { calls: 0, errors: 0 };
  async charge(orderId: string, amount: number): Promise<string> {
    this.stats.calls++;
    try {
      return await this.inner.charge(orderId, amount);
    } catch (e) {
      this.stats.errors++;
      throw e;
    }
  }
}

// ---------- function form ----------
type Charge = (orderId: string, amount: number) => Promise<string>;
const withRetry = (fn: Charge, attempts: number): Charge => async (id, amt) => {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(id, amt); } catch (e) { lastErr = e; }
  }
  throw lastErr;
};
const withTag = (fn: Charge, tag: string): Charge => async (id, amt) => `${tag}:${await fn(id, amt)}`;

async function main() {
  console.log('--- before: no retry, the first timeout reaches the user ---');
  try {
    await new FlakyUpiGateway(2).charge('ord_1', 499);
  } catch (e) {
    console.log(`  user sees: ${(e as Error).message}`);
  }

  console.log('\n--- after: Logging(Retry(gateway)) logs once per call ---');
  const outerLog = new LoggingGateway(new RetryGateway(new FlakyUpiGateway(2), 3), 'outer');
  await outerLog.charge('ord_2', 499);

  console.log('\n--- after: Retry(Logging(gateway)) logs every attempt ---');
  const innerLog = new RetryGateway(new LoggingGateway(new FlakyUpiGateway(2), 'inner'), 3);
  await innerLog.charge('ord_3', 499);

  console.log('\n--- metrics outside retry ---');
  const metrics = new MetricsGateway(new RetryGateway(new FlakyUpiGateway(5), 3));
  try {
    await metrics.charge('ord_4', 100);
  } catch (e) {
    console.log(`  gave up: ${(e as Error).message}`);
  }
  console.log('  stats:', metrics.stats);

  console.log('\n--- function decorators ---');
  const gw = new FlakyUpiGateway(1);
  const charge = withTag(withRetry(gw.charge.bind(gw), 2), 'v2');
  console.log(' ', await charge('ord_5', 250));
}

await main();

export {};
