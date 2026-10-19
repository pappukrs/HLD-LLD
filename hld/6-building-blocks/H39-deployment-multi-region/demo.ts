// H39 · Deployment and DR: HPA on a traffic spike (reactive vs pre-scaled), canary analysis
// that aborts a bad version, and a region failover that computes RPO and RTO.
// Run: npx tsx hld/6-building-blocks/H39-deployment-multi-region/demo.ts

// ---- 1. HPA simulation ----
const POD_RPS = 200; // one pod at 100% CPU
const TARGET = 0.6; // HPA target utilisation
const POD_START_S = 60; // image pull + boot + warm-up

const trafficAt = (t: number) => (t >= 60 && t < 420 ? 4000 : 1000); // 4x spike from t=60 s to t=420 s

function simulate(label: string, minReplicas: (t: number) => number): void {
  let ready = Math.max(9, minReplicas(0));
  const starting: number[] = []; // ready-at times of pods that are booting
  const history: { t: number; want: number }[] = [];
  let dropped = 0;
  console.log(`  ${label}`);
  for (let t = 0; t <= 840; t += 15) {
    while (starting.length && starting[0] <= t) { starting.shift(); ready++; }
    const rps = trafficAt(t);
    const served = Math.min(rps, ready * POD_RPS);
    dropped += (rps - served) * 15;
    const util = Math.min(1, rps / (ready * POD_RPS)); // CPU cannot go above 100%
    if (!starting.length) { // wait for booting pods before deciding again
      let want = Math.min(50, Math.max(minReplicas(t), Math.ceil(ready * (util / TARGET))));
      history.push({ t, want });
      if (want < ready) want = Math.max(want, ...history.filter((h) => t - h.t <= 300).map((h) => h.want)); // 5-min window
      if (want > ready) for (let i = ready; i < want; i++) starting.push(t + POD_START_S);
      else ready = want;
    }
    if (t % 60 === 0) {
      console.log(`    t=${String(t).padStart(3)}s rps=${String(rps).padStart(4)} ready=${String(ready).padStart(2)} booting=${String(starting.length).padStart(2)} cpu=${String(Math.round(util * 100)).padStart(3)}%${served < rps ? `  OVERLOADED, ${rps - served} rps failing` : ''}`);
    }
  }
  console.log(`    total failed requests: ${dropped.toLocaleString()}`);
}

// ---- 2. Canary analysis ----
interface Stats { errorRate: number; p99: number; successRate: number }
function verdict(base: Stats, canary: Stats): string {
  if (canary.errorRate > base.errorRate * 1.5 + 0.001) return `ABORT (errors ${(canary.errorRate * 100).toFixed(2)}% vs ${(base.errorRate * 100).toFixed(2)}%)`;
  if (canary.p99 > base.p99 * 1.2) return `ABORT (p99 ${canary.p99} ms vs ${base.p99} ms)`;
  if (canary.successRate < base.successRate - 0.005) return `ABORT (payment success ${(canary.successRate * 100).toFixed(1)}%)`;
  return 'PROMOTE';
}
function rollout(version: string, canaryStats: (pct: number) => Stats): void {
  const base: Stats = { errorRate: 0.002, p99: 180, successRate: 0.962 };
  console.log(`  rolling out ${version}:`);
  for (const pct of [1, 10, 50, 100]) {
    const v = verdict(base, canaryStats(pct));
    console.log(`    ${String(pct).padStart(3)}% -> ${v}`);
    if (v !== 'PROMOTE') { console.log('    traffic to canary set to 0%; users affected only at this step'); return; }
  }
  console.log('    fully rolled out');
}

// ---- 3. Region failover ----
function failover(lagMs: number, writesPerSec: number, steps: [string, number][]): void {
  const lost = Math.round((lagMs / 1000) * writesPerSec);
  console.log(`  async replication lag at failure: ${lagMs} ms -> RPO ≈ ${lagMs / 1000} s ≈ ${lost} writes at ${writesPerSec}/s`);
  let t = 0;
  for (const [step, s] of steps) { t += s; console.log(`    +${String(s).padStart(4)}s  ${step.padEnd(42)} (t=${t}s)`); }
  console.log(`  RTO ≈ ${Math.round(t / 60)} min`);
}

function main(): void {
  console.log('== 1. HPA on a 4x spike (pod = 200 rps at 100% CPU, target 60%, pods boot in 60 s) ==');
  simulate('reactive only (minReplicas 2):', () => 2);
  simulate('scheduled pre-scale: minReplicas 34 from 10 min before the sale until it ends:', (t) => (t < 420 ? 34 : 2));

  console.log('\n== 2. Canary with automated analysis ==');
  rollout('v42 (good)', () => ({ errorRate: 0.0021, p99: 185, successRate: 0.961 }));
  rollout('v43 (bug in UPI flow)', (pct) => ({ errorRate: 0.0022, p99: 190, successRate: pct >= 10 ? 0.91 : 0.958 }));

  console.log('\n== 3. Region failover: Mumbai -> Hyderabad (warm standby) ==');
  failover(3000, 800, [
    ['detect: health checks fail 3 x 30 s', 90],
    ['human "go" decision (money system)', 300],
    ['fence old primary (revoke writes, epoch++)', 30],
    ['promote replica in Hyderabad', 60],
    ['flip DNS / global LB (TTL 60 s)', 60],
    ['scale standby compute to full size', 180],
  ]);
}

main();

export {};
