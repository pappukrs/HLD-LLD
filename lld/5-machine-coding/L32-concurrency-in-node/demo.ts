// L32 · Concurrency in Node: reproduce a double booking, then fix it four ways.
// Run: npx tsx lld/5-machine-coding/L32-concurrency-in-node/demo.ts

import { stat } from 'node:fs';

const tick = (ms = 5) => new Promise<void>((r) => setTimeout(r, ms)); // stands in for a DB / HTTP await

interface Seat { id: string; owner: string | null; version: number }
class SeatTaken extends Error { name = 'SeatTaken'; }

// A fake async DB: every call awaits, like a real driver.
class SeatDb {
  private rows = new Map<string, Seat>([['A7', { id: 'A7', owner: null, version: 1 }]]);
  async find(id: string) { await tick(); return { ...this.rows.get(id)! }; }
  async save(s: Seat) { await tick(); this.rows.set(s.id, { ...s }); }
  // Conditional update: check + write in one atomic step, like UPDATE ... WHERE version = $v
  async claim(id: string, owner: string, version: number) {
    await tick();
    const cur = this.rows.get(id)!;
    if (cur.owner !== null || cur.version !== version) return false;   // 0 rows updated
    this.rows.set(id, { id, owner, version: version + 1 });
    return true;
  }
  owner(id: string) { return this.rows.get(id)!.owner; }
}

async function race(name: string, book: (user: string) => Promise<string>, owner: () => string | null) {
  const results = await Promise.allSettled([book('alice'), book('bob')]);
  const out = results.map((r, i) => `${i ? 'bob' : 'alice'}: ${r.status === 'fulfilled' ? r.value : (r.reason as Error).name}`);
  console.log(`${name.padEnd(26)} ${out.join(' | ')}  -> seat owner = ${owner()}`);
}

class Mutex {
  private tail: Promise<void> = Promise.resolve();
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((r) => (release = r));
    await prev;
    try { return await fn(); } finally { release(); }
  }
}

async function eventLoopOrder() {
  const order: string[] = [];
  await new Promise<void>((done) => {
    let left = 2;
    const finish = () => { if (--left === 0) done(); };
    // Inside an I/O callback (poll phase), schedule one of each kind.
    stat('.', () => {
      setTimeout(() => { order.push('timeout'); finish(); }, 0);
      setImmediate(() => { order.push('immediate'); finish(); });
      Promise.resolve().then(() => order.push('promise'));
      process.nextTick(() => order.push('nextTick'));
      order.push('sync');
    });
  });
  return order;
}

async function main() {
  console.log('=== 1. Event loop order (sync → nextTick → promise → check → timers) ===');
  console.log((await eventLoopOrder()).join(' → '));

  console.log('\n=== 2. The bug: check, await, act ===');
  {
    const db = new SeatDb();
    await race('naive (read, await, write)', async (user) => {
      const s = await db.find('A7');
      if (s.owner) throw new SeatTaken();
      await tick(); // payment hold: the other request runs here
      await db.save({ ...s, owner: user });
      return 'booked';
    }, () => db.owner('A7'));
    console.log('   both got "booked"; last write wins -> double booking');
  }

  console.log('\n=== 3. Fix 0: no gap (synchronous hold, then async work) ===');
  {
    const seat: Seat = { id: 'A7', owner: null, version: 1 };
    await race('sync hold', async (user) => {
      if (seat.owner) throw new SeatTaken();  // check
      seat.owner = user;                      // act, same tick: nothing can interleave
      await tick();                           // slow payment after the hold
      return 'held+paid';
    }, () => seat.owner);
  }

  console.log('\n=== 4. Fix 1: per-seat mutex (one process only) ===');
  {
    const db = new SeatDb();
    const lock = new Mutex();
    await race('mutex(seat:A7)', (user) => lock.runExclusive(async () => {
      const s = await db.find('A7');
      if (s.owner) throw new SeatTaken();
      await tick();
      await db.save({ ...s, owner: user });
      return 'booked';
    }), () => db.owner('A7'));
    console.log('   two pods = two Mutex objects -> this guard disappears');
  }

  console.log('\n=== 5. Fix 2: optimistic conditional update (works across instances) ===');
  {
    const db = new SeatDb();
    await race('UPDATE ... WHERE version', async (user) => {
      const s = await db.find('A7');                  // both read v1
      if (s.owner) throw new SeatTaken();
      await tick();
      if (!(await db.claim('A7', user, s.version))) throw new SeatTaken(); // 0 rows -> 409
      return 'booked';
    }, () => db.owner('A7'));
  }

  console.log('\n=== 6. Fix 3: idempotency key (a client retry is concurrency too) ===');
  {
    const keys = new Map<string, Promise<string>>(); // stands in for UNIQUE(key) / SET NX
    let charges = 0;
    const charge = (key: string, amount: number) => {
      const existing = keys.get(key);
      if (existing) return existing;                  // same key → same answer, no new charge
      const p = (async () => { await tick(); charges++; return `txn_${charges} (₹${amount})`; })();
      keys.set(key, p);                               // set synchronously: no gap
      return p;
    };
    const [a, b, c] = await Promise.all([charge('idem-42', 499), charge('idem-42', 499), charge('idem-43', 99)]);
    console.log(`original: ${a} | retry: ${b} | other key: ${c} | gateway charged ${charges} times`);
  }
}

main();
