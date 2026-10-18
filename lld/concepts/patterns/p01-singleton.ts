// P01 · Singleton
// Run: npx tsx lld/concepts/patterns/p01-singleton.ts

// ---------- before: every caller creates its own pool ----------
let poolsOpened = 0;
class NaiveDbPool {
  constructor(readonly size: number) {
    poolsOpened++;
  }
}

// ---------- after (1): classic class singleton ----------
class AppConfig {
  private static instance: AppConfig | undefined;
  static createdCount = 0;

  private constructor(
    readonly env: string,
    readonly gatewayTimeoutMs: number,
  ) {
    AppConfig.createdCount++;
  }

  static get(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig(process.env.NODE_ENV ?? 'dev', 3000);
    }
    return AppConfig.instance;
  }
}

// ---------- after (2): async singleton, cache the promise ----------
interface Db {
  id: number;
  query(sql: string): Promise<string>;
}
let connectCalls = 0;
async function connect(): Promise<Db> {
  connectCalls++;
  const id = connectCalls;
  await new Promise((r) => setTimeout(r, 20)); // fake network delay
  return { id, query: async (sql) => `db#${id} ran: ${sql}` };
}

let badDb: Db | undefined;
async function getDbUnsafe(): Promise<Db> {
  if (!badDb) badDb = await connect(); // two callers both pass the check before the await ends
  return badDb;
}

let dbPromise: Promise<Db> | undefined;
function getDb(): Promise<Db> {
  dbPromise ??= connect(); // set synchronously, so the second caller reuses it
  return dbPromise;
}

// ---------- after (3): the injected alternative ----------
class PaymentService {
  constructor(private readonly config: AppConfig) {}
  describe(): string {
    return `PaymentService(env=${this.config.env}, timeout=${this.config.gatewayTimeoutMs}ms)`;
  }
}

async function main() {
  console.log('--- before: new in every module ---');
  new NaiveDbPool(10); // orders module
  new NaiveDbPool(10); // payments module
  console.log(`pools opened: ${poolsOpened} (wanted 1)`);

  console.log('\n--- after: class singleton ---');
  const a = AppConfig.get();
  const b = AppConfig.get();
  console.log(`same instance: ${a === b}, created: ${AppConfig.createdCount} time(s)`);

  console.log('\n--- async init: unsafe vs promise-cached ---');
  const [u1, u2] = await Promise.all([getDbUnsafe(), getDbUnsafe()]);
  console.log(`unsafe: got db#${u1.id} and db#${u2.id} -> connect called ${connectCalls} times`);
  connectCalls = 0;
  const [s1, s2] = await Promise.all([getDb(), getDb()]);
  console.log(`safe:   got db#${s1.id} and db#${s2.id} -> connect called ${connectCalls} time`);
  console.log(await s1.query('SELECT 1'));

  console.log('\n--- prefer injection: one instance, passed in ---');
  const service = new PaymentService(AppConfig.get()); // the composition root decides
  console.log(service.describe());
}

await main();

export {};
