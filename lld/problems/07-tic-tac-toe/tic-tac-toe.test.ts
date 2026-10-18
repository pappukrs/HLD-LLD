import * as starter from './starter';
import * as reference from './reference';
import type { Player, WinChecker } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { TicTacToe } = (process.env.REF ? reference : starter) as typeof reference;

type Game = InstanceType<typeof TicTacToe>;

function play(game: Game, moves: [number, number][]) {
  let status = game.status;
  for (const [r, c] of moves) status = game.move(r, c);
  return status;
}

describe('07 · Tic-Tac-Toe', () => {
  describe('turns and validation', () => {
    it('starts with X by default and alternates turns', () => {
      const game = new TicTacToe();
      expect(game.currentPlayer).toBe('X');
      game.move(0, 0);
      expect(game.currentPlayer).toBe('O');
      expect(game.cell(0, 0)).toBe('X');
      expect(new TicTacToe({ first: 'O' }).currentPlayer).toBe('O');
    });

    it('rejects a taken cell and keeps the same player to move', () => {
      const game = new TicTacToe();
      game.move(1, 1);
      expect(() => game.move(1, 1)).toThrow();
      expect(game.currentPlayer).toBe('O');
    });

    it('rejects moves outside the board', () => {
      const game = new TicTacToe();
      expect(() => game.move(3, 0)).toThrow();
      expect(() => game.move(0, -1)).toThrow();
      expect(() => game.move(0.5, 1)).toThrow();
    });

    it('rejects a board smaller than 3', () => {
      expect(() => new TicTacToe({ size: 2 })).toThrow();
    });

    it('returns a copy of the board', () => {
      const game = new TicTacToe();
      game.move(0, 0);
      const copy = game.board();
      copy[0][0] = 'O';
      expect(game.cell(0, 0)).toBe('X');
    });
  });

  describe('win and draw', () => {
    it('detects a row win', () => {
      const game = new TicTacToe();
      expect(play(game, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]])).toBe('X_WON');
    });

    it('detects a column win for O', () => {
      const game = new TicTacToe();
      expect(play(game, [[0, 0], [0, 1], [2, 2], [1, 1], [1, 0], [2, 1]])).toBe('O_WON');
    });

    it('detects both diagonals', () => {
      expect(play(new TicTacToe(), [[0, 0], [0, 1], [1, 1], [0, 2], [2, 2]])).toBe('X_WON');
      expect(play(new TicTacToe(), [[0, 2], [0, 0], [1, 1], [0, 1], [2, 0]])).toBe('X_WON');
    });

    it('detects a draw', () => {
      // X O X / X O O / O X X
      const moves: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 1], [1, 0], [1, 2], [2, 1], [2, 0], [2, 2]];
      expect(play(new TicTacToe(), moves)).toBe('DRAW');
    });

    it('calls it a win, not a draw, when the last move fills the board and wins', () => {
      // Final board X O X / O X O / O X X. The 9th move (2,2) completes the main diagonal.
      const moves: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 1], [2, 0], [2, 2]];
      expect(play(new TicTacToe(), moves)).toBe('X_WON');
    });

    it('rejects any move after the game is over', () => {
      const game = new TicTacToe();
      play(game, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]]);
      expect(() => game.move(2, 2)).toThrow();
    });

    it('needs N in a line on an N x N board', () => {
      const game = new TicTacToe({ size: 4 });
      const status = play(game, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]);
      expect(status).toBe('IN_PROGRESS'); // 3 in a row is not enough on 4x4
      expect(game.move(0, 3)).toBe('X_WON');
    });
  });

  describe('extensibility', () => {
    it('accepts any WinChecker, for example a "four corners" variant', () => {
      class FourCorners implements WinChecker {
        private readonly owned = new Map<Player, number>();
        constructor(private readonly n: number) {}
        recordMove(row: number, col: number, player: Player): boolean {
          const corner = (row === 0 || row === this.n - 1) && (col === 0 || col === this.n - 1);
          if (corner) this.owned.set(player, (this.owned.get(player) ?? 0) + 1);
          return this.owned.get(player) === 4;
        }
      }
      const game = new TicTacToe({ winChecker: (n) => new FourCorners(n) });
      const status = play(game, [[0, 0], [1, 1], [0, 2], [0, 1], [2, 0], [1, 0], [2, 2]]);
      expect(status).toBe('X_WON');
    });
  });
});
