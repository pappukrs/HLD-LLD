// H09 · Caching: LRU hit rate under skewed traffic, stampede, penetration, TTL jitter.
// Run: npx tsx hld/2-scaling/H09-caching/demo.ts
export {};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function rng(seed: number) {
  let x = seed >>> 0;
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

// ---- LRU: Map keeps insertion order, so delete + set moves a key to the "newest" end ----
class LRU<V> {
  private m = new Map<string, V>();
  hits = 0; misses = 0;
  constructor(private cap: number) {}
  get(k: string): V | undefined {
    const v = this.m.get(k);
    if (v === undefined) { this.misses++; return undefined; }
    this.hits++;
    this.m.delete(k); this.m.set(k, v);
    return v;
  }
  set(k: string, v: V) {
    this.m.delete(k);
    if (this.m.size >= this.cap) this.m.delete(this.m.keys().next().value as string); // evict oldest
    this.m.set(k, v);
  }
}

// Zipf-like popularity: key i is picked with weight 1/(i+1)^1.1 (a few keys get most reads).
function zipfPicker(n: number, r: () => number) {
  const cdf: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) { sum += 1 / Math.pow(i + 1, 1.1); cdf.push(sum); }
  return () => {
    const x = r() * sum;
    let lo = 0, hi = n - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < x) lo = mid + 1; else hi = mid; }
    return `product:${lo}`;
  };
}

// ---- A fake DB that counts queries ----
let dbQueries = 0;
async function dbFind(key: string): Promise<string | null> {
  dbQueries++;
  await sleep(5);
  return key.endsWith(':999999') ? null : `row(${key})`;
}

async function main() {
  console.log('\n== 1. Hit rate vs cache size (100k products, 300k Zipf-skewed reads) ==');
  for (const size of [100, 1_000, 10_000, 50_000]) {
    const r = rng(7), pick = zipfPicker(100_000, r), c = new LRU<string>(size);
    for (let i = 0; i < 300_000; i++) { const k = pick(); if (c.get(k) === undefined) c.set(k, 'v'); }
    const hit = c.hits / (c.hits + c.misses);
    console.log(`  cache ${String(size).padStart(6)} keys (${((size / 100_000) * 100).toFixed(1).padStart(4)}% of catalog): hit ${(hit * 100).toFixed(1)}%  → DB gets ${((1 - hit) * 100).toFixed(1)}% of reads, avg ${(hit * 1 + (1 - hit) * 11).toFixed(2)} ms`);
  }

  console.log('\n== 2. Stampede: hot key expires, 200 requests arrive together ==');
  const cache = new Map<string, string | null>();
  dbQueries = 0;
  async function naive(k: string) {
    if (cache.has(k)) return cache.get(k);
    const v = await dbFind(k); cache.set(k, v); return v;
  }
  await Promise.all(Array.from({ length: 200 }, () => naive('home:feed')));
  console.log(`  plain cache-aside : ${dbQueries} DB queries`);

  cache.clear(); dbQueries = 0;
  const inflight = new Map<string, Promise<string | null>>();
  async function singleFlight(k: string) {
    if (cache.has(k)) return cache.get(k);
    if (!inflight.has(k)) inflight.set(k, dbFind(k).then((v) => { cache.set(k, v); return v; }).finally(() => inflight.delete(k)));
    return inflight.get(k);
  }
  await Promise.all(Array.from({ length: 200 }, () => singleFlight('home:feed')));
  console.log(`  single-flight     : ${dbQueries} DB query (per process; use a Redis SET NX lock across instances)`);

  console.log('\n== 3. Penetration: 100 requests for a product that does not exist ==');
  cache.clear(); dbQueries = 0;
  for (let i = 0; i < 100; i++) { const v = await dbFind('product:999999'); if (v !== null) cache.set('product:999999', v); }
  console.log(`  never caching "not found" : ${dbQueries} DB queries`);
  cache.clear(); dbQueries = 0;
  for (let i = 0; i < 100; i++) {
    if (cache.has('product:999999')) continue;                  // cached null counts as a hit
    cache.set('product:999999', await dbFind('product:999999'));  // store null with a short TTL in real life
  }
  console.log(`  caching null for 30 s      : ${dbQueries} DB query`);

  console.log('\n== 4. Avalanche: 10,000 keys loaded at 09:00 with TTL 3600 s ==');
  const r = rng(3);
  const bucket = (ttls: number[]) => {
    const perMin = new Map<number, number>();
    for (const t of ttls) { const m = Math.floor(t / 60); perMin.set(m, (perMin.get(m) ?? 0) + 1); }
    return Math.max(...perMin.values());
  };
  const same = Array(10_000).fill(3600);
  const jitter = Array.from({ length: 10_000 }, () => 3600 + Math.floor((r() * 2 - 1) * 360));
  console.log(`  same TTL     : peak ${bucket(same).toLocaleString()} keys expire in one minute (10:00 → DB spike)`);
  console.log(`  TTL ±10%     : peak ${bucket(jitter).toLocaleString()} keys per minute, spread over 12 minutes`);

  console.log('\n== 5. Sizing ==');
  const keys = 20_000_000, bytes = 500;
  console.log(`  ${keys.toLocaleString()} keys × ${bytes} B × 1.3 overhead = ${((keys * bytes * 1.3) / 1e9).toFixed(1)} GB → 2 shards of 8 GB, each with a replica`);
}

main();
