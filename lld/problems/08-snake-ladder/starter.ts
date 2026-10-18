// 08 · Snake and Ladder: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/08-snake-ladder

export interface Dice {
  roll(): number;
}

export type JumpKind = 'SNAKE' | 'LADDER';

export interface TurnResult {
  readonly player: string;
  readonly roll: number;
  readonly from: number;
  readonly to: number;
  readonly jump: JumpKind | null;
  readonly won: boolean;
}

export class StandardDice implements Dice {
  constructor(faces = 6, random: () => number = Math.random) {
    // TODO: validate faces
  }

  roll(): number {
    throw new Error('TODO: 1..faces from random()');
  }
}

export class Game {
  /** Use GameBuilder. It validates the board before a Game exists. */
  constructor(
    size: number,
    jumps: ReadonlyMap<number, { to: number; kind: JumpKind }>, // start cell -> jump
    players: readonly string[],
    dice: Dice,
  ) {
    // TODO: everyone starts at 0 (not on the board yet)
  }

  get winner(): string | null {
    throw new Error('TODO');
  }

  get currentPlayer(): string {
    throw new Error('TODO');
  }

  position(player: string): number {
    throw new Error('TODO');
  }

  playTurn(): TurnResult {
    throw new Error('TODO: roll, move, overshoot stays, apply one jump, check win, next player');
  }

  /** Plays until someone wins. Throws after maxTurns. */
  play(maxTurns = 100_000): string {
    throw new Error('TODO');
  }
}

export class GameBuilder {
  boardSize(size: number): this {
    throw new Error('TODO');
  }

  addSnake(head: number, tail: number): this {
    throw new Error('TODO');
  }

  addLadder(bottom: number, top: number): this {
    throw new Error('TODO');
  }

  addPlayer(name: string): this {
    throw new Error('TODO');
  }

  withDice(dice: Dice): this {
    throw new Error('TODO');
  }

  build(): Game {
    throw new Error('TODO: validate everything here, then create the Game');
  }
}
