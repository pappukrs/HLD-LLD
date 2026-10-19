// L08 · Singleton: run with `npx tsx lld/2-creational/L08-singleton/demo.ts`
// Shows: the "before" (many pools), the classic class singleton, the async-init race and its fix,
// and why an in-memory singleton counter breaks once you run several pods.

export {};

const section = (t: string) => console.log(`\n=== ${t} ===`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- before: every module calls new ----------
let openConnections = 0;
class DbPool {
  readonly id: number;
  private static seq = 0;
  constructor(readonly size = 10) {
    this.id = ++DbPool.seq;
    openConnections += size;
  }
}

// ---------- after: classic singleton ----------
class AppDb {
  private static instance?: AppDb;
  readonly pool: DbPool;
  private constructor() {
    this.pool = new DbPool(10);
  }
  static get(): AppDb {
    return (AppDb.instance ??= new AppDb()); // lazy: created on first call only
  }
}

// ---------- async init: naive vs promise cache ----------
let connectCalls = 0;
async function connect(): Promise<DbPool> {
  connectCalls++;
  await sleep(20); // network handshake
  return new DbPool(10);
}

let naiveInst: DbPool | undefined;
async function getDbNaive(): Promise<DbPool> {
  if (!naiveInst) naiveInst = await connect(); // both callers pass the check before the await ends
  return naiveInst;
}

let dbPromise: Promise<DbPool> | undefined;
function getDb(): Promise<DbPool> {
  return (dbPromise ??= connect()); // the assignment is synchronous, so the second caller sees it
}

// ---------- per-process rate counter ----------
class LocalRateCounter {
  private counts = new Map<string, number>();
  allow(user: string, limit: number): boolean {
    const n = (this.counts.get(user) ?? 0) + 1;
    this.counts.set(user, n);
    return n <= limit;
  }
}
class SharedRateCounter {
  // stands in for Redis INCR: one store for every pod
  constructor(private store: Map<string, number>) {}
  allow(user: string, limit: number): boolean {
    const n = (this.store.get(user) ?? 0) + 1;
    this.store.set(user, n);
    return n <= limit;
  }
}

// ---------- DI: one instance, passed in ----------
interface Db { query(sql: string): string }
class OrderService {
  constructor(private db: Db) {}
  latest(): string { return this.db.query('SELECT * FROM orders ORDER BY id DESC LIMIT 1'); }
}

async function main() {
  section('1. Before: three modules, three pools');
  const pools = ['orders', 'payments', 'reports'].map(() => new DbPool(10));
  console.log(`pools: ${pools.map((p) => '#' + p.id).join(', ')}  connections: ${openConnections} (DB max 25)`);
  console.log(openConnections > 25 ? 'FAIL: too many clients' : 'ok');

  section('2. Classic singleton: private constructor + static get()');
  openConnections = 0;
  const a = AppDb.get();
  const b = AppDb.get();
  const c = AppDb.get();
  console.log(`a === b === c: ${a === b && b === c}, pool #${a.pool.id}, connections: ${openConnections}`);
  // new AppDb();  // TS2673: Constructor of class 'AppDb' is private

  section('3. Async init race');
  openConnections = 0;
  connectCalls = 0;
  const [n1, n2] = await Promise.all([getDbNaive(), getDbNaive()]);
  console.log(`naive: connect() called ${connectCalls}x, same pool? ${n1 === n2}  <- leak`);
  connectCalls = 0;
  const [p1, p2] = await Promise.all([getDb(), getDb()]);
  console.log(`promise cache: connect() called ${connectCalls}x, same pool? ${p1 === p2}`);

  section('4. One per process, not per cluster (limit 25/min, 4 pods, 40 requests each)');
  const pods = [1, 2, 3, 4].map(() => new LocalRateCounter());
  let allowedLocal = 0;
  for (const pod of pods) for (let i = 0; i < 40; i++) if (pod.allow('user42', 25)) allowedLocal++;
  const redis = new Map<string, number>();
  const shared = [1, 2, 3, 4].map(() => new SharedRateCounter(redis));
  let allowedShared = 0;
  for (const pod of shared) for (let i = 0; i < 40; i++) if (pod.allow('user42', 25)) allowedShared++;
  console.log(`in-memory singleton per pod: allowed ${allowedLocal} (should be 25)`);
  console.log(`shared store (Redis):        allowed ${allowedShared}`);

  section('5. Better: create once in main(), inject it');
  const realDb: Db = { query: (sql) => `postgres ran: ${sql}` };
  const fakeDb: Db = { query: () => 'fake row {id: 1}' };
  console.log('prod :', new OrderService(realDb).latest());
  console.log('test :', new OrderService(fakeDb).latest());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
