// 07 · Tic-Tac-Toe: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/07-tic-tac-toe

export type Player = 'X' | 'O';
export type Cell = Player | null;
export type GameStatus = 'IN_PROGRESS' | 'X_WON' | 'O_WON' | 'DRAW';

export interface WinChecker {
  /** Called once after each legal move. Returns true if this move wins. */
  recordMove(row: number, col: number, player: Player): boolean;
}

export type WinCheckerFactory = (size: number) => WinChecker;

export interface GameOptions {
  size?: number; // default 3
  first?: Player; // default 'X'
  winChecker?: WinCheckerFactory; // default: LineCounterWinChecker
}

// Must be O(1) per move. Do not scan the board.
export class LineCounterWinChecker implements WinChecker {
  constructor(n: number) {
    // TODO
  }

  recordMove(row: number, col: number, player: Player): boolean {
    throw new Error('TODO');
  }
}

export class TicTacToe {
  readonly size: number = 0;

  constructor(options: GameOptions = {}) {
    // TODO: validate size, build the board, create the win checker
  }

  get status(): GameStatus {
    throw new Error('TODO');
  }

  get currentPlayer(): Player {
    throw new Error('TODO');
  }

  cell(row: number, col: number): Cell {
    throw new Error('TODO');
  }

  /** A copy, so callers cannot change the board behind the game's back. */
  board(): Cell[][] {
    throw new Error('TODO');
  }

  move(row: number, col: number): GameStatus {
    throw new Error('TODO');
  }
}
