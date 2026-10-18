// 17 · Ride Sharing: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

export type VehicleType = 'BIKE' | 'AUTO' | 'CAR';
export type RideStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/** A point on a flat grid, in km. Real systems use lat/lng and geohash; a grid keeps the LLD focused. */
export interface Location {
  readonly x: number;
  readonly y: number;
}

export interface DriverInput {
  id: string;
  name: string;
  vehicle: VehicleType;
  location: Location;
}

export interface DriverView {
  readonly id: string;
  readonly name: string;
  readonly vehicle: VehicleType;
  readonly location: Location;
  readonly online: boolean;
  /** true while the driver has an ASSIGNED or IN_PROGRESS ride. */
  readonly busy: boolean;
}

export interface RideRequest {
  riderId: string;
  pickup: Location;
  drop: Location;
  vehicle: VehicleType;
}

export interface Ride {
  readonly id: string;
  readonly riderId: string;
  readonly driverId: string;
  readonly vehicle: VehicleType;
  readonly pickup: Location;
  readonly drop: Location;
  readonly status: RideStatus;
  /** Set when the ride is completed. */
  readonly fare: number | null;
}

export type RideEvent = {
  readonly type: 'ASSIGNED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';
  readonly rideId: string;
  readonly riderId: string;
  readonly driverId: string;
};

export interface MatchingStrategy {
  /** `candidates` are already online, free and of the right vehicle type. */
  match(request: RideRequest, candidates: readonly DriverView[]): DriverView | undefined;
}

export interface FareStrategy {
  fare(vehicle: VehicleType, distanceKm: number): number;
}

export interface RideServiceConfig {
  matching?: MatchingStrategy;
  fare?: FareStrategy;
}

export function distance(a: Location, b: Location): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class NearestDriverStrategy implements MatchingStrategy {
  constructor(private readonly maxDistanceKm = Infinity) {}

  match(request: RideRequest, candidates: readonly DriverView[]): DriverView | undefined {
    let best: DriverView | undefined;
    let bestDist = Infinity;
    for (const d of candidates) {
      const dist = distance(d.location, request.pickup);
      if (dist > this.maxDistanceKm) continue;
      // Tie on distance → lower id, so the result never depends on insertion order.
      if (dist < bestDist || (dist === bestDist && best && d.id < best.id)) {
        best = d;
        bestDist = dist;
      }
    }
    return best;
  }
}

export const DEFAULT_RATES: Record<VehicleType, { base: number; perKm: number }> = {
  BIKE: { base: 20, perKm: 8 },
  AUTO: { base: 30, perKm: 12 },
  CAR: { base: 50, perKm: 15 },
};

export class DistanceFare implements FareStrategy {
  constructor(private readonly rates = DEFAULT_RATES) {}

  fare(vehicle: VehicleType, distanceKm: number): number {
    const r = this.rates[vehicle];
    return Math.round(r.base + r.perKm * distanceKm);
  }
}

// The state machine as data: one place to read and change the rules.
const TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

interface Driver {
  readonly id: string;
  readonly name: string;
  readonly vehicle: VehicleType;
  location: Location;
  online: boolean;
  activeRideId: string | null;
}

type MutableRide = { -readonly [K in keyof Ride]: Ride[K] };

export class RideService {
  private readonly drivers = new Map<string, Driver>();
  private readonly rides = new Map<string, MutableRide>();
  private readonly activeRideOfRider = new Map<string, string>();
  private readonly listeners = new Set<(e: RideEvent) => void>();
  private readonly matching: MatchingStrategy;
  private readonly fareStrategy: FareStrategy;
  private nextRide = 1;

  constructor(config: RideServiceConfig = {}) {
    this.matching = config.matching ?? new NearestDriverStrategy();
    this.fareStrategy = config.fare ?? new DistanceFare();
  }

  /** New drivers start online. */
  addDriver(input: DriverInput): void {
    if (this.drivers.has(input.id)) throw new Error(`Driver ${input.id} already exists`);
    this.drivers.set(input.id, { ...input, online: true, activeRideId: null });
  }

  setOnline(driverId: string, online: boolean): void {
    this.driver(driverId).online = online;
  }

  updateLocation(driverId: string, location: Location): void {
    this.driver(driverId).location = location;
  }

  requestRide(req: RideRequest): Ride {
    if (this.activeRideOfRider.has(req.riderId)) throw new Error(`Rider ${req.riderId} already has an active ride`);

    // Availability is a rule of the service, not of a strategy. A strategy can't double-book.
    const candidates = [...this.drivers.values()]
      .filter((d) => d.online && d.activeRideId === null && d.vehicle === req.vehicle)
      .map((d) => this.view(d));
    const chosen = this.matching.match(req, candidates);
    if (!chosen) throw new Error(`No ${req.vehicle} driver available`);
    const driver = this.drivers.get(chosen.id);
    if (!driver || driver.activeRideId !== null) throw new Error(`Strategy picked an unavailable driver ${chosen.id}`);

    const ride: MutableRide = {
      id: `R${this.nextRide++}`,
      riderId: req.riderId,
      driverId: driver.id,
      vehicle: req.vehicle,
      pickup: req.pickup,
      drop: req.drop,
      status: 'ASSIGNED',
      fare: null,
    };
    this.rides.set(ride.id, ride);
    driver.activeRideId = ride.id;
    this.activeRideOfRider.set(ride.riderId, ride.id);
    this.emit('ASSIGNED', ride);
    return { ...ride };
  }

  startRide(rideId: string): Ride {
    const ride = this.transition(rideId, 'IN_PROGRESS');
    this.emit('STARTED', ride);
    return { ...ride };
  }

  completeRide(rideId: string): Ride {
    const ride = this.transition(rideId, 'COMPLETED');
    ride.fare = this.fareStrategy.fare(ride.vehicle, distance(ride.pickup, ride.drop));
    const driver = this.driver(ride.driverId);
    driver.location = ride.drop;
    this.release(ride);
    this.emit('COMPLETED', ride);
    return { ...ride };
  }

  /** Only before the trip starts. */
  cancelRide(rideId: string): Ride {
    const ride = this.transition(rideId, 'CANCELLED');
    this.release(ride);
    this.emit('CANCELLED', ride);
    return { ...ride };
  }

  getRide(rideId: string): Ride {
    return { ...this.ride(rideId) };
  }

  getDriver(driverId: string): DriverView {
    return this.view(this.driver(driverId));
  }

  /** Observer. Returns an unsubscribe function. */
  subscribe(listener: (e: RideEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private transition(rideId: string, to: RideStatus): MutableRide {
    const ride = this.ride(rideId);
    if (!TRANSITIONS[ride.status].includes(to)) throw new Error(`Ride ${rideId}: cannot go from ${ride.status} to ${to}`);
    ride.status = to;
    return ride;
  }

  private release(ride: MutableRide): void {
    this.driver(ride.driverId).activeRideId = null;
    this.activeRideOfRider.delete(ride.riderId);
  }

  private emit(type: RideEvent['type'], ride: Ride): void {
    const event: RideEvent = { type, rideId: ride.id, riderId: ride.riderId, driverId: ride.driverId };
    for (const l of this.listeners) l(event);
  }

  private view(d: Driver): DriverView {
    return { id: d.id, name: d.name, vehicle: d.vehicle, location: d.location, online: d.online, busy: d.activeRideId !== null };
  }

  private driver(id: string): Driver {
    const d = this.drivers.get(id);
    if (!d) throw new Error(`Unknown driver ${id}`);
    return d;
  }

  private ride(id: string): MutableRide {
    const r = this.rides.get(id);
    if (!r) throw new Error(`Unknown ride ${id}`);
    return r;
  }
}
