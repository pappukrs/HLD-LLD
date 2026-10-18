// P18 · Repository and Dependency Injection
// Run: npx tsx lld/concepts/patterns/p18-repository-di.ts

interface Wallet { id: string; userId: string; balance: number; version: number }
interface LedgerEntry { id: string; walletId: string; amount: number; type: 'CREDIT' | 'DEBIT'; at: string }

// ---------- before: hard-wired storage and clock ----------
const globalDb = new Map<string, Wallet>([['w1', { id: 'w1', userId: 'u1', balance: 0, version: 1 }]]);
class WalletServiceBefore {
  credit(walletId: string, amount: number) {
    const w = globalDb.get(walletId)!; // direct storage access, shared global
    w.balance += amount;               // mutates stored state, no version check
    return `${new Date().toISOString().slice(0, 4)}...: credited ${amount}`; // real clock: hard to test
  }
}

// ---------- after: repositories (interfaces) ----------
class ConcurrencyError extends Error {}
class NotFoundError extends Error {}
class InsufficientFundsError extends Error {}

interface WalletRepository {
  findById(id: string): Promise<Wallet | undefined>;
  save(w: Wallet): Promise<void>;
}
interface LedgerRepository {
  append(e: LedgerEntry): Promise<void>;
  byWallet(walletId: string): Promise<LedgerEntry[]>;
}

class InMemoryWalletRepository implements WalletRepository {
  private rows = new Map<string, Wallet>();
  async findById(id: string) {
    const w = this.rows.get(id);
    return w && { ...w }; // a copy, like a real DB read
  }
  async save(w: Wallet) {
    const current = this.rows.get(w.id);
    if (current && current.version !== w.version - 1) {
      throw new ConcurrencyError(`wallet ${w.id}: expected v${w.version - 1}, found v${current.version}`);
    }
    this.rows.set(w.id, { ...w });
  }
}

class InMemoryLedger implements LedgerRepository {
  private entries: LedgerEntry[] = [];
  async append(e: LedgerEntry) { this.entries.push({ ...e }); }
  async byWallet(walletId: string) { return this.entries.filter((e) => e.walletId === walletId); }
}

// ---------- the service: depends only on interfaces ----------
type Clock = () => Date;
type IdGen = () => string;

class WalletService {
  constructor(
    private readonly wallets: WalletRepository,
    private readonly ledger: LedgerRepository,
    private readonly clock: Clock,
    private readonly newId: IdGen,
  ) {}

  async open(userId: string): Promise<Wallet> {
    const w: Wallet = { id: this.newId(), userId, balance: 0, version: 1 };
    await this.wallets.save(w);
    return w;
  }

  async credit(walletId: string, amount: number) { return this.apply(walletId, amount, 'CREDIT'); }
  async debit(walletId: string, amount: number) { return this.apply(walletId, -amount, 'DEBIT'); }

  private async apply(walletId: string, delta: number, type: LedgerEntry['type']): Promise<Wallet> {
    const w = await this.wallets.findById(walletId);
    if (!w) throw new NotFoundError(`wallet ${walletId}`);
    if (w.balance + delta < 0) throw new InsufficientFundsError(`balance ${w.balance}, need ${-delta}`);
    const updated = { ...w, balance: w.balance + delta, version: w.version + 1 };
    await this.wallets.save(updated); // optimistic check happens here
    await this.ledger.append({ id: this.newId(), walletId, amount: Math.abs(delta), type, at: this.clock().toISOString() });
    return updated;
  }
}

// ---------- composition root ----------
function buildApp(overrides: Partial<{ clock: Clock; newId: IdGen }> = {}) {
  let seq = 0;
  const wallets = new InMemoryWalletRepository();
  const ledger = new InMemoryLedger();
  const service = new WalletService(
    wallets,
    ledger,
    overrides.clock ?? (() => new Date()),
    overrides.newId ?? (() => `id_${++seq}`),
  );
  return { service, wallets, ledger };
}

async function main() {
  console.log('--- before ---');
  console.log(' ', new WalletServiceBefore().credit('w1', 100), '| global state:', globalDb.get('w1'));

  console.log('\n--- after: wired in the composition root, fixed clock for a test ---');
  const { service, wallets, ledger } = buildApp({ clock: () => new Date('2026-10-18T10:00:00Z') });
  const w = await service.open('u1');
  await service.credit(w.id, 1000);
  await service.debit(w.id, 300);
  console.log('  wallet:', await wallets.findById(w.id));
  console.log('  ledger:', (await ledger.byWallet(w.id)).map((e) => `${e.type} ${e.amount} @ ${e.at}`));

  try {
    await service.debit(w.id, 5000);
  } catch (e) {
    console.log(`  expected ${(e as Error).constructor.name}: ${(e as Error).message}`);
  }

  console.log('\n--- optimistic locking: two writers read the same version ---');
  const copy1 = (await wallets.findById(w.id))!;
  const copy2 = (await wallets.findById(w.id))!;
  await wallets.save({ ...copy1, balance: copy1.balance + 50, version: copy1.version + 1 });
  try {
    await wallets.save({ ...copy2, balance: copy2.balance + 70, version: copy2.version + 1 });
  } catch (e) {
    console.log(`  second writer: ${(e as Error).message} -> re-read and retry`);
  }
  console.log('  final:', await wallets.findById(w.id));

  console.log('\n--- returned objects are copies ---');
  const leaked = (await wallets.findById(w.id))!;
  leaked.balance = 1_000_000;
  console.log(`  stored balance still: ${(await wallets.findById(w.id))!.balance}`);
}

await main();

export {};
