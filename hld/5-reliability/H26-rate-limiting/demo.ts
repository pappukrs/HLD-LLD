// H26 · Rate limiting: five algorithms on the same traffic, then the multi-pod race.
// Run: npx tsx hld/5-reliability/H26-rate-limiting/demo.ts
export {};

interface Limiter { name: string; allow(nowMs: number): boolean }

class TokenBucket implements Limiter {
  name = 'token bucket (cap 4, 2/s)';
  private tokens: number;
  private last = 0;
  constructor(private cap: number, private perSec: number) { this.tokens = cap; }
  allow(now: number): boolean {
    this.tokens = Math.min(this.cap, this.tokens + ((now - this.last) / 1000) * this.perSec);
    this.last = now;
    if (this.tokens >= 1) { this.tokens -= 1; return true; }
    return false;
  }
}

class LeakyBucket implements Limiter {
  name = 'leaky bucket (queue 4, 2/s)';
  private level = 0;
  private last = 0;
  constructor(private size: number, private perSec: number) {}
  allow(now: number): boolean {
    this.level = Math.max(0, this.level - ((now - this.last) / 1000) * this.perSec);
    this.last = now;
    if (this.level + 1 <= this.size) { this.level += 1; return true; } // queued, leaves at a steady rate
    return false;
  }
}

class FixedWindow implements Limiter {
  name = 'fixed window (4 per 1 s)';
  private counts = new Map<number, number>();
  constructor(private limit: number, private windowMs: number) {}
  allow(now: number): boolean {
    const w = Math.floor(now / this.windowMs);
    const c = this.counts.get(w) ?? 0;
    if (c >= this.limit) return false;
    this.counts.set(w, c + 1);
    return true;
  }
}

class SlidingLog implements Limiter {
  name = 'sliding window log (4 per 1 s)';
  private log: number[] = [];
  constructor(private limit: number, private windowMs: number) {}
  allow(now: number): boolean {
    this.log = this.log.filter((t) => t > now - this.windowMs);
    if (this.log.length >= this.limit) return false;
    this.log.push(now);
    return true;
  }
}

class SlidingCounter implements Limiter {
  name = 'sliding window counter (4 per 1 s)';
  private counts = new Map<number, number>();
  constructor(private limit: number, private windowMs: number) {}
  allow(now: number): boolean {
    const w = Math.floor(now / this.windowMs);
    const elapsed = (now % this.windowMs) / this.windowMs;
    const est = (this.counts.get(w - 1) ?? 0) * (1 - elapsed) + (this.counts.get(w) ?? 0);
    if (est + 1 > this.limit) return false;
    this.counts.set(w, (this.counts.get(w) ?? 0) + 1);
    return true;
  }
}

// Traffic: a burst of 4 at 0.9 s and 4 more at 1.1 s (the window-edge attack), then 3 at 1.5 s.
const traffic: number[] = [900, 900, 900, 900, 1100, 1100, 1100, 1100, 1500, 1500, 1500];

function runAll(): void {
  console.log('\n== 1. Same 11 requests, five algorithms (intended limit: about 4 per second) ==');
  console.log('requests at ms:', traffic.join(' '));
  const limiters: Limiter[] = [
    new TokenBucket(4, 2), new LeakyBucket(4, 2), new FixedWindow(4, 1000),
    new SlidingLog(4, 1000), new SlidingCounter(4, 1000),
  ];
  for (const l of limiters) {
    const marks = traffic.map((t) => (l.allow(t) ? '+' : 'x'));
    const inEdge = marks.slice(0, 8).filter((m) => m === '+').length;
    console.log(`${l.name.padEnd(36)} ${marks.join('')}   allowed in 0.9-1.1 s: ${inEdge}`);
  }
  console.log('Fixed window lets 8 through in 0.2 s (2x the limit). The sliding ones block the edge burst.');
}

// ---- Distributed: 20 pods share one counter. Simulate interleaving of GET/SET vs one atomic script.
class FakeRedis {
  private data = new Map<string, number>();
  get(k: string): number { return this.data.get(k) ?? 0; }
  set(k: string, v: number): void { this.data.set(k, v); }
  // Like EVAL: runs the whole function with no other command in between.
  evalAtomic(k: string, limit: number): 0 | 1 {
    const v = this.get(k);
    if (v >= limit) return 0;
    this.set(k, v + 1);
    return 1;
  }
}

function race(): void {
  console.log('\n== 2. 20 gateway pods, limit 100, 200 requests arrive in the same instant ==');
  const LIMIT = 100, PODS = 20, REQ = 200;

  // Naive: every pod does GET first (same tick), then SET. Reads happen in batches of PODS.
  const r1 = new FakeRedis();
  let allowedNaive = 0;
  for (let batch = 0; batch < REQ / PODS; batch++) {
    const seen = Array.from({ length: PODS }, () => r1.get('rl:k42')); // all GETs land before any SET
    seen.forEach((v) => { if (v < LIMIT) { allowedNaive++; r1.set('rl:k42', v + 1); } });
  }
  console.log(`GET -> check in Node -> SET : allowed ${allowedNaive}, counter says ${r1.get('rl:k42')}`);

  const r2 = new FakeRedis();
  let allowedLua = 0;
  for (let i = 0; i < REQ; i++) allowedLua += r2.evalAtomic('rl:k42', LIMIT);
  console.log(`one Lua script (EVAL)       : allowed ${allowedLua}, counter says ${r2.get('rl:k42')}`);

  // Local counters per pod: each pod thinks it owns the full limit.
  console.log(`counter in each pod's memory: allowed up to ${Math.min(REQ, LIMIT * PODS)} (limit x pods)`);
}

function memory(): void {
  console.log('\n== 3. Sizing ==');
  const keys = 10_000_000, bytes = 50;
  console.log(`${keys.toLocaleString()} keys x ${bytes} B = ${((keys * bytes) / 1e6).toFixed(0)} MB in Redis (token bucket: 2 numbers per key)`);
  const perMin = 1000;
  console.log(`sliding LOG at ${perMin}/min per key: ${(keys * perMin).toExponential(1)} entries. Use it only for small, strict limits.`);
}

function main(): void {
  runAll();
  race();
  memory();
}

main();
