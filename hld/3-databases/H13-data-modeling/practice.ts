// H13 · Data modelling and normalization: Day 17 practice.
// Run: npx tsx hld/3-databases/H13-data-modeling/practice.ts
// Different domains from demo.ts on purpose:
//   1. Movie booking: classify functional dependencies, split to 3NF, prove the split is lossless (Q2, Q3, Q4).
//   2. Wallet: integer money, append-only ledger, cached balance, reversing entries (Q5 idea: facts stay frozen).
//   3. Constraints: soft delete with a partial unique index, one like per user (Q7).
//   4. A copied column kept in sync by an idempotent consumer and a repair job (Q8).
//   5. Embed vs reference, with the 16 MB limit worked out (Q6). Key size and fan-out numbers.

export {};

type Cell = string | number;
type Row = Record<string, Cell>;
type Fd = { lhs: string[]; rhs: string[] };

// ---------- 1. Movie booking ----------
const flat: Row[] = [
  { booking_id: 'B1', seat_id: 'S1-A1', show_id: 'SH1', movie: 'Dune', screen: 'S1', user_id: 'U1', email: 'asha@x.in', seat_row: 'A', price_paise: 30000 },
  { booking_id: 'B1', seat_id: 'S1-A2', show_id: 'SH1', movie: 'Dune', screen: 'S1', user_id: 'U1', email: 'asha@x.in', seat_row: 'A', price_paise: 30000 },
  { booking_id: 'B2', seat_id: 'S1-A3', show_id: 'SH1', movie: 'Dune', screen: 'S1', user_id: 'U2', email: 'ravi@y.in', seat_row: 'A', price_paise: 25000 },
  { booking_id: 'B3', seat_id: 'S2-C1', show_id: 'SH2', movie: 'Heat', screen: 'S2', user_id: 'U1', email: 'asha@x.in', seat_row: 'C', price_paise: 18000 },
  { booking_id: 'B3', seat_id: 'S2-D1', show_id: 'SH2', movie: 'Heat', screen: 'S2', user_id: 'U1', email: 'asha@x.in', seat_row: 'D', price_paise: 20000 },
  { booking_id: 'B4', seat_id: 'S1-A1', show_id: 'SH3', movie: 'Heat', screen: 'S1', user_id: 'U3', email: 'neha@z.in', seat_row: 'A', price_paise: 22000 },
];
const KEY = ['booking_id', 'seat_id'];

// The business rules, written down by a person. Rows can disprove a rule but cannot prove one.
const FDS: Fd[] = [
  { lhs: ['booking_id'], rhs: ['show_id', 'user_id'] },
  { lhs: ['seat_id'], rhs: ['seat_row'] },
  { lhs: ['show_id'], rhs: ['movie', 'screen'] },
  { lhs: ['user_id'], rhs: ['email'] },
];

function holds(rows: Row[], lhs: string[], rhs: string): boolean {
  const seen = new Map<string, Cell>();
  for (const r of rows) {
    const k = lhs.map((c) => r[c]).join('|');
    const prev = seen.get(k);
    if (prev !== undefined && prev !== r[rhs]) return false;
    seen.set(k, r[rhs]);
  }
  return true;
}

function classify(key: string[], fd: Fd): 'ok' | 'partial (breaks 2NF)' | 'transitive (breaks 3NF)' {
  const inKey = fd.lhs.filter((c) => key.includes(c)).length;
  if (inKey === key.length) return 'ok';
  return inKey === fd.lhs.length ? 'partial (breaks 2NF)' : 'transitive (breaks 3NF)';
}

function project(rows: Row[], cols: string[]): Row[] {
  const out = new Map<string, Row>();
  for (const r of rows) {
    const p = Object.fromEntries(cols.map((c) => [c, r[c]]));
    out.set(JSON.stringify(p), p);
  }
  return [...out.values()];
}

function naturalJoin(a: Row[], b: Row[]): Row[] {
  const out: Row[] = [];
  for (const x of a) {
    for (const y of b) {
      const shared = Object.keys(x).filter((c) => c in y);
      if (shared.every((c) => x[c] === y[c])) out.push({ ...x, ...y });
    }
  }
  return out;
}

const canon = (rows: Row[]) =>
  rows.map((r) => JSON.stringify(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)))).sort().join('\n');
const cells = (rows: Row[]) => rows.reduce((n, r) => n + Object.keys(r).length, 0);

// ---------- 2. Wallet ledger ----------
type Entry = Readonly<{ id: number; account: string; amountPaise: number; dir: 'DEBIT' | 'CREDIT'; ref: string }>;

class Wallet {
  readonly entries: Entry[] = [];
  private balance = new Map<string, number>(); // cached, always written with the entries
  private refs = new Set<string>();            // UNIQUE (ref)

  deposit(ref: string, account: string, paise: number) { this.post(ref, [[account, paise, 'CREDIT']]); }
  transfer(ref: string, from: string, to: string, paise: number) {
    this.post(ref, [[from, paise, 'DEBIT'], [to, paise, 'CREDIT']]);
  }
  // Never edit a past entry. Post the opposite entries under a new ref.
  reverse(ref: string) {
    const legs = this.entries.filter((e) => e.ref === ref);
    if (legs.length === 0) throw new Error(`unknown ref ${ref}`);
    this.post(`rev:${ref}`, legs.map((e) => [e.account, e.amountPaise, e.dir === 'DEBIT' ? 'CREDIT' : 'DEBIT']));
  }
  // One transaction: validate everything first, then write everything.
  private post(ref: string, legs: [string, number, Entry['dir']][]) {
    if (this.refs.has(ref)) return; // the unique constraint makes a retry safe
    const next = new Map(this.balance);
    for (const [account, paise, dir] of legs) {
      if (!Number.isInteger(paise) || paise <= 0) throw new Error('CHECK amount_paise > 0'); // integers only
      const b = (next.get(account) ?? 0) + (dir === 'CREDIT' ? paise : -paise);
      if (b < 0) throw new Error('insufficient funds');
      next.set(account, b);
    }
    for (const [account, amountPaise, dir] of legs) {
      this.entries.push(Object.freeze({ id: this.entries.length + 1, account, amountPaise, dir, ref }));
    }
    this.refs.add(ref);
    this.balance = next;
  }
  cached(account: string) { return this.balance.get(account) ?? 0; }
  rebuilt(account: string) { // the ledger is the truth: the cache must always equal this
    return this.entries.filter((e) => e.account === account)
      .reduce((s, e) => s + (e.dir === 'CREDIT' ? e.amountPaise : -e.amountPaise), 0);
  }
}

// ---------- 3. Constraints ----------
// CREATE UNIQUE INDEX ON users (email) WHERE deleted_at IS NULL;
class Users {
  private rows: { id: number; email: string; deletedAt: number | null }[] = [];
  insert(email: string) {
    if (this.rows.some((r) => r.email === email && r.deletedAt === null)) throw new Error('23505 unique_violation');
    const id = this.rows.length + 1;
    this.rows.push({ id, email, deletedAt: null });
    return id;
  }
  softDelete(id: number, now: number) { this.rows[id - 1].deletedAt = now; }
  changeEmail(id: number, email: string) { this.rows[id - 1].email = email; }
  get(id: number) { return this.rows[id - 1]; }
  get total() { return this.rows.length; }
}

// PRIMARY KEY (user_id, post_id), with like_count written in the same transaction.
class Likes {
  private rows = new Set<string>();
  likeCount = 0;
  like(user: string, post: string): boolean {
    const k = `${user}|${post}`;
    if (this.rows.has(k)) return false; // ON CONFLICT DO NOTHING: no row, so no count change
    this.rows.add(k);
    this.likeCount++;
    return true;
  }
}

// ---------- 4. Copied column: orders.customer_name ----------
type NameChanged = { custId: string; name: string; version: number };

class AdminOrders {
  rows = [
    { orderId: 1, custId: 'C1', customerName: 'Asha', nameVersion: 1 },
    { orderId: 2, custId: 'C1', customerName: 'Asha', nameVersion: 1 },
    { orderId: 3, custId: 'C2', customerName: 'Ravi', nameVersion: 1 },
  ];
  writes = 0;
  // Idempotent and safe out of order: a copy only moves to a newer version.
  apply(ev: NameChanged) {
    for (const r of this.rows) {
      if (r.custId === ev.custId && ev.version > r.nameVersion) {
        r.customerName = ev.name;
        r.nameVersion = ev.version;
        this.writes++;
      }
    }
  }
  // The periodic repair job: finds what lost events left behind.
  repair(source: Map<string, { name: string; version: number }>) {
    let fixed = 0;
    for (const r of this.rows) {
      const s = source.get(r.custId)!;
      if (r.customerName !== s.name) {
        r.customerName = s.name;
        r.nameVersion = s.version;
        fixed++;
      }
    }
    return fixed;
  }
}

// ---------- 5. Embed vs reference ----------
const MONGO_LIMIT = 16 * 1024 * 1024;
type Child = { readWithParent: boolean; shared: boolean; updatedAlone: boolean; maxCount: number; bytesEach: number };

function embedOrReference(c: Child): 'embed' | 'reference' {
  if (!c.readWithParent || c.shared || c.updatedAlone) return 'reference';
  return c.maxCount * c.bytesEach < MONGO_LIMIT ? 'embed' : 'reference';
}

// ---------- checks ----------
let pass = 0;
const ok = (cond: boolean, name: string) => {
  if (!cond) throw new Error(`FAILED: ${name}`);
  pass++;
  console.log(`  ok  ${name}`);
};
const throws = (fn: () => unknown, msg: string) => {
  try { fn(); } catch (e) { return (e as Error).message.includes(msg); }
  return false;
};

console.log('\n=== Movie booking: find the violations ===');
for (const fd of FDS) {
  ok(fd.rhs.every((c) => holds(flat, fd.lhs, c)), `the rows agree with ${fd.lhs} -> ${fd.rhs}`);
}
ok(classify(KEY, FDS[0]) === 'partial (breaks 2NF)', 'booking_id -> show_id, user_id is partial (Q2)');
ok(classify(KEY, FDS[1]) === 'partial (breaks 2NF)', 'seat_id -> seat_row is partial (Q2)');
ok(classify(KEY, FDS[2]) === 'transitive (breaks 3NF)', 'show_id -> movie, screen is transitive (Q3)');
ok(classify(KEY, FDS[3]) === 'transitive (breaks 3NF)', 'user_id -> email is transitive (Q3)');
ok(classify(KEY, { lhs: KEY, rhs: ['price_paise'] }) === 'ok', '(booking_id, seat_id) -> price_paise is fine: it needs the whole key');
ok(!holds(flat, ['booking_id'], 'price_paise') && !holds(flat, ['seat_id'], 'price_paise'), 'the price really does need both parts');

console.log('\n=== Sample rows can only disprove a dependency ===');
const firstFour = flat.slice(0, 4);
ok(holds(firstFour, ['movie'], 'screen'), 'in the first 4 rows, movie -> screen looks true');
ok(!holds(flat, ['movie'], 'screen'), 'row 6 shows Heat on another screen, so it was an accident');

console.log('\n=== Split to 3NF ===');
const tables = {
  bookings: project(flat, ['booking_id', 'show_id', 'user_id']),
  shows: project(flat, ['show_id', 'movie', 'screen']),
  users: project(flat, ['user_id', 'email']),
  seats: project(flat, ['seat_id', 'seat_row']),
  booking_seats: project(flat, [...KEY, 'price_paise']), // the M:N junction, with its own column (Q4)
};
ok(tables.users.filter((r) => r.user_id === 'U1').length === 1, 'Asha\'s email now lives in one row, not four');
const all = Object.values(tables);
ok(flat.filter((r) => r.show_id === 'SH1').length === 3 && tables.shows.filter((r) => r.show_id === 'SH1').length === 1, 'renaming the SH1 movie touches 1 row, not 3');
ok(cells(all.flat()) === 55 && cells(flat) === 54, 'space is not the win on small data: 54 cells became 55, because keys repeat');
const rejoined = naturalJoin(naturalJoin(naturalJoin(naturalJoin(tables.booking_seats, tables.bookings), tables.shows), tables.users), tables.seats);
ok(canon(rejoined) === canon(flat), 'joining the 5 tables gives back the exact flat table: the split is lossless');

const wrongSplit = naturalJoin(project(flat, ['booking_id', 'screen']), project(flat, ['screen', 'seat_id']));
ok(wrongSplit.length > project(flat, ['booking_id', 'seat_id', 'screen']).length, 'splitting on a column that is not a key invents rows that never existed');

console.log('\n=== Wallet ledger ===');
ok(0.1 + 0.2 !== 0.3 && 10 + 20 === 30, 'floats drift, integer paise do not');
const w = new Wallet();
w.deposit('d1', 'asha', 100000);
w.transfer('t1', 'asha', 'ravi', 30000);
w.transfer('t1', 'asha', 'ravi', 30000); // the client retried after a timeout
ok(w.cached('asha') === 70000 && w.cached('ravi') === 30000, 'a retry with the same ref does not move money twice');
ok(throws(() => w.transfer('t2', 'ravi', 'asha', 90000), 'insufficient'), 'an overdraft is rejected');
ok(w.entries.length === 3 && w.cached('ravi') === 30000, 'and it writes nothing at all');
ok(throws(() => w.transfer('t3', 'asha', 'ravi', 10.5), 'CHECK'), 'a fractional amount is rejected');

const old = w.entries[1];
w.reverse('t1');
w.reverse('t1');
ok(w.cached('asha') === 100000 && w.cached('ravi') === 0, 'reversal restores the balance, and repeating it changes nothing');
ok(w.entries.length === 5 && w.entries[1] === old, 'history keeps both: the old entries are untouched');
ok(throws(() => { (w.entries[0] as { amountPaise: number }).amountPaise = 1; }, 'read only'), 'entries are frozen: a past entry cannot be edited');
ok(w.cached('asha') === w.rebuilt('asha') && w.cached('ravi') === w.rebuilt('ravi'), 'the cached balance equals the sum of the ledger');

console.log('\n=== Constraints ===');
const users = new Users();
const u1 = users.insert('asha@x.in');
ok(throws(() => users.insert('asha@x.in'), '23505'), 'a live duplicate email is rejected');
users.softDelete(u1, 1000);
const u2 = users.insert('asha@x.in');
ok(u2 !== u1 && users.total === 2, 'after a soft delete the email can sign up again: the index skips deleted rows');
users.changeEmail(u2, 'asha@new.in');
ok(users.get(u2).id === u2, 'the email changed and the id did not, so no foreign key moves (Q7)');

const likes = new Likes();
const results = [likes.like('u1', 'p1'), likes.like('u1', 'p1'), likes.like('u2', 'p1')];
ok(results.join() === 'true,false,true' && likes.likeCount === 2, 'a double tap adds no row and no count');

console.log('\n=== Copied column: customer_name (Q8) ===');
const source = new Map([['C1', { name: 'Asha', version: 1 }], ['C2', { name: 'Ravi', version: 1 }]]);
const admin = new AdminOrders();
source.set('C1', { name: 'Asha K', version: 2 });
ok(admin.rows[0].customerName === 'Asha', 'just after the rename the copy is stale: this is the lag you accept');
const v2: NameChanged = { custId: 'C1', name: 'Asha K', version: 2 };
const v3: NameChanged = { custId: 'C1', name: 'Asha Kumari', version: 3 };
source.set('C1', { name: 'Asha Kumari', version: 3 });
admin.apply(v3);
admin.apply(v2);
ok(admin.rows[0].customerName === 'Asha Kumari', 'events arrive out of order: the old one cannot overwrite the new one');
const writes = admin.writes;
admin.apply(v3);
ok(admin.writes === writes, 'a duplicate event writes nothing: the consumer is idempotent');
ok(writes === 2, 'one rename cost 2 writes here: 1 update x N copies');

source.set('C2', { name: 'Ravi S', version: 2 }); // this event is lost
ok(admin.rows[2].customerName === 'Ravi', 'a lost event leaves the copy wrong forever without help');
ok(admin.repair(source) === 1 && admin.rows[2].customerName === 'Ravi S', 'the repair job finds it: the source of truth rebuilds any copy');

console.log('\n=== Embed vs reference (Q6) ===');
const lines: Child = { readWithParent: true, shared: false, updatedAlone: false, maxCount: 50, bytesEach: 200 };
const comments: Child = { readWithParent: true, shared: false, updatedAlone: false, maxCount: 100_000, bytesEach: 300 };
const product: Child = { readWithParent: true, shared: true, updatedAlone: true, maxCount: 50, bytesEach: 500 };
ok(embedOrReference(lines) === 'embed', 'order lines: read together, bounded, owned, so embed (10 KB)');
ok(comments.maxCount * comments.bytesEach > MONGO_LIMIT && embedOrReference(comments) === 'reference', 'comments on a viral post: 100k x 300 B = 30 MB, over 16 MB, so reference');
ok(embedOrReference(product) === 'reference', 'a product is shared by many orders, so reference');

console.log('\n=== Numbers ===');
const extraGb = (rows: number, indexes: number) => (rows * 8 * indexes) / 1e9;
ok(extraGb(1e9, 1) === 8, 'UUID (16 B) vs BIGINT (8 B): 1B rows = 8 GB more per index that stores the key');
ok(extraGb(1e9, 4) === 32, 'with 4 such indexes that is 32 GB');

console.log(`\n${pass} checks passed`);
