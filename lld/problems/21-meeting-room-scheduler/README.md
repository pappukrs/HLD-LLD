# 21 · Meeting Room Scheduler

> Asked at: Atlassian, Microsoft, Google, Uber, Flipkart. A favourite for interval logic.
> Time box: **75 min** (10 min design, 50 min code, 15 min tests and extensions)
> Patterns you should reach for: **Strategy** (which free room to pick), **interval logic** (half-open overlap check, sorted bookings)

## Problem statement (as the interviewer says it)

"Design a meeting room booking system for an office. There are N rooms with different capacities.
People book a room for a time slot and can cancel. Two meetings must never overlap in the same room.
If someone does not care which room, find them a free one."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| How is time given? | Epoch milliseconds (`number`). No time zones inside the scheduler |
| Is the end time inside the meeting? | No. Intervals are **half-open** `[start, end)`. A 10:00 end and a 10:00 start do not clash |
| Valid slot? | `start < end` and `start` is not in the past (by the injected clock) |
| Capacity? | `attendees` must be ≤ the room's capacity |
| Book any room: which one? | A pluggable strategy. Default: the **smallest** room that fits; ties by room id |
| No free room? | Throw |
| Cancel? | By booking id. Unknown or already cancelled → throw |
| Free time of a room? | `freeSlots(roomId, window)` returns the gaps inside the window |
| Recurring meetings? | Extension: `bookRecurring` books all occurrences or none. `cancelSeries` cancels the ones that have not started |
| Invites, calendars, time zones, room equipment? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const s = new MeetingScheduler({
  rooms: [{ id: 'BIG', capacity: 20 }, { id: 'SMALL', capacity: 4 }],
  strategy: new SmallestFitStrategy(),   // optional, this is the default
  clock: () => Date.now(),               // injectable, so tests control time
});

overlaps({ start: 10, end: 11 }, { start: 11, end: 12 });   // → false

const b = s.book('SMALL', { title: 'Sync', start, end, attendees: 3 });   // → Booking
s.bookAny({ title: 'All hands', start, end, attendees: 15 });              // strategy picks the room
s.cancel(b.id);
s.findFreeRooms({ start, end }, 3);           // → Room[], smallest first
s.bookingsFor('SMALL');                       // → Booking[] sorted by start
s.freeSlots('SMALL', { start: dayStart, end: dayEnd });   // → Interval[]

const series = s.bookRecurring({ title: 'Standup', start, end, attendees: 5, roomId: 'BIG', everyMs: DAY, count: 5 });
s.cancelSeries(series[0].seriesId!);          // → number cancelled
```

The internals are **your design**. The tests only use the API above.

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `MeetingScheduler`: the facade. Owns rooms, bookings and the strategy
- `Room`: id, capacity. A plain value
- `Booking`: an immutable record with `seriesId: string | null`
- Per-room list of bookings, **kept sorted by start**. This makes `bookingsFor` and `freeSlots` simple, and allows a binary search later
- `overlaps(a, b) = a.start < b.end && b.start < a.end`. Learn this one line. It covers partial overlap, "contains" and "inside"
- `RoomSelectionStrategy` (interface) → `SmallestFitStrategy`. It gets only rooms that are free and big enough
- Recurring: expand the rule into concrete occurrences, check every one, then insert all. Check first, write after: that is how you get all-or-nothing

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/21-meeting-room-scheduler` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 75 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Faster conflict check.** The list is sorted, so binary-search for the first booking with `end > start` and check only that one. Or use an interval tree: O(log n) per check.
2. **Two people book the last free room at once.** One Node process: the synchronous `book` is safe. In a database: an exclusion constraint on `(room_id, tsrange)` in Postgres, or lock the room row (`SELECT … FOR UPDATE`) and then check.
3. **Minimum meeting rooms needed** (LeetCode 253, often asked as a follow-up). Sort starts and ends, sweep with two pointers or a min-heap of end times.
4. **Real recurrence rules.** "Every weekday", "first Monday of the month", with exceptions for one occurrence. Store the rule (RFC 5545 RRULE style) and expand it into a window on read.
5. **Time zones and daylight saving.** Store UTC instants. Expand recurring rules in the organiser's time zone, or 9:00 moves to 8:00 after a DST change.
6. **Notify attendees** on book and cancel: the Observer pattern.

## Self-check before you call it done

- [ ] One `overlaps` function, used everywhere. No copy-pasted comparisons.
- [ ] Back-to-back meetings work. You tested `end === start`.
- [ ] Time is injected. "Past" means before `clock()`, not before `Date.now()`.
- [ ] A recurring booking with one clash leaves no partial series behind.
- [ ] Room choice lives in a strategy, not in `bookAny`.

## Concepts used

- [Strategy pattern](../../concepts/patterns/p10-strategy.md) · [Machine-coding framework](../../concepts/04-lld-interview-framework.md) · [Concurrency in Node LLD](../../concepts/06-concurrency-in-node.md)
- Related HLD: [Hotel Reservation](../../../hld/problems/23-hotel-booking/)
- Visual: [Strategy + Factory](../../../visuals/v23-strategy-factory.html)
