// 18 · Food Delivery: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/18-food-delivery

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
    throw new Error('TODO: the free driver closest to the restaurant');
  }
}

export class HighestRatedStrategy implements DriverAssignmentStrategy {
  // Only drivers within maxDistanceKm are considered. Ties on rating go to the nearer driver.
  constructor(private readonly maxDistanceKm = Infinity) {}

  pick(ctx: AssignmentContext, candidates: readonly DriverInfo[]): DriverInfo | undefined {
    throw new Error('TODO');
  }
}

export class FoodDeliveryService {
  constructor(config: FoodDeliveryConfig) {
    // TODO: keep strategy, fee and clock; create the stores for restaurants, drivers, orders, observers
  }

  addRestaurant(id: string, location: Location): void {
    throw new Error('TODO');
  }

  addDriver(driver: DriverInfo): void {
    throw new Error('TODO');
  }

  updateDriverLocation(driverId: string, location: Location): void {
    throw new Error('TODO');
  }

  /** Returns an unsubscribe function. */
  subscribe(observer: OrderObserver): () => void {
    throw new Error('TODO');
  }

  placeOrder(customerId: string, restaurantId: string, items: OrderItem[]): Order {
    throw new Error('TODO');
  }

  acceptOrder(orderId: string): Order {
    throw new Error('TODO');
  }

  startPreparing(orderId: string): Order {
    throw new Error('TODO');
  }

  markReady(orderId: string): Order {
    throw new Error('TODO');
  }

  pickUp(orderId: string): Order {
    throw new Error('TODO: needs READY and an assigned driver');
  }

  deliver(orderId: string): Order {
    throw new Error('TODO: also frees the driver');
  }

  /** Allowed in ACCEPTED, PREPARING or READY. Returns the driver id. */
  assignDriver(orderId: string): string {
    throw new Error('TODO');
  }

  cancel(orderId: string): CancelResult {
    throw new Error('TODO: free before PREPARING, fee in PREPARING/READY, error after pickup');
  }

  getOrder(orderId: string): Order {
    throw new Error('TODO');
  }

  isDriverFree(driverId: string): boolean {
    throw new Error('TODO');
  }
}
