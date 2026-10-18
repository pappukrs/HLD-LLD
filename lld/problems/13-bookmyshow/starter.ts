// 13 · BookMyShow (seat locking): your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/13-bookmyshow

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';

export type SeatRecord =
  | { status: 'AVAILABLE' }
  | { status: 'HELD'; holdId: string; userId: string; expiresAt: number }
  | { status: 'BOOKED'; bookingId: string; userId: string };

/** Async on purpose: a real store is a DB or Redis, and every call is an await. */
export interface SeatStore {
  get(showId: string, seatId: string): Promise<SeatRecord | undefined>;
  set(showId: string, seatId: string, record: SeatRecord): Promise<void>;
}

export interface ShowInput {
  id: string;
  movie: string;
  seats: string[];
  price: number;
}

export interface Hold {
  readonly id: string;
  readonly showId: string;
  readonly userId: string;
  readonly seats: readonly string[];
  readonly expiresAt: number;
}

export interface Booking {
  readonly id: string;
  readonly showId: string;
  readonly userId: string;
  readonly seats: readonly string[];
  readonly amount: number;
}

export interface PricingStrategy {
  price(show: Readonly<ShowInput>, seatIds: readonly string[]): number;
}

export interface BookingConfig {
  clock?: () => number;
  holdTtlMs?: number; // default 5 minutes
  store?: SeatStore;
  pricing?: PricingStrategy;
}

export class FlatPricing implements PricingStrategy {
  price(show: Readonly<ShowInput>, seatIds: readonly string[]): number {
    throw new Error('TODO');
  }
}

// Given: every call awaits once, like a network round trip. That gap is where races happen.
export class InMemorySeatStore implements SeatStore {
  private readonly data = new Map<string, SeatRecord>();

  async get(showId: string, seatId: string): Promise<SeatRecord | undefined> {
    await Promise.resolve();
    return this.data.get(`${showId}:${seatId}`);
  }

  async set(showId: string, seatId: string, record: SeatRecord): Promise<void> {
    await Promise.resolve();
    this.data.set(`${showId}:${seatId}`, record);
  }
}

/** In-process async mutex. Callers run one at a time, in arrival order. */
export class Mutex {
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    throw new Error('TODO: chain each caller onto the previous one');
  }
}

export class BookingService {
  constructor(config: BookingConfig = {}) {
    // TODO: keep clock, TTL, store and pricing
  }

  async addShow(input: ShowInput): Promise<void> {
    throw new Error('TODO');
  }

  /** All-or-nothing: either every seat is held for this user, or none is. */
  async holdSeats(showId: string, userId: string, seatIds: string[]): Promise<Hold> {
    throw new Error('TODO: check all seats, then write all, inside a lock');
  }

  /** Call after payment succeeds. Throws if the hold expired. */
  async confirm(holdId: string): Promise<Booking> {
    throw new Error('TODO');
  }

  /** The user cancels at the payment page. */
  async release(holdId: string): Promise<void> {
    throw new Error('TODO');
  }

  async seatStatus(showId: string, seatId: string): Promise<SeatStatus> {
    throw new Error('TODO: an expired hold reads as AVAILABLE');
  }

  async availableSeats(showId: string): Promise<string[]> {
    throw new Error('TODO');
  }
}
