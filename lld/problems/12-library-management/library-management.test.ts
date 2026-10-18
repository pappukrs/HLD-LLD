import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { Library, DAY_MS } = (process.env.REF ? reference : starter) as typeof reference;
type LibraryEvent = reference.LibraryEvent;

const HOUR = 60 * 60 * 1000;

function setup(config: Partial<reference.LibraryConfig> = {}) {
  let now = 0;
  const lib = new Library({ clock: () => now, ...config });
  lib.addBook({ isbn: 'DDIA', title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann' }, 2);
  lib.addBook({ isbn: 'CC', title: 'Clean Code', author: 'Robert Martin' }, 1);
  lib.addBook({ isbn: 'SICP', title: 'Structure and Interpretation', author: 'Abelson' }, 1);
  lib.addBook({ isbn: 'GOF', title: 'Design Patterns', author: 'Gamma' }, 1);
  lib.addMember('m1', 'Asha');
  lib.addMember('m2', 'Ravi');
  lib.addMember('m3', 'Meera');
  const events: LibraryEvent[] = [];
  lib.subscribe((e) => events.push(e));
  return { lib, events, advance: (ms: number) => (now += ms) };
}

describe('12 · Library Management', () => {
  describe('catalogue', () => {
    it('searches title and author, case-insensitive, sorted by title', () => {
      const { lib } = setup();
      expect(lib.search({ author: 'martin' }).map((b) => b.isbn)).toEqual(['CC', 'DDIA']);
      expect(lib.search({ title: 'design', author: 'gamma' }).map((b) => b.isbn)).toEqual(['GOF']);
      expect(lib.search({ title: 'nothing' })).toEqual([]);
    });

    it('adding an existing ISBN adds copies', () => {
      const { lib } = setup();
      lib.addBook({ isbn: 'CC', title: 'Clean Code', author: 'Robert Martin' }, 2);
      expect(lib.search({ title: 'clean' })[0]).toMatchObject({ totalCopies: 3, availableCopies: 3 });
    });
  });

  describe('loans', () => {
    it('checks out a copy with a 14-day due date', () => {
      const { lib } = setup();
      const loan = lib.checkout('m1', 'DDIA');
      expect(loan).toMatchObject({ isbn: 'DDIA', memberId: 'm1', borrowedAt: 0, dueAt: 14 * DAY_MS });
      expect(lib.search({ title: 'data' })[0].availableCopies).toBe(1);
      expect(lib.loansOf('m1')).toHaveLength(1);
    });

    it('rejects a checkout when no copy is free', () => {
      const { lib } = setup();
      lib.checkout('m1', 'CC');
      expect(() => lib.checkout('m2', 'CC')).toThrow();
    });

    it('limits a member to 3 active loans and one copy per title', () => {
      const { lib } = setup();
      lib.checkout('m1', 'DDIA');
      expect(() => lib.checkout('m1', 'DDIA')).toThrow();
      lib.checkout('m1', 'CC');
      lib.checkout('m1', 'SICP');
      expect(() => lib.checkout('m1', 'GOF')).toThrow();
    });

    it('returns on time with no fine and frees the copy', () => {
      const { lib, advance } = setup();
      const loan = lib.checkout('m1', 'CC');
      advance(14 * DAY_MS);
      expect(lib.returnCopy(loan.copyId)).toEqual({ loanId: loan.id, lateDays: 0, fine: 0 });
      expect(lib.search({ title: 'clean' })[0].availableCopies).toBe(1);
      expect(lib.loansOf('m1')).toEqual([]);
    });

    it('charges 10 per late day, rounds partial days up, and blocks borrowing until paid', () => {
      const { lib, advance, events } = setup();
      const loan = lib.checkout('m1', 'CC');
      advance(16 * DAY_MS + HOUR); // 2 days and 1 hour late → 3 days
      expect(lib.returnCopy(loan.copyId)).toMatchObject({ lateDays: 3, fine: 30 });
      expect(events).toContainEqual({ type: 'FINE_CHARGED', memberId: 'm1', amount: 30 });
      expect(lib.finesOf('m1')).toBe(30);
      expect(() => lib.checkout('m1', 'GOF')).toThrow();
      expect(() => lib.payFine('m1', 50)).toThrow();
      lib.payFine('m1', 30);
      expect(() => lib.checkout('m1', 'GOF')).not.toThrow();
    });
  });

  describe('reservations', () => {
    it('rejects a reservation when a copy is free', () => {
      const { lib } = setup();
      expect(() => lib.reserve('m1', 'CC')).toThrow();
    });

    it('holds the returned copy for the first reserver and notifies them', () => {
      const { lib, events } = setup();
      const loan = lib.checkout('m1', 'CC');
      lib.reserve('m2', 'CC');
      lib.returnCopy(loan.copyId);

      expect(events).toContainEqual({ type: 'HOLD_READY', memberId: 'm2', isbn: 'CC', copyId: loan.copyId });
      expect(lib.search({ title: 'clean' })[0].availableCopies).toBe(0);
      expect(() => lib.checkout('m3', 'CC')).toThrow(); // held for m2
      expect(lib.checkout('m2', 'CC').copyId).toBe(loan.copyId);
    });

    it('serves reservations in FIFO order and rejects duplicates', () => {
      const { lib, events } = setup();
      const first = lib.checkout('m1', 'CC');
      lib.reserve('m2', 'CC');
      lib.reserve('m3', 'CC');
      expect(() => lib.reserve('m2', 'CC')).toThrow();
      expect(() => lib.reserve('m1', 'CC')).toThrow(); // already has it

      lib.returnCopy(first.copyId);
      const second = lib.checkout('m2', 'CC');
      lib.returnCopy(second.copyId);
      const ready = events.filter((e) => e.type === 'HOLD_READY').map((e) => e.memberId);
      expect(ready).toEqual(['m2', 'm3']);
    });
  });

  describe('errors', () => {
    it('rejects unknown members, books and copies, and double returns', () => {
      const { lib } = setup();
      expect(() => lib.checkout('nobody', 'CC')).toThrow();
      expect(() => lib.checkout('m1', 'NOPE')).toThrow();
      expect(() => lib.returnCopy('NOPE-1')).toThrow();
      expect(() => lib.addMember('m1', 'Again')).toThrow();
      const loan = lib.checkout('m1', 'CC');
      lib.returnCopy(loan.copyId);
      expect(() => lib.returnCopy(loan.copyId)).toThrow();
    });
  });

  describe('extensibility', () => {
    it('accepts any FinePolicy', () => {
      const capped = { fine: (days: number) => Math.min(days * 10, 50) };
      const { lib, advance } = setup({ finePolicy: capped });
      const loan = lib.checkout('m1', 'CC');
      advance(30 * DAY_MS);
      expect(lib.returnCopy(loan.copyId).fine).toBe(50);
    });

    it('stops notifying a listener after it unsubscribes', () => {
      const { lib } = setup();
      const seen: LibraryEvent[] = [];
      const off = lib.subscribe((e) => seen.push(e));
      off();
      const loan = lib.checkout('m1', 'CC');
      lib.reserve('m2', 'CC');
      lib.returnCopy(loan.copyId);
      expect(seen).toEqual([]);
    });
  });
});
