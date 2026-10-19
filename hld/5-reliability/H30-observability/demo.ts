// H30 · Observability: trace context propagation, average vs p99, merging histograms across pods,
// metric cardinality, and an SLO error budget with burn-rate alerts.
// Run: npx tsx hld/5-reliability/H30-observability/demo.ts
export {};

function rng(seed: number): () => number {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const hex = (r: () => number, n: number) => Array.from({ length: n }, () => Math.floor(r() * 16).toString(16)).join('');

// ---- 1. Trace context: each hop reads traceparent, starts a child span, passes it on.
type Span = { name: string; traceId: string; spanId: string; parent: string | null; startMs: number; endMs: number; error?: string };
const spans: Span[] = [];
const r = rng(1);

function handle(name: string, traceparent: string | null, startMs: number, work: (tp: string, t: number) => number, error?: string): number {
  const traceId = traceparent ? traceparent.split('-')[1] : hex(r, 32);
  const parent = traceparent ? traceparent.split('-')[2] : null;
  const spanId = hex(r, 16);
  const myHeader = `00-${traceId}-${spanId}-01`;
  const endMs = work(myHeader, startMs);
  spans.push({ name, traceId, spanId, parent, startMs, endMs, error });
  return endMs;
}

function tracing(): void {
  console.log('\n== 1. One request, one trace across 4 services + a Kafka consumer ==');
  handle('gateway', null, 0, (tp, t) =>
    handle('order', tp, t + 8, (tp2, t2) => {
      const inv = handle('inventory', tp2, t2 + 6, (_tp, t3) => t3 + 12);
      const pay = handle('payment', tp2, inv + 4, (tp3, t3) => handle('bank API', tp3, t3 + 8, (_tp, t4) => t4 + 262, 'ETIMEDOUT') + 6);
      // Kafka: the producer puts traceparent in message headers; the consumer continues the trace.
      const headers = { traceparent: tp2 };
      handle('notify (kafka consumer)', headers.traceparent, pay + 12, (_tp, t5) => t5 + 24);
      return pay + 6;
    }) + 8);
  const traceIds = new Set(spans.map((s) => s.traceId));
  console.log(`spans: ${spans.length}, distinct trace ids: ${traceIds.size} (${[...traceIds][0].slice(0, 8)}...)`);
  const byStart = [...spans].sort((a, b) => a.startMs - b.startMs);
  for (const s of byStart) {
    const bar = ' '.repeat(Math.round(s.startMs / 10)) + '#'.repeat(Math.max(1, Math.round((s.endMs - s.startMs) / 10)));
    console.log(`${s.name.padEnd(24)} ${String(s.endMs - s.startMs).padStart(4)} ms ${bar}${s.error ? '  x ' + s.error : ''}`);
  }
}

// ---- 2. Latency: average vs percentiles, and merging pods.
const BUCKETS = [25, 50, 100, 250, 500, 1000, 2500, Infinity];
class Histogram {
  counts = BUCKETS.map(() => 0);
  observe(ms: number): void { this.counts[BUCKETS.findIndex((b) => ms <= b)]++; }
  merge(o: Histogram): Histogram { o.counts.forEach((c, i) => (this.counts[i] += c)); return this; }
  quantile(q: number): number {
    const total = this.counts.reduce((a, b) => a + b, 0);
    let seen = 0;
    for (let i = 0; i < BUCKETS.length; i++) { seen += this.counts[i]; if (seen >= q * total) return BUCKETS[i]; }
    return Infinity;
  }
}
function sample(n: number, seed: number, slow: number, huge: number): number[] {
  const g = rng(seed);
  return Array.from({ length: n }, () => { const u = g(); return u < huge ? 1800 + g() * 600 : u < huge + slow ? 250 + g() * 300 : 35 + g() * 110; });
}
const pct = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.ceil(q * a.length) - 1];
const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

function latency(): void {
  console.log('\n== 2. Average hides the tail ==');
  const d = sample(100, 7, 0.08, 0.02);
  console.log(`avg ${avg(d).toFixed(0)} ms | p50 ${pct(d, 0.5).toFixed(0)} | p95 ${pct(d, 0.95).toFixed(0)} | p99 ${pct(d, 0.99).toFixed(0)} ms`);
  console.log(`chance a page with 20 calls hits at least one >p99 call: ${((1 - 0.99 ** 20) * 100).toFixed(0)}%`);

  console.log('\n== 3. Two pods: average of p99s vs merged histogram ==');
  const a = sample(1000, 3, 0.005, 0), b = sample(10, 11, 0, 0.4);
  const ha = new Histogram(), hb = new Histogram();
  a.forEach((v) => ha.observe(v));
  b.forEach((v) => hb.observe(v));
  console.log(`pod A p99 ${pct(a, 0.99).toFixed(0)} ms (1000 req), pod B p99 ${pct(b, 0.99).toFixed(0)} ms (10 req)`);
  console.log(`average of p99s: ${((pct(a, 0.99) + pct(b, 0.99)) / 2).toFixed(0)} ms  <- wrong`);
  console.log(`merged buckets p99: <= ${new Histogram().merge(ha).merge(hb).quantile(0.99)} ms; exact fleet p99 ${pct([...a, ...b], 0.99).toFixed(0)} ms  <- right`);
}

function cardinality(): void {
  console.log('\n== 4. Cardinality ==');
  const labels: Array<[string, number]> = [['route', 20], ['status', 5], ['method', 3], ['pod', 50], ['user_id', 1_000_000]];
  let series = 1;
  for (const [name, values] of labels) {
    series *= values;
    console.log(`+ ${name.padEnd(8)} (${values.toLocaleString()} values) -> ${series.toLocaleString()} series${series > 2_000_000 ? '  <- Prometheus OOM' : ''}`);
  }
}

function errorBudget(): void {
  console.log('\n== 5. SLO 99.9% over 30 days: error budget and burn rate ==');
  const slo = 0.999, allowed = 1 - slo, monthMin = 30 * 24 * 60;
  console.log(`budget: ${(allowed * monthMin).toFixed(1)} min of full outage per 30 days`);
  for (const errRate of [0.0005, 0.002, 0.006, 0.0144, 0.05]) {
    const burn = Math.round((errRate / allowed) * 1000) / 1000;
    const hoursToEmpty = (30 * 24) / burn;
    const action = burn >= 14.4 ? 'PAGE (fast burn)' : burn >= 6 ? 'page if it lasts 6 h' : burn > 1 ? 'ticket' : 'fine';
    console.log(`error rate ${(errRate * 100).toFixed(2).padStart(5)}% -> burn ${burn.toFixed(1).padStart(4)}x -> budget gone in ${hoursToEmpty.toFixed(0).padStart(4)} h -> ${action}`);
  }
  const outageMin = 30;
  console.log(`a ${outageMin}-min full outage uses ${((outageMin / (allowed * monthMin)) * 100).toFixed(0)}% of the month's budget`);
}

function main(): void {
  tracing();
  latency();
  cardinality();
  errorBudget();
}

main();
