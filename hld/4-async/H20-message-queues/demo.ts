// H20 · Message queues and pub-sub
// Run: npx tsx hld/4-async/H20-message-queues/demo.ts
// A tiny in-memory broker: fanout exchange → one queue per service, competing workers,
// ack-after-work, redelivery on crash, exponential backoff with jitter, DLQ, idempotent consumer.
// Time is simulated (a virtual clock), so the demo finishes instantly.
export {};

type Msg = { id: string; type: string; body: Record<string, unknown>; attempts: number; visibleAt: number };

class Queue {
  ready: Msg[] = [];
  dlq: Msg[] = [];
  constructor(public name: string, public maxAttempts = 3) {}
  push(m: Msg) { this.ready.push(m); }
  // Take the first message whose backoff has expired.
  take(now: number): Msg | undefined {
    const i = this.ready.findIndex((m) => m.visibleAt <= now);
    return i >= 0 ? this.ready.splice(i, 1)[0] : undefined;
  }
}

class FanoutExchange {
  private bound: Queue[] = [];
  bind(q: Queue) { this.bound.push(q); }
  publish(id: string, type: string, body: Record<string, unknown>) {
    for (const q of this.bound) q.push({ id, type, body, attempts: 0, visibleAt: 0 }); // a COPY per queue
  }
}

const header = (t: string) => console.log(`\n=== ${t} ===`);
let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const backoffMs = (attempt: number) => Math.round(Math.min(30_000, 1000 * 2 ** (attempt - 1)) * (0.5 + rand())); // full jitter-ish

type Handler = (m: Msg) => void; // throws to signal failure

// One worker loop step: take → handle → ack, or nack with backoff / DLQ.
function runWorker(q: Queue, worker: string, handler: Handler, now: number, crashBeforeAck = false): boolean {
  const m = q.take(now);
  if (!m) return false;
  m.attempts++;
  try {
    handler(m);
    if (crashBeforeAck) {
      console.log(`  [${worker}] did the work for ${m.id}, then CRASHED before ack → broker requeues`);
      q.ready.unshift({ ...m, attempts: m.attempts - 1 });
      return true;
    }
    console.log(`  [${worker}] ${m.id} ok → ack (deleted)`);
  } catch (e) {
    if (m.attempts >= q.maxAttempts) {
      q.dlq.push(m);
      console.log(`  [${worker}] ${m.id} failed attempt ${m.attempts}/${q.maxAttempts} → DLQ (alert!)`);
    } else {
      const d = backoffMs(m.attempts);
      m.visibleAt = now + d;
      q.push(m);
      console.log(`  [${worker}] ${m.id} failed attempt ${m.attempts}/${q.maxAttempts}: ${(e as Error).message} → retry in ${d} ms`);
    }
  }
  return true;
}

function main(): void {
  const ex = new FanoutExchange();
  const email = new Queue('q.email');
  const ledger = new Queue('q.ledger');
  const analytics = new Queue('q.analytics');
  [email, ledger, analytics].forEach((q) => ex.bind(q));

  header('1. Fan-out: one event, one copy per service');
  ex.publish('evt-42', 'order.placed', { orderId: 42, to: 'a@x.com' });
  for (const q of [email, ledger, analytics]) console.log(`${q.name.padEnd(12)} depth=${q.ready.length}`);

  header('2. Competing consumers on q.email (each message → one worker)');
  for (let i = 43; i <= 46; i++) ex.publish(`evt-${i}`, 'order.placed', { orderId: i, to: `u${i}@x.com` });
  const sent: string[] = [];
  const processed = new Set<string>(); // idempotency table (unique key in a real DB)
  const sendEmail: Handler = (m) => {
    if (processed.has(m.id)) { console.log(`  (dedupe) ${m.id} already processed → skip side effect`); return; }
    processed.add(m.id); // same transaction as the side effect in real life
    sent.push(String(m.body.to));
  };
  let turn = 0;
  while (email.ready.length > 1) runWorker(email, turn++ % 2 ? 'email-w2' : 'email-w1', sendEmail, 0);

  header('3. Crash before ack → redelivery → idempotent consumer saves us');
  runWorker(email, 'email-w2', sendEmail, 0, true);
  runWorker(email, 'email-w1', sendEmail, 0);
  console.log(`emails actually sent: ${sent.length} for ${processed.size} unique messages (no duplicate)`);

  header('4. Poison message: backoff with jitter, then DLQ');
  email.push({ id: 'evt-bad', type: 'order.placed', body: { to: 'not-an-email' }, attempts: 0, visibleAt: 0 });
  const strict: Handler = (m) => { if (!String(m.body.to).includes('@')) throw new Error('invalid address'); sendEmail(m); };
  let now = 0;
  while (email.ready.length) {
    if (!runWorker(email, 'email-w1', strict, now)) now = Math.min(...email.ready.map((m) => m.visibleAt)); // jump the clock
  }
  console.log(`q.email depth=${email.ready.length}, DLQ=${email.dlq.map((m) => m.id).join(', ')} (t=${now} ms)`);

  header('5. Load levelling: a spike vs steady workers');
  const workers = 4, perMsgMs = 50, burst = 1000; // 1000 msgs arrive at once
  const capacity = (workers * 1000) / perMsgMs;    // msg/s
  console.log(`capacity = ${workers} workers × (1000/${perMsgMs}) = ${capacity} msg/s`);
  console.log(`burst of ${burst} drains in ${(burst / capacity).toFixed(1)} s; the API never waited on email`);
  console.log(`Little's law for 2000 msg/s at ${perMsgMs} ms: need ${(2000 * perMsgMs) / 1000} concurrent handlers`);

  header('6. Redis Pub/Sub vs durable queue (offline subscriber)');
  const subscribers: Array<(m: string) => void> = []; // nobody connected right now
  const deliveredPubSub = subscribers.length;
  ex.publish('evt-47', 'order.placed', { orderId: 47 });
  console.log(`Pub/Sub PUBLISH evt-47 → delivered to ${deliveredPubSub} subscribers → message gone`);
  console.log(`q.analytics still holds: ${analytics.ready.map((m) => m.id).join(', ')} → read after restart`);
}

main();
