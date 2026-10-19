// H01 · A mock-round timer: walks the 45-minute HLD framework for a problem and flags overruns.
// Run: npx tsx hld/1-basics/H01-approach-hld-round/demo.ts

interface Phase { name: string; mins: number; outputs: readonly string[] }
const PHASES: readonly Phase[] = [
  { name: 'Requirements', mins: 5, outputs: ['3-5 functional', 'non-functional (scale, p99, consistency)', 'out of scope'] },
  { name: 'Estimation', mins: 5, outputs: ['peak QPS', 'storage per year', 'read:write ratio'] },
  { name: 'API + data model', mins: 5, outputs: ['3-5 endpoints', 'entities + lookup key'] },
  { name: 'High-level design', mins: 10, outputs: ['one diagram', 'walk 1 write + 1 read'] },
  { name: 'Deep dives', mins: 15, outputs: ['2-3 problem-specific parts'] },
  { name: 'Wrap-up', mins: 5, outputs: ['SPOFs', 'what breaks at 10x', 'metrics + alerts'] },
];

interface Problem {
  name: string;
  questions: string[];
  dau: number; actionsPerUserPerDay: number; readWrite: number; bytesPerWrite: number;
  deepDives: string[];
}
const URL_SHORTENER: Problem = {
  name: 'URL shortener',
  questions: ['Custom aliases?', 'Do links expire?', 'Analytics in scope?', 'Redirect p99 target?'],
  dau: 100_000_000, actionsPerUserPerDay: 4, readWrite: 100, bytesPerWrite: 500,
  deepDives: ['Code generation without collisions (base62 counter vs hash)', 'Cache for hot links + 301 vs 302', 'Single primary for writes, replicas for reads'],
};

// Estimation that ends in a decision, not just a number.
function estimate(p: Problem) {
  const DAY = 86_400;
  const total = p.dau * p.actionsPerUserPerDay;
  const writesPerDay = total / (p.readWrite + 1);
  const readsPerDay = total - writesPerDay;
  const peak = (x: number) => Math.round((x / DAY) * 3);
  const storageGBYear = (writesPerDay * 365 * p.bytesPerWrite) / 1e9;
  const decisions: string[] = [];
  decisions.push(peak(readsPerDay) > 10_000 ? 'reads > 10k/s at peak → cache (Redis) in front of the DB' : 'reads fit one DB with replicas');
  decisions.push(peak(writesPerDay) > 3_000 ? 'writes > 3k/s → shard or queue writes' : 'writes fit a single primary');
  decisions.push(storageGBYear > 2_000 ? 'TBs per year → plan sharding / tiered storage' : 'storage fits one node for years');
  return { peakReads: peak(readsPerDay), peakWrites: peak(writesPerDay), storageGBYear, decisions };
}

// Simulate a candidate's actual minutes per phase and flag problems.
function runRound(p: Problem, actual: number[]) {
  let clock = 0;
  const warnings: string[] = [];
  PHASES.forEach((ph, i) => {
    const used = actual[i];
    const start = clock;
    clock += used;
    const flag = used > ph.mins * 1.5 ? `  ← OVER by ${used - ph.mins} min` : '';
    console.log(`[${String(start).padStart(2)}-${String(clock).padStart(2)} min] ${ph.name.padEnd(18)} planned ${ph.mins}, used ${used}${flag}`);
    console.log(`               produce: ${ph.outputs.join(' · ')}`);
    if (ph.name === 'Requirements') console.log(`               ask: ${p.questions.join(' | ')}`);
    if (ph.name === 'Deep dives') p.deepDives.forEach((d) => console.log(`               - ${d}`));
    if (flag) warnings.push(`${ph.name} ran long`);
  });
  const diagramAt = actual.slice(0, 4).reduce((a, b) => a + b, 0);
  if (diagramAt > 25) warnings.push(`no full diagram until minute ${diagramAt}: put up the simple version first`);
  if (actual[4] < 10) warnings.push(`only ${actual[4]} min of deep dives: one shallow pass, no depth`);
  if (actual[5] === 0) warnings.push('wrap-up skipped: no failure cases, no metrics');
  if (clock > 45) warnings.push(`round ended at ${clock} min: deep dives or wrap-up got cut`);
  return warnings;
}

function main() {
  const p = URL_SHORTENER;
  console.log(`=== Problem: ${p.name} ===`);

  console.log('\n=== Estimation (only numbers that decide something) ===');
  const e = estimate(p);
  console.log(`peak reads ≈ ${e.peakReads.toLocaleString()}/s, peak writes ≈ ${e.peakWrites.toLocaleString()}/s, storage ≈ ${e.storageGBYear.toFixed(0)} GB/year`);
  e.decisions.forEach((d) => console.log('→ ' + d));

  console.log('\n=== Round A: on time ===');
  const a = runRound(p, [5, 4, 5, 10, 16, 5]);
  console.log(a.length ? 'Warnings: ' + a.join('; ') : 'Verdict: on time, end-to-end design + 2-3 deep dives + wrap-up.');

  console.log('\n=== Round B: the common failure ===');
  const b = runRound(p, [12, 10, 6, 9, 8, 0]);
  console.log('Warnings:\n- ' + b.join('\n- '));
  console.log('Fix: say "let me put up the high-level design now" at minute 15, whatever is unfinished.');
}

main();

export {};
