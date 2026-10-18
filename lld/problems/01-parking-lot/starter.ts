// 01 · Parking Lot: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/01-parking-lot

export type VehicleType = 'BIKE' | 'CAR' | 'TRUCK';
export type SpotSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export interface Ticket {
  readonly id: string;
  readonly plate: string;
  readonly vehicleType: VehicleType;
  readonly floor: number;
  readonly spotId: string;
  readonly entryTime: number;
}

export interface Receipt {
  readonly ticketId: string;
  readonly amount: number;
  readonly durationMinutes: number;
}

export interface PricingStrategy {
  calculate(vehicleType: VehicleType, entryTime: number, exitTime: number): number;
}

export interface FloorConfig {
  small: number;
  medium: number;
  large: number;
}

export interface ParkingLotConfig {
  floors: FloorConfig[];
  pricing: PricingStrategy;
  clock?: () => number;
}

export class HourlyPricing implements PricingStrategy {
  constructor(private readonly ratePerHour: Record<VehicleType, number>) {}

  calculate(vehicleType: VehicleType, entryTime: number, exitTime: number): number {
    throw new Error('TODO: partial hours round up, minimum 1 hour');
  }
}

export class ParkingLot {
  constructor(config: ParkingLotConfig) {
    // TODO: build floors and spots, keep pricing and clock
  }

  park(plate: string, vehicleType: VehicleType): Ticket {
    throw new Error('TODO');
  }

  unpark(ticketId: string): Receipt {
    throw new Error('TODO');
  }

  availableSpots(size?: SpotSize): number {
    throw new Error('TODO');
  }
}
