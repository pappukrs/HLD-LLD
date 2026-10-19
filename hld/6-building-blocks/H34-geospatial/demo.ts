// H34 · Geospatial: geohash and quadtree
// Run: npx tsx hld/6-building-blocks/H34-geospatial/demo.ts
// A tiny "drivers near me" service: geohash cells + 9-cell search + haversine,
// compared with a brute-force scan, and a quadtree that adapts to density.

export {}; // module scope: keeps main() local to this file

const B32 = '0123456789bcdefghjkmnpqrstuvwxyz';

interface Point { id: string; lat: number; lon: number }

function encode(lat: number, lon: number, len: number): string {
  let la: [number, number] = [-90, 90], lo: [number, number] = [-180, 180];
  let out = '', bits = 0, ch = 0, even = true;
  while (out.length < len) {
    const r = even ? lo : la, v = even ? lon : lat, mid = (r[0] + r[1]) / 2;
    if (v >= mid) { ch = ch * 2 + 1; r[0] = mid; } else { ch = ch * 2; r[1] = mid; }
    even = !even;
    if (++bits === 5) { out += B32[ch]; bits = 0; ch = 0; }
  }
  return out;
}

function decode(hash: string) {
  const la = [-90, 90], lo = [-180, 180];
  let even = true;
  for (const c of hash) {
    const v = B32.indexOf(c);
    for (let b = 4; b >= 0; b--) {
      const r = even ? lo : la, mid = (r[0] + r[1]) / 2;
      if ((v >> b) & 1) r[0] = mid; else r[1] = mid;
      even = !even;
    }
  }
  return { lat: (la[0] + la[1]) / 2, lon: (lo[0] + lo[1]) / 2, dLat: la[1] - la[0], dLon: lo[1] - lo[0] };
}

// The 8 neighbours: move the centre by one cell and encode again.
function nineCells(hash: string): string[] {
  const c = decode(hash), out: string[] = [];
  for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
    out.push(encode(c.lat + dy * c.dLat, c.lon + dx * c.dLon, hash.length));
  }
  return out;
}

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371, t = Math.PI / 180;
  const dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Deterministic random numbers so every run prints the same thing.
let seed = 42;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

function main(): void {
  const rider = { lat: 12.9716, lon: 77.5946 }; // MG Road, Bengaluru
  console.log('=== 1. Encode the rider ===');
  for (const len of [3, 5, 6, 7]) {
    const d = decode(encode(rider.lat, rider.lon, len));
    const h = (d.dLat * 111).toFixed(2), w = (d.dLon * 111 * Math.cos((rider.lat * Math.PI) / 180)).toFixed(2);
    console.log(`  length ${len}: ${encode(rider.lat, rider.lon, len).padEnd(8)} cell ≈ ${w} km wide × ${h} km tall`);
  }

  // 20,000 drivers: 70% packed in a 10 km downtown box, 30% spread over a 60 km box.
  const drivers: Point[] = [];
  for (let i = 0; i < 20000; i++) {
    const spread = i % 10 < 7 ? 0.045 : 0.27;
    drivers.push({ id: 'D' + i, lat: rider.lat + (rand() - 0.5) * 2 * spread, lon: rider.lon + (rand() - 0.5) * 2 * spread });
  }

  console.log('\n=== 2. Index: cell -> drivers (like Redis GEO / a geohash column) ===');
  const LEN = 5;
  const index = new Map<string, Point[]>();
  for (const d of drivers) {
    const h = encode(d.lat, d.lon, LEN);
    (index.get(h) ?? index.set(h, []).get(h)!).push(d);
  }
  const home = encode(rider.lat, rider.lon, LEN);
  console.log(`  ${drivers.length} drivers in ${index.size} cells. Rider cell = ${home}`);

  console.log('\n=== 3. Search within 2 km ===');
  const RADIUS = 2;
  const onlyHome = (index.get(home) ?? []).filter((d) => km(rider, d) <= RADIUS);
  const cells = nineCells(home);
  const candidates = cells.flatMap((c) => index.get(c) ?? []);
  const nine = candidates.filter((d) => km(rider, d) <= RADIUS).sort((a, b) => km(rider, a) - km(rider, b));
  const brute = drivers.filter((d) => km(rider, d) <= RADIUS);
  console.log(`  only my cell     : ${onlyHome.length} found`);
  console.log(`  9 cells          : read ${candidates.length} candidates, ${nine.length} within ${RADIUS} km`);
  console.log(`  brute force scan : read ${drivers.length} rows, ${brute.length} within ${RADIUS} km`);
  console.log(`  9-cell result matches brute force: ${nine.length === brute.length}`);
  console.log(`  nearest 3: ${nine.slice(0, 3).map((d) => `${d.id} ${km(rider, d).toFixed(2)} km`).join(', ')}`);

  console.log('\n=== 4. The edge problem ===');
  const c = decode(home);
  const east = c.lon + c.dLon / 2; // east border of the rider's cell
  const a = { lat: c.lat, lon: east - 0.00005 }, b = { lat: c.lat, lon: east + 0.00005 };
  console.log(`  two points ${(km(a, b) * 1000).toFixed(0)} m apart: ${encode(a.lat, a.lon, 7)} vs ${encode(b.lat, b.lon, 7)}`);
  console.log('  different cells, so a prefix-only query would miss one of them.');

  console.log('\n=== 5. Quadtree: split a box only when it holds > 50 drivers ===');
  type QNode = { pts: Point[]; depth: number; kids?: QNode[] };
  const CAP = 50;
  let leaves = 0, maxDepth = 0;
  function build(pts: Point[], la0: number, la1: number, lo0: number, lo1: number, depth: number): QNode {
    const n: QNode = { pts, depth };
    if (pts.length <= CAP || depth >= 12) { leaves++; maxDepth = Math.max(maxDepth, depth); return n; }
    const lm = (la0 + la1) / 2, om = (lo0 + lo1) / 2;
    const q = (p: Point) => (p.lat >= lm ? 2 : 0) + (p.lon >= om ? 1 : 0);
    n.kids = [0, 1, 2, 3].map((i) => build(pts.filter((p) => q(p) === i),
      i >= 2 ? lm : la0, i >= 2 ? la1 : lm, i % 2 ? om : lo0, i % 2 ? lo1 : om, depth + 1));
    return n;
  }
  build(drivers, rider.lat - 0.3, rider.lat + 0.3, rider.lon - 0.3, rider.lon + 0.3, 0);
  const sizes = [...index.values()].map((v) => v.length);
  console.log(`  fixed grid (length ${LEN}): busiest cell ${Math.max(...sizes)} drivers, quietest ${Math.min(...sizes)}`);
  console.log(`  quadtree: ${leaves} leaves, max depth ${maxDepth}, every leaf <= ${CAP} drivers`);

  console.log('\n=== 6. Back of the envelope for live locations ===');
  const active = 500_000, every = 4, bytes = 50;
  console.log(`  ${active.toLocaleString()} drivers / ${every} s = ${(active / every).toLocaleString()} writes per second`);
  console.log(`  memory: ${active.toLocaleString()} x ${bytes} B = ${((active * bytes) / 1e6).toFixed(0)} MB, fits in one Redis shard per city`);
  console.log('  So: Redis GEO for "where is everyone now", Kafka + a store for history.');
}

main();
