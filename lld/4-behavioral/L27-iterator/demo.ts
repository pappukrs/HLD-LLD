// L27 Iterator: walk a collection without knowing how it is stored.
// Run: npx tsx lld/4-behavioral/L27-iterator/demo.ts

export {}; // module scope: keeps names local to this file

interface Payment { id: string; amount: number }

// 1. A collection with a hidden layout (segments of 3), iterable with a generator.
class PaymentLog implements Iterable<Payment> {
  private segments: Payment[][] = [[]];
  private static readonly SEGMENT_SIZE = 3;

  append(p: Payment): void {
    let last = this.segments[this.segments.length - 1];
    if (last.length === PaymentLog.SEGMENT_SIZE) { last = []; this.segments.push(last); }
    last.push(p);
  }
  get segmentCount(): number { return this.segments.length; }

  *[Symbol.iterator](): Generator<Payment> {
    for (const seg of this.segments) yield* seg;
  }
  // A second way to walk the same data: from an offset (like a Kafka consumer).
  *from(offset: number): Generator<Payment> {
    let i = 0;
    for (const p of this) if (i++ >= offset) yield p;
  }
}

// 2. The protocol by hand: this is what for..of calls under the hood.
function countdown(n: number): Iterable<number> {
  return {
    [Symbol.iterator](): Iterator<number> {
      let cur = n;
      return { next: () => (cur > 0 ? { value: cur--, done: false } : { value: undefined, done: true }) };
    },
  };
}

// 3. Lazy pipeline helpers: nothing runs until someone pulls.
function* filter<T>(src: Iterable<T>, pred: (x: T) => boolean): Generator<T> {
  for (const x of src) if (pred(x)) yield x;
}
function* take<T>(src: Iterable<T>, n: number): Generator<T> {
  if (n <= 0) return;
  let i = 0;
  for (const x of src) { yield x; if (++i >= n) return; }
}
function* naturals(): Generator<number> { let i = 1; while (true) yield i++; }

// 4. Async iterator over a cursor-paginated API. Callers never see pages or cursors.
const ALL: Payment[] = Array.from({ length: 7 }, (_, i) => ({ id: `pay_${i + 1}`, amount: (i + 1) * 100 }));
let apiCalls = 0;
async function listPayments(cursor: number, limit: number): Promise<{ items: Payment[]; next?: number }> {
  apiCalls++;
  await new Promise((r) => setTimeout(r, 5)); // pretend network
  const items = ALL.slice(cursor, cursor + limit);
  const next = cursor + limit < ALL.length ? cursor + limit : undefined;
  return { items, next };
}
async function* allPayments(pageSize: number): AsyncGenerator<Payment> {
  let cursor: number | undefined = 0;
  try {
    while (cursor !== undefined) {
      const page = await listPayments(cursor, pageSize);
      console.log(`   (fetched page at cursor ${cursor}: ${page.items.length} items)`);
      yield* page.items;
      cursor = page.next;
    }
  } finally {
    console.log('   (finally: generator closed, release the DB cursor / socket here)');
  }
}

async function main(): Promise<void> {
  console.log('== 1. for..of over a segmented log (caller never sees segments) ==');
  const log = new PaymentLog();
  ALL.forEach((p) => log.append(p));
  console.log(`   stored in ${log.segmentCount} segments`);
  console.log('  ', [...log].map((p) => p.id).join(' '));

  console.log('\n== 2. A second traversal: from offset 4 ==');
  console.log('  ', [...log.from(4)].map((p) => p.id).join(' '));

  console.log('\n== 3. The protocol by hand: next() → { value, done } ==');
  const it = countdown(3)[Symbol.iterator]();
  for (let r = it.next(); ; r = it.next()) {
    console.log('  ', JSON.stringify(r));
    if (r.done) break;
  }

  console.log('\n== 4. Laziness: an infinite generator, but we pull only 3 ==');
  const evens = take(filter(naturals(), (n) => n % 2 === 0), 3);
  console.log('   first 3 even numbers:', [...evens].join(', '));

  console.log('\n== 5. Generators are one-shot ==');
  const once = log.from(5);
  console.log('   first pass :', [...once].map((p) => p.id).join(' '));
  console.log('   second pass:', [...once].map((p) => p.id).join(' ') || '(empty, iterator used up)');
  console.log('   but the iterable can be walked again:', [...log].length, 'items');

  console.log('\n== 6. Async pagination with for await (page size 3) ==');
  let total = 0;
  for await (const p of allPayments(3)) total += p.amount;
  console.log(`   total = ₹${total}, API calls = ${apiCalls}`);

  console.log('\n== 7. Break early: only the pages we need are fetched ==');
  apiCalls = 0;
  for await (const p of allPayments(3)) {
    console.log(`   reconcile ${p.id}`);
    if (p.id === 'pay_2') break; // calls return() → finally runs
  }
  console.log(`   API calls = ${apiCalls} (not 3)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
