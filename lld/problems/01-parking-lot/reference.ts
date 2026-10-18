// 01 · Parking Lot: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

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

const HOUR_MS = 60 * 60 * 1000;

// Fit rules live in data, not in if/else chains. Order = preference (smallest first).
const FITS: Record<VehicleType, SpotSize[]> = {
  BIKE: ['SMALL', 'MEDIUM', 'LARGE'],
  CAR: ['MEDIUM', 'LARGE'],
  TRUCK: ['LARGE'],
};

export class HourlyPricing implements PricingStrategy {
  constructor(private readonly ratePerHour: Record<VehicleType, number>) {}

  calculate(vehicleType: VehicleType, entryTime: number, exitTime: number): number {
    const hours = Math.max(1, Math.ceil((exitTime - entryTime) / HOUR_MS));
    return hours * this.ratePerHour[vehicleType];
  }
}

class Spot {
  private occupant: string | null = null;

  constructor(readonly id: string, readonly size: SpotSize, readonly floor: number) {}

  get isFree(): boolean {
    return this.occupant === null;
  }

  occupy(plate: string): void {
    if (!this.isFree) throw new Error(`Spot ${this.id} already occupied`);
    this.occupant = plate;
  }

  release(): void {
    this.occupant = null;
  }
}

class Floor {
  private readonly spots: Spot[] = [];

  constructor(readonly level: number, config: FloorConfig) {
    const add = (size: SpotSize, count: number) => {
      for (let i = 0; i < count; i++) {
        this.spots.push(new Spot(`F${level}-${size[0]}${i + 1}`, size, level));
      }
    };
    add('SMALL', config.small);
    add('MEDIUM', config.medium);
    add('LARGE', config.large);
  }

  findFree(size: SpotSize): Spot | undefined {
    return this.spots.find((s) => s.size === size && s.isFree);
  }

  countFree(size?: SpotSize): number {
    return this.spots.filter((s) => s.isFree && (!size || s.size === size)).length;
  }
}

export class ParkingLot {
  private readonly floors: Floor[];
  private readonly pricing: PricingStrategy;
  private readonly clock: () => number;
  private readonly active = new Map<string, { ticket: Ticket; spot: Spot }>();
  private readonly platesInside = new Set<string>();
  private nextTicket = 1;

  constructor(config: ParkingLotConfig) {
    this.floors = config.floors.map((f, i) => new Floor(i, f));
    this.pricing = config.pricing;
    this.clock = config.clock ?? Date.now;
  }

  park(plate: string, vehicleType: VehicleType): Ticket {
    if (this.platesInside.has(plate)) throw new Error(`Vehicle ${plate} is already parked`);

    const spot = this.allocate(vehicleType);
    if (!spot) throw new Error(`Lot full for ${vehicleType}`);

    spot.occupy(plate);
    const ticket: Ticket = {
      id: `T${this.nextTicket++}`,
      plate,
      vehicleType,
      floor: spot.floor,
      spotId: spot.id,
      entryTime: this.clock(),
    };
    this.active.set(ticket.id, { ticket, spot });
    this.platesInside.add(plate);
    return ticket;
  }

  unpark(ticketId: string): Receipt {
    const entry = this.active.get(ticketId);
    if (!entry) throw new Error(`Unknown or already closed ticket ${ticketId}`);

    const exitTime = this.clock();
    const { ticket, spot } = entry;
    spot.release();
    this.active.delete(ticketId);
    this.platesInside.delete(ticket.plate);

    return {
      ticketId,
      amount: this.pricing.calculate(ticket.vehicleType, ticket.entryTime, exitTime),
      durationMinutes: Math.ceil((exitTime - ticket.entryTime) / 60_000),
    };
  }

  availableSpots(size?: SpotSize): number {
    return this.floors.reduce((sum, f) => sum + f.countFree(size), 0);
  }

  // Lowest floor first, then smallest size that fits.
  private allocate(vehicleType: VehicleType): Spot | undefined {
    for (const floor of this.floors) {
      for (const size of FITS[vehicleType]) {
        const spot = floor.findFree(size);
        if (spot) return spot;
      }
    }
    return undefined;
  }
}
