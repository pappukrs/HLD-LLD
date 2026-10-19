// H16 · Partitioning and sharding: a small simulation.
// Run: npx tsx hld/3-databases/H16-partitioning-sharding/demo.ts

export {};

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const header = (t: string) => console.log(`\n=== ${t} ===`);
const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(1)}%`;

function spread(counts: number[]): string {
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((c, i) => `s${i}=${pct(c, total)}`).join('  ');
}

// 1. Range on time vs hash on device_id for IoT telemetry writes.
function hotspot(): void {
  header('1. IoT writes for "today": range on time vs hash on device_id');
  const shards = 4;
  const byTime = new Array(shards).fill(0);
  const byDevice = new Array(shards).fill(0);
  // Range on month: Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec. Every new reading is "today" (October).
  const todayShard = 3;
  for (let i = 0; i < 100_000; i++) {
    const deviceId = `dev-${i % 10_000}`;
    byTime[todayShard]++;
    byDevice[fnv1a(deviceId) % shards]++;
  }
  console.log('range(created_at):', spread(byTime), ' <- one hot shard');
  console.log('hash(device_id):  ', spread(byDevice), ' <- even');
}

// 2. Adding a node: hash % N vs fixed logical partitions.
function rebalance(): void {
  header('2. Add a 5th node: hash % N vs 1024 logical shards');
  const keys = Array.from({ length: 50_000 }, (_, i) => `user:${i}`);
  const movedMod = keys.filter((k) => fnv1a(k) % 4 !== fnv1a(k) % 5).length;
  console.log(`hash % N (4 -> 5): ${movedMod} of ${keys.length} keys move (${pct(movedMod, keys.length)})`);

  const LOGICAL = 1024;
  const owner: number[] = Array.from({ length: LOGICAL }, (_, p) => p % 4);
  const before = keys.map((k) => owner[fnv1a(k) % LOGICAL]);
  // New node 4 steals logical shards evenly from the other four (about 1/5 of all).
  const perNodeTarget = Math.floor(LOGICAL / 5);
  const taken = [0, 0, 0, 0];
  let stolen = 0;
  for (let p = 0; p < LOGICAL && stolen < perNodeTarget; p++) {
    const from = owner[p];
    if (taken[from] < perNodeTarget / 4) {
      owner[p] = 4;
      taken[from]++;
      stolen++;
    }
  }
  const after = keys.map((k) => owner[fnv1a(k) % LOGICAL]);
  const movedFixed = keys.filter((_, i) => before[i] !== after[i]).length;
  console.log(`fixed partitions: ${stolen} of ${LOGICAL} logical shards moved; ${movedFixed} keys move (${pct(movedFixed, keys.length)})`);
  console.log('key -> logical shard never changed; only the logical -> node map did.');
}

// 3. Hot key: even keys, uneven traffic. Then salt it.
function hotKey(): void {
  header('3. Hot key: hashing spreads keys, not traffic');
  const shards = 8;
  const load = new Array(shards).fill(0);
  const requests = 100_000;
  for (let i = 0; i < requests; i++) {
    // 30% of reads hit one flash-sale product.
    const key = i % 10 < 3 ? 'product:iphone' : `product:${i % 5000}`;
    load[fnv1a(key) % shards]++;
  }
  const max = Math.max(...load);
  console.log('per-shard requests:', load.join(' '));
  console.log(`hottest shard gets ${pct(max, requests)} (fair share is ${pct(1, shards)})`);

  const salted = new Array(shards).fill(0);
  const SALTS = 16;
  for (let i = 0; i < requests; i++) {
    const key = i % 10 < 3 ? `product:iphone#${i % SALTS}` : `product:${i % 5000}`;
    salted[fnv1a(key) % shards]++;
  }
  console.log(`after salting into ${SALTS} sub-keys, hottest shard: ${pct(Math.max(...salted), requests)}`);
  console.log('cost: a read of the full counter must sum 16 sub-keys.');
}

// 4. Single-shard query vs scatter-gather latency.
function scatterGather(): void {
  header('4. Scatter-gather: latency = slowest shard');
  // Deterministic pseudo-random latency: most calls 5 ms, 1% take 120 ms.
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const shardLatency = () => (rand() < 0.01 ? 120 : 4 + rand() * 2);
  for (const fanout of [1, 10, 100]) {
    const samples: number[] = [];
    for (let q = 0; q < 2000; q++) {
      let worst = 0;
      for (let s = 0; s < fanout; s++) worst = Math.max(worst, shardLatency());
      samples.push(worst);
    }
    samples.sort((a, b) => a - b);
    const p50 = samples[Math.floor(samples.length * 0.5)];
    const p99 = samples[Math.floor(samples.length * 0.99)];
    console.log(`fan-out ${String(fanout).padStart(3)} shards: p50=${p50.toFixed(0)} ms  p99=${p99.toFixed(0)} ms`);
  }
  console.log('Lesson: keep hot queries on one shard by putting the shard key in them.');
}

// 5. Directory override for a whale tenant.
function directory(): void {
  header('5. Directory override: give a whale merchant its own shard');
  const directoryMap = new Map<string, string>([['merchant:bigbazaar', 'dedicated-1']]);
  const route = (m: string) => directoryMap.get(m) ?? `node-${fnv1a(m) % 1024 % 4}`;
  for (const m of ['merchant:chai-point', 'merchant:bigbazaar', 'merchant:dental-clinic']) {
    console.log(`${m.padEnd(24)} -> ${route(m)}`);
  }
}

function main(): void {
  console.log('H16 Partitioning and sharding');
  hotspot();
  rebalance();
  hotKey();
  scatterGather();
  directory();
}

main();
