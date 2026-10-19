// L34 · Testing your design: a tiny describe/it/expect so this runs with plain tsx (no Vitest).
// The tests below are written exactly the way you'd write them in a *.test.ts file.
// Run: npx tsx lld/5-machine-coding/L34-testing-designs/demo.ts

// ---------- a 30-line test runner (Vitest-shaped) ----------
type Fn = () => void | Promise<void>;
const queue: { name: string; fn: Fn }[] = [];
let prefix = '';
function describe(name: string, body: () => void) { const p = prefix; prefix = `${p}${name} › `; body(); prefix = p; }
function it(name: string, fn: Fn) { queue.push({ name: prefix + name, fn }); }
function expect<T>(actual: T) {
  const fail = (msg: string) => { throw new Error(msg); };
  return {
    toBe: (exp: T) => { if (!Object.is(actual, exp)) fail(`expected ${String(exp)}, got ${String(actual)}`); },
    toEqual: (exp: T) => { if (JSON.stringify(actual) !== JSON.stringify(exp)) fail(`expected ${JSON.stringify(exp)}, got ${JSON.stringify(actual)}`); },
    toThrow: (cls: new (...a: never[]) => Error) => {
      try { (actual as () => unknown)(); } catch (e) { if (e instanceof cls) return; fail(`threw ${(e as Error).name}, wanted ${cls.name}`); }
      fail(`did not throw ${cls.name}`);
    },
  };
}
function spy<A extends unknown[]>() { const calls: A[] = []; const f = (...a: A) => { calls.push(a); }; return Object.assign(f, { calls }); }

// ---------- the design under test ----------
class RateLimitedError extends Error { name = 'RateLimitedError'; }
class SeatTakenError extends Error { name = 'SeatTakenError'; }
class HoldExpiredError extends Error { name = 'HoldExpiredError'; }

class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly o: { limit: number; windowMs: number; clock: () => number }) {}
  check(user: string) {
    const now = this.o.clock();
    const recent = (this.hits.get(user) ?? []).filter((t) => now - t < this.o.windowMs);
    if (recent.length >= this.o.limit) throw new RateLimitedError(user);
    this.hits.set(user, [...recent, now]);
  }
}

class SeatService {
  private holds = new Map<string, { user: string; expiresAt: number }>();
  constructor(private readonly d: { clock: () => number; ttlMs: number; notify: (user: string, msg: string) => void }) {}
  async hold(seat: string, user: string) {
    const h = this.holds.get(seat);
    if (h && h.expiresAt > this.d.clock()) throw new SeatTakenError(seat);
    this.holds.set(seat, { user, expiresAt: this.d.clock() + this.d.ttlMs }); // no await before this
    await Promise.resolve();                                                   // pretend async work
  }
  confirm(seat: string, user: string) {
    const h = this.holds.get(seat);
    if (!h || h.user !== user || h.expiresAt <= this.d.clock()) throw new HoldExpiredError(seat);
    this.d.notify(user, `booked ${seat}`);
  }
}

// ---------- the tests ----------
describe('RateLimiter', () => {
  const setup = () => { let now = 0; return { rl: new RateLimiter({ limit: 2, windowMs: 1000, clock: () => now }), at: (t: number) => (now = t) }; };

  it('allows up to the limit, then throws a typed error', () => {
    const { rl } = setup();
    rl.check('u1'); rl.check('u1');
    expect(() => rl.check('u1')).toThrow(RateLimitedError);
  });
  it('counts users separately', () => {
    const { rl } = setup();
    rl.check('u1'); rl.check('u1');
    rl.check('u2');   // must not throw
  });
  for (const [t, allowed] of [[999, false], [1000, true]] as const) {   // it.each in Vitest
    it(`at t=${t} a new request is ${allowed ? 'allowed' : 'rejected'} (boundary)`, () => {
      const { rl, at } = setup();
      rl.check('u1'); rl.check('u1');
      at(t);   // move the fake clock: no sleep
      if (allowed) rl.check('u1'); else expect(() => rl.check('u1')).toThrow(RateLimitedError);
    });
  }
});

describe('SeatService', () => {
  const MIN = 60_000;
  const setup = () => {
    let now = 0;
    const notify = spy<[string, string]>();
    return { svc: new SeatService({ clock: () => now, ttlMs: 10 * MIN, notify }), notify, at: (t: number) => (now = t) };
  };

  it('confirms inside the TTL and notifies exactly once (spy)', async () => {
    const { svc, notify, at } = setup();
    await svc.hold('A1', 'alice');
    at(10 * MIN - 1);
    svc.confirm('A1', 'alice');
    expect(notify.calls).toEqual([['alice', 'booked A1']]);
  });
  it('rejects confirm at exactly the TTL', async () => {
    const { svc, at } = setup();
    await svc.hold('A1', 'alice');
    at(10 * MIN);
    expect(() => svc.confirm('A1', 'alice')).toThrow(HoldExpiredError);
  });
  it('lets exactly one of two concurrent holds win', async () => {
    const { svc } = setup();
    const r = await Promise.allSettled([svc.hold('A1', 'alice'), svc.hold('A1', 'bob')]);
    expect(r.map((x) => x.status)).toEqual(['fulfilled', 'rejected']);
  });
  it('a second user can hold after the first hold expires', async () => {
    const { svc, at } = setup();
    await svc.hold('A1', 'alice');
    at(10 * MIN);
    await svc.hold('A1', 'bob');
  });
  it('(deliberately wrong) shows what a failure looks like', () => {
    expect(2 + 2).toBe(5 as number);
  });
});

async function main() {
  let pass = 0, fail = 0;
  const t0 = performance.now();
  for (const t of queue) {
    try { await t.fn(); pass++; console.log(`  ✓ ${t.name}`); }
    catch (e) { fail++; console.log(`  ✗ ${t.name}\n      → ${(e as Error).message}`); }
  }
  console.log(`\n${pass} passed, ${fail} failed (1 failure is intentional) in ${(performance.now() - t0).toFixed(1)} ms, no sleeps, no DB`);
}

main();

export {};
