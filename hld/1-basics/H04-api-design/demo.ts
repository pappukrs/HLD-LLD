// H04 · API design: idempotent POST + offset vs cursor pagination.
// Run: npx tsx hld/1-basics/H04-api-design/demo.ts
import { createHash, randomUUID } from 'node:crypto';

type Res = { code: number; body: string };
type Entry = { status: 'IN_PROGRESS' | 'DONE'; hash: string; response?: Res };
type PayReq = { orderId: string; amount: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sha = (o: unknown) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 10);

// ---- Idempotency store: insertIfAbsent is the atomic step (UNIQUE constraint / SET NX) ----
class IdempotencyStore {
  private rows = new Map<string, Entry>();
  insertIfAbsent(key: string, e: Entry): boolean {
    if (this.rows.has(key)) return false;
    this.rows.set(key, e);
    return true;
  }
  get(key: string) { return this.rows.get(key); }
  set(key: string, e: Entry) { this.rows.set(key, e); }
}

let charges = 0;
async function pspCharge(req: PayReq): Promise<string> {
  await sleep(30); // the slow bank call
  charges++;
  return `pay_${charges} for ${req.orderId} amount=${req.amount}`;
}

const store = new IdempotencyStore();
async function createPayment(key: string | undefined, req: PayReq): Promise<Res> {
  if (!key) return { code: 201, body: await pspCharge(req) }; // the unsafe version
  const hash = sha(req);
  if (!store.insertIfAbsent(key, { status: 'IN_PROGRESS', hash })) {
    const s = store.get(key)!;
    if (s.hash !== hash) return { code: 422, body: 'key reused with a different body' };
    if (s.status === 'IN_PROGRESS') return { code: 409, body: 'same request in progress' };
    return s.response!; // replay the stored answer
  }
  const res: Res = { code: 201, body: await pspCharge(req) };
  store.set(key, { status: 'DONE', hash, response: res });
  return res;
}

// ---- Pagination over a feed that keeps growing ----
type Post = { id: number; t: number };
let feed: Post[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, t: 1000 + i }));
const newestFirst = () => [...feed].sort((a, b) => b.t - a.t || b.id - a.id);

function offsetPage(offset: number, limit: number) {
  return newestFirst().slice(offset, offset + limit);
}
type Cursor = { t: number; id: number };
const enc = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');
const dec = (s: string): Cursor => JSON.parse(Buffer.from(s, 'base64url').toString());
function cursorPage(after: string | null, limit: number) {
  const c = after ? dec(after) : null;
  const rows = newestFirst()
    .filter((p) => !c || p.t < c.t || (p.t === c.t && p.id < c.id))
    .slice(0, limit);
  const last = rows[rows.length - 1];
  return { rows, next: rows.length === limit ? enc({ t: last.t, id: last.id }) : null };
}

async function main() {
  const req: PayReq = { orderId: 'ord_7', amount: 499 };

  console.log('\n== 1. No idempotency key: client retries after a timeout ==');
  await createPayment(undefined, req);
  await createPayment(undefined, req);
  console.log(`charges made: ${charges}  <- user paid twice`);

  charges = 0;
  console.log('\n== 2. With Idempotency-Key: same key on retry ==');
  const key = randomUUID();
  const a = await createPayment(key, req);
  const b = await createPayment(key, req);
  console.log(`first : ${a.code} ${a.body}`);
  console.log(`retry : ${b.code} ${b.body}`);
  console.log(`charges made: ${charges}  <- one charge, same response replayed`);

  console.log('\n== 3. Two retries race at the same moment ==');
  const k2 = randomUUID();
  const [r1, r2] = await Promise.all([createPayment(k2, req), createPayment(k2, req)]);
  console.log(`call A: ${r1.code} ${r1.body}`);
  console.log(`call B: ${r2.code} ${r2.body}`);
  console.log(`charges made so far: ${charges} (only one of the racing calls charged)`);

  console.log('\n== 4. Same key, different body ==');
  const bad = await createPayment(key, { orderId: 'ord_7', amount: 999 });
  console.log(`${bad.code} ${bad.body}`);

  console.log('\n== 5. Offset pagination while new posts arrive ==');
  const p1 = offsetPage(0, 4).map((p) => p.id);
  feed.push({ id: 11, t: 2000 }, { id: 12, t: 2001 }); // two new posts at the top
  const p2 = offsetPage(4, 4).map((p) => p.id);
  const dupes = p2.filter((id) => p1.includes(id));
  console.log(`page 1: [${p1}]  page 2: [${p2}]  duplicates: [${dupes}]`);

  console.log('\n== 6. Cursor pagination, same situation ==');
  feed = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, t: 1000 + i }));
  const c1 = cursorPage(null, 4);
  feed.push({ id: 11, t: 2000 }, { id: 12, t: 2001 });
  const c2 = cursorPage(c1.next, 4);
  console.log(`page 1: [${c1.rows.map((p) => p.id)}]  cursor=${c1.next}`);
  console.log(`page 2: [${c2.rows.map((p) => p.id)}]  duplicates: none, new posts wait for a refresh`);

  console.log('\n== 7. Cost at depth (rows the DB touches for one page of 20) ==');
  for (const depth of [0, 1_000, 100_000, 1_000_000]) {
    console.log(`page starting at ${depth.toLocaleString().padStart(9)}: offset reads ${(depth + 20).toLocaleString().padStart(9)} rows, keyset reads ~20 (+ index seek)`);
  }
}

main();
