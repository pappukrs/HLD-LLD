// L21 Observer and pub-sub: subject + observers, sync vs async notify, typed EventEmitter,
// a tiny topic broker with an offline subscriber, and an idempotent consumer.
// Run: npx tsx lld/4-behavioral/L21-observer/demo.ts
import { EventEmitter } from 'node:events';

type OrderEvent = { eventId: string; type: 'DELIVERED' | 'CANCELLED'; orderId: string; userId: string };
interface OrderObserver { readonly name: string; onEvent(e: OrderEvent): Promise<void> }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let seq = 0;
const ev = (type: OrderEvent['type'], orderId: string): OrderEvent => ({ eventId: `evt-${++seq}`, type, orderId, userId: 'u1' });

// ---------- Subject ----------
class OrderEvents {
  private observers = new Set<OrderObserver>();
  subscribe(o: OrderObserver): () => void {
    this.observers.add(o);
    return () => { this.observers.delete(o); };
  }
  async notifySync(e: OrderEvent): Promise<void> {          // waits for each; one throw stops the rest
    for (const o of this.observers) await o.onEvent(e);
  }
  notifyAsync(e: OrderEvent): Promise<PromiseSettledResult<void>[]> { // start all; isolate failures
    const runs = [...this.observers].map((o) =>
      o.onEvent(e).catch((err: Error) => { console.log(`    [${o.name}] failed, logged: ${err.message}`); }));
    return Promise.allSettled(runs);
  }
  get size(): number { return this.observers.size; }
}

const observer = (name: string, ms: number, fail = false): OrderObserver => ({
  name,
  async onEvent(e) {
    await sleep(ms);
    if (fail) throw new Error(`${name} timeout`);
    console.log(`    [${name}] handled ${e.type} ${e.orderId} after ${ms} ms`);
  },
});

// ---------- A tiny broker with topics, buffering for offline subscribers ----------
type Msg = { eventId: string; topic: string; body: string };
class Broker {
  private subs = new Map<string, Set<string>>();       // topic -> subscriber names
  private online = new Map<string, (m: Msg) => void>();
  private inbox = new Map<string, Msg[]>();            // buffered per subscriber
  subscribe(topic: string, name: string, handler: (m: Msg) => void): void {
    if (!this.subs.has(topic)) this.subs.set(topic, new Set());
    this.subs.get(topic)!.add(name);
    this.online.set(name, handler);
  }
  goOffline(name: string): (m: Msg) => void { const h = this.online.get(name)!; this.online.delete(name); return h; }
  comeBack(name: string, h: (m: Msg) => void): void {
    this.online.set(name, h);
    for (const m of this.inbox.get(name) ?? []) h(m);
    this.inbox.delete(name);
  }
  publish(m: Msg): void {
    for (const name of this.subs.get(m.topic) ?? []) {
      const h = this.online.get(name);
      if (h) h(m);
      else { this.inbox.set(name, [...(this.inbox.get(name) ?? []), m]); console.log(`    broker: ${name} offline, buffered ${m.eventId}`); }
    }
  }
}

async function main(): Promise<void> {
  const events = new OrderEvents();
  events.subscribe(observer('email', 300));
  events.subscribe(observer('inventory', 40));
  const unsubAnalytics = events.subscribe(observer('analytics', 20));

  console.log('== 1. Sync notify: the caller waits for the sum');
  let t = Date.now();
  await events.notifySync(ev('DELIVERED', 'ord-1'));
  console.log(`  reply after ~${Date.now() - t} ms (300 + 40 + 20)\n`);

  console.log('== 2. Async notify: reply at once, observers run in parallel');
  t = Date.now();
  const done = events.notifyAsync(ev('DELIVERED', 'ord-2'));
  console.log(`  reply after ~${Date.now() - t} ms`);
  await done;

  console.log('\n== 3. One observer fails: sync stops, async isolates');
  const bad = new OrderEvents();
  bad.subscribe(observer('email', 30, true));
  bad.subscribe(observer('inventory', 10));
  try { await bad.notifySync(ev('DELIVERED', 'ord-3')); } catch (e) { console.log(`  sync: ${(e as Error).message}, inventory never ran`); }
  await bad.notifyAsync(ev('DELIVERED', 'ord-4'));
  console.log('  async: inventory still handled it');

  console.log('\n== 4. Unsubscribe');
  unsubAnalytics();
  console.log(`  observers left: ${events.size}`);

  console.log('\n== 5. Node EventEmitter is synchronous and typed');
  type PaymentEvents = { captured: [paymentId: string, amount: number]; failed: [paymentId: string, reason: string] };
  const bus = new EventEmitter<PaymentEvents>();
  bus.on('captured', (id, amt) => console.log(`    listener 1: ${id} captured ${amt}`));
  bus.on('captured', (id) => console.log(`    listener 2: ledger entry for ${id}`));
  bus.once('failed', (id, why) => console.log(`    once: ${id} failed (${why})`));
  console.log('  before emit');
  bus.emit('captured', 'pay_1', 499);
  console.log('  after emit (both listeners already ran)');
  bus.emit('failed', 'pay_2', 'insufficient funds');
  console.log(`  'failed' listeners left after once(): ${bus.listenerCount('failed')}`);
  try { new EventEmitter().emit('error', new Error('socket closed')); } catch (e) { console.log(`  'error' with no listener throws: ${(e as Error).message}`); }

  console.log('\n== 6. Pub-sub broker: topics, offline subscriber, duplicate delivery');
  const broker = new Broker();
  const processed = new Set<string>();
  const emailHandler = (m: Msg) => {
    if (processed.has(m.eventId)) { console.log(`    email: duplicate ${m.eventId}, skipped (idempotent)`); return; }
    processed.add(m.eventId);
    console.log(`    email: sent for ${m.topic} (${m.eventId})`);
  };
  broker.subscribe('order.created', 'email', emailHandler);
  broker.subscribe('payment.failed', 'email', emailHandler);
  broker.subscribe('order.created', 'inventory', (m) => console.log(`    inventory: reserve stock (${m.eventId})`));
  broker.subscribe('order.cancelled', 'billing', (m) => console.log(`    billing: refund (${m.eventId})`));

  broker.publish({ eventId: 'e1', topic: 'order.created', body: '{}' });
  broker.publish({ eventId: 'e2', topic: 'order.cancelled', body: '{}' });
  const h = broker.goOffline('email');
  broker.publish({ eventId: 'e3', topic: 'payment.failed', body: '{}' });
  console.log('  email comes back:');
  broker.comeBack('email', h);
  console.log('  broker redelivers e3 (at-least-once):');
  broker.publish({ eventId: 'e3', topic: 'payment.failed', body: '{}' });

  console.log('\nTakeaway: publish facts, let subscribers react; async + isolated in-process, broker + idempotency across services.');
}

main();
