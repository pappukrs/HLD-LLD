// P16 · Iterator
// Run: npx tsx lld/concepts/patterns/p16-iterator.ts
import { Readable } from 'node:stream';

interface Message { offset: number; payload: string }

// ---------- before: callers walk the internal structure ----------
const rawSegments: Message[][] = [
  [{ offset: 0, payload: 'a' }, { offset: 1, payload: 'b' }],
  [{ offset: 2, payload: 'c' }],
];
function readAllBefore(): string[] {
  const out: string[] = [];
  for (const seg of rawSegments) for (const m of seg) out.push(m.payload);
  return out;
}

// ---------- after: an iterable topic + consumer offsets ----------
class Topic implements Iterable<Message> {
  private segments: Message[][] = [[]];
  private size = 0;
  constructor(private readonly segmentSize: number) {}

  append(payload: string): number {
    let last = this.segments[this.segments.length - 1]!;
    if (last.length === this.segmentSize) {
      last = [];
      this.segments.push(last);
    }
    last.push({ offset: this.size, payload });
    return this.size++;
  }

  *[Symbol.iterator](): Iterator<Message> {
    for (const seg of this.segments) yield* seg;
  }

  *from(offset: number): Generator<Message> {
    const segIdx = Math.floor(offset / this.segmentSize); // jump to the right segment
    for (let s = segIdx; s < this.segments.length; s++) {
      for (const m of this.segments[s]!) if (m.offset >= offset) yield m;
    }
  }

  get segmentCount() { return this.segments.length; }
}

class ConsumerGroup {
  private offset = 0;
  constructor(readonly name: string, private readonly topic: Topic) {}
  poll(max: number): Message[] {
    const batch: Message[] = [];
    for (const m of this.topic.from(this.offset)) {
      if (batch.length === max) break; // the generator stops here, lazily
      batch.push(m);
    }
    this.offset += batch.length; // commit after reading (at-least-once if done after processing)
    return batch;
  }
}

// ---------- async iterator: paging through an API ----------
interface Page { items: string[]; nextCursor?: string }
const fakeApi = {
  calls: 0,
  async listPayments(cursor?: string): Promise<Page> {
    this.calls++;
    const start = cursor ? Number(cursor) : 0;
    const items = Array.from({ length: 3 }, (_, i) => `pay_${start + i}`).filter((_, i) => start + i < 7);
    const next = start + 3;
    return { items, nextCursor: next < 7 ? String(next) : undefined };
  },
};
async function* allPayments(): AsyncGenerator<string> {
  let cursor: string | undefined;
  do {
    const page = await fakeApi.listPayments(cursor);
    yield* page.items;
    cursor = page.nextCursor;
  } while (cursor);
}

// ---------- lazy infinite generator ----------
function* idSequence(prefix: string): Generator<string> {
  let i = 1;
  while (true) yield `${prefix}_${String(i++).padStart(4, '0')}`;
}

async function main() {
  console.log('--- before ---');
  console.log(' ', readAllBefore().join(','));

  console.log('\n--- after: iterable topic ---');
  const topic = new Topic(3);
  for (const p of ['order_created', 'payment_captured', 'order_packed', 'order_shipped', 'order_delivered']) topic.append(p);
  console.log(`  segments: ${topic.segmentCount}, all: ${[...topic].map((m) => m.payload).join(', ')}`);

  const billing = new ConsumerGroup('billing', topic);
  const email = new ConsumerGroup('email', topic);
  console.log(`  billing poll(2): ${billing.poll(2).map((m) => m.offset).join(',')}`);
  console.log(`  billing poll(2): ${billing.poll(2).map((m) => m.offset).join(',')}`);
  console.log(`  email   poll(5): ${email.poll(5).map((m) => m.offset).join(',')}  (own offset)`);
  topic.append('refund_requested');
  console.log(`  billing poll(9): ${billing.poll(9).map((m) => `${m.offset}:${m.payload}`).join(', ')}`);

  console.log('\n--- async iterator over pages ---');
  const ids: string[] = [];
  for await (const p of allPayments()) ids.push(p);
  console.log(`  ${ids.join(', ')}  (${fakeApi.calls} API calls, caller never saw a cursor)`);

  console.log('\n--- lazy generator ---');
  const gen = idSequence('INV');
  console.log(`  ${gen.next().value}, ${gen.next().value}, ${gen.next().value}`);

  console.log('\n--- Node Readable streams are async iterable ---');
  let total = 0;
  for await (const chunk of Readable.from(['120', '80', '300'])) total += Number(chunk);
  console.log(`  total from stream: ${total}`);
}

await main();

export {};
