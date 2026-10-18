import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { BookingService, InMemorySeatStore, Mutex } = (process.env.REF ? reference : starter) as typeof reference;

const MIN = 60 * 1000;
const SEATS = ['A1', 'A2', 'A3', 'B1', 'B2'];

async function setup(config: Partial<reference.BookingConfig> = {}) {
  let now = 0;
  const svc = new BookingService({ clock: () => now, holdTtlMs: 5 * MIN, ...config });
  await svc.addShow({ id: 'S1', movie: 'Interstellar', seats: SEATS, price: 200 });
  return { svc, advance: (ms: number) => (now += ms) };
}

describe('13 · BookMyShow', () => {
  describe('hold and confirm', () => {
    it('holds seats, then confirms them into a booking', async () => {
      const { svc } = await setup();
      const hold = await svc.holdSeats('S1', 'u1', ['A1', 'A2']);
      expect(hold).toMatchObject({ showId: 'S1', userId: 'u1', seats: ['A1', 'A2'], expiresAt: 5 * MIN });
      expect(await svc.seatStatus('S1', 'A1')).toBe('HELD');

      const booking = await svc.confirm(hold.id);
      expect(booking).toMatchObject({ showId: 'S1', userId: 'u1', seats: ['A1', 'A2'], amount: 400 });
      expect(await svc.seatStatus('S1', 'A1')).toBe('BOOKED');
      expect(await svc.availableSeats('S1')).toEqual(['A3', 'B1', 'B2']);
    });

    it('does not let a second user hold a held or booked seat', async () => {
      const { svc } = await setup();
      const hold = await svc.holdSeats('S1', 'u1', ['A1']);
      await expect(svc.holdSeats('S1', 'u2', ['A1'])).rejects.toThrow();
      await svc.confirm(hold.id);
      await expect(svc.holdSeats('S1', 'u2', ['A1'])).rejects.toThrow();
    });

    it('is all-or-nothing: one taken seat fails the whole request', async () => {
      const { svc } = await setup();
      await svc.holdSeats('S1', 'u1', ['A2']);
      await expect(svc.holdSeats('S1', 'u2', ['A1', 'A2', 'A3'])).rejects.toThrow();
      expect(await svc.seatStatus('S1', 'A1')).toBe('AVAILABLE');
      expect(await svc.seatStatus('S1', 'A3')).toBe('AVAILABLE');
    });

    it('release frees the seats, and the hold cannot be used again', async () => {
      const { svc } = await setup();
      const hold = await svc.holdSeats('S1', 'u1', ['B1', 'B2']);
      await svc.release(hold.id);
      expect(await svc.seatStatus('S1', 'B1')).toBe('AVAILABLE');
      await expect(svc.confirm(hold.id)).rejects.toThrow();
    });

    it('rejects bad input: unknown show or seat, empty or duplicate seats', async () => {
      const { svc } = await setup();
      await expect(svc.holdSeats('S9', 'u1', ['A1'])).rejects.toThrow();
      await expect(svc.holdSeats('S1', 'u1', ['Z9'])).rejects.toThrow();
      await expect(svc.holdSeats('S1', 'u1', [])).rejects.toThrow();
      await expect(svc.holdSeats('S1', 'u1', ['A1', 'A1'])).rejects.toThrow();
      await expect(svc.confirm('H999')).rejects.toThrow();
    });
  });

  describe('hold expiry (injected clock)', () => {
    it('frees a held seat once the TTL passes', async () => {
      const { svc, advance } = await setup();
      await svc.holdSeats('S1', 'u1', ['A1']);
      advance(5 * MIN - 1);
      expect(await svc.seatStatus('S1', 'A1')).toBe('HELD');
      advance(1); // exactly at expiresAt → expired
      expect(await svc.seatStatus('S1', 'A1')).toBe('AVAILABLE');
      await expect(svc.holdSeats('S1', 'u2', ['A1'])).resolves.toMatchObject({ userId: 'u2' });
    });

    it('rejects a confirm after expiry', async () => {
      const { svc, advance } = await setup();
      const hold = await svc.holdSeats('S1', 'u1', ['A1']);
      advance(6 * MIN);
      await expect(svc.confirm(hold.id)).rejects.toThrow();
      expect(await svc.seatStatus('S1', 'A1')).toBe('AVAILABLE');
    });

    it("an expired hold cannot release or steal another user's new hold", async () => {
      const { svc, advance } = await setup();
      const old = await svc.holdSeats('S1', 'u1', ['A1']);
      advance(6 * MIN);
      const fresh = await svc.holdSeats('S1', 'u2', ['A1']);
      await svc.release(old.id); // must not free u2's seat
      expect(await svc.seatStatus('S1', 'A1')).toBe('HELD');
      expect((await svc.confirm(fresh.id)).userId).toBe('u2');
    });
  });

  describe('concurrency', () => {
    it('why the lock matters: check-then-write over an async store double-books', async () => {
      const store = new InMemorySeatStore();
      await store.set('S', 'A1', { status: 'AVAILABLE' });
      const naiveHold = async (user: string) => {
        const rec = await store.get('S', 'A1');
        if (rec?.status !== 'AVAILABLE') throw new Error('taken');
        await store.set('S', 'A1', { status: 'BOOKED', bookingId: user, userId: user });
      };
      const naive = await Promise.allSettled([naiveHold('u1'), naiveHold('u2')]);
      expect(naive.filter((r) => r.status === 'fulfilled')).toHaveLength(2); // both "won": the bug

      await store.set('S', 'A1', { status: 'AVAILABLE' });
      const mutex = new Mutex();
      const locked = await Promise.allSettled([
        mutex.runExclusive(() => naiveHold('u1')),
        mutex.runExclusive(() => naiveHold('u2')),
      ]);
      expect(locked.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });

    it('10 users racing for the same seat: exactly one wins', async () => {
      const { svc } = await setup();
      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) => svc.holdSeats('S1', `u${i}`, ['A1'])),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });

    it('overlapping seat sets racing: exactly one wins, no seat is shared', async () => {
      const { svc } = await setup();
      const results = await Promise.allSettled([
        svc.holdSeats('S1', 'u1', ['A1', 'A2']),
        svc.holdSeats('S1', 'u2', ['A2', 'A3']),
        svc.holdSeats('S1', 'u3', ['B1']),
      ]);
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
      expect(await svc.availableSeats('S1')).toEqual(['A3', 'B2']);
    });

    it('Mutex runs critical sections one at a time, in arrival order', async () => {
      const mutex = new Mutex();
      const log: string[] = [];
      const task = (name: string) =>
        mutex.runExclusive(async () => {
          log.push(`${name}:start`);
          await Promise.resolve();
          await Promise.resolve();
          log.push(`${name}:end`);
        });
      await Promise.all([task('a'), task('b'), task('c')]);
      expect(log).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
    });
  });

  describe('extensibility', () => {
    it('accepts any PricingStrategy', async () => {
      const rowAPremium = {
        price: (show: { price: number }, seats: readonly string[]) =>
          seats.reduce((sum, s) => sum + (s.startsWith('A') ? show.price * 1.5 : show.price), 0),
      };
      const { svc } = await setup({ pricing: rowAPremium });
      const hold = await svc.holdSeats('S1', 'u1', ['A1', 'B1']);
      expect((await svc.confirm(hold.id)).amount).toBe(500);
    });
  });
});
