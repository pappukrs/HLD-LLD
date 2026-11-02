// H11 · Indexes: Day 15 practice.
// Run: npx tsx hld/3-databases/H11-indexing/practice.ts
// Two small tools that answer interview questions with numbers:
//   1. B+tree depth and index size for a table (back-of-envelope).
//   2. "Can this composite index serve this query?": leftmost-prefix, range stop, sort, covering.

export {};

// ---------- 1. Depth and size ----------
function btreeStats(rows: number, keyBytes: number, pageBytes = 8192, ptrBytes = 12) {
  const fanout = Math.floor(pageBytes / (keyBytes + ptrBytes));
  let levels = 1;
  let capacity = fanout; // keys one leaf level can address
  while (capacity < rows) { capacity *= fanout; levels++; }
  const sizeMB = (rows * (keyBytes + ptrBytes) * 1.3) / 1e6; // ~30% page slack
  return { fanout, levels, sizeMB: Math.round(sizeMB) };
}

// ---------- 2. Index advisor ----------
type Pred = { col: string; op: '=' | 'range' };
interface Query { where: Pred[]; orderBy?: string; select: string[] }
interface Index { name: string; keys: string[]; include?: string[] }

function explain(idx: Index, q: Query) {
  const eq = new Set(q.where.filter((p) => p.op === '=').map((p) => p.col));
  const range = new Set(q.where.filter((p) => p.op === 'range').map((p) => p.col));

  // Walk keys left to right. Equality keeps the seek going; a range uses the column and then stops it.
  const seekCols: string[] = [];
  let stoppedAt = -1;
  for (let i = 0; i < idx.keys.length; i++) {
    const k = idx.keys[i];
    if (eq.has(k)) { seekCols.push(k); continue; }
    if (range.has(k)) { seekCols.push(k); stoppedAt = i + 1; break; }
    stoppedAt = i;
    break;
  }
  if (stoppedAt === -1) stoppedAt = idx.keys.length;

  const usable = seekCols.length > 0;
  const allPred = [...eq, ...range];
  const filteredInIndex = allPred.filter((c) => !seekCols.includes(c) && idx.keys.includes(c));
  // Order comes free only if every key before the ORDER BY column is pinned by equality.
  let sortFree = false;
  if (q.orderBy) {
    const pos = idx.keys.indexOf(q.orderBy);
    sortFree = pos >= 0 && idx.keys.slice(0, pos).every((k) => eq.has(k));
  }
  const inIndex = new Set([...idx.keys, ...(idx.include ?? [])]);
  const covering = [...q.select, ...allPred].every((c) => inIndex.has(c));

  return {
    usable,
    seekOn: seekCols,
    filterInIndex: filteredInIndex,
    needsSort: !!q.orderBy && !sortFree,
    indexOnly: usable && covering,
  };
}

// ---------- checks ----------
let pass = 0;
const ok = (cond: boolean, name: string) => {
  if (!cond) throw new Error(`FAILED: ${name}`);
  pass++;
  console.log(`  ok  ${name}`);
};

console.log('\n=== B+tree depth and size ===');
for (const rows of [1e6, 1e8, 1e9]) {
  const s = btreeStats(rows, 8);
  console.log(`  ${rows.toExponential()} rows, 8 B key -> fan-out ${s.fanout}, ${s.levels} levels, ~${s.sizeMB} MB`);
}
ok(btreeStats(1e8, 8).levels <= 4, '100M rows fit in 3-4 levels');
ok(Math.ceil(Math.log2(1e7)) === 24, 'a binary tree would need ~24 reads for 10M rows');

console.log('\n=== Self-test Q2: index (a, b, c) ===');
const abc: Index = { name: 'abc', keys: ['a', 'b', 'c'] };
const sel = ['a', 'b', 'c'];
const q1 = explain(abc, { where: [{ col: 'a', op: '=' }], select: sel });
const q2 = explain(abc, { where: [{ col: 'b', op: '=' }], select: sel });
const q3 = explain(abc, { where: [{ col: 'a', op: '=' }, { col: 'c', op: '=' }], select: sel });
const q4 = explain(abc, { where: [{ col: 'a', op: '=' }, { col: 'b', op: '=' }], orderBy: 'c', select: sel });
ok(q1.usable && q1.seekOn.join() === 'a', 'a=1 seeks on a');
ok(!q2.usable, 'b=2 cannot seek (no leading column)');
ok(q3.seekOn.join() === 'a' && q3.filterInIndex.join() === 'c', 'a=1 AND c=3 seeks on a, filters c inside the index');
ok(q4.seekOn.join() === 'a,b' && !q4.needsSort, 'a=1 AND b=2 ORDER BY c: full seek, no sort');

console.log('\n=== Equality first, range last ===');
const where: Pred[] = [{ col: 'merchant_id', op: '=' }, { col: 'created_at', op: 'range' }];
const wrong = explain({ name: 'wrong', keys: ['created_at', 'merchant_id'] }, { where, select: ['merchant_id', 'created_at'] });
const right = explain({ name: 'right', keys: ['merchant_id', 'created_at'] }, { where, select: ['merchant_id', 'created_at'] });
ok(wrong.seekOn.join() === 'created_at' && wrong.filterInIndex.join() === 'merchant_id', '(created_at, merchant_id) seeks the range only, then filters');
ok(right.seekOn.join() === 'merchant_id,created_at', '(merchant_id, created_at) seeks on both');

console.log('\n=== Dashboard query: newest 20 payments of a merchant ===');
const dash: Query = { where: [{ col: 'merchant_id', op: '=' }], orderBy: 'created_at', select: ['amount', 'status', 'created_at'] };
const plain = explain({ name: 'm_c', keys: ['merchant_id', 'created_at'] }, dash);
const cover = explain({ name: 'm_c_incl', keys: ['merchant_id', 'created_at'], include: ['amount', 'status'] }, dash);
ok(!plain.needsSort && !plain.indexOnly, '(merchant_id, created_at): no sort, but heap fetches for amount/status');
ok(cover.indexOnly, 'INCLUDE (amount, status) makes it an index-only scan');

console.log(`\n${pass} checks passed`);
