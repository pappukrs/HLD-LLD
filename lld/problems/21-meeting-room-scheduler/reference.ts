// 21 · Meeting Room Scheduler: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

export interface Room {
  readonly id: string;
  readonly capacity: number;
}

/** Half-open interval [start, end) in epoch ms. A meeting ending at 10:00 does not clash with one starting at 10:00. */
export interface Interval {
  readonly start: number;
  readonly end: number;
}

export interface Booking extends Interval {
  readonly id: string;
  readonly roomId: string;
  readonly title: string;
  readonly attendees: number;
  readonly seriesId: string | null;
}

export interface MeetingRequest extends Interval {
  title: string;
  attendees: number;
}

export interface RecurringRequest extends MeetingRequest {
  roomId: string;
  everyMs: number;
  count: number;
}

export interface RoomSelectionStrategy {
  /** `rooms` are already free for the slot and big enough. Return undefined to refuse. */
  choose(rooms: readonly Room[], request: MeetingRequest): Room | undefined;
}

export interface SchedulerConfig {
  rooms: Room[];
  strategy?: RoomSelectionStrategy;
  clock?: () => number;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Smallest room that fits, so big rooms stay free for big meetings. Ties by room id. */
export class SmallestFitStrategy implements RoomSelectionStrategy {
  choose(rooms: readonly Room[]): Room | undefined {
    return [...rooms].sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id))[0];
  }
}

export class MeetingScheduler {
  private readonly rooms = new Map<string, Room>();
  private readonly byRoom = new Map<string, Booking[]>(); // kept sorted by start
  private readonly bookings = new Map<string, Booking>();
  private readonly strategy: RoomSelectionStrategy;
  private readonly clock: () => number;
  private nextBooking = 1;
  private nextSeries = 1;

  constructor(config: SchedulerConfig) {
    for (const r of config.rooms) {
      if (this.rooms.has(r.id)) throw new Error(`Duplicate room ${r.id}`);
      this.rooms.set(r.id, r);
      this.byRoom.set(r.id, []);
    }
    this.strategy = config.strategy ?? new SmallestFitStrategy();
    this.clock = config.clock ?? Date.now;
  }

  book(roomId: string, req: MeetingRequest): Booking {
    this.validate(this.room(roomId), req);
    if (!this.isFree(roomId, req)) throw new Error(`Room ${roomId} is busy in that slot`);
    return this.insert(roomId, req, null);
  }

  /** Let the strategy pick among the free rooms that fit. */
  bookAny(req: MeetingRequest): Booking {
    const room = this.strategy.choose(this.findFreeRooms(req, req.attendees), req);
    if (!room) throw new Error('No free room for that slot');
    return this.book(room.id, req);
  }

  /** All occurrences or none. A clash on any one rejects the whole series. */
  bookRecurring(req: RecurringRequest): Booking[] {
    const { roomId, everyMs, count, ...base } = req;
    if (!Number.isInteger(count) || count < 1) throw new Error('count must be a positive integer');
    if (everyMs < base.end - base.start) throw new Error('Occurrences would overlap each other');

    const room = this.room(roomId);
    const occurrences: MeetingRequest[] = Array.from({ length: count }, (_, i) => ({
      ...base,
      start: base.start + i * everyMs,
      end: base.end + i * everyMs,
    }));
    for (const occ of occurrences) {
      this.validate(room, occ);
      if (!this.isFree(roomId, occ)) throw new Error(`Room ${roomId} is busy at ${occ.start}`);
    }
    const seriesId = `S${this.nextSeries++}`;
    return occurrences.map((occ) => this.insert(roomId, occ, seriesId));
  }

  cancel(bookingId: string): void {
    const b = this.bookings.get(bookingId);
    if (!b) throw new Error(`Unknown booking ${bookingId}`);
    this.bookings.delete(bookingId);
    const list = this.byRoom.get(b.roomId)!;
    list.splice(list.indexOf(b), 1);
  }

  /** Cancels the occurrences that have not started yet. Returns how many were cancelled. */
  cancelSeries(seriesId: string): number {
    const now = this.clock();
    const future = [...this.bookings.values()].filter((b) => b.seriesId === seriesId && b.start >= now);
    if (future.length === 0) throw new Error(`No upcoming bookings in series ${seriesId}`);
    future.forEach((b) => this.cancel(b.id));
    return future.length;
  }

  findFreeRooms(slot: Interval, attendees = 1): Room[] {
    return [...this.rooms.values()]
      .filter((r) => r.capacity >= attendees && this.isFree(r.id, slot))
      .sort((a, b) => a.capacity - b.capacity || a.id.localeCompare(b.id));
  }

  bookingsFor(roomId: string): Booking[] {
    this.room(roomId);
    return [...this.byRoom.get(roomId)!];
  }

  /** Gaps inside `window` where the room is free. */
  freeSlots(roomId: string, window: Interval): Interval[] {
    const slots: Interval[] = [];
    let cursor = window.start;
    for (const b of this.bookingsFor(roomId)) {
      if (b.end <= window.start || b.start >= window.end) continue;
      if (b.start > cursor) slots.push({ start: cursor, end: b.start });
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < window.end) slots.push({ start: cursor, end: window.end });
    return slots;
  }

  // A linear scan is fine for a day of meetings. Sorted list → binary search, or an interval tree, at scale.
  private isFree(roomId: string, slot: Interval): boolean {
    return !this.byRoom.get(roomId)!.some((b) => overlaps(b, slot));
  }

  private insert(roomId: string, req: MeetingRequest, seriesId: string | null): Booking {
    const booking: Booking = {
      id: `B${this.nextBooking++}`,
      roomId,
      title: req.title,
      attendees: req.attendees,
      start: req.start,
      end: req.end,
      seriesId,
    };
    const list = this.byRoom.get(roomId)!;
    const at = list.findIndex((b) => b.start > booking.start);
    list.splice(at === -1 ? list.length : at, 0, booking);
    this.bookings.set(booking.id, booking);
    return booking;
  }

  private validate(room: Room, req: MeetingRequest): void {
    if (!(req.start < req.end)) throw new Error('start must be before end');
    if (req.start < this.clock()) throw new Error('Cannot book in the past');
    if (!Number.isInteger(req.attendees) || req.attendees < 1) throw new Error('attendees must be a positive integer');
    if (req.attendees > room.capacity) throw new Error(`Room ${room.id} holds only ${room.capacity}`);
  }

  private room(id: string): Room {
    const r = this.rooms.get(id);
    if (!r) throw new Error(`Unknown room ${id}`);
    return r;
  }
}
