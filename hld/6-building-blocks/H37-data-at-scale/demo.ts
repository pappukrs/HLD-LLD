// H37 · Data at scale: push vs pull vs hybrid fan-out, a hot key split into shards,
// a buffered counter, and a like table that is the source of truth.
// Run: npx tsx hld/6-building-blocks/H37-data-at-scale/demo.ts

// ---- A small social graph with one celebrity ----
const followersOf = new Map<string, string[]>();
const followsOf = new Map<string, string[]>();
function follow(user: string, author: string): void {
  followersOf.set(author, [...(followersOf.get(author) ?? []), user]);
  followsOf.set(user, [...(followsOf.get(user) ?? []), author]);
}
const readers = Array.from({ length: 2000 }, (_, i) => `u${i}`);
const authors = Array.from({ length: 50 }, (_, i) => `a${i}`);
readers.forEach((u, i) => {
  follow(u, 'star'); // everyone follows the celebrity
  for (let k = 0; k < 5; k++) follow(u, authors[(i * 7 + k * 11) % authors.length]);
});

interface Cost { postWrites: number; feedReads: number }
function simulate(mode: 'push' | 'pull' | 'hybrid', celebLimit: number, posts: string[], feedOpens: number): Cost {
  let postWrites = 0;
  for (const author of posts) {
    const f = followersOf.get(author)?.length ?? 0;
    const push = mode === 'push' || (mode === 'hybrid' && f < celebLimit);
    postWrites += push ? 1 + f : 1; // 1 = the post row itself
  }
  // A feed open costs 1 list read (if anything is pushed) + 1 query per pulled followee.
  let feedReads = 0;
  for (let i = 0; i < feedOpens; i++) {
    const follows = followsOf.get(readers[i % readers.length]) ?? [];
    const pulled = follows.filter((a) => mode === 'pull' || (mode === 'hybrid' && (followersOf.get(a)?.length ?? 0) >= celebLimit));
    feedReads += (mode === 'pull' ? 0 : 1) + pulled.length;
  }
  return { postWrites, feedReads };
}

// ---- A hot key on a sharded cache ----
function shardOf(key: string, nodes: number): number {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; // final mix
  return (h >>> 0) % nodes;
}
function loadPerNode(keys: string[], nodes: number): number[] {
  const load = new Array<number>(nodes).fill(0);
  for (const k of keys) load[shardOf(k, nodes)]++;
  return load;
}

// ---- Buffered counter: many +1s become one write per flush ----
class BufferedCounter {
  private pending = new Map<string, number>();
  dbWrites = 0;
  readonly db = new Map<string, number>();
  add(key: string): void { this.pending.set(key, (this.pending.get(key) ?? 0) + 1); }
  flush(): void {
    for (const [k, n] of this.pending) { this.db.set(k, (this.db.get(k) ?? 0) + n); this.dbWrites++; }
    this.pending.clear();
  }
}

function main(): void {
  console.log('== 1. Feed fan-out: 2,000 readers, 50 normal authors, 1 celebrity ("star") ==');
  const posts = [...authors.slice(0, 20), ...Array<string>(10).fill('star')]; // 20 normal posts + 10 celebrity posts
  console.log(`  star has ${followersOf.get('star')!.length} followers; a normal author has ~${followersOf.get('a0')!.length}`);
  for (const mode of ['push', 'pull', 'hybrid'] as const) {
    const c = simulate(mode, 1000, posts, 10_000);
    console.log(`  ${mode.padEnd(6)} post writes=${String(c.postWrites).padStart(6)}   reads for 10k feed opens=${String(c.feedReads).padStart(6)}`);
  }
  console.log('  Hybrid: celebrity post costs 1 write, each feed open costs 1 list + 1 celebrity query.');

  console.log('\n== 2. Hot key: 50k likes/s on one post, 8 cache nodes ==');
  const writes = Array.from({ length: 50_000 }, () => 'likes:s1');
  console.log('  one key     -> ops per node:', loadPerNode(writes, 8).join(' '));
  let r = 1;
  const rand = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r; }; // deterministic
  const split = writes.map((k) => `${k}#${(rand() >>> 8) % 16}`);
  const spread = loadPerNode(split, 8);
  console.log('  16 sub-keys -> ops per node:', spread.join(' '));
  console.log(`  busiest node: 50000 -> ${Math.max(...spread)} ops/s (hashing is lumpy; more sub-keys smooth it)`);
  const counts = new Map<string, number>();
  for (const k of split) counts.set(k, (counts.get(k) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  console.log(`  read = MGET 16 keys and sum -> ${total} (exact)`);

  console.log('\n== 3. Buffered counter: flush aggregated increments every second ==');
  const bc = new BufferedCounter();
  for (let second = 0; second < 5; second++) {
    for (let i = 0; i < 50_000; i++) bc.add('likes:s1');
    bc.flush();
  }
  console.log(`  250,000 likes over 5 s -> ${bc.dbWrites} DB writes, total=${bc.db.get('likes:s1')}`);

  console.log('\n== 4. Like table is the source of truth (unique user_id, post_id) ==');
  const likeTable = new Set<string>();
  let counter = 0;
  for (const [user, post] of [['u1', 's1'], ['u2', 's1'], ['u1', 's1'], ['u3', 's1'], ['u2', 's1']]) {
    const key = `${user}|${post}`;
    if (likeTable.has(key)) { console.log(`  like ${user} -> ${post}: duplicate, rejected by unique key`); continue; }
    likeTable.add(key);
    counter++;
  }
  counter += 7; // pretend a bug or lost flush drifted the cached counter
  console.log(`  cached counter says ${counter}; like table has ${likeTable.size} rows`);
  console.log(`  repair job: counter := count(like rows) = ${likeTable.size}`);

  console.log('\n== 5. Timeline memory estimate ==');
  const users = 100_000_000, ids = 800, bytes = 8;
  console.log(`  ${users.toLocaleString()} users x ${ids} ids x ${bytes} B = ${((users * ids * bytes) / 1e9).toFixed(0)} GB -> shard Redis by user_id`);
}

main();

export {};
