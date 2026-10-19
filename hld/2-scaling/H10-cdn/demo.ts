// H10 · CDN: edge PoPs, origin shield, cache keys, purge vs versioned URLs, latency math.
// Run: npx tsx hld/2-scaling/H10-cdn/demo.ts
export {};

function rng(seed: number) {
  let x = seed >>> 0;
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

type Entry = { body: string; expiresAt: number };
class Cache {
  private m = new Map<string, Entry>();
  hits = 0; misses = 0;
  constructor(readonly name: string) {}
  get(key: string, now: number) {
    const e = this.m.get(key);
    if (e && e.expiresAt > now) { this.hits++; return e.body; }
    this.misses++;
    return undefined;
  }
  set(key: string, body: string, ttl: number, now: number) { this.m.set(key, { body, expiresAt: now + ttl }); }
  purge(prefix: string) { for (const k of [...this.m.keys()]) if (k.startsWith(prefix)) this.m.delete(k); }
}

let originHits = 0;
const originFiles = new Map<string, string>([['/img/logo.png', 'logo-v1'], ['/css/style.css', 'css-v1']]);
function origin(path: string) { originHits++; return originFiles.get(path.split('?')[0]) ?? '404'; }

// Edge → (optional shield) → origin, with a TTL from Cache-Control: s-maxage.
function fetchVia(edge: Cache, shield: Cache | null, key: string, path: string, now: number, ttl = 3600) {
  const hit = edge.get(key, now);
  if (hit) return hit;
  let body = shield?.get(key, now);
  if (!body) { body = origin(path); shield?.set(key, body, ttl, now); }
  edge.set(key, body, ttl, now);
  return body;
}

function main() {
  const objects = Array.from({ length: 200 }, (_, i) => `/img/p${i}.jpg`);
  for (const o of objects) originFiles.set(o, `bytes(${o})`);

  console.log('\n== 1. 3 PoPs, 30k requests for 200 images (a viral image is 30% of traffic) ==');
  for (const withShield of [false, true]) {
    originHits = 0;
    const r = rng(11);
    const pops = ['Chennai', 'Mumbai', 'Delhi'].map((n) => new Cache(n));
    const shield = withShield ? new Cache('shield-Mumbai') : null;
    for (let i = 0; i < 30_000; i++) {
      const path = r() < 0.3 ? objects[0] : objects[Math.floor(r() * objects.length)];
      fetchVia(pops[i % 3], shield, path, path, i, 1e9);
    }
    const hits = pops.reduce((s, p) => s + p.hits, 0);
    console.log(`  ${withShield ? 'with shield   ' : 'without shield'}: edge hit ${((hits / 30_000) * 100).toFixed(1)}%, origin fetches ${originHits} (${withShield ? '1 per object' : '1 per object per PoP'})`);
  }

  console.log('\n== 2. Cache key: keep ?utm_* in the key vs strip it ==');
  for (const strip of [false, true]) {
    originHits = 0;
    const r = rng(5);
    const edge = new Cache('edge');
    for (let i = 0; i < 10_000; i++) {
      const path = objects[Math.floor(r() * 20)];
      const url = `${path}?utm_source=ad${Math.floor(r() * 50)}`;
      const key = strip ? path : url;
      fetchVia(edge, null, key, url, i, 1e9);
    }
    console.log(`  ${strip ? 'key = path only        ' : 'key = path + utm param '}: hit ${((edge.hits / 10_000) * 100).toFixed(1)}%, origin fetches ${originHits}`);
  }

  console.log('\n== 3. Ship a CSS fix: purge vs content-hashed file name ==');
  const edge = new Cache('edge');
  fetchVia(edge, null, '/css/style.css', '/css/style.css', 0, 86_400);
  originFiles.set('/css/style.css', 'css-v2');
  console.log(`  fixed name, before purge : edge serves ${fetchVia(edge, null, '/css/style.css', '/css/style.css', 10, 86_400)} (stale for up to a day)`);
  edge.purge('/css/');
  console.log(`  after purge (seconds-min): edge serves ${fetchVia(edge, null, '/css/style.css', '/css/style.css', 20, 86_400)}, but every PoP misses at once`);
  originFiles.set('/css/style.8c1d.css', 'css-v3');
  console.log(`  hashed name style.8c1d.css: new URL → ${fetchVia(edge, null, '/css/style.8c1d.css', '/css/style.8c1d.css', 30, 31_536_000)} immediately; old file never conflicts; cache 1 year`);

  console.log('\n== 4. Latency for a user in Bengaluru (first HTTPS request, new connection) ==');
  const rttOrigin = 230, rttEdge = 12;
  const rounds = 3; // TCP handshake + TLS 1.3 + HTTP request
  console.log(`  straight to us-east-1 origin : ${rounds} × ${rttOrigin} ms = ${rounds * rttOrigin} ms`);
  console.log(`  edge HIT                     : ${rounds} × ${rttEdge} ms = ${rounds * rttEdge} ms`);
  console.log(`  edge MISS (warm conn to origin): ${rounds * rttEdge} + ${rttOrigin} = ${rounds * rttEdge + rttOrigin} ms  ← even uncacheable APIs get faster`);

  console.log('\n== 5. Bandwidth: live match, 10M viewers at 5 Mbps ==');
  const tbps = (10_000_000 * 5) / 1_000_000;
  for (const hit of [0.9, 0.99, 0.999]) {
    console.log(`  hit ${(hit * 100).toFixed(1).padStart(5)}%: edges serve ${tbps} Tbps, origin serves ${(tbps * (1 - hit) * 1000).toFixed(0)} Gbps`);
  }
}

main();
