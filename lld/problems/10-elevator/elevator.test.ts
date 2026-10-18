import * as starter from './starter';
import * as reference from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { ElevatorSystem } = (process.env.REF ? reference : starter) as typeof reference;
type ElevatorSystemT = InstanceType<typeof ElevatorSystem>;

/** Steps n times and records elevator `id`'s floor after each step. */
function run(sys: ElevatorSystemT, n: number, id = 0): number[] {
  const floors: number[] = [];
  for (let i = 0; i < n; i++) {
    sys.step();
    floors.push(sys.status()[id].floor);
  }
  return floors;
}

describe('10 · Elevator', () => {
  describe('single elevator movement', () => {
    it('moves one floor per step and opens the doors on the next step', () => {
      const sys = new ElevatorSystem({ floors: 10, elevators: 1 });
      sys.call(3, 'DOWN');
      expect(run(sys, 3)).toEqual([1, 2, 3]);
      expect(sys.status()[0].state).toBe('MOVING_UP');
      sys.step();
      expect(sys.status()[0]).toMatchObject({ floor: 3, state: 'DOORS_OPEN', stops: [] });
    });

    it('becomes IDLE after the doors close with no stops left', () => {
      const sys = new ElevatorSystem({ floors: 5, elevators: 1 });
      sys.selectFloor(0, 1);
      run(sys, 3); // move, open, close
      expect(sys.status()[0]).toMatchObject({ floor: 1, state: 'IDLE', direction: null });
    });

    it('serves a request on the current floor by opening the doors', () => {
      const sys = new ElevatorSystem({ floors: 5, elevators: 1, startFloors: [2] });
      sys.call(2, 'UP');
      sys.step();
      expect(sys.status()[0]).toMatchObject({ floor: 2, state: 'DOORS_OPEN' });
    });

    it('stops at floors in travel order, not request order', () => {
      const sys = new ElevatorSystem({ floors: 10, elevators: 1 });
      sys.selectFloor(0, 5);
      sys.selectFloor(0, 2);
      const opened: number[] = [];
      for (let i = 0; i < 10; i++) {
        sys.step();
        const s = sys.status()[0];
        if (s.state === 'DOORS_OPEN') opened.push(s.floor);
      }
      expect(opened).toEqual([2, 5]);
    });

    it('LOOK: finishes stops ahead before reversing', () => {
      const sys = new ElevatorSystem({ floors: 10, elevators: 1 });
      sys.selectFloor(0, 4);
      run(sys, 2); // now at floor 2, going up
      sys.selectFloor(0, 1); // behind the elevator
      // 3, 4, open at 4, 3, 2, 1, open at 1
      expect(run(sys, 7)).toEqual([3, 4, 4, 3, 2, 1, 1]);
    });

    it('LOOK, not SCAN: turns at the last request instead of the top floor', () => {
      const sys = new ElevatorSystem({ floors: 10, elevators: 1, startFloors: [5] });
      sys.selectFloor(0, 7);
      sys.selectFloor(0, 2);
      const trace = run(sys, 12);
      expect(Math.max(...trace)).toBe(7);
      expect(trace.slice(0, 3)).toEqual([6, 7, 7]); // up to 7 first (first request), then open
      expect(trace.at(-1)).toBe(2);
    });

    it('does not add a duplicate stop', () => {
      const sys = new ElevatorSystem({ floors: 10, elevators: 1 });
      sys.selectFloor(0, 4);
      sys.selectFloor(0, 4);
      sys.call(4, 'UP');
      expect(sys.status()[0].stops).toEqual([4]);
    });
  });

  describe('dispatch', () => {
    it('sends the nearest idle elevator', () => {
      const sys = new ElevatorSystem({ floors: 10, elevators: 2, startFloors: [0, 8] });
      expect(sys.call(7, 'DOWN')).toBe(1);
      expect(sys.status()[1].stops).toEqual([7]);
      expect(sys.status()[0].stops).toEqual([]);
    });

    it('prefers an elevator already moving toward the call in the same direction', () => {
      const sys = new ElevatorSystem({ floors: 12, elevators: 2, startFloors: [0, 10] });
      sys.selectFloor(0, 9);
      run(sys, 2); // elevator 0 at floor 2, going up
      expect(sys.call(5, 'UP')).toBe(0);
    });

    it('does not pick an elevator that has already passed the floor', () => {
      const sys = new ElevatorSystem({ floors: 12, elevators: 2, startFloors: [0, 10] });
      sys.selectFloor(0, 9);
      run(sys, 2); // elevator 0 at floor 2, going up to 9
      // Elevator 0 would need 7 floors up + 8 down = 15. Elevator 1 needs 9.
      expect(sys.call(1, 'UP')).toBe(1);
    });
  });

  describe('errors', () => {
    it('rejects invalid floors, impossible directions and unknown elevators', () => {
      const sys = new ElevatorSystem({ floors: 5, elevators: 1 });
      expect(() => sys.call(5, 'DOWN')).toThrow();
      expect(() => sys.call(-1, 'UP')).toThrow();
      expect(() => sys.call(0, 'DOWN')).toThrow();
      expect(() => sys.call(4, 'UP')).toThrow();
      expect(() => sys.selectFloor(3, 2)).toThrow();
      expect(() => sys.selectFloor(0, 7)).toThrow();
    });
  });

  describe('extensibility', () => {
    it('accepts any DispatchStrategy', () => {
      const alwaysLast = { choose: (cars: readonly { id: number }[]) => cars[cars.length - 1].id };
      const sys = new ElevatorSystem({ floors: 10, elevators: 3, dispatch: alwaysLast });
      expect(sys.call(1, 'UP')).toBe(2);
      expect(sys.status()[2].stops).toEqual([1]);
    });
  });
});
