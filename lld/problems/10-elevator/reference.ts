// 10 · Elevator System: reference solution.
// Read this only after your own attempt passes (or after 90 minutes).

export type Direction = 'UP' | 'DOWN';
export type ElevatorState = 'IDLE' | 'MOVING_UP' | 'MOVING_DOWN' | 'DOORS_OPEN';

export interface ElevatorStatus {
  readonly id: number;
  readonly floor: number;
  readonly state: ElevatorState;
  /** The direction the elevator is committed to. null when it has no stops. */
  readonly direction: Direction | null;
  /** Pending stops, sorted ascending. */
  readonly stops: readonly number[];
}

export interface DispatchStrategy {
  /** Return the id of the elevator that should serve a hall call. */
  choose(elevators: readonly ElevatorStatus[], floor: number, direction: Direction): number;
}

export interface ElevatorSystemConfig {
  /** Number of floors. Valid floors are 0 .. floors - 1. */
  floors: number;
  elevators: number;
  /** Start floor of each elevator. Default: all at floor 0. */
  startFloors?: number[];
  dispatch?: DispatchStrategy;
}

// Cost = floors the car must travel before it reaches the call.
// A car already moving toward the call, in the call's direction, picks it up on the way.
// Any other moving car must first reach its turning point.
export class NearestCarDispatch implements DispatchStrategy {
  choose(elevators: readonly ElevatorStatus[], floor: number, direction: Direction): number {
    let best = elevators[0];
    let bestCost = Infinity;
    for (const e of elevators) {
      const cost = this.cost(e, floor, direction);
      if (cost < bestCost) {
        best = e;
        bestCost = cost;
      }
    }
    return best.id;
  }

  private cost(e: ElevatorStatus, floor: number, direction: Direction): number {
    const distance = Math.abs(e.floor - floor);
    if (e.direction === null) return distance;

    const ahead = e.direction === 'UP' ? floor >= e.floor : floor <= e.floor;
    if (ahead && e.direction === direction) return distance;

    const turn = e.direction === 'UP' ? Math.max(e.floor, ...e.stops) : Math.min(e.floor, ...e.stops);
    return Math.abs(turn - e.floor) + Math.abs(turn - floor);
  }
}

class Elevator {
  state: ElevatorState = 'IDLE';
  direction: Direction | null = null;
  private readonly stops = new Set<number>();

  constructor(readonly id: number, public floor: number) {}

  addStop(floor: number): void {
    // The doors are already open here, so the request is served.
    if (floor === this.floor && this.state === 'DOORS_OPEN') return;
    this.stops.add(floor);
    if (this.direction === null) this.direction = this.nextDirection();
  }

  // One action per tick: open the doors at a stop, or move one floor.
  // Open doors close at the start of the next tick.
  step(): void {
    if (this.stops.has(this.floor)) {
      this.stops.delete(this.floor);
      this.state = 'DOORS_OPEN';
      this.direction = this.nextDirection();
      return;
    }

    const dir = this.nextDirection();
    this.direction = dir;
    if (dir === null) {
      this.state = 'IDLE';
      return;
    }
    this.floor += dir === 'UP' ? 1 : -1;
    this.state = dir === 'UP' ? 'MOVING_UP' : 'MOVING_DOWN';
  }

  // LOOK: keep going while there are stops ahead, then reverse.
  // Unlike SCAN, it never travels to the end floor without a reason.
  private nextDirection(): Direction | null {
    if (this.stops.size === 0) return null;
    const stops = [...this.stops];
    const above = stops.some((s) => s > this.floor);
    const below = stops.some((s) => s < this.floor);

    if (this.direction === 'UP' && above) return 'UP';
    if (this.direction === 'DOWN' && below) return 'DOWN';
    if (above && !below) return 'UP';
    if (below && !above) return 'DOWN';
    if (!above && !below) return this.direction; // only stop is the current floor

    // Stops on both sides and no committed direction: go to the nearest (tie: UP).
    const nearestUp = Math.min(...stops.filter((s) => s > this.floor)) - this.floor;
    const nearestDown = this.floor - Math.max(...stops.filter((s) => s < this.floor));
    return nearestUp <= nearestDown ? 'UP' : 'DOWN';
  }

  snapshot(): ElevatorStatus {
    return {
      id: this.id,
      floor: this.floor,
      state: this.state,
      direction: this.direction,
      stops: [...this.stops].sort((a, b) => a - b),
    };
  }
}

export class ElevatorSystem {
  private readonly floors: number;
  private readonly cars: Elevator[];
  private readonly dispatch: DispatchStrategy;

  constructor(config: ElevatorSystemConfig) {
    if (config.floors < 2) throw new Error('Need at least 2 floors');
    if (config.elevators < 1) throw new Error('Need at least 1 elevator');
    this.floors = config.floors;
    this.dispatch = config.dispatch ?? new NearestCarDispatch();
    this.cars = Array.from({ length: config.elevators }, (_, i) => {
      const start = config.startFloors?.[i] ?? 0;
      this.assertFloor(start);
      return new Elevator(i, start);
    });
  }

  /** Hall call: someone on `floor` pressed UP or DOWN. Returns the chosen elevator id. */
  call(floor: number, direction: Direction): number {
    this.assertFloor(floor);
    if (direction === 'DOWN' && floor === 0) throw new Error('No floor below 0');
    if (direction === 'UP' && floor === this.floors - 1) throw new Error('No floor above the top');

    const id = this.dispatch.choose(this.status(), floor, direction);
    this.car(id).addStop(floor);
    return id;
  }

  /** Cabin request: someone inside elevator `elevatorId` pressed `floor`. */
  selectFloor(elevatorId: number, floor: number): void {
    this.assertFloor(floor);
    this.car(elevatorId).addStop(floor);
  }

  step(): void {
    for (const car of this.cars) car.step();
  }

  status(): ElevatorStatus[] {
    return this.cars.map((c) => c.snapshot());
  }

  private car(id: number): Elevator {
    const car = this.cars[id];
    if (!car) throw new Error(`Unknown elevator ${id}`);
    return car;
  }

  private assertFloor(floor: number): void {
    if (!Number.isInteger(floor) || floor < 0 || floor >= this.floors) {
      throw new Error(`Invalid floor ${floor}`);
    }
  }
}
