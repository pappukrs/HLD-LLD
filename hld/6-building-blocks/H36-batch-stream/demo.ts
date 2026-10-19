// H36 · Batch and stream: event-time tumbling windows, watermark, late data,
// checkpoint + replay (upsert vs increment sink), and a map-shuffle-reduce batch to reconcile.
// Run: npx tsx hld/6-building-blocks/H36-batch-stream/demo.ts

interface Click { id: string; ad: string; t: number } // t = event time in seconds after 10:00:00

const fmt = (s: number) => `10:${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// Arrival order (processing order) is NOT event-time order.
const STREAM: Click[] = [
  { id: 'c1', ad: 'ad1', t: 5 }, { id: 'c2', ad: 'ad2', t: 20 }, { id: 'c3', ad: 'ad1', t: 41 },
  { id: 'c4', ad: 'ad1', t: 70 }, { id: 'c5', ad: 'ad1', t: 58 }, { id: 'c6', ad: 'ad2', t: 95 },
  { id: 'c7', ad: 'ad1', t: 40 }, // very late: arrives after window 10:00 has fired
  { id: 'c8', ad: 'ad1', t: 130 }, { id: 'c9', ad: 'ad2', t: 155 }, { id: 'c10', ad: 'ad1', t: 200 },
];

interface Sink { write(key: string, n: number): void; table: Map<string, number> }
const upsertSink = (): Sink => { const table = new Map<string, number>(); return { table, write: (k, n) => table.set(k, n) }; };
const incrementSink = (): Sink => { const table = new Map<string, number>(); return { table, write: (k, n) => table.set(k, (table.get(k) ?? 0) + n) }; };

interface State { windows: Map<number, Map<string, number>>; maxT: number; offset: number }
const SIZE = 60, DELAY = 30;

function processRange(state: State, sink: Sink, late: Click[], from: number, to: number, quiet = false): void {
  for (let i = from; i < to; i++) {
    const e = STREAM[i];
    const wm = state.maxT - DELAY;
    const start = Math.floor(e.t / SIZE) * SIZE;
    if (start + SIZE <= wm) {
      late.push(e);
      if (!quiet) console.log(`  ${e.id} t=${fmt(e.t)} LATE (watermark ${fmt(wm)}) -> side output`);
    } else {
      const w = state.windows.get(start) ?? new Map<string, number>();
      w.set(e.ad, (w.get(e.ad) ?? 0) + 1);
      state.windows.set(start, w);
      state.maxT = Math.max(state.maxT, e.t);
      if (!quiet) console.log(`  ${e.id} t=${fmt(e.t)} -> window ${fmt(start)}   watermark now ${fmt(Math.max(0, state.maxT - DELAY))}`);
    }
    for (const [s, counts] of [...state.windows]) {
      if (s + SIZE <= state.maxT - DELAY) {
        for (const [ad, n] of counts) sink.write(`${ad}|${fmt(s)}`, n);
        if (!quiet) console.log(`    FIRE window ${fmt(s)}: ${[...counts].map(([a, n]) => `${a}=${n}`).join(' ')}`);
        state.windows.delete(s);
      }
    }
    state.offset = i + 1;
  }
}

const snapshot = (s: State): State => ({ windows: new Map([...s.windows].map(([k, v]) => [k, new Map(v)])), maxT: s.maxT, offset: s.offset });
const show = (sink: Sink) => [...sink.table].map(([k, v]) => `${k}=${v}`).join('  ');

// Batch: map -> shuffle -> reduce over the complete, bounded input.
function batch(events: Click[]): Map<string, number> {
  const mapped = events.map((e) => [`${e.ad}|${fmt(Math.floor(e.t / SIZE) * SIZE)}`, 1] as const);
  const shuffled = new Map<string, number[]>();
  for (const [k, v] of mapped) shuffled.set(k, [...(shuffled.get(k) ?? []), v]);
  return new Map([...shuffled].map(([k, vs]) => [k, vs.reduce((a, b) => a + b, 0)]));
}

function main(): void {
  console.log(`== 1. Stream: 1-min tumbling windows by EVENT time, watermark = max event time - ${DELAY}s ==`);
  const sink = upsertSink();
  const late: Click[] = [];
  const state: State = { windows: new Map(), maxT: 0, offset: 0 };
  processRange(state, sink, late, 0, 6);
  const checkpoint = snapshot(state);
  console.log(`  [checkpoint] state + Kafka offset ${checkpoint.offset} saved to S3`);
  processRange(state, sink, late, 6, 9);
  console.log('  sink:', show(sink));

  console.log('\n== 2. Crash after offset 9. Restore checkpoint, replay offsets 6..9 ==');
  const restored = snapshot(checkpoint);
  const lateAgain: Click[] = [];
  const upsert = upsertSink(); const incr = incrementSink();
  for (const [k, v] of sink.table) { upsert.table.set(k, v); incr.table.set(k, v); } // what was already written
  processRange(snapshot(restored), upsert, lateAgain, restored.offset, 9, true);
  processRange(snapshot(restored), incr, [], restored.offset, 9, true);
  console.log('  upsert sink   :', show(upsert), '  <- correct, replay overwrote');
  console.log('  increment sink:', show(incr), '  <- window 10:01 double counted');
  processRange(snapshot(restored), upsert, lateAgain, restored.offset, STREAM.length, true);

  console.log('\n== 3. Nightly batch over the raw archive (S3 Parquet): map -> shuffle -> reduce ==');
  const exact = batch(STREAM);
  console.log('  batch:', [...exact].map(([k, v]) => `${k}=${v}`).join('  '));

  console.log('\n== 4. Reconcile stream vs batch ==');
  for (const [k, v] of exact) {
    if (!upsert.table.has(k)) { console.log(`  ${k.padEnd(14)} batch=${v}  stream window still open (watermark not past it yet)`); continue; }
    const s = upsert.table.get(k)!;
    const lateHere = late.filter((e) => `${e.ad}|${fmt(Math.floor(e.t / SIZE) * SIZE)}` === k).map((e) => e.id);
    console.log(`  ${k.padEnd(14)} stream=${s} batch=${v} ${s === v ? 'ok' : `DIFF ${v - s} (late: ${lateHere.join(',')})`}`);
  }
  console.log('  Bill on the batch numbers; alert if the diff is above a threshold.');

  console.log('\n== 5. Watermark delay trade-off (same stream) ==');
  for (const d of [0, 10, 30, 60]) {
    let maxT = 0, lateN = 0;
    const fired = new Set<number>();
    for (const e of STREAM) {
      const start = Math.floor(e.t / SIZE) * SIZE;
      if (fired.has(start)) lateN++; else maxT = Math.max(maxT, e.t);
      for (let s = 0; s + SIZE <= maxT - d; s += SIZE) fired.add(s);
    }
    console.log(`  delay ${String(d).padStart(2)}s -> late events ${lateN}, results wait ~${d}s longer`);
  }
}

main();

export {};
