// H02 · Estimation calculator: assumptions in, numbers with formulas out, decisions at the end.
// Run: npx tsx hld/1-basics/H02-back-of-envelope/demo.ts

interface Assumptions {
  name: string;
  dau: number;            // daily active users
  writesPerUser: number;  // writes per user per day
  readsPerWrite: number;  // read:write ratio
  bytes: number;          // bytes per object
  years: number;          // retention
  replicas: number;
  peak: number;           // peak / average
  hotFraction: number;    // share of daily reads to cache (0..1)
}

// Per-node capacity: assumptions you would confirm with a load test.
const CAP = { apiPod: 5_000, pgPrimaryWrites: 5_000, redisOps: 100_000, redisGB: 100, utilisation: 0.6 };

const fmt = (n: number) => {
  for (const [v, s] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']] as const) if (n >= v) return `${(n / v).toPrecision(3)}${s}`;
  return n.toPrecision(3);
};
const bytes = (n: number) => {
  const u = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
  let i = 0;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return `${n.toPrecision(3)} ${u[i]}`;
};
const gbps = (bytesPerSec: number) => `${((bytesPerSec * 8) / 1e9).toPrecision(3)} Gbps`;
const nodes = (load: number, perNode: number) => Math.ceil(load / perNode / CAP.utilisation) + 1;

function estimate(a: Assumptions) {
  const writesDay = a.dau * a.writesPerUser;
  const readsDay = writesDay * a.readsPerWrite;
  const wAvg = writesDay / 86_400, wPeak = wAvg * a.peak;
  const rAvg = readsDay / 86_400, rPeak = rAvg * a.peak;
  const storage = writesDay * a.bytes * 365 * a.years * a.replicas;
  const egressPeak = rPeak * a.bytes;
  const cache = readsDay * a.hotFraction * a.bytes;
  return { writesDay, readsDay, wAvg, wPeak, rAvg, rPeak, storage, egressPeak, cache };
}

function report(a: Assumptions) {
  const r = estimate(a);
  console.log(`\n=== ${a.name} ===`);
  console.log(`assume: ${fmt(a.dau)} DAU × ${a.writesPerUser} writes, ${a.readsPerWrite}:1 reads, ${bytes(a.bytes)}, ${a.years}y, ×${a.replicas}, peak ×${a.peak}`);
  console.log(`writes  ${fmt(r.writesDay)}/day ÷ 86,400 = ${fmt(r.wAvg)}/s  → peak ${fmt(r.wPeak)}/s`);
  console.log(`reads   ${fmt(r.readsDay)}/day ÷ 86,400 = ${fmt(r.rAvg)}/s  → peak ${fmt(r.rPeak)}/s`);
  console.log(`storage ${fmt(r.writesDay)} × ${bytes(a.bytes)} × 365 × ${a.years} × ${a.replicas} = ${bytes(r.storage)}`);
  console.log(`egress  peak ${fmt(r.rPeak)}/s × ${bytes(a.bytes)} = ${bytes(r.egressPeak)}/s (${gbps(r.egressPeak)})`);
  console.log(`cache   ${fmt(r.readsDay)} × ${a.hotFraction * 100}% × ${bytes(a.bytes)} = ${bytes(r.cache)} (upper bound)`);

  const d: string[] = [];
  d.push(r.wPeak > CAP.pgPrimaryWrites
    ? `writes ${fmt(r.wPeak)}/s > ~${fmt(CAP.pgPrimaryWrites)}/s per primary → shard, or a write-scalable store`
    : `writes ${fmt(r.wPeak)}/s fit one primary`);
  d.push(a.bytes > 10_000 && r.rPeak > 10_000
    ? `reads ${fmt(r.rPeak)}/s of ${bytes(a.bytes)} blobs → edge cache (CDN), not Redis`
    : r.rPeak > 10_000
    ? `reads ${fmt(r.rPeak)}/s → cache first: ~${nodes(r.rPeak, CAP.redisOps)} Redis nodes by ops, ~${Math.ceil(r.cache / (CAP.redisGB * 1e9))} by memory`
    : `reads ${fmt(r.rPeak)}/s → read replicas are enough`);
  d.push(`API tier: ~${nodes(r.rPeak + r.wPeak, CAP.apiPod)} pods at ${CAP.utilisation * 100}% target`);
  d.push(r.storage > 10e12 ? `${bytes(r.storage)} → beyond one machine: shard / object storage / tiering` : `${bytes(r.storage)} fits one node`);
  if (r.egressPeak * 8 > 10e9) d.push(`${gbps(r.egressPeak)} egress → CDN in front`);
  d.forEach((x) => console.log('→ ' + x));
}

function main() {
  console.log('Shortcut check: 1B/day ÷ 10^5 =', 1e9 / 1e5, '/s (exact:', Math.round(1e9 / 86_400), '/s)');

  report({ name: 'URL shortener', dau: 100e6, writesPerUser: 1, readsPerWrite: 100, bytes: 500, years: 5, replicas: 3, peak: 3, hotFraction: 0.2 });
  report({ name: 'Twitter-like feed', dau: 150e6, writesPerUser: 2, readsPerWrite: 100, bytes: 1_000, years: 5, replicas: 3, peak: 2, hotFraction: 0.2 });
  report({ name: 'Chat (WhatsApp-like)', dau: 500e6, writesPerUser: 40, readsPerWrite: 1, bytes: 100, years: 1, replicas: 3, peak: 2.5, hotFraction: 0.05 });
  report({ name: 'Photo views (resized)', dau: 200e6, writesPerUser: 0.05, readsPerWrite: 100, bytes: 200_000, years: 3, replicas: 3, peak: 3, hotFraction: 0.1 });
  report({ name: 'Internal admin tool', dau: 200, writesPerUser: 50, readsPerWrite: 10, bytes: 2_000, years: 3, replicas: 2, peak: 3, hotFraction: 0.2 });
}

main();

export {};
