// H25 · Microservices: a service registry with heartbeats and TTL eviction, client-side
// round-robin discovery, sync-chain availability, and sync vs async checkout latency.
// Run: npx tsx hld/5-reliability/H25-microservices/demo.ts
export {};

type Instance = { id: string; addr: string; lastBeat: number };

class Registry {
  private services = new Map<string, Map<string, Instance>>();
  constructor(private ttlMs = 15_000) {}
  register(svc: string, id: string, addr: string, now: number): void {
    if (!this.services.has(svc)) this.services.set(svc, new Map());
    this.services.get(svc)!.set(id, { id, addr, lastBeat: now });
  }
  deregister(svc: string, id: string): void {
    this.services.get(svc)?.delete(id);
  }
  heartbeat(svc: string, id: string, now: number): void {
    const i = this.services.get(svc)?.get(id);
    if (i) i.lastBeat = now;
  }
  lookup(svc: string, now: number): Instance[] {
    const all = [...(this.services.get(svc)?.values() ?? [])];
    return all.filter((i) => now - i.lastBeat <= this.ttlMs);
  }
}

class DiscoveryClient {
  private rr = 0;
  private cache: { list: Instance[]; at: number } | null = null;
  constructor(private reg: Registry, private cacheMs = 5_000) {}
  pick(svc: string, now: number): Instance | null {
    if (!this.cache || now - this.cache.at > this.cacheMs) this.cache = { list: this.reg.lookup(svc, now), at: now };
    const list = this.cache.list;
    return list.length ? list[this.rr++ % list.length] : null;
  }
}

function discovery(): void {
  console.log('\n== 1. Registry + client-side round robin (TTL 15 s, client cache 5 s) ==');
  const reg = new Registry();
  const client = new DiscoveryClient(reg);
  const alive = new Set(['p1', 'p2', 'p3']);
  reg.register('payment', 'p1', '10.0.1.11:50051', 0);
  reg.register('payment', 'p2', '10.0.1.12:50051', 0);
  reg.register('payment', 'p3', '10.0.1.13:50051', 0);

  let failed = 0, ok = 0;
  for (let t = 0; t <= 40_000; t += 2_000) {
    if (t === 10_000) { alive.delete('p2'); console.log(`t=${t / 1000}s  p2 crashes (no deregister call, it just stops beating)`); }
    if (t === 20_000) { reg.register('payment', 'p4', '10.0.1.14:50051', t); alive.add('p4'); console.log(`t=${t / 1000}s  p4 passes readiness and registers`); }
    for (const id of alive) if (t % 5_000 === 0 || t % 4_000 === 0) reg.heartbeat('payment', id, t); // beats every few seconds
    const inst = client.pick('payment', t);
    const result = inst && alive.has(inst.id) ? 'OK' : 'FAILED (dead instance, caller retries)';
    if (result === 'OK') ok++; else failed++;
    const listed = reg.lookup('payment', t).map((i) => i.id).join(',');
    console.log(`t=${String(t / 1000).padStart(2)}s  registry=[${listed}]  call -> ${inst?.id ?? 'none'} ${result}`);
  }
  console.log(`calls ok=${ok} failed=${failed}. Failures only happen in the window between crash and TTL eviction (+ client cache).`);
}

function availability(): void {
  console.log('\n== 2. Availability of a sync chain (each hop 99.9%) ==');
  for (const hops of [1, 3, 5, 8]) {
    const a = 0.999 ** hops;
    const downMin = (1 - a) * 30 * 24 * 60;
    console.log(`${hops} hop(s): ${(a * 100).toFixed(2)}%  ~${downMin.toFixed(0)} min down per 30 days`);
  }
}

// Fake latency (ms) and failure for each downstream call.
const svc = {
  inventory: { ms: 15, up: true },
  payment: { ms: 120, up: true },
  notification: { ms: 3_000, up: false }, // slow and currently failing
  search: { ms: 60, up: true },
};

function checkout(mode: 'all-sync' | 'sync-where-needed'): { ms: number; ok: boolean } {
  let ms = 5; // order service's own work
  const needAnswer = ['inventory', 'payment'] as const;
  const fireAndForget = ['notification', 'search'] as const;
  for (const s of needAnswer) { ms += svc[s].ms; if (!svc[s].up) return { ms, ok: false }; }
  if (mode === 'all-sync') {
    for (const s of fireAndForget) { ms += svc[s].ms; if (!svc[s].up) return { ms, ok: false }; }
  } else {
    ms += 3; // write OrderPlaced to the outbox in the same DB transaction; Kafka relays it later
  }
  return { ms, ok: true };
}

function syncVsAsync(): void {
  console.log('\n== 3. Checkout: notification service is slow AND failing ==');
  for (const mode of ['all-sync', 'sync-where-needed'] as const) {
    const r = checkout(mode);
    console.log(`${mode.padEnd(18)} -> ${r.ok ? '201 Created' : '500 error'} in ${r.ms} ms`);
  }
  console.log('Only stock and payment need an answer. Receipt email and search update react to the event.');
}

function main(): void {
  discovery();
  availability();
  syncVsAsync();
}

main();
