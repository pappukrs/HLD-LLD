// P08 · Proxy
// Run: npx tsx lld/concepts/patterns/p08-proxy.ts

interface Statement { accountId: string; balance: number; lines: number }
interface User { id: string; role: 'ADMIN' | 'CUSTOMER'; accountId: string }
interface StatementService {
  getStatement(accountId: string): Promise<Statement>;
}

class LedgerStatementService implements StatementService {
  calls = 0;
  async getStatement(accountId: string): Promise<Statement> {
    this.calls++;
    await new Promise((r) => setTimeout(r, 30)); // slow ledger query
    return { accountId, balance: 12_500, lines: 42 };
  }
}

// ---------- caching proxy (with TTL + in-flight coalescing) ----------
class CachingStatementProxy implements StatementService {
  private cache = new Map<string, { value: Statement; expiresAt: number }>();
  private inFlight = new Map<string, Promise<Statement>>();
  constructor(
    private readonly real: StatementService,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async getStatement(accountId: string): Promise<Statement> {
    const hit = this.cache.get(accountId);
    if (hit && hit.expiresAt > this.now()) return hit.value;
    const pending = this.inFlight.get(accountId);
    if (pending) return pending;
    const p = this.real
      .getStatement(accountId)
      .then((value) => {
        this.cache.set(accountId, { value, expiresAt: this.now() + this.ttlMs });
        return value;
      })
      .finally(() => this.inFlight.delete(accountId));
    this.inFlight.set(accountId, p);
    return p;
  }
}

// ---------- protection proxy ----------
class AuthStatementProxy implements StatementService {
  constructor(private readonly real: StatementService, private readonly user: User) {}
  getStatement(accountId: string): Promise<Statement> {
    if (this.user.role !== 'ADMIN' && this.user.accountId !== accountId) {
      return Promise.reject(new Error(`Forbidden: ${this.user.id} cannot read ${accountId}`));
    }
    return this.real.getStatement(accountId);
  }
}

// ---------- virtual (lazy) proxy ----------
class LazyStatementProxy implements StatementService {
  private real?: StatementService;
  constructor(private readonly create: () => StatementService) {}
  getStatement(accountId: string): Promise<Statement> {
    this.real ??= this.create();
    return this.real.getStatement(accountId);
  }
}

async function main() {
  console.log('--- before: direct calls, every one is slow ---');
  const ledger = new LedgerStatementService();
  for (let i = 0; i < 3; i++) await ledger.getStatement('acc_1');
  console.log(`  ledger calls: ${ledger.calls}`);

  console.log('\n--- caching proxy ---');
  let now = 0;
  const ledger2 = new LedgerStatementService();
  const cached = new CachingStatementProxy(ledger2, 60_000, () => now);
  await Promise.all([cached.getStatement('acc_1'), cached.getStatement('acc_1')]); // coalesced
  await cached.getStatement('acc_1'); // cache hit
  console.log(`  3 reads -> ledger calls: ${ledger2.calls}`);
  now += 61_000; // TTL passes
  await cached.getStatement('acc_1');
  console.log(`  after TTL -> ledger calls: ${ledger2.calls}`);

  console.log('\n--- protection proxy over the caching proxy ---');
  const customer: User = { id: 'u7', role: 'CUSTOMER', accountId: 'acc_1' };
  const secured = new AuthStatementProxy(cached, customer);
  console.log('  own account:', await secured.getStatement('acc_1'));
  try {
    await secured.getStatement('acc_2');
  } catch (e) {
    console.log(`  expected error: ${(e as Error).message}`);
  }

  console.log('\n--- lazy proxy ---');
  let created = false;
  const lazy = new LazyStatementProxy(() => { created = true; return new LedgerStatementService(); });
  console.log(`  created before first call: ${created}`);
  await lazy.getStatement('acc_3');
  console.log(`  created after first call: ${created}`);

  console.log('\n--- JS Proxy object (language feature) ---');
  const reads: string[] = [];
  const tracked = new Proxy({ balance: 100, currency: 'INR' }, {
    get(target, prop, receiver) {
      reads.push(String(prop));
      return Reflect.get(target, prop, receiver);
    },
  });
  void tracked.balance;
  void tracked.currency;
  console.log(`  properties read: ${reads.join(', ')}`);
}

await main();

export {};
