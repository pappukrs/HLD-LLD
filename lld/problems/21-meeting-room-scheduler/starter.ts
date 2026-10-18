// 21 · Meeting Room Scheduler: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/21-meeting-room-scheduler

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
  throw new Error('TODO: one line. Remember the intervals are half-open');
}

/** Smallest room that fits, so big rooms stay free for big meetings. Ties by room id. */
export class SmallestFitStrategy implements RoomSelectionStrategy {
  choose(rooms: readonly Room[]): Room | undefined {
    throw new Error('TODO');
  }
}

export class MeetingScheduler {
  constructor(config: SchedulerConfig) {
    // TODO: rooms, bookings per room, strategy (default SmallestFitStrategy), clock
  }

  book(roomId: string, req: MeetingRequest): Booking {
    throw new Error('TODO: validate (interval, past, capacity), check conflicts, insert');
  }

  /** Let the strategy pick among the free rooms that fit. */
  bookAny(req: MeetingRequest): Booking {
    throw new Error('TODO');
  }

  /** All occurrences or none. A clash on any one rejects the whole series. */
  bookRecurring(req: RecurringRequest): Booking[] {
    throw new Error('TODO');
  }

  cancel(bookingId: string): void {
    throw new Error('TODO');
  }

  /** Cancels the occurrences that have not started yet. Returns how many were cancelled. */
  cancelSeries(seriesId: string): number {
    throw new Error('TODO');
  }

  /** Free rooms with capacity >= attendees, smallest first, then by id. */
  findFreeRooms(slot: Interval, attendees = 1): Room[] {
    throw new Error('TODO');
  }

  /** Sorted by start. */
  bookingsFor(roomId: string): Booking[] {
    throw new Error('TODO');
  }

  /** Gaps inside `window` where the room is free. */
  freeSlots(roomId: string, window: Interval): Interval[] {
    throw new Error('TODO');
  }
}
