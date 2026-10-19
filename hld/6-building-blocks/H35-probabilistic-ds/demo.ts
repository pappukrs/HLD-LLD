// H35 · Bloom filter, HyperLogLog, Count-Min sketch
// Run: npx tsx hld/6-building-blocks/H35-probabilistic-ds/demo.ts
// Three small simulations: measured error vs theory, and memory vs an exact structure.

export {}; // module scope: keeps main() local to this file

// 32-bit FNV-1a with a seed + murmur finaliser. Good enough spread for a demo.
function hash32(s: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// ---------- Bloom filter: double hashing, h1 + i*h2 ----------
class BloomFilter {
  private bits: Uint8Array;
  readonly m: number;
  readonly k: number;
  constructor(n: number, p: number) {
    this.m = Math.ceil((-n * Math.log(p)) / Math.LN2 ** 2);
    this.k = Math.max(1, Math.round((this.m / n) * Math.LN2));
    this.bits = new Uint8Array(Math.ceil(this.m / 8));
  }
  private *positions(x: string) {
    const h1 = hash32(x, 1), h2 = (hash32(x, 2) | 1) >>> 0; // >>> 0 keeps it unsigned
    for (let i = 0; i < this.k; i++) yield (h1 + i * h2) % this.m;
  }
  add(x: string): void { for (const b of this.positions(x)) this.bits[b >> 3] |= 1 << (b & 7); }
  mightContain(x: string): boolean {
    for (const b of this.positions(x)) if (!(this.bits[b >> 3] & (1 << (b & 7)))) return false;
    return true;
  }
  get bytes(): number { return this.bits.length; }
}

// ---------- Count-Min sketch ----------
class CountMin {
  private rows: Uint32Array[];
  total = 0;
  constructor(readonly width: number, readonly depth: number) {
    this.rows = Array.from({ length: depth }, () => new Uint32Array(width));
  }
  add(x: string, n = 1): void {
    this.total += n;
    for (let r = 0; r < this.depth; r++) this.rows[r][hash32(x, 100 + r) % this.width] += n;
  }
  estimate(x: string): number {
    let min = Infinity;
    for (let r = 0; r < this.depth; r++) min = Math.min(min, this.rows[r][hash32(x, 100 + r) % this.width]);
    return min;
  }
}

// ---------- HyperLogLog ----------
class HyperLogLog {
  readonly regs: Uint8Array;
  constructor(readonly p: number) { this.regs = new Uint8Array(1 << p); }
  add(x: string): void {
    const h = hash32(x, 7), idx = h >>> (32 - this.p), rest = (h << this.p) >>> 0;
    const rank = Math.min(Math.clz32(rest) + 1, 32 - this.p + 1);
    if (rank > this.regs[idx]) this.regs[idx] = rank;
  }
  count(): number {
    const m = this.regs.length, alpha = 0.7213 / (1 + 1.079 / m);
    let sum = 0, zeros = 0;
    for (const r of this.regs) { sum += 2 ** -r; if (r === 0) zeros++; }
    const e = (alpha * m * m) / sum;
    return e <= 2.5 * m && zeros > 0 ? m * Math.log(m / zeros) : e;
  }
  merge(o: HyperLogLog): void { for (let i = 0; i < this.regs.length; i++) this.regs[i] = Math.max(this.regs[i], o.regs[i]); }
}

const pct = (x: number) => (x * 100).toFixed(2) + '%';

function main(): void {
  console.log('=== 1. Bloom filter: "is this username taken?" ===');
  const n = 100_000;
  for (const p of [0.01, 0.001]) {
    const bf = new BloomFilter(n, p);
    for (let i = 0; i < n; i++) bf.add('user' + i);
    let fn = 0, fp = 0;
    for (let i = 0; i < n; i++) if (!bf.mightContain('user' + i)) fn++;
    const probes = 200_000;
    for (let i = 0; i < probes; i++) if (bf.mightContain('nobody' + i)) fp++;
    console.log(`  target ${pct(p)}: m=${bf.m.toLocaleString()} bits (${(bf.m / n).toFixed(1)} bits/item), k=${bf.k}, ` +
      `${(bf.bytes / 1024).toFixed(0)} KB`);
    console.log(`    false negatives: ${fn} (always 0)   measured false positives: ${pct(fp / probes)}`);
  }
  const exact = n * (8 + 40); // rough: 8-byte pointer + ~40-byte string per entry in a Set
  console.log(`  a Set<string> of the same ${n.toLocaleString()} names: ~${(exact / 1024 / 1024).toFixed(1)} MB`);
  console.log('  So: "no" skips the DB; "maybe" does one real lookup.');

  console.log('\n=== 2. Count-Min sketch: trending hashtags ===');
  // Zipf-like stream: tag #i appears about 20000/i times.
  const truth = new Map<string, number>();
  const eps = 0.001, delta = 0.01;
  const cm = new CountMin(Math.ceil(Math.E / eps), Math.ceil(Math.log(1 / delta)));
  for (let i = 1; i <= 5000; i++) {
    const c = Math.max(1, Math.floor(20000 / i));
    truth.set('#tag' + i, c);
    cm.add('#tag' + i, c);
  }
  console.log(`  ${truth.size} tags, N = ${cm.total.toLocaleString()} events, sketch ${cm.width} x ${cm.depth} = ` +
    `${((cm.width * cm.depth * 4) / 1024).toFixed(0)} KB`);
  let under = 0, worst = 0;
  for (const [t, c] of truth) { const e = cm.estimate(t); if (e < c) under++; worst = Math.max(worst, e - c); }
  console.log(`  undercounts: ${under} (always 0)   worst overcount: ${worst}   bound eps*N = ${Math.round(eps * cm.total)}`);
  for (const t of ['#tag1', '#tag10', '#tag4999']) console.log(`    ${t.padEnd(9)} true ${String(truth.get(t)).padStart(6)}  estimate ${cm.estimate(t)}`);
  // Top-k with a size-3 "heap" (an array is enough for k = 3).
  const top: { t: string; e: number }[] = [];
  for (const t of truth.keys()) {
    const e = cm.estimate(t);
    if (top.length < 3) top.push({ t, e }); else if (e > top[2].e) top[2] = { t, e };
    top.sort((a, b) => b.e - a.e);
  }
  console.log(`  top 3 trending: ${top.map((x) => `${x.t}≈${x.e}`).join(', ')}`);

  console.log('\n=== 3. HyperLogLog: unique visitors ===');
  const hourA = new HyperLogLog(14), hourB = new HyperLogLog(14);
  for (let i = 0; i < 60_000; i++) hourA.add('visitor' + i);           // visitors 0..59,999
  for (let i = 40_000; i < 120_000; i++) hourB.add('visitor' + i);     // visitors 40,000..119,999
  const show = (label: string, est: number, real: number) =>
    console.log(`  ${label.padEnd(22)} real ${real.toLocaleString().padStart(7)}  estimate ${Math.round(est).toLocaleString().padStart(7)}  error ${pct((est - real) / real)}`);
  show('hour A', hourA.count(), 60_000);
  show('hour B', hourB.count(), 80_000);
  console.log(`  naive A + B = ${(60_000 + 80_000).toLocaleString()} double-counts the 20,000 who came both hours`);
  hourA.merge(hourB);
  show('merge(A, B) = union', hourA.count(), 120_000);
  console.log(`  memory: ${hourA.regs.length.toLocaleString()} registers x 6 bits = 12 KB (Redis PFADD/PFCOUNT/PFMERGE)`);
  console.log(`  theory: standard error 1.04/sqrt(m) = ${pct(1.04 / Math.sqrt(hourA.regs.length))}`);
}

main();
