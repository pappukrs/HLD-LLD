export {};

// H12 · Transactions, isolation levels and locking: a tiny in-memory MVCC simulation.
// Run: npx tsx hld/3-databases/H12-transactions-isolation/demo.ts

type Row = { value: number; version: number };

class Db {
  rows = new Map<string, Row>();
  private nextTx = 1;
  private committed: { tx: number; at: number; writes: Set<string> }[] = [];
  private clock = 0;

  set(key: string, value: number) { this.rows.set(key, { value, version: 1 }); }
  get(key: string): Row { return { ...this.rows.get(key)! }; }

  // Snapshot isolation: a transaction reads a frozen copy taken at BEGIN.
  begin(): Tx { return new Tx(this, this.nextTx++, ++this.clock, new Map([...this.rows].map(([k, r]) => [k, { ...r }]))); }

  // Commit rules. 'si' = first committer wins on the SAME row (Postgres Repeatable Read).
  // 'ssi' = also abort if a row we READ was written by someone who committed after our snapshot.
  commit(tx: Tx, mode: 'si' | 'ssi'): boolean {
    const after = this.committed.filter((c) => c.at > tx.startedAt);
    for (const c of after) {
      for (const k of tx.writes.keys()) if (c.writes.has(k)) return this.abort(tx, `write-write conflict on ${k}`);
      if (mode === 'ssi') for (const k of tx.reads) if (c.writes.has(k)) return this.abort(tx, `read-write dependency on ${k}`);
    }
    for (const [k, v] of tx.writes) {
      const r = this.rows.get(k)!;
      this.rows.set(k, { value: v, version: r.version + 1 });
    }
    this.committed.push({ tx: tx.id, at: ++this.clock, writes: new Set(tx.writes.keys()) });
    console.log(`  T${tx.id} COMMIT`);
    return true;
  }
  private abort(tx: Tx, why: string): false {
    console.log(`  T${tx.id} ERROR 40001 (could not serialize: ${why}) -> app must retry`);
    return false;
  }
}

class Tx {
  reads = new Set<string>();
  writes = new Map<string, number>();
  constructor(private db: Db, public id: number, public startedAt: number, private snap: Map<string, Row>) {}
  read(k: string): number { this.reads.add(k); return this.writes.get(k) ?? this.snap.get(k)!.value; }
  write(k: string, v: number) { this.writes.set(k, v); }
}

function header(t: string) { console.log(`\n=== ${t} ===`); }

function lostUpdate() {
  header('1. Lost update: read-modify-write in app code (Read Committed, no lock)');
  const db = new Db(); db.set('likes', 10);
  const a = db.get('likes').value; // T1 reads 10
  const b = db.get('likes').value; // T2 reads 10
  db.set('likes', a + 1); console.log('  T1 writes', a + 1);
  db.set('likes', b + 1); console.log('  T2 writes', b + 1);
  console.log(`  Two likes, final = ${db.get('likes').value}. One update was LOST.`);
}

function atomicAndOptimistic() {
  header('2. Fixes: atomic UPDATE and optimistic version column');
  const db = new Db(); db.set('likes', 10);
  // UPDATE posts SET likes = likes + 1  -> the DB does read+write under one row lock.
  for (let i = 0; i < 2; i++) { const r = db.rows.get('likes')!; r.value += 1; r.version += 1; }
  console.log(`  Atomic SET likes = likes + 1, twice -> ${db.get('likes').value}`);

  // UPDATE ... SET likes = ?, version = version + 1 WHERE id = ? AND version = ?
  const casUpdate = (expectVersion: number, newValue: number): number => {
    const r = db.rows.get('likes')!;
    if (r.version !== expectVersion) return 0;
    r.value = newValue; r.version++; return 1;
  };
  const s1 = db.get('likes'), s2 = db.get('likes');
  console.log(`  T1 and T2 both read value=${s1.value} version=${s1.version}`);
  console.log(`  T1 update WHERE version=${s1.version} -> rows=${casUpdate(s1.version, s1.value + 1)}`);
  let rows = casUpdate(s2.version, s2.value + 1);
  console.log(`  T2 update WHERE version=${s2.version} -> rows=${rows} (someone else won)`);
  const fresh = db.get('likes');
  rows = casUpdate(fresh.version, fresh.value + 1);
  console.log(`  T2 re-reads and retries -> rows=${rows}, final = ${db.get('likes').value}`);
}

function writeSkew(mode: 'si' | 'ssi') {
  header(`3${mode === 'si' ? 'a' : 'b'}. Write skew, rule "at least 1 doctor on call", mode = ${mode === 'si' ? 'Repeatable Read (snapshot)' : 'Serializable (SSI)'}`);
  const db = new Db(); db.set('alice', 1); db.set('bob', 1);
  const goOff = (tx: Tx, me: string) => {
    const onCall = tx.read('alice') + tx.read('bob');
    console.log(`  T${tx.id} counts on-call = ${onCall}`);
    if (onCall >= 2) { tx.write(me, 0); console.log(`  T${tx.id} sets ${me} off call`); }
  };
  const t1 = db.begin(), t2 = db.begin();
  goOff(t1, 'alice'); goOff(t2, 'bob');
  db.commit(t1, mode);
  if (!db.commit(t2, mode)) {
    const retry = db.begin();
    goOff(retry, 'bob');
    if (retry.writes.size === 0) console.log(`  T${retry.id} (retry) sees only 1 on call, refuses to leave`);
    db.commit(retry, mode);
  }
  const total = db.get('alice').value + db.get('bob').value;
  console.log(`  On call now: ${total} -> ${total === 0 ? 'RULE BROKEN' : 'rule holds'}`);
}

function deadlock() {
  header('4. Deadlock: transfer A->B and B->A at the same time');
  const holder = new Map<string, number>();
  const lock = (tx: number, k: string): boolean => {
    const h = holder.get(k);
    if (h !== undefined && h !== tx) { console.log(`  T${tx} wants ${k}, held by T${h} -> waits`); return false; }
    holder.set(k, tx); console.log(`  T${tx} locks ${k}`); return true;
  };
  lock(1, 'A'); lock(2, 'B');
  const w1 = !lock(1, 'B'), w2 = !lock(2, 'A');
  if (w1 && w2) console.log('  Wait-for graph T1 -> T2 -> T1 is a cycle. DB aborts T2 (40P01 deadlock_detected).');
  holder.clear();
  console.log('  Fix: always lock accounts in id order (A before B):');
  lock(1, 'A'); lock(2, 'A'); lock(1, 'B'); holder.clear();
  console.log('  T1 commits, then T2 gets A and B. No cycle is possible.');
}

function main() {
  lostUpdate();
  atomicAndOptimistic();
  writeSkew('si');
  writeSkew('ssi');
  deadlock();
  console.log('\nTake-away: Read Committed + atomic updates / FOR UPDATE for hot rows; SERIALIZABLE + retry for rules across rows.');
}

main();
