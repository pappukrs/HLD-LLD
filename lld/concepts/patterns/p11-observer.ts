// P11 · Observer
// Run: npx tsx lld/concepts/patterns/p11-observer.ts
import { EventEmitter } from 'node:events';

type OrderEvent = { type: 'DELIVERED' | 'CANCELLED'; orderId: string; userId: string };

// ---------- before: the service calls every team directly ----------
class OrderServiceBefore {
  markDelivered(orderId: string, userId: string) {
    console.log(`  sms -> ${userId}: order ${orderId} delivered`);
    console.log(`  loyalty -> +10 points for ${userId}`);
    console.log(`  analytics -> delivered ${orderId}`);
  }
}

// ---------- after: subject + observers ----------
interface OrderObserver {
  readonly name: string;
  onEvent(e: OrderEvent): void;
}

class OrderEvents {
  private observers = new Set<OrderObserver>();
  subscribe(o: OrderObserver): () => void {
    this.observers.add(o);
    return () => { this.observers.delete(o); };
  }
  publish(e: OrderEvent): void {
    for (const o of this.observers) {
      try {
        o.onEvent(e);
      } catch (err) {
        console.log(`  [${o.name}] failed: ${(err as Error).message} (others still run)`);
      }
    }
  }
}

class SmsNotifier implements OrderObserver {
  readonly name = 'sms';
  onEvent(e: OrderEvent) { console.log(`  sms -> ${e.userId}: order ${e.orderId} ${e.type.toLowerCase()}`); }
}
class LoyaltyPoints implements OrderObserver {
  readonly name = 'loyalty';
  points = new Map<string, number>();
  onEvent(e: OrderEvent) {
    if (e.type !== 'DELIVERED') return;
    this.points.set(e.userId, (this.points.get(e.userId) ?? 0) + 10);
    console.log(`  loyalty -> ${e.userId} now has ${this.points.get(e.userId)} points`);
  }
}
class BrokenAnalytics implements OrderObserver {
  readonly name = 'analytics';
  onEvent(): void { throw new Error('analytics endpoint down'); }
}

class OrderService {
  constructor(private readonly events: OrderEvents) {}
  markDelivered(orderId: string, userId: string) {
    this.events.publish({ type: 'DELIVERED', orderId, userId });
  }
  cancel(orderId: string, userId: string) {
    this.events.publish({ type: 'CANCELLED', orderId, userId });
  }
}

// ---------- Node's EventEmitter, typed with an event map ----------
type PaymentEvents = {
  captured: [paymentId: string, amount: number];
  failed: [paymentId: string, reason: string];
};

function main() {
  console.log('--- before ---');
  new OrderServiceBefore().markDelivered('ord_1', 'u1');

  console.log('\n--- after: observers, one is broken ---');
  const events = new OrderEvents();
  const service = new OrderService(events);
  events.subscribe(new SmsNotifier());
  events.subscribe(new BrokenAnalytics());
  const unsubscribeLoyalty = events.subscribe(new LoyaltyPoints());
  service.markDelivered('ord_2', 'u1');

  console.log('\n--- after unsubscribing loyalty ---');
  unsubscribeLoyalty();
  service.cancel('ord_3', 'u1');

  console.log('\n--- EventEmitter: synchronous, in registration order ---');
  const bus = new EventEmitter<PaymentEvents>();
  bus.on('captured', (id, amt) => console.log(`  1st listener: ${id} captured ${amt}`));
  bus.on('captured', (id) => console.log(`  2nd listener: ledger entry for ${id}`));
  bus.once('failed', (id, reason) => console.log(`  once: ${id} failed (${reason})`));
  console.log('  before emit');
  bus.emit('captured', 'pay_1', 499);
  console.log('  after emit (both listeners already ran)');
  bus.emit('failed', 'pay_2', 'insufficient funds');
  console.log(`  'failed' listeners left after once: ${bus.listenerCount('failed')}`);

  console.log("\n--- 'error' with no listener throws ---");
  const raw = new EventEmitter();
  try {
    raw.emit('error', new Error('socket closed'));
  } catch (e) {
    console.log(`  thrown: ${(e as Error).message}`);
  }
}

main();

export {};
