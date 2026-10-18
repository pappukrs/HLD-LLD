// 08 · Snake and Ladder: reference solution.
// Read this only after your own attempt passes (or after 60 minutes).

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

// Randomness is injected, so a test can pass a fixed sequence.
export class StandardDice implements Dice {
  constructor(private readonly faces = 6, private readonly random: () => number = Math.random) {
    if (!Number.isInteger(faces) || faces < 1) throw new Error('Dice needs at least 1 face');
  }

  roll(): number {
    return 1 + Math.floor(this.random() * this.faces);
  }
}

interface Jump {
  to: number;
  kind: JumpKind;
}

export class Game {
  private readonly positions = new Map<string, number>();
  private turnIndex = 0;
  private _winner: string | null = null;

  /** Use GameBuilder. It validates the board before a Game exists. */
  constructor(
    private readonly size: number,
    private readonly jumps: ReadonlyMap<number, Jump>,
    private readonly players: readonly string[],
    private readonly dice: Dice,
  ) {
    for (const p of players) this.positions.set(p, 0); // 0 = not on the board yet
  }

  get winner(): string | null {
    return this._winner;
  }

  get currentPlayer(): string {
    return this.players[this.turnIndex];
  }

  position(player: string): number {
    const pos = this.positions.get(player);
    if (pos === undefined) throw new Error(`Unknown player ${player}`);
    return pos;
  }

  playTurn(): TurnResult {
    if (this._winner) throw new Error(`Game is over. ${this._winner} won`);
    const player = this.currentPlayer;
    const roll = this.dice.roll();
    if (!Number.isInteger(roll) || roll < 1) throw new Error(`Dice returned an invalid value ${roll}`);

    const from = this.positions.get(player)!;
    let to = from + roll;
    let jump: JumpKind | null = null;
    if (to > this.size) {
      to = from; // must land exactly on the last cell
    } else {
      const j = this.jumps.get(to);
      if (j) {
        to = j.to; // one jump per move: the builder forbids chains
        jump = j.kind;
      }
    }

    this.positions.set(player, to);
    const won = to === this.size;
    if (won) this._winner = player;
    else this.turnIndex = (this.turnIndex + 1) % this.players.length;
    return { player, roll, from, to, jump, won };
  }

  /** Plays until someone wins. The limit stops an endless loop with a bad dice. */
  play(maxTurns = 100_000): string {
    for (let i = 0; i < maxTurns && !this._winner; i++) this.playTurn();
    if (!this._winner) throw new Error(`No winner after ${maxTurns} turns`);
    return this._winner;
  }
}

// Builder: many optional parts, validated once in build().
export class GameBuilder {
  private size = 100;
  private readonly snakes: [number, number][] = [];
  private readonly ladders: [number, number][] = [];
  private readonly players: string[] = [];
  private dice: Dice = new StandardDice();

  boardSize(size: number): this {
    this.size = size;
    return this;
  }

  addSnake(head: number, tail: number): this {
    this.snakes.push([head, tail]);
    return this;
  }

  addLadder(bottom: number, top: number): this {
    this.ladders.push([bottom, top]);
    return this;
  }

  addPlayer(name: string): this {
    this.players.push(name);
    return this;
  }

  withDice(dice: Dice): this {
    this.dice = dice;
    return this;
  }

  build(): Game {
    const { size } = this;
    if (!Number.isInteger(size) || size < 2) throw new Error('Board size must be an integer >= 2');
    if (this.players.length < 2) throw new Error('Need at least 2 players');
    if (new Set(this.players).size !== this.players.length) throw new Error('Player names must be unique');

    const inside = (c: number) => Number.isInteger(c) && c >= 1 && c <= size;
    const jumps = new Map<number, Jump>();
    const add = (from: number, to: number, kind: JumpKind) => {
      if (!inside(from) || !inside(to)) throw new Error(`${kind} ${from}->${to} is outside the board`);
      if (from === size) throw new Error(`A ${kind} cannot start on the last cell`);
      if (jumps.has(from)) throw new Error(`Cell ${from} already starts a snake or ladder`);
      jumps.set(from, { to, kind });
    };
    for (const [head, tail] of this.snakes) {
      if (tail >= head) throw new Error(`Snake ${head}->${tail} must go down`);
      add(head, tail, 'SNAKE');
    }
    for (const [bottom, top] of this.ladders) {
      if (top <= bottom) throw new Error(`Ladder ${bottom}->${top} must go up`);
      add(bottom, top, 'LADDER');
    }
    // No chains: a jump may not end where another jump starts. Keeps one jump per move.
    for (const [from, j] of jumps) {
      if (jumps.has(j.to)) throw new Error(`Jump ${from}->${j.to} ends on the start of another jump`);
    }
    return new Game(size, jumps, [...this.players], this.dice);
  }
}
