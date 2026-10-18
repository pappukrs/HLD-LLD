// 18 · Food Delivery: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Location {
  readonly x: number; // km on a flat grid; real systems use lat/lng + geohash
  readonly y: number;
}

export interface OrderItem {
  readonly name: string;
  readonly pricePaise: number;
  readonly quantity: number;
}

export interface Order {
  readonly id: string;
  readonly customerId: string;
  readonly restaurantId: string;
  readonly items: readonly OrderItem[];
  readonly totalPaise: number;
  readonly status: OrderStatus;
  readonly driverId: string | null;
}

export interface DriverInfo {
  readonly id: string;
  readonly location: Location;
  readonly rating: number;
}

export interface AssignmentContext {
  readonly orderId: string;
  readonly restaurantLocation: Location;
}

export interface DriverAssignmentStrategy {
  // `candidates` holds only free drivers. Return undefined if none is suitable.
  pick(ctx: AssignmentContext, candidates: readonly DriverInfo[]): DriverInfo | undefined;
}

export type OrderEvent =
  | { type: 'STATUS_CHANGED'; orderId: string; from: OrderStatus; to: OrderStatus; at: number }
  | { type: 'DRIVER_ASSIGNED'; orderId: string; driverId: string; at: number };

export interface OrderObserver {
  notify(event: OrderEvent): void;
}

export interface CancelResult {
  readonly orderId: string;
  readonly feePaise: number;
}

export interface FoodDeliveryConfig {
  strategy: DriverAssignmentStrategy;
  cancellationFeePaise?: number; // charged when cancelling after the kitchen started
  clock?: () => number;
}

export function distance(a: Location, b: Location): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class NearestDriverStrategy implements DriverAssignmentStrategy {
  pick(ctx: AssignmentContext, candidates: readonly DriverInfo[]): DriverInfo | undefined {
    let best: DriverInfo | undefined;
    for (const d of candidates) {
      if (!best || distance(d.location, ctx.restaurantLocation) < distance(best.location, ctx.restaurantLocation)) {
        best = d;
      }
    }
    return best;
  }
}

export class HighestRatedStrategy implements DriverAssignmentStrategy {
  // Only drivers within maxDistanceKm are considered. Ties on rating go to the nearer driver.
  constructor(private readonly maxDistanceKm = Infinity) {}

  pick(ctx: AssignmentContext, candidates: readonly DriverInfo[]): DriverInfo | undefined {
    const dist = (d: DriverInfo) => distance(d.location, ctx.restaurantLocation);
    return candidates
      .filter((d) => dist(d) <= this.maxDistanceKm)
      .sort((a, b) => b.rating - a.rating || dist(a) - dist(b))[0];
  }
}

type Action = 'accept' | 'startPreparing' | 'markReady' | 'pickUp' | 'deliver';

// The state machine as data. Anything missing from this table is an illegal move.
const TRANSITIONS: Record<OrderStatus, Partial<Record<Action, OrderStatus>>> = {
  PLACED: { accept: 'ACCEPTED' },
  ACCEPTED: { startPreparing: 'PREPARING' },
  PREPARING: { markReady: 'READY' },
  READY: { pickUp: 'PICKED_UP' },
  PICKED_UP: { deliver: 'DELIVERED' },
  DELIVERED: {},
  CANCELLED: {},
};

const ASSIGNABLE: ReadonlySet<OrderStatus> = new Set(['ACCEPTED', 'PREPARING', 'READY']);
const FREE_CANCEL: ReadonlySet<OrderStatus> = new Set(['PLACED', 'ACCEPTED']);
const PAID_CANCEL: ReadonlySet<OrderStatus> = new Set(['PREPARING', 'READY']);

interface OrderRecord {
  id: string;
  customerId: string;
  restaurantId: string;
  items: OrderItem[];
  totalPaise: number;
  status: OrderStatus;
  driverId: string | null;
}

interface DriverRecord {
  info: DriverInfo;
  busyWith: string | null; // order id
}

export class FoodDeliveryService {
  private readonly strategy: DriverAssignmentStrategy;
  private readonly cancellationFeePaise: number;
  private readonly clock: () => number;
  private readonly restaurants = new Map<string, Location>();
  private readonly drivers = new Map<string, DriverRecord>();
  private readonly orders = new Map<string, OrderRecord>();
  private readonly observers = new Set<OrderObserver>();
  private nextOrder = 1;

  constructor(config: FoodDeliveryConfig) {
    this.strategy = config.strategy;
    this.cancellationFeePaise = config.cancellationFeePaise ?? 0;
    this.clock = config.clock ?? Date.now;
  }

  addRestaurant(id: string, location: Location): void {
    if (this.restaurants.has(id)) throw new Error(`Restaurant ${id} already exists`);
    this.restaurants.set(id, location);
  }

  addDriver(driver: DriverInfo): void {
    if (this.drivers.has(driver.id)) throw new Error(`Driver ${driver.id} already exists`);
    this.drivers.set(driver.id, { info: driver, busyWith: null });
  }

  updateDriverLocation(driverId: string, location: Location): void {
    const rec = this.getDriver(driverId);
    rec.info = { ...rec.info, location };
  }

  subscribe(observer: OrderObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  placeOrder(customerId: string, restaurantId: string, items: OrderItem[]): Order {
    if (!this.restaurants.has(restaurantId)) throw new Error(`Unknown restaurant ${restaurantId}`);
    if (items.length === 0) throw new Error('Order needs at least one item');
    for (const it of items) {
      if (!Number.isInteger(it.pricePaise) || it.pricePaise <= 0) throw new Error(`Bad price for ${it.name}`);
      if (!Number.isInteger(it.quantity) || it.quantity <= 0) throw new Error(`Bad quantity for ${it.name}`);
    }
    const order: OrderRecord = {
      id: `O${this.nextOrder++}`,
      customerId,
      restaurantId,
      items: items.map((i) => ({ ...i })),
      totalPaise: items.reduce((sum, i) => sum + i.pricePaise * i.quantity, 0),
      status: 'PLACED',
      driverId: null,
    };
    this.orders.set(order.id, order);
    return this.snapshot(order);
  }

  acceptOrder(orderId: string): Order {
    return this.transition(orderId, 'accept');
  }

  startPreparing(orderId: string): Order {
    return this.transition(orderId, 'startPreparing');
  }

  markReady(orderId: string): Order {
    return this.transition(orderId, 'markReady');
  }

  pickUp(orderId: string): Order {
    // Guard first, mutate after: no half-done pickups.
    if (!this.getOrderRecord(orderId).driverId) throw new Error(`Order ${orderId} has no driver`);
    return this.transition(orderId, 'pickUp');
  }

  deliver(orderId: string): Order {
    const result = this.transition(orderId, 'deliver');
    this.releaseDriver(this.getOrderRecord(orderId));
    return result;
  }

  assignDriver(orderId: string): string {
    const order = this.getOrderRecord(orderId);
    if (!ASSIGNABLE.has(order.status)) throw new Error(`Cannot assign a driver in ${order.status}`);
    if (order.driverId) throw new Error(`Order ${orderId} already has driver ${order.driverId}`);

    const free = [...this.drivers.values()].filter((d) => d.busyWith === null).map((d) => d.info);
    const ctx: AssignmentContext = { orderId, restaurantLocation: this.restaurants.get(order.restaurantId)! };
    const chosen = this.strategy.pick(ctx, free);
    if (!chosen) throw new Error(`No driver available for ${orderId}`);

    const rec = this.getDriver(chosen.id);
    if (rec.busyWith !== null) throw new Error(`Strategy picked busy driver ${chosen.id}`);
    rec.busyWith = orderId;
    order.driverId = chosen.id;
    this.emit({ type: 'DRIVER_ASSIGNED', orderId, driverId: chosen.id, at: this.clock() });
    return chosen.id;
  }

  cancel(orderId: string): CancelResult {
    const order = this.getOrderRecord(orderId);
    let feePaise: number;
    if (FREE_CANCEL.has(order.status)) feePaise = 0;
    else if (PAID_CANCEL.has(order.status)) feePaise = this.cancellationFeePaise;
    else throw new Error(`Cannot cancel order in ${order.status}`);

    this.setStatus(order, 'CANCELLED');
    this.releaseDriver(order);
    return { orderId, feePaise };
  }

  getOrder(orderId: string): Order {
    return this.snapshot(this.getOrderRecord(orderId));
  }

  isDriverFree(driverId: string): boolean {
    return this.getDriver(driverId).busyWith === null;
  }

  private transition(orderId: string, action: Action): Order {
    const order = this.getOrderRecord(orderId);
    const next = TRANSITIONS[order.status][action];
    if (!next) throw new Error(`Cannot ${action} order ${orderId} in ${order.status}`);
    this.setStatus(order, next);
    return this.snapshot(order);
  }

  private setStatus(order: OrderRecord, to: OrderStatus): void {
    const from = order.status;
    order.status = to;
    this.emit({ type: 'STATUS_CHANGED', orderId: order.id, from, to, at: this.clock() });
  }

  private releaseDriver(order: OrderRecord): void {
    if (!order.driverId) return;
    this.getDriver(order.driverId).busyWith = null;
  }

  // One bad observer (say, SMS gateway down) must not break the order flow.
  private emit(event: OrderEvent): void {
    for (const o of this.observers) {
      try {
        o.notify(event);
      } catch {
        // In production: log and push to a retry queue.
      }
    }
  }

  private getOrderRecord(id: string): OrderRecord {
    const o = this.orders.get(id);
    if (!o) throw new Error(`Unknown order ${id}`);
    return o;
  }

  private getDriver(id: string): DriverRecord {
    const d = this.drivers.get(id);
    if (!d) throw new Error(`Unknown driver ${id}`);
    return d;
  }

  private snapshot(o: OrderRecord): Order {
    return { ...o, items: o.items.map((i) => ({ ...i })) };
  }
}
