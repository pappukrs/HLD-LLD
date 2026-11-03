// H12 · Transactions, isolation levels and locking: Day 16 practice.
// Run: npx tsx hld/3-databases/H12-transactions-isolation/practice.ts
// Different races from demo.ts on purpose:
//   1. Job queue: FOR UPDATE (workers wait) vs FOR UPDATE SKIP LOCKED (self-test Q4).
//   2. Hotel booking: FOR UPDATE cannot stop a phantom; an exclusion constraint can (Q6).
//   3. A withTx() retry wrapper for SQLSTATE 40001 / 40P01 with backoff (Q3).
//   4. Hot-row throughput: why FOR UPDATE on one row caps out (Numbers to remember).

export {};

// ---------- 1. Job queue ----------
type Job = { id: number; status: 'PENDING' | 'RUNNING' };

class JobTable {
  jobs: Job[] = [];
  private locks = new Map<number, string>(); // job id -> worker holding the row lock

  constructor(n: number) { for (let i = 1; i <= n; i++) this.jobs.push({ id: i, status: 'PENDING' }); }

  // SELECT id FROM jobs WHERE status='PENDING' ORDER BY id LIMIT n FOR UPDATE [SKIP LOCKED]
  // Returns null when the worker would block on a row another worker has locked.
  claim(worker: string, n: number, skipLocked: boolean): number[] | null {
    const got: number[] = [];
    for (const j of this.jobs) {
      if (got.length === n) break;
      if (j.status !== 'PENDING') continue;
      const holder = this.locks.get(j.id);
      if (holder && holder !== worker) {
        if (skipLocked) continue; // skip it, look at the next row
        return null;             // plain FOR UPDATE: wait for the holder to commit
      }
      this.locks.set(j.id, worker);
      got.push(j.id);
    }
    return got;
  }
  // UPDATE jobs SET status='RUNNING' WHERE id = ANY($1); COMMIT;
  commit(worker: string, ids: number[]) {
    for (const id of ids) { this.jobs[id - 1].status = 'RUNNING'; this.locks.delete(id); }
    for (const [id, w] of this.locks) if (w === worker) this.locks.delete(id);
  }
}

function runRound(skipLocked: boolean) {
  const t = new JobTable(10);
  const workers = ['w1', 'w2', 'w3'];
  // All three workers start their transaction before anyone commits.
  const claims = workers.map((w) => ({ w, ids: t.claim(w, 3, skipLocked) }));
  claims.forEach((c) => c.ids && t.commit(c.w, c.ids));
  return claims;
}

// ---------- 2. Hotel booking ----------
type Booking = { room: string; from: number; to: number }; // nights [from, to)
const overlaps = (a: Booking, b: Booking) => a.room === b.room && a.from < b.to && b.from < a.to;

class BookingTable {
  rows: Booking[] = [];
  constructor(private exclusionConstraint: boolean) {}

  // Snapshot read at Read Committed: what this transaction "sees" when it checks.
  readOverlapping(b: Booking) { return this.rows.filter((r) => overlaps(r, b)); }

  // EXCLUDE USING gist (room WITH =, daterange(from, to) WITH &&) runs on every insert,
  // against all committed rows, so it also sees rows that did not exist at check time.
  insert(b: Booking): 'ok' | '23P01' {
    if (this.exclusionConstraint && this.rows.some((r) => overlaps(r, b))) return '23P01';
    this.rows.push(b);
    return 'ok';
  }
}

function doubleBook(exclusionConstraint: boolean) {
  const t = new BookingTable(exclusionConstraint);
  const a: Booking = { room: '101', from: 10, to: 13 };
  const b: Booking = { room: '101', from: 12, to: 14 };
  // Both transactions check first. SELECT ... FOR UPDATE would lock zero rows here:
  // the conflicting booking does not exist yet, so there is nothing to lock.
  const seenByA = t.readOverlapping(a).length;
  const seenByB = t.readOverlapping(b).length;
  const results = [seenByA === 0 ? t.insert(a) : 'skip', seenByB === 0 ? t.insert(b) : 'skip'];
  return { lockedRows: seenByA + seenByB, results, rows: t.rows.length };
}

// ---------- 3. Retry wrapper ----------
class PgError extends Error { constructor(readonly code: string) { super(`SQLSTATE ${code}`); } }
const RETRYABLE = new Set(['40001', '40P01']);

async function withTx<T>(fn: (attempt: number) => Promise<T>, maxTries = 4, log: number[] = []): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn(attempt); // BEGIN ... COMMIT around this in real code
    } catch (e) {
      // ROLLBACK here in real code
      if (!(e instanceof PgError) || !RETRYABLE.has(e.code) || attempt >= maxTries) throw e;
      const delay = 10 * 2 ** attempt; // + jitter in real code, so retries don't collide again
      log.push(delay);
      await new Promise((r) => setTimeout(r, 1)); // keep the run fast; real code sleeps `delay`
    }
  }
}

// ---------- 4. Hot row ceiling ----------
// Under FOR UPDATE each writer waits for the previous commit, so writes are serial:
// max rate ≈ 1 / (time the lock is held). Lock held = statement time + commit fsync.
const hotRowCeiling = (stmtMs: number, fsyncMs: number) => Math.floor(1000 / (stmtMs + fsyncMs));

// ---------- checks ----------
let pass = 0;
const ok = (cond: boolean, name: string) => {
  if (!cond) throw new Error(`FAILED: ${name}`);
  pass++;
  console.log(`  ok  ${name}`);
};

async function main() {
  console.log('\n=== 1. Job queue ===');
  const plain = runRound(false);
  ok(plain[0].ids?.join() === '1,2,3', 'FOR UPDATE: w1 locks jobs 1-3');
  ok(plain[1].ids === null && plain[2].ids === null, 'FOR UPDATE: w2 and w3 block on job 1 (they wait, no work done)');

  const skip = runRound(true);
  const all = skip.flatMap((c) => c.ids ?? []);
  ok(skip.every((c) => c.ids?.length === 3), 'SKIP LOCKED: every worker gets 3 jobs at once');
  ok(new Set(all).size === 9, 'SKIP LOCKED: no job is claimed twice');

  console.log('\n=== 2. Hotel booking (phantom) ===');
  const noGuard = doubleBook(false);
  ok(noGuard.lockedRows === 0, 'FOR UPDATE would lock 0 rows: the clash does not exist yet');
  ok(noGuard.rows === 2, 'without a constraint, room 101 is double-booked for night 12');
  const guarded = doubleBook(true);
  ok(guarded.results.join() === 'ok,23P01' && guarded.rows === 1, 'exclusion constraint rejects the 2nd booking (23P01)');

  console.log('\n=== 3. withTx retry ===');
  const log: number[] = [];
  const out = await withTx(async (n) => { if (n < 3) throw new PgError('40001'); return `done on try ${n}`; }, 4, log);
  ok(out === 'done on try 3', '40001 twice, then success on the 3rd try');
  ok(log.join() === '20,40', 'backoff doubles between tries (20 ms, 40 ms)');

  let tries = 0;
  await withTx(async () => { tries++; throw new PgError('23505'); }).catch(() => {});
  ok(tries === 1, 'a unique violation (23505) is not retried: it is a real error');

  tries = 0;
  const err = await withTx(async () => { tries++; throw new PgError('40P01'); }, 3).catch((e) => e);
  ok(tries === 3 && err.code === '40P01', 'a deadlock is retried, then the error surfaces after maxTries');

  console.log('\n=== 4. Hot row ceiling ===');
  const ssd = hotRowCeiling(0.3, 0.5);
  const cloudDisk = hotRowCeiling(0.5, 2);
  console.log(`  one hot row: ~${ssd}/s on local SSD, ~${cloudDisk}/s on a cloud disk`);
  ok(ssd > 1000 && cloudDisk < 500, 'a single locked row tops out around hundreds to ~1-2k writes/s');

  console.log(`\n${pass} checks passed`);
}

main();
