// L16 Proxy: caching (TTL + coalescing), protection and lazy proxies in front of a slow service.
// Run: npx tsx lld/3-structural/L16-proxy/demo.ts

interface Statement { accountId: string; balance: number }
interface User { id: string; role: 'ADMIN' | 'CUSTOMER'; accountId: string }
interface StatementService { getStatement(accountId: string): Promise<Statement> }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

class LedgerStatementService implements StatementService {
  calls = 0;
  async getStatement(accountId: string): Promise<Statement> {
    this.calls++;
    await sleep(40); // stands in for an 800 ms ledger query
    return { accountId, balance: 12_500 };
  }
}

// ---- caching proxy: same interface, TTL, in-flight coalescing ----
class CachingStatementProxy implements StatementService {
  private cache = new Map<string, { value: Statement; expiresAt: number }>();
  private inFlight = new Map<string, Promise<Statement>>();
  hits = 0;
  constructor(private real: StatementService, private ttlMs: number, private now: () => number = Date.now) {}

  async getStatement(id: string): Promise<Statement> {
    const hit = this.cache.get(id);
    if (hit && hit.expiresAt > this.now()) { this.hits++; return hit.value; }
    const pending = this.inFlight.get(id);
    if (pending) return pending;
    const p = this.real
      .getStatement(id)
      .then((value) => { this.cache.set(id, { value, expiresAt: this.now() + this.ttlMs }); return value; })
      .finally(() => this.inFlight.delete(id));
    this.inFlight.set(id, p);
    return p;
  }
  invalidate(id: string): void { this.cache.delete(id); }
}

// ---- protection proxy ----
class AuthStatementProxy implements StatementService {
  constructor(private real: StatementService, private user: User) {}
  getStatement(id: string): Promise<Statement> {
    if (this.user.role !== 'ADMIN' && this.user.accountId !== id) {
      return Promise.reject(new Error(`FORBIDDEN: ${this.user.id} cannot read ${id}`));
    }
    return this.real.getStatement(id);
  }
}

// ---- virtual (lazy) proxy ----
class LazyStatementProxy implements StatementService {
  private real?: StatementService;
  constructor(private create: () => StatementService) {}
  getStatement(id: string): Promise<Statement> {
    this.real ??= this.create();
    return this.real.getStatement(id);
  }
}

// The caller only knows the interface. It never changes.
async function controller(svc: StatementService, id: string): Promise<string> {
  const s = await svc.getStatement(id);
  return `${s.accountId}: Rs ${s.balance}`;
}

async function main(): Promise<void> {
  console.log('== 1. No proxy: 3 reads = 3 slow ledger calls');
  const ledger = new LedgerStatementService();
  for (let i = 0; i < 3; i++) await controller(ledger, 'acc_1');
  console.log(`  ledger calls: ${ledger.calls}\n`);

  console.log('== 2. Caching proxy (fake clock, TTL 60 s)');
  let now = 0;
  const ledger2 = new LedgerStatementService();
  const cached = new CachingStatementProxy(ledger2, 60_000, () => now);
  await controller(cached, 'acc_1'); // miss
  await controller(cached, 'acc_1'); // hit
  await controller(cached, 'acc_1'); // hit
  console.log(`  3 reads -> ledger calls: ${ledger2.calls}, hits: ${cached.hits}`);

  await Promise.all([controller(cached, 'acc_2'), controller(cached, 'acc_2'), controller(cached, 'acc_2')]);
  console.log(`  3 concurrent cold reads of acc_2 -> ledger calls now: ${ledger2.calls} (coalesced into 1)`);

  now += 61_000;
  await controller(cached, 'acc_1');
  console.log(`  after TTL expiry, acc_1 read -> ledger calls now: ${ledger2.calls}`);

  cached.invalidate('acc_1');
  await controller(cached, 'acc_1');
  console.log(`  after invalidate(acc_1) on write -> ledger calls now: ${ledger2.calls}\n`);

  console.log('== 3. Protection proxy OUTSIDE the cache');
  const customer: User = { id: 'u7', role: 'CUSTOMER', accountId: 'acc_1' };
  const secured = new AuthStatementProxy(cached, customer);
  console.log(`  own account -> ${await controller(secured, 'acc_1')}`);
  try {
    await controller(secured, 'acc_2'); // acc_2 IS cached, but auth runs first
  } catch (e) {
    console.log(`  other account -> ${(e as Error).message} (cached value never leaked)\n`);
  }

  console.log('== 4. Lazy proxy: real object built on first use');
  let built = 0;
  const lazy = new LazyStatementProxy(() => { built++; return new LedgerStatementService(); });
  console.log(`  built before first call: ${built}`);
  await controller(lazy, 'acc_3');
  await controller(lazy, 'acc_3');
  console.log(`  built after two calls: ${built}\n`);

  console.log('== 5. JS Proxy object: a language-level proxy');
  const reads: string[] = [];
  const tracked = new Proxy({ balance: 100, currency: 'INR' }, {
    get(target, prop, receiver) { reads.push(String(prop)); return Reflect.get(target, prop, receiver); },
  });
  void tracked.balance;
  void tracked.currency;
  console.log(`  properties read: ${reads.join(', ')}`);

  console.log('\nTakeaway: same interface, so the controller never changed; each proxy owns one access concern.');
}

main();

export {};
