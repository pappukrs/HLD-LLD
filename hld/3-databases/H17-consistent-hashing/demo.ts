// H17 · Consistent hashing: modulo vs ring vs ring + virtual nodes, measured on 100k keys.
// Run from the repo root: npx tsx hld/3-databases/H17-consistent-hashing/demo.ts

/** FNV-1a 32-bit + murmur3 finalizer. Good enough mixing for "node#1" vs "node#2". */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

class Ring {
  private points: { pos: number; node: string }[] = [];
  constructor(private readonly vnodes: number) {}

  add(node: string): void {
    for (let i = 0; i < this.vnodes; i++) this.points.push({ pos: hash32(`${node}#${i}`), node });
    this.points.sort((a, b) => a.pos - b.pos);
  }
  remove(node: string): void {
    this.points = this.points.filter((p) => p.node !== node);
  }
  /** Lower-bound binary search: first point with pos >= hash(key), wrapping to index 0. */
  private index(key: string): number {
    const h = hash32(key);
    let lo = 0, hi = this.points.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.points[mid].pos < h) lo = mid + 1;
      else hi = mid;
    }
    return lo === this.points.length ? 0 : lo;
  }
  owner(key: string): string {
    return this.points[this.index(key)].node;
  }
  /** Dynamo-style preference list: next n DISTINCT physical nodes clockwise. */
  replicas(key: string, n: number): string[] {
    const out: string[] = [];
    for (let i = this.index(key), steps = 0; out.length < n && steps < this.points.length; i = (i + 1) % this.points.length, steps++) {
      const node = this.points[i].node;
      if (!out.includes(node)) out.push(node);
    }
    return out;
  }
}

const KEYS = Array.from({ length: 100_000 }, (_, i) => `user:${i}`);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function movedShare(before: (k: string) => string, after: (k: string) => string): number {
  let moved = 0;
  for (const k of KEYS) if (before(k) !== after(k)) moved++;
  return moved / KEYS.length;
}

function spread(owner: (k: string) => string, nodes: string[]): { max: number; min: number } {
  const counts = new Map<string, number>(nodes.map((n) => [n, 0]));
  for (const k of KEYS) counts.set(owner(k), (counts.get(owner(k)) ?? 0) + 1);
  const avg = KEYS.length / nodes.length;
  const vals = [...counts.values()];
  return { max: Math.max(...vals) / avg, min: Math.min(...vals) / avg };
}

function main(): void {
  const nodes = ['cache-a', 'cache-b', 'cache-c', 'cache-d'];

  console.log('== 1. hash % N: add a 5th cache node ==');
  const mod = (n: number) => (k: string) => `node-${hash32(k) % n}`;
  console.log(`  keys that change node going 4 -> 5: ${pct(movedShare(mod(4), mod(5)))} (theory: 1 - 1/5 = 80%)`);
  console.log(`  keys that change node going 10 -> 9: ${pct(movedShare(mod(10), mod(9)))} (one node died)`);

  console.log('\n== 2. Ring: add a 5th node (ideal share for the new node = 1/5 = 20%) ==');
  for (const v of [1, 150]) {
    const before = new Ring(v), after = new Ring(v);
    nodes.forEach((n) => { before.add(n); after.add(n); });
    after.add('cache-e');
    const moved = movedShare((k) => before.owner(k), (k) => after.owner(k));
    const allToNew = KEYS.every((k) => before.owner(k) === after.owner(k) || after.owner(k) === 'cache-e');
    console.log(`  vnodes=${String(v).padStart(3)}: moved ${pct(moved)}, all to cache-e: ${allToNew}`);
  }

  console.log('  With 1 vnode the new node lands on one random arc, so its share is luck. Vnodes make it ~1/N.');
  console.log('\n== 3. Load balance vs vnodes per server (4 nodes, max/min load as x of average) ==');
  for (const v of [1, 10, 50, 150, 500]) {
    const r = new Ring(v);
    nodes.forEach((n) => r.add(n));
    const s = spread((k) => r.owner(k), nodes);
    console.log(`  vnodes=${String(v).padStart(3)}: busiest ${s.max.toFixed(2)}x, idlest ${s.min.toFixed(2)}x`);
  }

  console.log('\n== 4. cache-b dies: who absorbs its keys? ==');
  for (const v of [1, 150]) {
    const r = new Ring(v);
    nodes.forEach((n) => r.add(n));
    const victims = KEYS.filter((k) => r.owner(k) === 'cache-b');
    r.remove('cache-b');
    const takers = new Map<string, number>();
    for (const k of victims) takers.set(r.owner(k), (takers.get(r.owner(k)) ?? 0) + 1);
    const parts = [...takers].map(([n, c]) => `${n} ${pct(c / victims.length)}`).join(', ');
    console.log(`  vnodes=${String(v).padStart(3)}: ${victims.length} keys -> ${parts}`);
  }
  console.log('  1 vnode: one neighbour takes 100% of the dead node\'s load. 150 vnodes: ~1/3 each.');

  console.log('\n== 5. Replication: preference list (next 3 distinct physical nodes) ==');
  const r = new Ring(150);
  [...nodes, 'cache-e'].forEach((n) => r.add(n));
  for (const k of ['user:42', 'order:9001', 'session:abc']) console.log(`  ${k.padEnd(12)} -> [${r.replicas(k, 3).join(', ')}]`);

  console.log('\n== 6. Lookup cost ==');
  const points = 100 * 150;
  console.log(`  100 servers x 150 vnodes = ${points} points -> binary search ~${Math.ceil(Math.log2(points))} comparisons per lookup`);
  console.log(`  ring memory ~ ${points} x 16 B = ${((points * 16) / 1024).toFixed(0)} KB: every client can hold a copy`);
}

main();

export {};
