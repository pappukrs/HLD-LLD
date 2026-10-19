// H05 · Real-time: polling cost, cross-gateway pub/sub, replay on reconnect, reconnect storms.
// Run: npx tsx hld/1-basics/H05-realtime-communication/demo.ts
import { EventEmitter } from 'node:events';

// ---- 1. Polling vs push: what does it cost to deliver 3 messages in 60 s? ----
function pollingCost(users: number, intervalS: number, msgsPerMin: number) {
  const reqPerSec = users / intervalS;
  const usefulShare = Math.min(1, msgsPerMin / (60 / intervalS));
  return { reqPerSec: Math.round(reqPerSec), emptyPct: Math.round((1 - usefulShare) * 100), avgDelayS: intervalS / 2 };
}

// ---- 2. Gateways joined by a pub/sub bus (the Socket.IO Redis adapter idea) ----
class PubSub {
  private em = new EventEmitter();
  publish(ch: string, msg: Msg) { this.em.emit(ch, msg); }
  subscribe(ch: string, fn: (m: Msg) => void) { this.em.on(ch, fn); }
  unsubscribe(ch: string) { this.em.removeAllListeners(ch); }
}
type Msg = { seq: number; from: string; text: string };
type Client = { userId: string; lastSeq: number; online: boolean };

class MessageStore {
  private rows: Msg[] = [];
  private seq = 0;
  save(from: string, text: string): Msg { const m = { seq: ++this.seq, from, text }; this.rows.push(m); return m; }
  after(seq: number) { return this.rows.filter((m) => m.seq > seq); }
}

class Gateway {
  readonly sockets = new Map<string, Client>();
  constructor(readonly name: string, private bus: PubSub) {}
  connect(c: Client, store: MessageStore) {
    this.sockets.set(c.userId, c);
    c.online = true;
    this.bus.subscribe(`user:${c.userId}`, (m) => this.deliver(c, m));
    const missed = store.after(c.lastSeq);
    if (missed.length) console.log(`  ${this.name}: ${c.userId} reconnected with lastSeq=${c.lastSeq}, replaying seq ${missed.map((m) => m.seq).join(',')}`);
    missed.forEach((m) => this.deliver(c, m));
  }
  drop(userId: string) {
    const c = this.sockets.get(userId);
    if (c) c.online = false;
    this.sockets.delete(userId);
    this.bus.unsubscribe(`user:${userId}`);
  }
  private deliver(c: Client, m: Msg) {
    if (!c.online) return;
    c.lastSeq = Math.max(c.lastSeq, m.seq);
    console.log(`  ${this.name} → ${c.userId}: [seq ${m.seq}] ${m.from}: ${m.text}`);
  }
}

function send(bus: PubSub, store: MessageStore, from: string, to: string, text: string) {
  const m = store.save(from, text); // store first: the socket is not a queue
  bus.publish(`user:${to}`, m);
}

// ---- 4. Reconnect storm: 100k clients after a gateway restart ----
function reconnectsPerSecond(clients: number, jitterMaxS: number, seed = 7) {
  let x = seed;
  const rand = () => ((x = (x * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const buckets = new Map<number, number>();
  for (let i = 0; i < clients; i++) {
    const t = Math.floor(1 + rand() * jitterMaxS); // 1 s base backoff + jitter
    buckets.set(t, (buckets.get(t) ?? 0) + 1);
  }
  return Math.max(...buckets.values());
}

function main() {
  console.log('\n== 1. Short polling cost for 1M users, 3 messages per minute ==');
  for (const every of [1, 2, 5, 15]) {
    const c = pollingCost(1_000_000, every, 3);
    console.log(`  poll every ${String(every).padStart(2)} s: ${c.reqPerSec.toLocaleString().padStart(9)} req/s, ${c.emptyPct}% empty, avg delay ${c.avgDelayS} s`);
  }
  console.log('  push (SSE/WS): 0 empty requests, delay ~1 network trip; cost = 1M open connections');

  console.log('\n== 2. A on gateway-1 sends to B on gateway-2 through pub/sub ==');
  const bus = new PubSub();
  const store = new MessageStore();
  const g1 = new Gateway('gateway-1', bus);
  const g2 = new Gateway('gateway-2', bus);
  const g3 = new Gateway('gateway-3', bus);
  const A: Client = { userId: 'A', lastSeq: 0, online: false };
  const B: Client = { userId: 'B', lastSeq: 0, online: false };
  g1.connect(A, store);
  g2.connect(B, store);
  send(bus, store, 'A', 'B', 'hi B');
  console.log('  gateway-1 never needed to know where B was connected');

  console.log('\n== 3. B drops (no FIN), misses 2 messages, reconnects on gateway-3 ==');
  g2.drop('B');
  console.log('  heartbeat: 2 missed pongs → gateway-2 closes B and unsubscribes user:B');
  send(bus, store, 'A', 'B', 'are you there?');
  send(bus, store, 'A', 'B', 'call me');
  console.log('  (no subscriber for user:B: messages are only in the store; send mobile push)');
  g3.connect(B, store);
  send(bus, store, 'A', 'B', 'welcome back');

  console.log('\n== 4. Gateway restart drops 100,000 sockets ==');
  console.log(`  no jitter        : peak ${reconnectsPerSecond(100_000, 0.0001).toLocaleString()} reconnects in one second`);
  console.log(`  jitter 0..10 s   : peak ${reconnectsPerSecond(100_000, 10).toLocaleString()} per second`);
  console.log(`  jitter 0..30 s   : peak ${reconnectsPerSecond(100_000, 30).toLocaleString()} per second`);

  console.log('\n== 5. Capacity: plan by concurrent connections ==');
  const users = 10_000_000, perBox = 100_000;
  const boxes = Math.ceil((users / perBox) * 1.3);
  console.log(`  ${users.toLocaleString()} users / ${perBox.toLocaleString()} per gateway × 1.3 headroom = ${boxes} gateways`);
  console.log(`  heartbeats every 30 s = ${Math.round(users / 30).toLocaleString()} ping frames/s`);
}

main();
