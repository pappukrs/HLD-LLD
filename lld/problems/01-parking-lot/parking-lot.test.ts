import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { ParkingLot, HourlyPricing } = (process.env.REF ? reference : starter) as typeof reference;

const HOUR = 60 * 60 * 1000;

function makeLot(floors = [{ small: 1, medium: 1, large: 1 }]) {
  let now = 0;
  const lot = new ParkingLot({
    floors,
    pricing: new HourlyPricing({ BIKE: 10, CAR: 20, TRUCK: 50 }),
    clock: () => now,
  });
  return { lot, advance: (ms: number) => (now += ms) };
}

describe('01 · Parking Lot', () => {
  describe('allocation', () => {
    it('gives each vehicle the smallest spot that fits', () => {
      const { lot } = makeLot();
      lot.park('BIKE-1', 'BIKE');
      expect(lot.availableSpots('SMALL')).toBe(0);
      expect(lot.availableSpots('MEDIUM')).toBe(1);
    });

    it('falls back to a bigger spot when the best fit is taken', () => {
      const { lot } = makeLot();
      lot.park('BIKE-1', 'BIKE'); // takes SMALL
      lot.park('BIKE-2', 'BIKE'); // must take MEDIUM
      expect(lot.availableSpots('MEDIUM')).toBe(0);
      expect(lot.availableSpots('LARGE')).toBe(1);
    });

    it('never puts a truck in a small or medium spot', () => {
      const { lot } = makeLot([{ small: 3, medium: 3, large: 0 }]);
      expect(() => lot.park('TRUCK-1', 'TRUCK')).toThrow();
    });

    it('fills the lowest floor first', () => {
      const { lot } = makeLot([{ small: 0, medium: 1, large: 0 }, { small: 0, medium: 1, large: 0 }]);
      expect(lot.park('CAR-1', 'CAR').floor).toBe(0);
      expect(lot.park('CAR-2', 'CAR').floor).toBe(1);
    });

    it('rejects a car when the lot is full', () => {
      const { lot } = makeLot([{ small: 0, medium: 1, large: 0 }]);
      lot.park('CAR-1', 'CAR');
      expect(() => lot.park('CAR-2', 'CAR')).toThrow();
    });

    it('rejects the same plate parking twice', () => {
      const { lot } = makeLot();
      lot.park('KA01', 'CAR');
      expect(() => lot.park('KA01', 'CAR')).toThrow();
    });

    it('never gives two vehicles the same spot', () => {
      const { lot } = makeLot([{ small: 5, medium: 5, large: 5 }]);
      const ids = Array.from({ length: 15 }, (_, i) => lot.park(`V${i}`, 'BIKE').spotId);
      expect(new Set(ids).size).toBe(15);
      expect(lot.availableSpots()).toBe(0);
    });
  });

  describe('unpark and pricing', () => {
    it('frees the spot on unpark', () => {
      const { lot } = makeLot([{ small: 0, medium: 1, large: 0 }]);
      const t = lot.park('CAR-1', 'CAR');
      lot.unpark(t.id);
      expect(lot.availableSpots('MEDIUM')).toBe(1);
      expect(() => lot.park('CAR-2', 'CAR')).not.toThrow();
    });

    it('lets the same plate park again after leaving', () => {
      const { lot } = makeLot();
      lot.unpark(lot.park('KA01', 'CAR').id);
      expect(() => lot.park('KA01', 'CAR')).not.toThrow();
    });

    it('charges a minimum of one hour', () => {
      const { lot, advance } = makeLot();
      const t = lot.park('CAR-1', 'CAR');
      advance(5 * 60 * 1000);
      expect(lot.unpark(t.id).amount).toBe(20);
    });

    it('rounds partial hours up', () => {
      const { lot, advance } = makeLot();
      const t = lot.park('TRUCK-1', 'TRUCK');
      advance(2 * HOUR + 1);
      const r = lot.unpark(t.id);
      expect(r.amount).toBe(150);
      expect(r.ticketId).toBe(t.id);
    });

    it('rejects unknown and already-closed tickets', () => {
      const { lot } = makeLot();
      expect(() => lot.unpark('nope')).toThrow();
      const t = lot.park('CAR-1', 'CAR');
      lot.unpark(t.id);
      expect(() => lot.unpark(t.id)).toThrow();
    });
  });

  describe('extensibility', () => {
    it('accepts any PricingStrategy (Open/Closed)', () => {
      let now = 0;
      const flat = { calculate: () => 99 };
      const lot = new ParkingLot({ floors: [{ small: 1, medium: 1, large: 1 }], pricing: flat, clock: () => now });
      const t = lot.park('X', 'CAR');
      now += 10 * HOUR;
      expect(lot.unpark(t.id).amount).toBe(99);
    });
  });
});
