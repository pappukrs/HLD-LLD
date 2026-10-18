// 10 · Elevator System: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/10-elevator

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

export class NearestCarDispatch implements DispatchStrategy {
  choose(elevators: readonly ElevatorStatus[], floor: number, direction: Direction): number {
    throw new Error('TODO: lowest travel cost wins; tie goes to the lowest id');
  }
}

export class ElevatorSystem {
  constructor(config: ElevatorSystemConfig) {
    // TODO: create the elevators, keep the dispatch strategy
  }

  call(floor: number, direction: Direction): number {
    throw new Error('TODO: validate, ask the dispatch strategy, add the stop');
  }

  selectFloor(elevatorId: number, floor: number): void {
    throw new Error('TODO');
  }

  step(): void {
    throw new Error('TODO: each elevator opens its doors or moves one floor');
  }

  status(): ElevatorStatus[] {
    throw new Error('TODO');
  }
}
