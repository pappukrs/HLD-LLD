// 13 · BookMyShow (seat locking): reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

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
    return show.price * seatIds.length;
  }
}

// Every call awaits once, like a network round trip. That gap is where races happen.
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

/**
 * In-process async mutex. Callers run one at a time, in arrival order.
 * Node is single-threaded, but any `await` inside a check-then-write lets another call run in between.
 */
export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => (release = resolve));
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export class BookingService {
  private readonly clock: () => number;
  private readonly holdTtlMs: number;
  private readonly store: SeatStore;
  private readonly pricing: PricingStrategy;
  private readonly shows = new Map<string, ShowInput & { seatSet: Set<string> }>();
  private readonly holds = new Map<string, Hold>();
  private readonly locks = new Map<string, Mutex>(); // one lock per show: shows don't block each other
  private nextHold = 1;
  private nextBooking = 1;

  constructor(config: BookingConfig = {}) {
    this.clock = config.clock ?? Date.now;
    this.holdTtlMs = config.holdTtlMs ?? 5 * 60 * 1000;
    this.store = config.store ?? new InMemorySeatStore();
    this.pricing = config.pricing ?? new FlatPricing();
  }

  async addShow(input: ShowInput): Promise<void> {
    if (this.shows.has(input.id)) throw new Error(`Show ${input.id} already exists`);
    this.shows.set(input.id, { ...input, seatSet: new Set(input.seats) });
    this.locks.set(input.id, new Mutex());
    for (const seat of input.seats) await this.store.set(input.id, seat, { status: 'AVAILABLE' });
  }

  /** All-or-nothing: either every seat is held for this user, or none is. */
  async holdSeats(showId: string, userId: string, seatIds: string[]): Promise<Hold> {
    const show = this.show(showId);
    if (seatIds.length === 0) throw new Error('Pick at least one seat');
    if (new Set(seatIds).size !== seatIds.length) throw new Error('Duplicate seat in request');
    for (const s of seatIds) if (!show.seatSet.has(s)) throw new Error(`Unknown seat ${s}`);

    return this.lock(showId).runExclusive(async () => {
      // Check every seat first, write after. Without the lock, two calls could both pass this check.
      for (const seat of seatIds) {
        if (this.effective(await this.store.get(showId, seat)) !== 'AVAILABLE') {
          throw new Error(`Seat ${seat} is not available`);
        }
      }
      const hold: Hold = {
        id: `H${this.nextHold++}`,
        showId,
        userId,
        seats: [...seatIds],
        expiresAt: this.clock() + this.holdTtlMs,
      };
      for (const seat of seatIds) {
        await this.store.set(showId, seat, { status: 'HELD', holdId: hold.id, userId, expiresAt: hold.expiresAt });
      }
      this.holds.set(hold.id, hold);
      return hold;
    });
  }

  /** Call after payment succeeds. Throws if the hold expired. */
  async confirm(holdId: string): Promise<Booking> {
    const hold = this.hold(holdId);
    return this.lock(hold.showId).runExclusive(async () => {
      if (this.clock() >= hold.expiresAt) {
        this.holds.delete(holdId);
        throw new Error(`Hold ${holdId} expired`);
      }
      for (const seat of hold.seats) {
        const rec = await this.store.get(hold.showId, seat);
        if (rec?.status !== 'HELD' || rec.holdId !== holdId) throw new Error(`Seat ${seat} is no longer held`);
      }
      const booking: Booking = {
        id: `B${this.nextBooking++}`,
        showId: hold.showId,
        userId: hold.userId,
        seats: hold.seats,
        amount: this.pricing.price(this.show(hold.showId), hold.seats),
      };
      for (const seat of hold.seats) {
        await this.store.set(hold.showId, seat, { status: 'BOOKED', bookingId: booking.id, userId: hold.userId });
      }
      this.holds.delete(holdId);
      return booking;
    });
  }

  /** The user cancels at the payment page. */
  async release(holdId: string): Promise<void> {
    const hold = this.hold(holdId);
    await this.lock(hold.showId).runExclusive(async () => {
      for (const seat of hold.seats) {
        const rec = await this.store.get(hold.showId, seat);
        // Only free seats this hold still owns. After expiry someone else may hold them.
        if (rec?.status === 'HELD' && rec.holdId === holdId) {
          await this.store.set(hold.showId, seat, { status: 'AVAILABLE' });
        }
      }
      this.holds.delete(holdId);
    });
  }

  async seatStatus(showId: string, seatId: string): Promise<SeatStatus> {
    const show = this.show(showId);
    if (!show.seatSet.has(seatId)) throw new Error(`Unknown seat ${seatId}`);
    return this.effective(await this.store.get(showId, seatId));
  }

  async availableSeats(showId: string): Promise<string[]> {
    const show = this.show(showId);
    const free: string[] = [];
    for (const seat of show.seats) {
      if (this.effective(await this.store.get(showId, seat)) === 'AVAILABLE') free.push(seat);
    }
    return free;
  }

  // Lazy expiry: an expired hold reads as AVAILABLE. No timer needed.
  private effective(rec: SeatRecord | undefined): SeatStatus {
    if (!rec) return 'AVAILABLE';
    if (rec.status === 'HELD' && this.clock() >= rec.expiresAt) return 'AVAILABLE';
    return rec.status;
  }

  private show(id: string) {
    const show = this.shows.get(id);
    if (!show) throw new Error(`Unknown show ${id}`);
    return show;
  }

  private hold(id: string): Hold {
    const hold = this.holds.get(id);
    if (!hold) throw new Error(`Unknown or closed hold ${id}`);
    return hold;
  }

  private lock(showId: string): Mutex {
    return this.locks.get(showId)!;
  }
}
