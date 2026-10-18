import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { RideService, NearestDriverStrategy, DistanceFare } = (process.env.REF ? reference : starter) as typeof reference;
type RideEvent = reference.RideEvent;
type VehicleType = reference.VehicleType;

const at = (x: number, y: number) => ({ x, y });
const request = (riderId: string, vehicle: VehicleType = 'CAR') => ({
  riderId,
  vehicle,
  pickup: at(0, 0),
  drop: at(3, 4), // 5 km
});

function setup(config: reference.RideServiceConfig = {}) {
  const svc = new RideService(config);
  svc.addDriver({ id: 'd1', name: 'Ravi', vehicle: 'CAR', location: at(5, 5) });
  svc.addDriver({ id: 'd2', name: 'Suresh', vehicle: 'CAR', location: at(1, 0) });
  svc.addDriver({ id: 'd3', name: 'Imran', vehicle: 'AUTO', location: at(0, 1) });
  return svc;
}

describe('17 · Ride Sharing', () => {
  describe('matching', () => {
    it('assigns the nearest driver, not the first one added', () => {
      const svc = setup();
      const ride = svc.requestRide(request('r1'));
      expect(ride).toMatchObject({ driverId: 'd2', status: 'ASSIGNED', fare: null });
      expect(svc.getDriver('d2').busy).toBe(true);
    });

    it('skips offline drivers and other vehicle types', () => {
      const svc = setup();
      svc.setOnline('d2', false);
      expect(svc.requestRide(request('r1')).driverId).toBe('d1');
      expect(svc.requestRide(request('r2', 'AUTO')).driverId).toBe('d3');
    });

    it('never double-books a driver', () => {
      const svc = setup();
      const a = svc.requestRide(request('r1'));
      const b = svc.requestRide(request('r2'));
      expect(new Set([a.driverId, b.driverId])).toEqual(new Set(['d1', 'd2']));
      expect(() => svc.requestRide(request('r3'))).toThrow();
    });

    it('throws when no driver fits, and respects a max pickup distance', () => {
      const svc = setup();
      expect(() => svc.requestRide(request('r1', 'BIKE'))).toThrow();

      const near = setup({ matching: new NearestDriverStrategy(1) });
      near.setOnline('d2', false); // d1 is ~7 km away
      expect(() => near.requestRide(request('r1'))).toThrow();
    });

    it('breaks a distance tie by the lower driver id', () => {
      const svc = new RideService();
      svc.addDriver({ id: 'b', name: 'B', vehicle: 'BIKE', location: at(0, 2) });
      svc.addDriver({ id: 'a', name: 'A', vehicle: 'BIKE', location: at(2, 0) });
      expect(svc.requestRide(request('r1', 'BIKE')).driverId).toBe('a');
    });
  });

  describe('ride lifecycle', () => {
    it('start → complete charges the fare and frees the driver at the drop point', () => {
      const svc = setup();
      const ride = svc.requestRide(request('r1'));
      expect(svc.startRide(ride.id).status).toBe('IN_PROGRESS');
      const done = svc.completeRide(ride.id);
      expect(done).toMatchObject({ status: 'COMPLETED', fare: 125 }); // 50 + 15 × 5 km
      expect(svc.getDriver('d2')).toMatchObject({ busy: false, location: at(3, 4) });
    });

    it('rejects invalid transitions', () => {
      const svc = setup();
      const ride = svc.requestRide(request('r1'));
      expect(() => svc.completeRide(ride.id)).toThrow(); // not started
      svc.startRide(ride.id);
      expect(() => svc.startRide(ride.id)).toThrow(); // already started
      expect(() => svc.cancelRide(ride.id)).toThrow(); // trip in progress
      svc.completeRide(ride.id);
      expect(() => svc.completeRide(ride.id)).toThrow();
    });

    it('cancel before start frees the driver; a cancelled ride cannot start', () => {
      const svc = setup();
      const ride = svc.requestRide(request('r1'));
      expect(svc.cancelRide(ride.id).status).toBe('CANCELLED');
      expect(svc.getDriver('d2').busy).toBe(false);
      expect(() => svc.startRide(ride.id)).toThrow();
      expect(svc.requestRide(request('r2')).driverId).toBe('d2');
    });

    it('a rider can have only one active ride', () => {
      const svc = setup();
      const ride = svc.requestRide(request('r1'));
      expect(() => svc.requestRide(request('r1'))).toThrow();
      svc.startRide(ride.id);
      svc.completeRide(ride.id);
      expect(() => svc.requestRide(request('r1'))).not.toThrow();
    });

    it('notifies listeners of each step, in order', () => {
      const svc = setup();
      const events: RideEvent[] = [];
      const off = svc.subscribe((e) => events.push(e));
      const ride = svc.requestRide(request('r1'));
      svc.startRide(ride.id);
      svc.completeRide(ride.id);
      expect(events.map((e) => e.type)).toEqual(['ASSIGNED', 'STARTED', 'COMPLETED']);
      expect(events[0]).toEqual({ type: 'ASSIGNED', rideId: ride.id, riderId: 'r1', driverId: 'd2' });
      off();
      svc.cancelRide(svc.requestRide(request('r2')).id);
      expect(events).toHaveLength(3);
    });
  });

  describe('errors', () => {
    it('rejects unknown rides and drivers, and duplicate driver ids', () => {
      const svc = setup();
      expect(() => svc.startRide('R999')).toThrow();
      expect(() => svc.getRide('R999')).toThrow();
      expect(() => svc.setOnline('nobody', true)).toThrow();
      expect(() => svc.addDriver({ id: 'd1', name: 'X', vehicle: 'CAR', location: at(0, 0) })).toThrow();
    });
  });

  describe('extensibility', () => {
    it('accepts any MatchingStrategy and FareStrategy', () => {
      const farthest = {
        match: (_req: unknown, cands: readonly reference.DriverView[]) =>
          [...cands].sort((a, b) => b.location.x + b.location.y - (a.location.x + a.location.y))[0],
      };
      const base = new DistanceFare();
      const surge = { fare: (v: VehicleType, km: number) => Math.round(base.fare(v, km) * 1.5) };
      const svc = setup({ matching: farthest, fare: surge });
      const ride = svc.requestRide(request('r1'));
      expect(ride.driverId).toBe('d1');
      svc.startRide(ride.id);
      expect(svc.completeRide(ride.id).fare).toBe(188); // round(125 × 1.5)
    });
  });
});
