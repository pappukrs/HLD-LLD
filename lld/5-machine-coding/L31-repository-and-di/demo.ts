// L31 · Repository + dependency injection on a payment wallet.
// Run: npx tsx lld/5-machine-coding/L31-repository-and-di/demo.ts

interface Wallet { id: string; userId: string; balance: number; version: number }
interface LedgerEntry { id: string; walletId: string; amount: number; type: 'CREDIT' | 'DEBIT'; at: string }

class NotFoundError extends Error { name = 'NotFoundError'; }
class ConcurrencyError extends Error { name = 'ConcurrencyError'; }
class InsufficientFundsError extends Error { name = 'InsufficientFundsError'; }

// ---------- BEFORE: global storage, real clock, no version ----------
const globalDb = new Map<string, Wallet>([['w1', { id: 'w1', userId: 'u1', balance: 0, version: 1 }]]);
class WalletServiceBefore {
  credit(walletId: string, amount: number) {
    const w = globalDb.get(walletId)!;   // reaches into shared storage
    w.balance += amount;                 // mutates stored state directly
    return `credited ${amount} at ${new Date().toISOString()}`; // differs every run
  }
}

// ---------- AFTER: interfaces ----------
interface WalletRepository { findById(id: string): Promise<Wallet | undefined>; save(w: Wallet): Promise<void> }
interface LedgerRepository { append(e: LedgerEntry): Promise<void>; byWallet(id: string): Promise<LedgerEntry[]> }

class InMemoryWalletRepository implements WalletRepository {
  private rows = new Map<string, Wallet>();
  reads = 0;
  async findById(id: string) { this.reads++; const w = this.rows.get(id); return w && { ...w }; } // copy, like a DB
  async save(w: Wallet) {
    const cur = this.rows.get(w.id);
    if (cur && cur.version !== w.version - 1) {
      throw new ConcurrencyError(`wallet ${w.id}: update based on v${w.version - 1}, but store is already at v${cur.version}`);
    }
    this.rows.set(w.id, { ...w });
  }
}

// A second implementation: same interface, different behaviour (a read-through cache in front).
class CachedWalletRepository implements WalletRepository {
  private cache = new Map<string, Wallet>();
  hits = 0;
  constructor(private readonly inner: WalletRepository) {}
  async findById(id: string) {
    const c = this.cache.get(id);
    if (c) { this.hits++; return { ...c }; }
    const w = await this.inner.findById(id);
    if (w) this.cache.set(id, { ...w });
    return w;
  }
  async save(w: Wallet) { await this.inner.save(w); this.cache.set(w.id, { ...w }); }
}

class InMemoryLedger implements LedgerRepository {
  private entries: LedgerEntry[] = [];
  async append(e: LedgerEntry) { this.entries.push({ ...e }); }
  async byWallet(id: string) { return this.entries.filter((e) => e.walletId === id); }
}

// ---------- the service: rules only, depends on interfaces ----------
class WalletService {
  constructor(
    private readonly wallets: WalletRepository,
    private readonly ledger: LedgerRepository,
    private readonly clock: () => Date,
    private readonly ids: () => string,
  ) {}

  async open(userId: string) {
    const w: Wallet = { id: this.ids(), userId, balance: 0, version: 1 };
    await this.wallets.save(w);
    return w.id;
  }
  async credit(id: string, amount: number) { return this.apply(id, amount, 'CREDIT'); }
  async debit(id: string, amount: number) { return this.apply(id, -amount, 'DEBIT'); }

  private async apply(id: string, delta: number, type: LedgerEntry['type']) {
    const w = await this.wallets.findById(id);
    if (!w) throw new NotFoundError(`wallet ${id}`);
    if (w.balance + delta < 0) throw new InsufficientFundsError(`balance ${w.balance}, need ${-delta}`);
    await this.wallets.save({ ...w, balance: w.balance + delta, version: w.version + 1 });
    await this.ledger.append({ id: this.ids(), walletId: id, amount: Math.abs(delta), type, at: this.clock().toISOString() });
    return w.balance + delta;
  }
  async history(id: string) { return this.ledger.byWallet(id); }
}

// ---------- composition root ----------
function buildApp(wallets: WalletRepository) {
  let n = 0;
  const fixedClock = () => new Date('2026-04-18T10:00:00Z');   // tests and demos control time
  return new WalletService(wallets, new InMemoryLedger(), fixedClock, () => `id${++n}`);
}

async function main() {
  console.log('=== Before: hard-wired ===');
  const before = new WalletServiceBefore();
  console.log(before.credit('w1', 100), '| global balance:', globalDb.get('w1')!.balance);
  console.log('Test needs the global map and cannot fix the time.');

  console.log('\n=== After: service gets its dependencies ===');
  const repo = new InMemoryWalletRepository();
  const svc = buildApp(repo);
  const id = await svc.open('pappu');
  console.log('credit 500 ->', await svc.credit(id, 500));
  console.log('debit 120  ->', await svc.debit(id, 120));
  try { await svc.debit(id, 1000); } catch (e) { console.log('debit 1000 ->', (e as Error).name); }
  console.log('ledger (fixed clock):', (await svc.history(id)).map((e) => `${e.type} ${e.amount} @ ${e.at}`));

  console.log('\n=== Copies, not live references ===');
  const leaked = (await repo.findById(id))!;
  leaked.balance = 1_000_000;                  // caller edits its copy...
  console.log('stored balance still', (await repo.findById(id))!.balance, '(no save, no change)');

  console.log('\n=== Swap the implementation, service untouched ===');
  const inner = new InMemoryWalletRepository();
  const cached = new CachedWalletRepository(inner);
  const svc2 = buildApp(cached);
  const id2 = await svc2.open('ankit');
  for (let i = 0; i < 5; i++) await svc2.credit(id2, 10);
  console.log(`5 credits: cache hits=${cached.hits}, inner reads=${inner.reads} (open() warmed the cache)`);

  console.log('\n=== Optimistic locking catches a lost update ===');
  const a = (await repo.findById(id))!;        // request A reads v3
  const b = (await repo.findById(id))!;        // request B reads v3 too
  await repo.save({ ...a, balance: a.balance + 50, version: a.version + 1 });
  console.log(`A saved v${a.version + 1}`);
  try { await repo.save({ ...b, balance: b.balance + 70, version: b.version + 1 }); }
  catch (e) { console.log('B ->', (e as Error).name + ':', (e as Error).message, '-> reload and retry'); }
  console.log('final balance', (await repo.findById(id))!.balance, '(A applied, B must retry)');
}

main();

export {};
