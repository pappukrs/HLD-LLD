// 07 · Tic-Tac-Toe: reference solution.
// Read this only after your own attempt passes (or after 45 minutes).

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

// O(1) per move: one counter per row, per column and per diagonal.
// X adds +1, O adds -1. A line is won when |counter| reaches n.
// Works because a line with both X and O can never reach ±n.
export class LineCounterWinChecker implements WinChecker {
  private readonly rows: number[];
  private readonly cols: number[];
  private diag = 0;
  private anti = 0;

  constructor(private readonly n: number) {
    this.rows = new Array<number>(n).fill(0);
    this.cols = new Array<number>(n).fill(0);
  }

  recordMove(row: number, col: number, player: Player): boolean {
    const d = player === 'X' ? 1 : -1;
    this.rows[row] += d;
    this.cols[col] += d;
    if (row === col) this.diag += d;
    if (row + col === this.n - 1) this.anti += d;
    return [this.rows[row], this.cols[col], this.diag, this.anti].some((v) => Math.abs(v) === this.n);
  }
}

export class TicTacToe {
  readonly size: number;
  private readonly grid: Cell[][];
  private readonly checker: WinChecker;
  private turn: Player;
  private moveCount = 0;
  private _status: GameStatus = 'IN_PROGRESS';

  constructor(options: GameOptions = {}) {
    const size = options.size ?? 3;
    if (!Number.isInteger(size) || size < 3) throw new Error('Board size must be an integer >= 3');
    this.size = size;
    this.grid = Array.from({ length: size }, () => new Array<Cell>(size).fill(null));
    this.checker = (options.winChecker ?? ((n) => new LineCounterWinChecker(n)))(size);
    this.turn = options.first ?? 'X';
  }

  get status(): GameStatus {
    return this._status;
  }

  get currentPlayer(): Player {
    return this.turn;
  }

  cell(row: number, col: number): Cell {
    this.assertInside(row, col);
    return this.grid[row][col];
  }

  /** A copy, so callers cannot change the board behind the game's back. */
  board(): Cell[][] {
    return this.grid.map((r) => [...r]);
  }

  move(row: number, col: number): GameStatus {
    if (this._status !== 'IN_PROGRESS') throw new Error('Game is over');
    this.assertInside(row, col);
    if (this.grid[row][col] !== null) throw new Error(`Cell (${row}, ${col}) is taken`);

    const player = this.turn;
    this.grid[row][col] = player;
    this.moveCount++;

    // Check the win before the draw: the last move can fill the board and win.
    if (this.checker.recordMove(row, col, player)) this._status = player === 'X' ? 'X_WON' : 'O_WON';
    else if (this.moveCount === this.size * this.size) this._status = 'DRAW';
    else this.turn = player === 'X' ? 'O' : 'X';
    return this._status;
  }

  private assertInside(row: number, col: number): void {
    const ok = (v: number) => Number.isInteger(v) && v >= 0 && v < this.size;
    if (!ok(row) || !ok(col)) throw new Error(`(${row}, ${col}) is outside the board`);
  }
}
