// H11 · Indexes: count "page reads" for seq scan, B+tree seek, composite and covering indexes.
// Run: npx tsx hld/3-databases/H11-indexing/demo.ts
export {}; // module scope: keeps names local to this file
type Payment = { id: number; merchantId: number; createdAt: number; amount: number; status: string };

const ROWS = 200_000;
const ROWS_PER_HEAP_PAGE = 50; // ~8 KB page / ~160 B row
const KEYS_PER_PAGE = 300; // B+tree fan-out (keys per index page)

// Deterministic pseudo-random so every run prints the same numbers.
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const heap: Payment[] = [];
for (let i = 0; i < ROWS; i++) {
  heap.push({
    id: i,
    merchantId: Math.floor(rand() * 2000),
    createdAt: 1_700_000_000 + Math.floor(rand() * 90 * 86400),
    amount: Math.floor(rand() * 50_000),
    status: rand() < 0.5 ? 'SUCCESS' : 'FAILED',
  });
}
const heapPage = (rowId: number) => Math.floor(rowId / ROWS_PER_HEAP_PAGE);

// An index = sorted entries (key tuple + row pointer), cut into leaf pages of KEYS_PER_PAGE.
type Entry = { key: number[]; rowId: number; include?: Partial<Payment> };
const cmp = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0; // prefix compare: [42] equals every [42, x]
};
function buildIndex(cols: (keyof Payment)[], include: (keyof Payment)[] = []): Entry[] {
  return heap
    .map((r) => ({
      key: cols.map((c) => r[c] as number),
      rowId: r.id,
      include: Object.fromEntries(include.map((c) => [c, r[c]])) as Partial<Payment>,
    }))
    .sort((a, b) => cmp(a.key, b.key) || a.rowId - b.rowId);
}
const depth = (n: number) => Math.ceil(Math.log(n / KEYS_PER_PAGE) / Math.log(KEYS_PER_PAGE)) + 1; // internal levels + leaf
function lowerBound(idx: Entry[], prefix: number[]): number {
  let lo = 0, hi = idx.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cmp(idx[mid].key, prefix) < 0) lo = mid + 1; else hi = mid;
  }
  return lo;
}

type Result = { rows: number; pages: number; plan: string };
function report(name: string, r: Result) {
  console.log(`  ${name.padEnd(46)} rows=${String(r.rows).padStart(5)}  page reads=${String(r.pages).padStart(5)}  (${r.plan})`);
}

// Query: payments of merchant 42, newest 20.
const M = 42, LIMIT = 20;

function seqScan(): Result {
  const hits = heap.filter((r) => r.merchantId === M).sort((a, b) => b.createdAt - a.createdAt).slice(0, LIMIT);
  return { rows: hits.length, pages: Math.ceil(ROWS / ROWS_PER_HEAP_PAGE), plan: 'Seq Scan + Sort' };
}

function seekRange(idx: Entry[], prefix: number[], limit: number, covering: boolean, newestFirst: boolean): Result {
  const start = lowerBound(idx, prefix);
  let end = start;
  while (end < idx.length && cmp(idx[end].key, prefix) === 0) end++;
  const run = idx.slice(start, end);
  const picked = newestFirst ? run.slice(-limit) : run.slice(0, limit); // index sorted ASC; walk backward for DESC
  const leafPages = new Set(picked.map((_, i) => Math.floor((newestFirst ? end - 1 - i : start + i) / KEYS_PER_PAGE))).size;
  const heapPages = covering ? 0 : picked.length; // one heap hop per row (random pages)
  return { rows: picked.length, pages: depth(idx.length) - 1 + leafPages + heapPages, plan: covering ? 'Index Only Scan' : 'Index Scan' };
}

function main() {
  console.log(`=== Table: ${ROWS.toLocaleString()} payments, ${Math.ceil(ROWS / ROWS_PER_HEAP_PAGE)} heap pages ===`);
  console.log(`B+tree fan-out ${KEYS_PER_PAGE} → depth ${depth(ROWS)} for ${ROWS.toLocaleString()} keys, depth ${depth(1e8)} for 100M, ${depth(1e9)} for 1B\n`);

  console.log(`--- Query: WHERE merchant_id = ${M} ORDER BY created_at DESC LIMIT ${LIMIT} ---`);
  report('1. No index', seqScan());

  const byMerchant = buildIndex(['merchantId']);
  const r2 = seekRange(byMerchant, [M], Infinity, false, false);
  report('2. INDEX (merchant_id): fetch all, then sort', { ...r2, plan: 'Index Scan + Sort' });

  const composite = buildIndex(['merchantId', 'createdAt']);
  report('3. INDEX (merchant_id, created_at)', seekRange(composite, [M], LIMIT, false, true));

  const covering = buildIndex(['merchantId', 'createdAt'], ['amount', 'status']);
  report('4. ... INCLUDE (amount, status)', seekRange(covering, [M], LIMIT, true, true));

  console.log('\n--- Leftmost-prefix rule: same composite index, query by created_at only ---');
  const t0 = 1_700_000_000 + 30 * 86400;
  // No leading merchant_id → cannot seek. Best case: read every leaf page and filter.
  const hits = composite.filter((e) => e.key[1] >= t0 && e.key[1] < t0 + 3600).length;
  report('5. WHERE created_at in one hour (no prefix)', { rows: hits, pages: Math.ceil(composite.length / KEYS_PER_PAGE), plan: 'Full index scan, filter' });
  const byTime = buildIndex(['createdAt']);
  const s = lowerBound(byTime, [t0]);
  let e = s;
  while (e < byTime.length && byTime[e].key[0] < t0 + 3600) e++;
  report('6. INDEX (created_at) for that query', { rows: e - s, pages: depth(ROWS) - 1 + Math.ceil((e - s) / KEYS_PER_PAGE) + (e - s), plan: 'Index Scan (range)' });

  console.log('\n--- Selectivity: status has 2 values ---');
  const failed = heap.filter((r) => r.status === 'FAILED').length;
  const pagesTouched = new Set(heap.filter((r) => r.status === 'FAILED').map((r) => heapPage(r.id))).size;
  console.log(`  status = 'FAILED' matches ${failed} rows (${((failed / ROWS) * 100).toFixed(0)}%) spread over ${pagesTouched} of ${Math.ceil(ROWS / ROWS_PER_HEAP_PAGE)} pages.`);
  console.log(`  Index scan = ~${failed} random reads vs seq scan = ${Math.ceil(ROWS / ROWS_PER_HEAP_PAGE)} sequential reads → planner picks Seq Scan.`);

  console.log('\n--- Write tax: insert 5,000 rows with 0 vs 5 secondary indexes ---');
  for (const n of [0, 5]) {
    const idxs: number[][] = Array.from({ length: n }, () => heap.slice(0, 50_000).map((r) => r.createdAt).sort((a, b) => a - b));
    const start = process.hrtime.bigint();
    for (let i = 0; i < 5000; i++) {
      const v = Math.floor(rand() * 1e9);
      for (const idx of idxs) {
        let lo = 0, hi = idx.length;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (idx[mid] < v) lo = mid + 1; else hi = mid; }
        idx.splice(lo, 0, v); // keep sorted: the B+tree does this per page, plus splits
      }
    }
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`  ${n} indexes: ${(5000 * n).toLocaleString()} index entries written, ${ms.toFixed(1)} ms`);
  }
  console.log('\nTakeaway: equality column first, sort/range column next, INCLUDE hot columns, and every index taxes writes.');
}

main();
