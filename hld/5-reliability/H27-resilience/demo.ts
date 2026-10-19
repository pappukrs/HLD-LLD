// H27 · Resilience: retries (fixed vs backoff vs jitter), retry amplification, a circuit breaker
// tripping and recovering, and a bulkhead. Everything runs on a virtual clock (no real waiting).
// Run: npx tsx hld/5-reliability/H27-resilience/demo.ts
export {};

// Deterministic random so the output is the same every run.
function rng(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// ---- 1. 100 clients fail at t=0; the server is down for 1 s, then serves 30 per 100 ms.
type Strategy = (attempt: number, rnd: () => number) => number; // delay in seconds
const strategies: Record<string, Strategy> = {
  'fixed 1 s       ': () => 1,
  'exp backoff     ': (k) => Math.min(4, 0.5 * 2 ** (k - 1)),
  'exp + full jitter': (k, rnd) => rnd() * Math.min(4, 0.5 * 2 ** (k - 1)),
};

function retryStorm(): void {
  console.log('\n== 1. 100 clients retry against a server that was down for 1 s (capacity 30 per 100 ms) ==');
  for (const [name, delay] of Object.entries(strategies)) {
    const rnd = rng(42);
    const buckets: number[][] = Array.from({ length: 60 }, () => []);
    for (let i = 0; i < 100; i++) buckets[0].push(1);
    let done = 0, peak = 0, finishedAt = 0;
    buckets.forEach((list, b) => {
      const cap = b < 10 ? 0 : 30;
      const ok = Math.min(cap, list.length);
      done += ok;
      if (ok) finishedAt = b;
      if (b > 0) peak = Math.max(peak, list.length);
      for (const attempt of list.slice(ok)) {
        if (attempt >= 6) continue; // give up after 6 attempts
        const nb = b + Math.max(1, Math.round(delay(attempt, rnd) * 10));
        if (nb < 60) buckets[nb].push(attempt + 1);
      }
    });
    console.log(`${name.trim().padEnd(18)} peak retries in one 100 ms slot: ${String(peak).padStart(3)}   done in 6 s: ${done}/100   last success at ${(finishedAt / 10).toFixed(1)} s`);
  }
  console.log('Only jitter keeps the retry peak near capacity (30), so almost everyone finishes fast.');
}

// ---- 2. Retries at every layer multiply.
function amplification(): void {
  console.log('\n== 2. Retry amplification ==');
  const attemptsPerLayer = 3;
  for (let layers = 1; layers <= 4; layers++) {
    console.log(`${layers} layer(s) x ${attemptsPerLayer} attempts -> ${attemptsPerLayer ** layers} calls on the bottom service for one user click`);
  }
}

// ---- 3. Circuit breaker on a virtual clock.
type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
class CircuitBreaker {
  state: State = 'CLOSED';
  private results: boolean[] = [];
  private openedAt = 0;
  constructor(private window = 10, private minCalls = 5, private failRate = 0.5, private coolMs = 30_000) {}

  call(now: number, dependencyUp: boolean): string {
    if (this.state === 'OPEN') {
      if (now - this.openedAt < this.coolMs) return 'fallback (1 ms, no call made)';
      this.state = 'HALF_OPEN';
    }
    const ok = dependencyUp; // the real call: succeeds only when the dependency is up
    if (this.state === 'HALF_OPEN') {
      this.state = ok ? 'CLOSED' : 'OPEN';
      this.results = [];
      this.openedAt = now;
      return ok ? 'trial OK -> CLOSED' : 'trial failed -> OPEN again';
    }
    this.results = [...this.results, ok].slice(-this.window);
    const fails = this.results.filter((r) => !r).length;
    if (this.results.length >= this.minCalls && fails / this.results.length >= this.failRate) {
      this.state = 'OPEN';
      this.openedAt = now;
      return `failed (2 s timeout) -> TRIP to OPEN (${fails}/${this.results.length} failed)`;
    }
    return ok ? '200 OK' : 'failed (2 s timeout)';
  }
}

function breaker(): void {
  console.log('\n== 3. Circuit breaker (open at >=50% failures over >=5 calls, cool-down 30 s) ==');
  const cb = new CircuitBreaker();
  const plan: Array<[number, boolean]> = [
    [0, true], [1000, true], [2000, false], [3000, false], [4000, false], [5000, false],
    [6000, false], [7000, false], [36_000, false], [40_000, true], [67_000, true], [68_000, true],
  ];
  for (const [t, up] of plan) {
    const before = cb.state;
    const result = cb.call(t, up);
    console.log(`t=${String(t / 1000).padStart(4)} s  dep ${up ? 'up  ' : 'DOWN'}  [${before.padEnd(9)}] ${result}`);
  }
}

// ---- 4. Bulkhead: Bank A hangs. Shared pool vs per-bank pools.
function bulkhead(): void {
  console.log('\n== 4. Bulkhead: Bank A hangs (calls hold a socket for 2 s) ==');
  const arrivals = ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'B', 'B'];
  const run = (label: string, limits: Record<string, number>, shared: boolean) => {
    const used: Record<string, number> = { A: 0, B: 0 };
    const out: string[] = [];
    for (const bank of arrivals) {
      const inUse = shared ? used.A + used.B : used[bank];
      const cap = shared ? limits.ALL : limits[bank];
      if (inUse < cap) { used[bank]++; out.push(bank === 'A' ? 'A:stuck' : 'B:ok'); }
      else out.push(`${bank}:rejected`);
    }
    const bOk = out.filter((o) => o === 'B:ok').length;
    console.log(`${label.padEnd(26)} Bank B payments served: ${bOk}/2   (${out.slice(-4).join(', ')})`);
  };
  run('shared pool of 10', { ALL: 10 }, true);
  run('bulkheads A=5, B=5', { A: 5, B: 5 }, false);
}

function main(): void {
  retryStorm();
  amplification();
  breaker();
  bulkhead();
}

main();
