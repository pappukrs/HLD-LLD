import * as starter from './starter';
import * as reference from './reference';
import type { DriverAssignmentStrategy, OrderEvent } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { FoodDeliveryService, NearestDriverStrategy, HighestRatedStrategy } = (
  process.env.REF ? reference : starter
) as typeof reference;

const PIZZA = { name: 'Pizza', pricePaise: 29_900, quantity: 2 };

function makeService(strategy: DriverAssignmentStrategy = new NearestDriverStrategy(), fee = 5_000) {
  let now = 1_000;
  const svc = new FoodDeliveryService({ strategy, cancellationFeePaise: fee, clock: () => now });
  svc.addRestaurant('R1', { x: 0, y: 0 });
  svc.addDriver({ id: 'FAR', location: { x: 10, y: 0 }, rating: 4.9 });
  svc.addDriver({ id: 'NEAR', location: { x: 1, y: 0 }, rating: 4.1 });
  svc.addDriver({ id: 'MID', location: { x: 3, y: 0 }, rating: 4.9 });
  return { svc, advance: (ms: number) => (now += ms) };
}

function toReady(svc: InstanceType<typeof FoodDeliveryService>, id: string) {
  svc.acceptOrder(id);
  svc.startPreparing(id);
  svc.markReady(id);
}

describe('18 · Food Delivery', () => {
  describe('order state machine', () => {
    it('runs the happy path from PLACED to DELIVERED', () => {
      const { svc } = makeService();
      const o = svc.placeOrder('C1', 'R1', [PIZZA, { name: 'Coke', pricePaise: 4_000, quantity: 1 }]);
      expect(o.status).toBe('PLACED');
      expect(o.totalPaise).toBe(63_800);

      toReady(svc, o.id);
      svc.assignDriver(o.id);
      expect(svc.pickUp(o.id).status).toBe('PICKED_UP');
      expect(svc.deliver(o.id).status).toBe('DELIVERED');
    });

    it('rejects illegal transitions', () => {
      const { svc } = makeService();
      const o = svc.placeOrder('C1', 'R1', [PIZZA]);
      expect(() => svc.startPreparing(o.id)).toThrow();
      expect(() => svc.deliver(o.id)).toThrow();
      svc.acceptOrder(o.id);
      expect(() => svc.acceptOrder(o.id)).toThrow();
      expect(svc.getOrder(o.id).status).toBe('ACCEPTED');
    });

    it('validates the order input', () => {
      const { svc } = makeService();
      expect(() => svc.placeOrder('C1', 'NOPE', [PIZZA])).toThrow();
      expect(() => svc.placeOrder('C1', 'R1', [])).toThrow();
      expect(() => svc.placeOrder('C1', 'R1', [{ name: 'X', pricePaise: 10.5, quantity: 1 }])).toThrow();
      expect(() => svc.getOrder('missing')).toThrow();
    });

    it('does not pick up an order with no driver, and leaves it READY', () => {
      const { svc } = makeService();
      const o = svc.placeOrder('C1', 'R1', [PIZZA]);
      toReady(svc, o.id);
      expect(() => svc.pickUp(o.id)).toThrow();
      expect(svc.getOrder(o.id).status).toBe('READY');
    });
  });

  describe('cancellation', () => {
    it('is free before the kitchen starts and costs a fee after', () => {
      const { svc } = makeService();
      const a = svc.placeOrder('C1', 'R1', [PIZZA]);
      svc.acceptOrder(a.id);
      expect(svc.cancel(a.id).feePaise).toBe(0);

      const b = svc.placeOrder('C1', 'R1', [PIZZA]);
      svc.acceptOrder(b.id);
      svc.startPreparing(b.id);
      expect(svc.cancel(b.id)).toEqual({ orderId: b.id, feePaise: 5_000 });
      expect(svc.getOrder(b.id).status).toBe('CANCELLED');
    });

    it('is not allowed after pickup, and a cancelled order accepts no more actions', () => {
      const { svc } = makeService();
      const a = svc.placeOrder('C1', 'R1', [PIZZA]);
      toReady(svc, a.id);
      svc.assignDriver(a.id);
      svc.pickUp(a.id);
      expect(() => svc.cancel(a.id)).toThrow();

      const b = svc.placeOrder('C1', 'R1', [PIZZA]);
      svc.cancel(b.id);
      expect(() => svc.acceptOrder(b.id)).toThrow();
      expect(() => svc.cancel(b.id)).toThrow();
    });

    it('frees the driver when an order is cancelled', () => {
      const { svc } = makeService();
      const o = svc.placeOrder('C1', 'R1', [PIZZA]);
      svc.acceptOrder(o.id);
      const driver = svc.assignDriver(o.id);
      expect(svc.isDriverFree(driver)).toBe(false);
      svc.cancel(o.id);
      expect(svc.isDriverFree(driver)).toBe(true);
    });
  });

  describe('driver assignment', () => {
    it('nearest strategy picks the closest free driver, never a busy one', () => {
      const { svc } = makeService();
      const a = svc.placeOrder('C1', 'R1', [PIZZA]);
      const b = svc.placeOrder('C2', 'R1', [PIZZA]);
      svc.acceptOrder(a.id);
      svc.acceptOrder(b.id);
      expect(svc.assignDriver(a.id)).toBe('NEAR');
      expect(svc.assignDriver(b.id)).toBe('MID');
      expect(() => svc.assignDriver(a.id)).toThrow(); // already has a driver
    });

    it('throws when no driver is free', () => {
      const { svc } = makeService();
      const ids = [1, 2, 3, 4].map(() => svc.placeOrder('C1', 'R1', [PIZZA]).id);
      ids.forEach((id) => svc.acceptOrder(id));
      ids.slice(0, 3).forEach((id) => svc.assignDriver(id));
      expect(() => svc.assignDriver(ids[3])).toThrow();
    });

    it('a driver is free again after delivery', () => {
      const { svc } = makeService();
      const a = svc.placeOrder('C1', 'R1', [PIZZA]);
      toReady(svc, a.id);
      expect(svc.assignDriver(a.id)).toBe('NEAR');
      svc.pickUp(a.id);
      svc.deliver(a.id);

      const b = svc.placeOrder('C1', 'R1', [PIZZA]);
      svc.acceptOrder(b.id);
      expect(svc.assignDriver(b.id)).toBe('NEAR');
    });

    it('highest-rated strategy breaks rating ties by distance and respects the radius', () => {
      const { svc } = makeService(new HighestRatedStrategy());
      const a = svc.placeOrder('C1', 'R1', [PIZZA]);
      svc.acceptOrder(a.id);
      expect(svc.assignDriver(a.id)).toBe('MID'); // 4.9 like FAR, but nearer

      const { svc: svc2 } = makeService(new HighestRatedStrategy(2));
      const b = svc2.placeOrder('C1', 'R1', [PIZZA]);
      svc2.acceptOrder(b.id);
      expect(svc2.assignDriver(b.id)).toBe('NEAR'); // only driver within 2 km
    });

    it('uses the latest driver location', () => {
      const { svc } = makeService();
      svc.updateDriverLocation('FAR', { x: 0.5, y: 0 });
      const o = svc.placeOrder('C1', 'R1', [PIZZA]);
      svc.acceptOrder(o.id);
      expect(svc.assignDriver(o.id)).toBe('FAR');
    });
  });

  describe('notifications', () => {
    it('sends status and assignment events in order, with clock time', () => {
      const { svc, advance } = makeService();
      const events: OrderEvent[] = [];
      svc.subscribe({ notify: (e) => events.push(e) });
      const o = svc.placeOrder('C1', 'R1', [PIZZA]);
      svc.acceptOrder(o.id);
      advance(500);
      svc.assignDriver(o.id);

      expect(events).toEqual([
        { type: 'STATUS_CHANGED', orderId: o.id, from: 'PLACED', to: 'ACCEPTED', at: 1_000 },
        { type: 'DRIVER_ASSIGNED', orderId: o.id, driverId: 'NEAR', at: 1_500 },
      ]);
    });

    it('a failing observer does not break the flow, and unsubscribe works', () => {
      const { svc } = makeService();
      const seen: string[] = [];
      svc.subscribe({ notify: () => { throw new Error('SMS down'); } });
      const off = svc.subscribe({ notify: (e) => seen.push(e.type) });
      const o = svc.placeOrder('C1', 'R1', [PIZZA]);
      expect(() => svc.acceptOrder(o.id)).not.toThrow();
      off();
      svc.startPreparing(o.id);
      expect(seen).toEqual(['STATUS_CHANGED']);
    });
  });

  describe('extensibility', () => {
    it('accepts any DriverAssignmentStrategy (Open/Closed)', () => {
      const byId: DriverAssignmentStrategy = {
        pick: (_ctx, candidates) => [...candidates].sort((a, b) => a.id.localeCompare(b.id))[0],
      };
      const { svc } = makeService(byId);
      const o = svc.placeOrder('C1', 'R1', [PIZZA]);
      svc.acceptOrder(o.id);
      expect(svc.assignDriver(o.id)).toBe('FAR');
    });
  });
});
