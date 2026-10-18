// 17 · Ride Sharing: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/17-ride-sharing

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
  throw new Error('TODO: straight-line distance');
}

export class NearestDriverStrategy implements MatchingStrategy {
  constructor(private readonly maxDistanceKm = Infinity) {}

  match(request: RideRequest, candidates: readonly DriverView[]): DriverView | undefined {
    throw new Error('TODO: closest to pickup within maxDistanceKm; tie → lower id');
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
    throw new Error('TODO: round(base + perKm × km)');
  }
}

export class RideService {
  constructor(config: RideServiceConfig = {}) {
    // TODO: keep matching and fare strategies
  }

  /** New drivers start online. */
  addDriver(input: DriverInput): void {
    throw new Error('TODO');
  }

  setOnline(driverId: string, online: boolean): void {
    throw new Error('TODO');
  }

  updateLocation(driverId: string, location: Location): void {
    throw new Error('TODO');
  }

  requestRide(req: RideRequest): Ride {
    throw new Error('TODO: filter free drivers, ask the strategy, mark the driver busy');
  }

  startRide(rideId: string): Ride {
    throw new Error('TODO');
  }

  completeRide(rideId: string): Ride {
    throw new Error('TODO');
  }

  /** Only before the trip starts. */
  cancelRide(rideId: string): Ride {
    throw new Error('TODO');
  }

  getRide(rideId: string): Ride {
    throw new Error('TODO');
  }

  getDriver(driverId: string): DriverView {
    throw new Error('TODO');
  }

  /** Observer. Returns an unsubscribe function. */
  subscribe(listener: (e: RideEvent) => void): () => void {
    throw new Error('TODO');
  }
}
