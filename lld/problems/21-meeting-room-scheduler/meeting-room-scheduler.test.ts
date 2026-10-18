import * as starter from './starter';
import * as reference from './reference';
import type { RoomSelectionStrategy } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { MeetingScheduler, overlaps } = (process.env.REF ? reference : starter) as typeof reference;

const H = 60 * 60 * 1000;
const DAY = 24 * H;

function makeScheduler(strategy?: RoomSelectionStrategy) {
  let now = 0;
  const s = new MeetingScheduler({
    rooms: [
      { id: 'BIG', capacity: 20 },
      { id: 'MID', capacity: 8 },
      { id: 'SMALL', capacity: 4 },
    ],
    strategy,
    clock: () => now,
  });
  return { s, advance: (ms: number) => (now += ms) };
}

const meet = (start: number, end: number, attendees = 2) => ({ title: 'Sync', start, end, attendees });

describe('21 · Meeting Room Scheduler', () => {
  describe('interval logic', () => {
    it('treats intervals as half-open', () => {
      expect(overlaps({ start: 10, end: 11 }, { start: 11, end: 12 })).toBe(false);
      expect(overlaps({ start: 10, end: 12 }, { start: 11, end: 13 })).toBe(true);
      expect(overlaps({ start: 10, end: 14 }, { start: 11, end: 12 })).toBe(true); // contains
      expect(overlaps({ start: 11, end: 12 }, { start: 10, end: 14 })).toBe(true); // inside
    });
  });

  describe('book and cancel', () => {
    it('books a room and lists bookings sorted by start', () => {
      const { s } = makeScheduler();
      s.book('MID', meet(14 * H, 15 * H));
      const b = s.book('MID', meet(9 * H, 10 * H));
      expect(b).toMatchObject({ roomId: 'MID', start: 9 * H, end: 10 * H, seriesId: null });
      expect(s.bookingsFor('MID').map((x) => x.start)).toEqual([9 * H, 14 * H]);
    });

    it('rejects overlaps but allows back-to-back meetings', () => {
      const { s } = makeScheduler();
      s.book('MID', meet(10 * H, 11 * H));
      expect(() => s.book('MID', meet(10.5 * H, 11.5 * H))).toThrow();
      expect(() => s.book('MID', meet(9 * H, 12 * H))).toThrow();
      expect(() => s.book('MID', meet(11 * H, 12 * H))).not.toThrow();
      expect(() => s.book('MID', meet(9 * H, 10 * H))).not.toThrow();
      expect(() => s.book('SMALL', meet(10 * H, 11 * H))).not.toThrow(); // other room is fine
    });

    it('rejects bad intervals, past slots, too many people and unknown rooms', () => {
      const { s, advance } = makeScheduler();
      expect(() => s.book('MID', meet(11 * H, 11 * H))).toThrow();
      expect(() => s.book('MID', meet(12 * H, 11 * H))).toThrow();
      expect(() => s.book('SMALL', meet(10 * H, 11 * H, 5))).toThrow();
      expect(() => s.book('NOPE', meet(10 * H, 11 * H))).toThrow();
      advance(10 * H);
      expect(() => s.book('MID', meet(9 * H, 11 * H))).toThrow(/past/);
    });

    it('frees the slot on cancel and rejects unknown or repeated cancels', () => {
      const { s } = makeScheduler();
      const b = s.book('MID', meet(10 * H, 11 * H));
      s.cancel(b.id);
      expect(s.bookingsFor('MID')).toEqual([]);
      expect(() => s.book('MID', meet(10 * H, 11 * H))).not.toThrow();
      expect(() => s.cancel(b.id)).toThrow();
      expect(() => s.cancel('B999')).toThrow();
    });
  });

  describe('finding rooms', () => {
    it('finds free rooms with enough capacity, smallest first', () => {
      const { s } = makeScheduler();
      s.book('SMALL', meet(10 * H, 11 * H));
      expect(s.findFreeRooms({ start: 10.5 * H, end: 12 * H }, 3).map((r) => r.id)).toEqual(['MID', 'BIG']);
      expect(s.findFreeRooms({ start: 11 * H, end: 12 * H }, 3).map((r) => r.id)).toEqual(['SMALL', 'MID', 'BIG']);
      expect(s.findFreeRooms({ start: 9 * H, end: 10 * H }, 50)).toEqual([]);
    });

    it('bookAny picks the smallest room that fits, and throws when none is free', () => {
      const { s } = makeScheduler();
      expect(s.bookAny(meet(10 * H, 11 * H, 6)).roomId).toBe('MID');
      expect(s.bookAny(meet(10 * H, 11 * H, 6)).roomId).toBe('BIG');
      expect(() => s.bookAny(meet(10 * H, 11 * H, 6))).toThrow();
      expect(s.bookAny(meet(10 * H, 11 * H, 2)).roomId).toBe('SMALL');
    });

    it('lists the free gaps of a room inside a window', () => {
      const { s } = makeScheduler();
      s.book('MID', meet(8 * H, 10 * H)); // starts before the window
      s.book('MID', meet(12 * H, 13 * H));
      s.book('MID', meet(13 * H, 14 * H)); // back-to-back: no gap between them
      expect(s.freeSlots('MID', { start: 9 * H, end: 18 * H })).toEqual([
        { start: 10 * H, end: 12 * H },
        { start: 14 * H, end: 18 * H },
      ]);
      expect(s.freeSlots('BIG', { start: 9 * H, end: 18 * H })).toEqual([{ start: 9 * H, end: 18 * H }]);
    });
  });

  describe('recurring meetings (extension)', () => {
    it('books every occurrence or none', () => {
      const { s } = makeScheduler();
      s.book('MID', meet(2 * DAY + 10 * H, 2 * DAY + 11 * H)); // clashes with the 3rd occurrence
      const req = { ...meet(10 * H, 11 * H), roomId: 'MID', everyMs: DAY, count: 5 };
      expect(() => s.bookRecurring(req)).toThrow();
      expect(s.bookingsFor('MID')).toHaveLength(1);

      const series = s.bookRecurring({ ...req, roomId: 'BIG' });
      expect(series.map((b) => b.start)).toEqual([0, 1, 2, 3, 4].map((d) => d * DAY + 10 * H));
      expect(new Set(series.map((b) => b.seriesId)).size).toBe(1);
    });

    it('cancelSeries removes only the occurrences that have not started', () => {
      const { s, advance } = makeScheduler();
      const series = s.bookRecurring({ ...meet(10 * H, 11 * H), roomId: 'MID', everyMs: DAY, count: 3 });
      advance(DAY + 12 * H); // the first two have started
      expect(s.cancelSeries(series[0].seriesId!)).toBe(1);
      expect(s.bookingsFor('MID')).toHaveLength(2);
    });
  });

  describe('extensibility', () => {
    it('accepts any RoomSelectionStrategy (Open/Closed)', () => {
      const largest: RoomSelectionStrategy = {
        choose: (rooms) => [...rooms].sort((a, b) => b.capacity - a.capacity)[0],
      };
      const { s } = makeScheduler(largest);
      expect(s.bookAny(meet(10 * H, 11 * H, 2)).roomId).toBe('BIG');
      const never: RoomSelectionStrategy = { choose: () => undefined };
      expect(() => makeScheduler(never).s.bookAny(meet(10 * H, 11 * H))).toThrow();
    });
  });
});
