// H19 · Quorums, leaderless replication and Merkle trees
// Run: npx tsx hld/3-databases/H19-quorum-merkle/demo.ts
// 1) Stale-read rate for different N/W/R under random replica lag.
// 2) A failed quorum write that later "comes back".
// 3) Merkle-tree anti-entropy: find the one stale bucket out of 1024 with a few hash compares.
import { createHash } from 'node:crypto';
export {};

const header = (t: string) => console.log(`\n=== ${t} ===`);

// Small deterministic PRNG so the output is the same every run.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// ---- 1. Quorum simulation ----
// Each trial: a write goes to all N replicas but only some arrive before the read starts
// (each replica independently "lags" with probability pLag). The write succeeds once W acked.
// The read asks R random replicas and returns the highest version it sees.
function staleReadRate(n: number, w: number, r: number, pLag: number, trials = 20000): { stale: number; failedWrites: number } {
  const rand = rng(42 + n * 100 + w * 10 + r);
  let stale = 0, failed = 0, done = 0;
  for (let t = 0; t < trials; t++) {
    const has = Array.from({ length: n }, () => rand() >= pLag); // true = replica already has v2
    if (has.filter(Boolean).length < w) { failed++; continue; } // client got an error
    done++;
    const ids = Array.from({ length: n }, (_, i) => i).sort(() => rand() - 0.5).slice(0, r);
    if (!ids.some((i) => has[i])) stale++;
  }
  return { stale: stale / Math.max(done, 1), failedWrites: failed / trials };
}

// ---- 3. Merkle tree ----
const h = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 12);

function buildTree(buckets: string[]): string[][] {
  const levels: string[][] = [buckets.map(h)];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) next.push(h(prev[i] + (prev[i + 1] ?? '')));
    levels.push(next);
  }
  return levels; // levels[0] = leaves, last = [root]
}

// Walk down from the root, visiting only children whose hashes differ.
function diff(a: string[][], b: string[][]): { buckets: number[]; compares: number } {
  let compares = 0;
  const out: number[] = [];
  const walk = (level: number, idx: number) => {
    compares++;
    if (a[level][idx] === b[level][idx]) return;
    if (level === 0) { out.push(idx); return; }
    walk(level - 1, idx * 2);
    if (idx * 2 + 1 < a[level - 1].length) walk(level - 1, idx * 2 + 1);
  };
  walk(a.length - 1, 0);
  return { buckets: out, compares };
}

function main(): void {
  header('1. Stale reads vs N/W/R (each replica lags with 30% chance)');
  console.log('N W R  R+W>N  stale reads  writes that failed (< W acks)');
  for (const [n, w, r] of [[3, 1, 1], [3, 2, 1], [3, 2, 2], [3, 1, 3], [3, 3, 1], [5, 3, 3]]) {
    const { stale, failedWrites } = staleReadRate(n, w, r, 0.3);
    console.log(`${n} ${w} ${r}  ${String(r + w > n).padEnd(5)}  ${(stale * 100).toFixed(1).padStart(6)}%     ${(failedWrites * 100).toFixed(1).padStart(5)}%`);
  }
  console.log('→ R+W>N drives stale reads to 0%. Higher W makes more writes fail when replicas lag.');

  header('2. A failed write is not rolled back (N=3, W=2)');
  const replicas = [{ v: 1 }, { v: 1 }, { v: 1 }];
  replicas[0].v = 2; // only R1 acked before timeout
  console.log('write v2: 1 ack < W=2 → client gets an ERROR');
  console.log('replicas now:', replicas.map((x, i) => `R${i + 1}=v${x.v}`).join(' '));
  const read = Math.max(replicas[0].v, replicas[1].v); // a later read with R=2 hits R1, R2
  console.log(`later read (R1,R2) returns v${read} → the "failed" write is visible. Retries must be idempotent.`);

  header('3. Merkle anti-entropy over 1024 buckets');
  const BUCKETS = 1024;
  const r1 = Array.from({ length: BUCKETS }, (_, i) => `bucket-${i}:keys-v1`);
  const r2 = [...r1];
  r2[731] = 'bucket-731:keys-v0'; // R2 missed a write in one bucket
  const t1 = buildTree(r1), t2 = buildTree(r2);
  console.log(`tree depth: ${t1.length - 1} levels, root R1=${t1[t1.length - 1][0]} R2=${t2[t2.length - 1][0]}`);
  const { buckets, compares } = diff(t1, t2);
  console.log(`differing buckets: [${buckets.join(', ')}] found with ${compares} hash compares (vs ${BUCKETS} leaf compares)`);
  r2[731] = r1[731];
  const t2b = buildTree(r2);
  console.log(`after streaming bucket 731: roots equal = ${t1[t1.length - 1][0] === t2b[t2b.length - 1][0]}`);

  header('Takeaway');
  console.log('N=3, W=2, R=2: survive 1 node down, reads overlap writes.');
  console.log('Read repair for hot keys, hinted handoff for short outages, Merkle trees for the rest.');
}

main();
