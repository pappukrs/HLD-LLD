// H33 · Search: inverted index + BM25 ranking + near-real-time refresh + typeahead trie with cached top-k.
// Run: npx tsx hld/6-building-blocks/H33-search-typeahead/demo.ts

// ---- Analysis: the same pipeline at index time and query time ----
const STOP = new Set(['the', 'a', 'for', 'and', 'with']);
function stem(w: string): string {
  let s = w.length > 5 ? w.replace(/ing$/, '') : w; // running -> runn
  if (s !== w && /(.)\1$/.test(s)) s = s.slice(0, -1); // runn -> run
  return s.replace(/([^s])s$/, '$1'); // shoes -> shoe
}
function analyze(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).map(stem);
}

// ---- Inverted index with an in-memory buffer and refresh (like a Lucene segment) ----
class SearchIndex {
  private postings = new Map<string, Map<number, number>>(); // term -> (docId -> tf)
  private lengths = new Map<number, number>();
  private buffer: { id: number; text: string }[] = [];
  readonly titles = new Map<number, string>();

  add(id: number, text: string): void { this.buffer.push({ id, text }); } // not searchable yet
  refresh(): number {
    const n = this.buffer.length;
    for (const { id, text } of this.buffer) {
      const terms = analyze(text);
      this.titles.set(id, text);
      this.lengths.set(id, terms.length);
      for (const t of terms) {
        const list = this.postings.get(t) ?? new Map<number, number>();
        list.set(id, (list.get(id) ?? 0) + 1);
        this.postings.set(t, list);
      }
    }
    this.buffer = [];
    return n;
  }
  list(term: string): number[] { return [...(this.postings.get(term)?.keys() ?? [])].sort((a, b) => a - b); }

  // BM25 over the OR of the terms
  search(query: string, mode: 'AND' | 'OR'): { id: number; score: number }[] {
    const terms = analyze(query);
    const N = this.lengths.size;
    const avg = [...this.lengths.values()].reduce((a, b) => a + b, 0) / Math.max(1, N);
    const candidates = terms.map((t) => this.list(t));
    const ids = mode === 'AND' ? candidates.reduce((a, b) => intersect(a, b)) : [...new Set(candidates.flat())];
    const k1 = 1.2, b = 0.75;
    return ids.map((id) => {
      let score = 0;
      for (const t of terms) {
        const tf = this.postings.get(t)?.get(id) ?? 0;
        if (!tf) continue;
        const df = this.postings.get(t)!.size;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * this.lengths.get(id)!) / avg));
      }
      return { id, score };
    }).sort((x, y) => y.score - x.score);
  }
}

function intersect(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0, j = 0, steps = 0;
  while (i < a.length && j < b.length) {
    steps++;
    if (a[i] === b[j]) { out.push(a[i]); i++; j++; } else if (a[i] < b[j]) i++; else j++;
  }
  console.log(`    merge [${a}] & [${b}] -> [${out}] in ${steps} comparisons`);
  return out;
}

// ---- Typeahead trie: each node caches its top-k ----
interface Hit { q: string; n: number }
class TrieNode { children = new Map<string, TrieNode>(); count = 0; top: Hit[] = []; }
class Typeahead {
  root = new TrieNode();
  constructor(private k: number) {}
  build(log: Record<string, number>): void {
    for (const [q, n] of Object.entries(log)) {
      let node = this.root;
      const path = [node];
      for (const ch of q) {
        if (!node.children.has(ch)) node.children.set(ch, new TrieNode());
        node = node.children.get(ch)!;
        path.push(node);
      }
      node.count += n;
      for (const p of path) { // offline build: update top-k on the whole path
        p.top = [...p.top.filter((h) => h.q !== q), { q, n: node.count }].sort((x, y) => y.n - x.n || (x.q < y.q ? -1 : 1)).slice(0, this.k);
      }
    }
  }
  private find(prefix: string): TrieNode | undefined {
    let node: TrieNode | undefined = this.root;
    for (const ch of prefix) { node = node?.children.get(ch); if (!node) return undefined; }
    return node;
  }
  suggestCached(prefix: string): { hits: Hit[]; visited: number } {
    return { hits: this.find(prefix)?.top ?? [], visited: prefix.length };
  }
  suggestWalk(prefix: string): { hits: Hit[]; visited: number } {
    const start = this.find(prefix);
    if (!start) return { hits: [], visited: prefix.length };
    const all: Hit[] = [];
    let visited = prefix.length;
    const stack: [TrieNode, string][] = [[start, prefix]];
    while (stack.length) {
      const [n, w] = stack.pop()!;
      visited++;
      if (n.count) all.push({ q: w, n: n.count });
      for (const [ch, c] of n.children) stack.push([c, w + ch]);
    }
    return { hits: all.sort((x, y) => y.n - x.n).slice(0, this.k), visited };
  }
}

function main(): void {
  console.log('== 1. Analysis pipeline ==');
  console.log('  "Red Running Shoes for the Gym" ->', analyze('Red Running Shoes for the Gym'));

  console.log('\n== 2. Build the inverted index ==');
  const idx = new SearchIndex();
  const docs = ['Red Running Shoes', 'Blue Running Jacket', 'Red Jacket', 'Red Wool Jacket with Red Lining', 'Trail Shoes'];
  docs.forEach((d, i) => idx.add(i + 1, d));
  console.log(`  refresh: ${idx.refresh()} docs now searchable`);
  for (const t of ['red', 'run', 'shoe', 'jacket']) console.log(`  ${t.padEnd(7)} -> [${idx.list(t)}]`);

  console.log('\n== 3. AND query "red jacket" (two-pointer merge) ==');
  for (const r of idx.search('red jacket', 'AND')) console.log(`    doc${r.id} "${idx.titles.get(r.id)}" bm25=${r.score.toFixed(2)}`);
  console.log('    doc4 says "red" twice but is longer: TF saturates and length is normalised, so doc3 wins.');

  console.log('\n== 4. OR query "red running shoes", ranked by BM25 ==');
  for (const r of idx.search('red running shoes', 'OR').slice(0, 4)) console.log(`    doc${r.id} "${idx.titles.get(r.id)}" bm25=${r.score.toFixed(2)}`);

  console.log('\n== 5. Near-real-time: a new doc is invisible until refresh ==');
  idx.add(6, 'Red Shoes Sale');
  console.log(`  before refresh, "sale" -> [${idx.list('sale')}]`);
  idx.refresh();
  console.log(`  after refresh (ES default 1 s), "sale" -> [${idx.list('sale')}]`);

  console.log('\n== 6. Typeahead trie with top-3 cached per node ==');
  const ta = new Typeahead(3);
  ta.build({ car: 90, cat: 75, card: 60, cart: 40, cake: 30, 'car rental': 55, 'car insurance': 48, dog: 50, door: 20 });
  for (const p of ['c', 'ca', 'car', 'd', 'x']) {
    const cached = ta.suggestCached(p);
    const walk = ta.suggestWalk(p);
    const list = cached.hits.map((h) => `${h.q}(${h.n})`).join(', ') || '(none)';
    console.log(`  "${p}" -> ${list.padEnd(40)} cached: ${cached.visited} nodes, subtree walk: ${walk.visited} nodes`);
  }
  console.log('  Same answers; the cached version touches only the prefix path.');
}

main();

export {};
